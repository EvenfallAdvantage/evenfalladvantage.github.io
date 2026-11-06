import { afterEach, describe, expect, it, vi } from "vitest";
import { buildCompanyManifest, type InstallMembership } from "@/lib/pwa-company-install";
import {
  COMPANY_INSTALL_READY_MS,
  INSTALL_MANIFEST_MESSAGE,
  INSTALL_TIMEOUT_MESSAGE,
  INSTALL_WORKER_MESSAGE,
} from "@/lib/pwa-company-finalize";
import {
  finalizeCompanyInstallInBrowser,
  raceForController,
  settleWithSignal,
  startInstallBudget,
  waitForServiceWorkerControl,
} from "@/lib/pwa-company-browser";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const company: InstallMembership = {
  companyId: A,
  companyName: "Northstar Recruitment",
  companyLogo: null,
  brandColor: "#102030",
  status: "active",
};
const built = buildCompanyManifest([company], A, false)!;
const ORIGIN = "https://www.evenfalladvantage.com";
const manifestUrl = new URL(built.manifestPath, ORIGIN).toString();

function cacheWithManifest() {
  const hit = new Response(JSON.stringify(built.body), {
    headers: { "Content-Type": "application/manifest+json" },
  });
  return {
    async match(url: string) {
      return url === manifestUrl ? hit.clone() : undefined;
    },
  };
}

function trackUnhandled() {
  const reasons: unknown[] = [];
  const onUnhandled = (reason: unknown) => { reasons.push(reason); };
  process.on("unhandledRejection", onUnhandled);
  return {
    reasons,
    stop() { process.off("unhandledRejection", onUnhandled); },
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("controller wait", () => {
  it("returns immediately when a controller is already set and does not listen", async () => {
    let listened = 0;
    let registered = 0;
    const controlled = await waitForServiceWorkerControl({
      controller: {},
      addEventListener: () => { listened += 1; },
      removeEventListener: () => { listened += 1; },
      register: () => { registered += 1; return new Promise(() => {}); },
      ready: new Promise(() => {}),
    }, new AbortController().signal);
    expect(controlled).toBe(true);
    expect(registered).toBe(0);
    expect(listened).toBe(0);
  });

  it("drops the controller listener and does not reject when registration never settles", async () => {
    vi.useFakeTimers();
    const unhandled = trackUnhandled();
    const listeners: Array<() => void> = [];
    let rejectRegister: (error: Error) => void = () => {};
    const budget = startInstallBudget(COMPANY_INSTALL_READY_MS);
    const pending = waitForServiceWorkerControl({
      controller: null,
      addEventListener: (_type, listener) => { listeners.push(listener); },
      removeEventListener: (_type, listener) => {
        const at = listeners.indexOf(listener);
        if (at >= 0) listeners.splice(at, 1);
      },
      register: () => new Promise((_resolve, reject) => { rejectRegister = reject; }),
      ready: new Promise(() => {}),
    }, budget.signal);
    await vi.advanceTimersByTimeAsync(COMPANY_INSTALL_READY_MS);
    await expect(pending).resolves.toBe(false);
    expect(listeners).toEqual([]);
    rejectRegister(new Error("register failed after abort"));
    await Promise.resolve();
    expect(unhandled.reasons).toEqual([]);
    unhandled.stop();
    budget.stop();
  });

  it("settles once when control and abort arrive together", async () => {
    const listeners: Array<() => void> = [];
    let unlistens = 0;
    const sw = {
      controller: null as null | object,
      addEventListener: (_type: string, listener: () => void) => { listeners.push(listener); },
      removeEventListener: (_type: string, listener: () => void) => {
        unlistens += 1;
        const at = listeners.indexOf(listener);
        if (at >= 0) listeners.splice(at, 1);
      },
      register: () => Promise.resolve(undefined),
      ready: Promise.resolve(undefined),
    };
    const abort = new AbortController();
    const pending = waitForServiceWorkerControl(sw, abort.signal);
    for (let i = 0; i < 10 && listeners.length === 0; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    expect(listeners).toHaveLength(1);
    sw.controller = {};
    listeners.slice().forEach((listener) => listener());
    abort.abort();
    await expect(pending).resolves.toBe(true);
    expect(listeners).toEqual([]);
    expect(unlistens).toBe(1);
  });

  it("resolves false on abort without leaving the listener installed", async () => {
    const listeners: Array<() => void> = [];
    const signal = new AbortController();
    const pending = raceForController({
      hasController: () => false,
      listen: (onChange) => { listeners.push(onChange); },
      unlisten: (onChange) => {
        const at = listeners.indexOf(onChange);
        if (at >= 0) listeners.splice(at, 1);
      },
      signal: signal.signal,
    });
    signal.abort();
    await expect(pending).resolves.toBe(false);
    expect(listeners).toEqual([]);
    listeners.forEach((listener) => listener());
  });
});

describe("proving fetches stay inside the install budget", () => {
  it("fails when the manifest fetch is still pending after 8 seconds", async () => {
    vi.useFakeTimers();
    const unhandled = trackUnhandled();
    let releasedLate = 0;
    const resultPromise = finalizeCompanyInstallInBrowser(built, [], {
      openCache: async () => cacheWithManifest(),
      waitForController: async () => true,
      fetch: (_url, init) => new Promise((resolve, reject) => {
        const late = setTimeout(() => {
          releasedLate += 1;
          resolve(new Response("late", { status: 200 }));
        }, COMPANY_INSTALL_READY_MS + 1000);
        init?.signal?.addEventListener("abort", () => {
          clearTimeout(late);
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      }),
    });
    const assertion = resultPromise.then((result) => {
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toBe(INSTALL_TIMEOUT_MESSAGE);
    });
    await vi.advanceTimersByTimeAsync(COMPANY_INSTALL_READY_MS);
    await assertion;
    await vi.advanceTimersByTimeAsync(COMPANY_INSTALL_READY_MS);
    expect(releasedLate).toBe(0);
    expect(unhandled.reasons).toEqual([]);
    unhandled.stop();
  });

  it("fails when an icon fetch hangs after the manifest was served", async () => {
    vi.useFakeTimers();
    const resultPromise = finalizeCompanyInstallInBrowser(built, [], {
      openCache: async () => cacheWithManifest(),
      waitForController: async () => true,
      fetch: (url, init) => {
        if (url === manifestUrl) {
          return Promise.resolve(new Response(JSON.stringify(built.body), {
            status: 200,
            headers: { "Content-Type": "application/manifest+json" },
          }));
        }
        return new Promise((_resolve, reject) => {
          const late = setTimeout(() => { /* still pending past the budget */ }, COMPANY_INSTALL_READY_MS + 1000);
          init?.signal?.addEventListener("abort", () => {
            clearTimeout(late);
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        });
      },
    });
    const assertion = resultPromise.then((result) => {
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toBe(INSTALL_TIMEOUT_MESSAGE);
    });
    await vi.advanceTimersByTimeAsync(COMPANY_INSTALL_READY_MS);
    await assertion;
  });

  it("returns a failure when fetch throws, including an aborted signal", async () => {
    const thrown = await finalizeCompanyInstallInBrowser(built, [], {
      openCache: async () => cacheWithManifest(),
      waitForController: async () => true,
      fetch: async () => { throw new TypeError("Failed to fetch"); },
    });
    expect(thrown.ok).toBe(false);
    if (!thrown.ok) expect(thrown.message).toBe(INSTALL_MANIFEST_MESSAGE);

    const aborted = await finalizeCompanyInstallInBrowser(built, [], {
      openCache: async () => cacheWithManifest(),
      waitForController: async () => true,
      fetch: async (_url, init) => {
        if (init?.signal?.aborted) throw new DOMException("The operation was aborted.", "AbortError");
        throw new DOMException("The operation was aborted.", "AbortError");
      },
    });
    expect(aborted.ok).toBe(false);
    if (!aborted.ok) expect(aborted.message).toBe(INSTALL_TIMEOUT_MESSAGE);
  });

  it("does not fetch when the worker never takes control", async () => {
    vi.useFakeTimers();
    let fetches = 0;
    const resultPromise = finalizeCompanyInstallInBrowser(built, [], {
      openCache: async () => cacheWithManifest(),
      waitForController: (signal) => new Promise<boolean>((resolve) => {
        if (signal.aborted) resolve(false);
        else signal.addEventListener("abort", () => resolve(false), { once: true });
      }),
      fetch: async () => { fetches += 1; throw new Error("should not fetch"); },
    });
    const assertion = resultPromise.then((result) => {
      expect(result).toEqual({ ok: false, code: "not-controlling", message: INSTALL_WORKER_MESSAGE });
    });
    await vi.advanceTimersByTimeAsync(COMPANY_INSTALL_READY_MS);
    await assertion;
    expect(fetches).toBe(0);
  });
});

describe("settleWithSignal", () => {
  it("ignores a rejection that arrives after abort", async () => {
    const unhandled = trackUnhandled();
    const budget = startInstallBudget(20);
    let rejectLate: (error: Error) => void = () => {};
    const pending = settleWithSignal(new Promise((_resolve, reject) => { rejectLate = reject; }), budget.signal);
    const assertion = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await new Promise((resolve) => setTimeout(resolve, 30));
    await assertion;
    rejectLate(new Error("late failure"));
    await Promise.resolve();
    expect(unhandled.reasons).toEqual([]);
    unhandled.stop();
  });
});
