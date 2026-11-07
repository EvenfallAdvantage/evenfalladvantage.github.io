import { describe, expect, it } from "vitest";
import { writeCompanyInstallCache } from "@/lib/pwa-company-browser";
import { buildCompanyManifest, type InstallMembership } from "@/lib/pwa-company-install";

const ORIGIN = "https://www.evenfalladvantage.com";
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LOGO = `https://abc.supabase.co/storage/v1/object/public/company-logos/${A}/mark.png`;
const V1 = Uint8Array.from([9, 9, 9, 9]);
const V2 = Uint8Array.from([4, 4, 4, 4]);

function membership(): InstallMembership {
  return { companyId: A, companyName: "Northstar Recruitment", companyLogo: LOGO, brandColor: "#102030", status: "active" };
}

function absolute(path: string): string {
  return new URL(path, ORIGIN).toString();
}

function createCache(seed: Map<string, Uint8Array>) {
  const entries = new Map(seed);
  const order: string[] = [];
  let manifestGate: Promise<void> = Promise.resolve();
  let failManifest = false;
  let failOnVersionedPut = 0;
  let versionedPuts = 0;
  return {
    entries,
    order,
    holdManifest() {
      let release = () => {};
      manifestGate = new Promise<void>((resolve) => { release = resolve; });
      return release;
    },
    failBeforeManifest() {
      failManifest = true;
    },
    failOnVersioned(n: number) {
      failOnVersionedPut = n;
    },
    async put(request: string, response: Response) {
      const url = String(request);
      const versioned = url.includes("?");
      if (versioned) {
        versionedPuts += 1;
        if (failOnVersionedPut && versionedPuts === failOnVersionedPut) throw new Error("interrupted");
      }
      if (url.endsWith("/manifest.webmanifest")) {
        await manifestGate;
        if (failManifest) throw new Error("interrupted");
      }
      order.push(url);
      entries.set(url, new Uint8Array(await response.arrayBuffer()));
    },
  };
}

/** Same rule as the service worker: a versioned URL never reads the pathname alias. */
function serve(entries: Map<string, Uint8Array>, path: string): Uint8Array | undefined {
  const url = absolute(path);
  const exact = entries.get(url);
  if (exact) return exact;
  if (new URL(url).search) return undefined;
  return entries.get(url);
}

describe("company icon cache migration", () => {
  const built = buildCompanyManifest([membership()], A, true)!;
  const v1Body = {
    ...built.body,
    icons: built.body.icons.map((icon) => ({ ...icon, src: icon.src.split("?")[0] })),
  };
  const icons = built.icons.map((icon) => ({ path: icon.src, blob: new Blob([V2], { type: "image/png" }) }));

  function seed(): Map<string, Uint8Array> {
    const entries = new Map<string, Uint8Array>();
    entries.set(absolute(built.manifestPath), new TextEncoder().encode(JSON.stringify(v1Body)));
    for (const icon of built.icons) entries.set(absolute(icon.src.split("?")[0]), V1);
    return entries;
  }

  function manifestText(entries: Map<string, Uint8Array>): string {
    const bytes = serve(entries, built.manifestPath);
    return bytes ? new TextDecoder().decode(bytes) : "";
  }

  it("stores every versioned icon before the manifest and the pathname alias after it", async () => {
    const cache = createCache(seed());
    await writeCompanyInstallCache(cache, built, icons, ORIGIN);
    const manifestAt = cache.order.findIndex((url) => url.endsWith("/manifest.webmanifest"));
    expect(manifestAt).toBe(built.icons.length);
    expect(cache.order.slice(0, manifestAt).every((url) => url.includes("?v="))).toBe(true);
    expect(cache.order.slice(manifestAt + 1).every((url) => url.includes("/icon-") && !url.includes("?"))).toBe(true);
    expect(manifestText(cache.entries)).toContain("?v=");
  });

  it("keeps the v1 manifest while two writers are paused, then publishes only with versioned icons", async () => {
    const cache = createCache(seed());
    const release = cache.holdManifest();
    const first = writeCompanyInstallCache(cache, built, icons, ORIGIN);
    const second = writeCompanyInstallCache(cache, built, icons, ORIGIN);
    const same = (left: Uint8Array | undefined, right: Uint8Array) => left?.length === right.length && left.every((byte, index) => byte === right[index]);
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const ready = built.icons.every((icon) => same(serve(cache.entries, icon.src), V2));
      if (ready && !manifestText(cache.entries).includes("?v=")) break;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    expect(manifestText(cache.entries)).not.toContain("?v=");
    for (const icon of built.icons) {
      expect(serve(cache.entries, icon.src)).toEqual(V2);
      expect(serve(cache.entries, icon.src.split("?")[0])).toEqual(V1);
    }
    release();
    await Promise.all([first, second]);
    expect(manifestText(cache.entries)).toContain("?v=");
    for (const icon of built.icons) {
      expect(serve(cache.entries, icon.src)).toEqual(V2);
      expect(serve(cache.entries, icon.src.split("?")[0])).toEqual(V2);
    }
  });

  it("leaves the v1 manifest in place when a versioned icon put is interrupted", async () => {
    const cache = createCache(seed());
    cache.failOnVersioned(2);
    await expect(writeCompanyInstallCache(cache, built, icons, ORIGIN)).rejects.toThrow("interrupted");
    expect(manifestText(cache.entries)).not.toContain("?v=");
    expect(serve(cache.entries, built.icons[0].src)).toEqual(V2);
    expect(serve(cache.entries, built.icons[1].src)).toBeUndefined();
    expect(serve(cache.entries, built.icons[1].src.split("?")[0])).toEqual(V1);
    expect(cache.order.some((url) => url.endsWith("/manifest.webmanifest"))).toBe(false);
  });

  it("does not replace pathname aliases when the manifest put fails", async () => {
    const cache = createCache(seed());
    cache.failBeforeManifest();
    await expect(writeCompanyInstallCache(cache, built, icons, ORIGIN)).rejects.toThrow("interrupted");
    expect(manifestText(cache.entries)).not.toContain("?v=");
    for (const icon of built.icons) {
      expect(serve(cache.entries, icon.src)).toEqual(V2);
      expect(serve(cache.entries, icon.src.split("?")[0])).toEqual(V1);
    }
  });

  it("rejects a manifest whose company icons were not provided", async () => {
    const cache = createCache(seed());
    await expect(writeCompanyInstallCache(cache, built, icons.slice(1), ORIGIN)).rejects.toThrow("company-icons-incomplete");
    expect(cache.order).toEqual([]);
    expect(manifestText(cache.entries)).not.toContain("?v=");
  });
});
