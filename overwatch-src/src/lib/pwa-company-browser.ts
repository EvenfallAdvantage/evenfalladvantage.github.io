import type { BuiltCompanyManifest } from "@/lib/pwa-company-install";
import {
  COMPANY_INSTALL_READY_MS,
  INSTALL_ICON_MESSAGE,
  INSTALL_MANIFEST_MESSAGE,
  INSTALL_TIMEOUT_MESSAGE,
  assessCompanyInstallFetch,
  type FinalizeAssessment,
  type IconProbe,
} from "@/lib/pwa-company-finalize";

type CompanyCachePut = {
  put(request: string, response: Response): Promise<void>;
};

/**
 * Writes one company's install cache.
 * Versioned icon URLs are stored first. The manifest is replaced only after
 * every icon it names is already stored, so another controlled tab cannot
 * read a ?v= revision whose icon is still missing. Pathname aliases are
 * replaced last; a versioned request must not depend on them.
 * Does not open any other cache.
 */
export async function writeCompanyInstallCache(
  cache: CompanyCachePut,
  built: BuiltCompanyManifest,
  icons: { path: string; blob: Blob }[],
  origin: string,
): Promise<void> {
  const prefix = `/overwatch/pwa/${built.companyId}/`;
  const provided = new Map<string, Blob>();
  for (const icon of icons) {
    if (!icon.path.startsWith(prefix)) continue;
    provided.set(icon.path, icon.blob);
  }
  const expected = built.icons.filter((icon) => icon.src.startsWith(prefix));
  if (expected.length !== provided.size || expected.some((icon) => !provided.has(icon.src))) {
    throw new Error("company-icons-incomplete");
  }
  const png = { headers: { "Content-Type": "image/png" } };
  const versioned: { path: string; blob: Blob }[] = [];
  for (const icon of expected) {
    const blob = provided.get(icon.src);
    if (!blob) throw new Error("company-icons-incomplete");
    const stored = new URL(icon.src, origin);
    await cache.put(stored.toString(), new Response(blob, png));
    versioned.push({ path: stored.toString(), blob });
  }
  await cache.put(
    new URL(built.manifestPath, origin).toString(),
    new Response(JSON.stringify(built.body), {
      headers: { "Content-Type": "application/manifest+json" },
    }),
  );
  for (const icon of versioned) {
    const alias = new URL(icon.path);
    if (!alias.search) continue;
    alias.search = "";
    await cache.put(alias.toString(), new Response(icon.blob, png));
  }
}

/** Writes the company manifest and its snapshotted icons. Does not open any other cache. */
export async function writeCompanyCacheInBrowser(
  built: BuiltCompanyManifest,
  icons: { path: string; blob: Blob }[],
): Promise<void> {
  const cache = await caches.open(built.cacheName);
  await writeCompanyInstallCache(cache, built, icons, location.origin);
}

type ServiceWorkerControl = {
  controller: unknown;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
  register: () => Promise<unknown>;
  ready: Promise<unknown>;
};

function abortError(): DOMException {
  return new DOMException("The operation was aborted.", "AbortError");
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

/** Rejects when signal aborts. A late settle of the original promise is ignored. */
export function settleWithSignal<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener("abort", onAbort);
      reject(abortError());
    };
    signal.addEventListener("abort", onAbort);
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

/**
 * Resolves true when hasController() is true. Resolves false when signal aborts.
 * The listener is removed on every exit, including when the controller event
 * and the abort land together. The promise does not reject.
 */
export function raceForController(options: {
  hasController: () => boolean;
  listen: (onChange: () => void) => void;
  unlisten: (onChange: () => void) => void;
  signal: AbortSignal;
}): Promise<boolean> {
  if (options.hasController()) return Promise.resolve(true);
  if (options.signal.aborted) return Promise.resolve(false);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (controlled: boolean) => {
      if (settled) return;
      settled = true;
      options.unlisten(onChange);
      options.signal.removeEventListener("abort", onAbort);
      resolve(controlled);
    };
    const onChange = () => {
      if (options.hasController()) finish(true);
    };
    const onAbort = () => finish(false);
    options.listen(onChange);
    if (options.hasController()) finish(true);
    else options.signal.addEventListener("abort", onAbort);
  });
}

export function startInstallBudget(ms: number): { signal: AbortSignal; stop: () => void } {
  const controller = new AbortController();
  if (ms <= 0) {
    controller.abort();
    return { signal: controller.signal, stop: () => {} };
  }
  const timer = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    stop: () => clearTimeout(timer),
  };
}

export async function waitForServiceWorkerControl(sw: ServiceWorkerControl, signal: AbortSignal): Promise<boolean> {
  if (signal.aborted) return false;
  if (sw.controller) return true;
  try {
    await settleWithSignal(sw.register(), signal);
  } catch {
    return false;
  }
  if (signal.aborted) return false;
  if (sw.controller) return true;
  try {
    await settleWithSignal(sw.ready, signal);
  } catch {
    return false;
  }
  if (signal.aborted) return false;
  if (sw.controller) return true;
  return raceForController({
    hasController: () => sw.controller != null,
    listen: (onChange) => sw.addEventListener("controllerchange", onChange),
    unlisten: (onChange) => sw.removeEventListener("controllerchange", onChange),
    signal,
  });
}

type CacheMatcher = { match(url: string): Promise<Response | undefined> };

type InstallBrowserDeps = {
  readyMs?: number;
  openCache?: (name: string) => Promise<CacheMatcher>;
  waitForController?: (signal: AbortSignal) => Promise<boolean>;
  fetch?: (url: string, init: RequestInit) => Promise<Response>;
};

const timedOut = (): FinalizeAssessment => ({ ok: false, code: "manifest", message: INSTALL_TIMEOUT_MESSAGE });

async function readResponse(response: Promise<Response>): Promise<{ status: number; contentType: string | null; bytes: Uint8Array } | "aborted" | "failed"> {
  try {
    const settled = await response;
    const bytes = new Uint8Array(await settled.arrayBuffer());
    return { status: settled.status, contentType: settled.headers.get("content-type"), bytes };
  } catch (error) {
    return isAbortError(error) ? "aborted" : "failed";
  }
}

/** Active worker only. Does not fetch the company manifest from this document. */
export async function waitForActiveServiceWorker(ms: number = COMPANY_INSTALL_READY_MS): Promise<boolean> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return false;
  const budget = startInstallBudget(ms);
  try {
    await settleWithSignal(
      navigator.serviceWorker.register("/overwatch/sw.js", { scope: "/overwatch/" }),
      budget.signal,
    );
    await settleWithSignal(navigator.serviceWorker.ready, budget.signal);
    const registration = await navigator.serviceWorker.getRegistration();
    return Boolean(registration?.active);
  } catch {
    return false;
  } finally {
    budget.stop();
  }
}

export async function companyManifestIsCached(companyId: string): Promise<boolean> {
  if (typeof caches === "undefined") return false;
  try {
    const cache = await caches.open(`overwatch-company-${companyId.toLowerCase()}`);
    const hit = await cache.match(new URL(`/overwatch/pwa/${companyId.toLowerCase()}/manifest.webmanifest`, location.origin).toString());
    if (!hit) return false;
    const body = await hit.json() as { id?: string };
    return body.id === `/overwatch/pwa/${companyId.toLowerCase()}/`;
  } catch {
    return false;
  }
}

export async function finalizeCompanyInstallInBrowser(
  built: BuiltCompanyManifest,
  icons: { path: string; blob: Blob }[],
  deps: InstallBrowserDeps = {},
): Promise<FinalizeAssessment> {
  const empty = { manifest: null, icons: [] as IconProbe[] };
  const budget = startInstallBudget(deps.readyMs ?? COMPANY_INSTALL_READY_MS);
  try {
    const openCache = deps.openCache ?? (async (name: string) => {
      if (typeof caches === "undefined") throw new Error("no-cache");
      return caches.open(name);
    });
    const fetchImpl = deps.fetch ?? ((url: string, init: RequestInit) => fetch(url, init));
    const wait = deps.waitForController ?? (async (signal: AbortSignal) => {
      if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return false;
      return waitForServiceWorkerControl({
        get controller() { return navigator.serviceWorker.controller; },
        addEventListener: (type, listener) => navigator.serviceWorker.addEventListener(type, listener),
        removeEventListener: (type, listener) => navigator.serviceWorker.removeEventListener(type, listener),
        register: () => navigator.serviceWorker.register("/overwatch/sw.js", { scope: "/overwatch/" }),
        ready: navigator.serviceWorker.ready,
      }, signal);
    });
    let cache: CacheMatcher;
    try {
      cache = await openCache(built.cacheName);
    } catch {
      return assessCompanyInstallFetch({ built, storedIcons: [], cacheReady: false, controlling: false, ...empty });
    }
    const origin = typeof location === "undefined" ? "https://www.evenfalladvantage.com" : location.origin;
    const absolute = (path: string) => new URL(path, origin).toString();
    const manifestHit = await cache.match(absolute(built.manifestPath));
    const companyIcons = icons.filter((icon) => icon.path.startsWith(`/overwatch/pwa/${built.companyId}/`));
    let iconsCached = true;
    for (const icon of companyIcons) {
      const hit = await cache.match(absolute(icon.path));
      if (!hit) iconsCached = false;
    }
    const expectedCompanyIcons = built.icons.filter((icon) => icon.src.startsWith(`/overwatch/pwa/${built.companyId}/`));
    const cacheReady = Boolean(manifestHit)
      && iconsCached
      && expectedCompanyIcons.every((icon) => companyIcons.some((stored) => stored.path === icon.src));
    if (!cacheReady) {
      return assessCompanyInstallFetch({ built, storedIcons: [], cacheReady: false, controlling: false, ...empty });
    }
    const controlling = await wait(budget.signal);
    if (!controlling || budget.signal.aborted) {
      return assessCompanyInstallFetch({ built, storedIcons: [], cacheReady: true, controlling: false, ...empty });
    }
    const request = { cache: "no-store" as const, credentials: "same-origin" as const, signal: budget.signal };
    const manifestBody = await readResponse(fetchImpl(absolute(built.manifestPath), request));
    if (manifestBody === "aborted") return timedOut();
    if (manifestBody === "failed") {
      return { ok: false, code: "manifest", message: INSTALL_MANIFEST_MESSAGE };
    }
    const iconProbes: IconProbe[] = [];
    for (const icon of built.icons) {
      const iconBody = await readResponse(fetchImpl(absolute(icon.src), request));
      if (iconBody === "aborted") return timedOut();
      if (iconBody === "failed") {
        return { ok: false, code: "icon", message: INSTALL_ICON_MESSAGE };
      }
      iconProbes.push({ src: icon.src, status: iconBody.status, contentType: iconBody.contentType, bytes: iconBody.bytes });
    }
    const storedIcons = await Promise.all(companyIcons.map(async (icon) => ({
      path: icon.path,
      bytes: new Uint8Array(await icon.blob.arrayBuffer()),
    })));
    return assessCompanyInstallFetch({
      built,
      storedIcons,
      cacheReady: true,
      controlling: true,
      manifest: {
        status: manifestBody.status,
        contentType: manifestBody.contentType,
        text: new TextDecoder().decode(manifestBody.bytes),
      },
      icons: iconProbes,
    });
  } catch {
    return timedOut();
  } finally {
    budget.stop();
  }
}
