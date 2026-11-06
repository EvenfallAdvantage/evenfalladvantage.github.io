/**
 * Company install caches. Classic script so the service worker can importScripts it.
 * Paths must stay identical to src/lib/pwa-company-install.ts.
 */
(function (root) {
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var FILES = {
    "manifest.webmanifest": true,
    "icon-192.png": true,
    "icon-512.png": true,
    "icon-maskable-192.png": true,
    "icon-maskable-512.png": true,
  };

  function isUuid(id) {
    return typeof id === "string" && UUID.test(id);
  }

  function companyCacheName(id) {
    return "overwatch-company-" + String(id).toLowerCase();
  }

  function matchCompanyPwaPath(pathname) {
    var prefix = "/overwatch/pwa/";
    if (typeof pathname !== "string" || pathname.indexOf(prefix) !== 0) return null;
    var rest = pathname.slice(prefix.length);
    var slash = rest.indexOf("/");
    if (slash <= 0) return null;
    var id = rest.slice(0, slash);
    var file = rest.slice(slash + 1);
    if (!isUuid(id) || !FILES[file]) return null;
    return { companyId: id.toLowerCase(), file: file };
  }

  function shouldPreserveCompanyCache(name) {
    if (typeof name !== "string" || name.indexOf("overwatch-company-") !== 0) return false;
    return isUuid(name.slice("overwatch-company-".length));
  }

  root.owCompanyPwa = {
    isUuid: isUuid,
    companyCacheName: companyCacheName,
    matchCompanyPwaPath: matchCompanyPwaPath,
    shouldPreserveCompanyCache: shouldPreserveCompanyCache,
  };
})(typeof self !== "undefined" ? self : globalThis);
