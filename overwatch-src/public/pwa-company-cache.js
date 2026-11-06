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

  function installCompanyIdFromUrl(url) {
    var parsed;
    try { parsed = new URL(url); } catch { return null; }
    var path = parsed.pathname || "";
    if (!(path.endsWith("/install") || path.endsWith("/install/"))) return null;
    var id = parsed.searchParams.get("company");
    if (!isUuid(id)) return null;
    return id.toLowerCase();
  }

  function shouldPreserveCompanyCache(name) {
    if (typeof name !== "string" || name.indexOf("overwatch-company-") !== 0) return false;
    return isUuid(name.slice("overwatch-company-".length));
  }

  var SHARED_ICONS = {
    "/overwatch/images/icon-192.png": true,
    "/overwatch/images/icon-512.png": true,
    "/overwatch/images/icon-maskable-192.png": true,
    "/overwatch/images/icon-maskable-512.png": true,
  };

  function iconSrcAllowedForCompany(src, companyId) {
    if (typeof src !== "string" || !isUuid(companyId)) return false;
    var id = companyId.toLowerCase();
    var own = "/overwatch/pwa/" + id + "/";
    if (src.indexOf(own) === 0) return !!FILES[src.slice(own.length)];
    return !!SHARED_ICONS[src];
  }

  function uuidsIn(value) {
    if (typeof value !== "string") return [];
    return value.toLowerCase().match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g) || [];
  }

  /** True only when the cached manifest body belongs to the company id in the request URL. */
  function manifestBodyMatchesCompany(text, companyId) {
    if (!isUuid(companyId)) return false;
    var id = companyId.toLowerCase();
    var body;
    try { body = JSON.parse(text); } catch { return false; }
    if (!body || body.id !== "/overwatch/pwa/" + id + "/") return false;
    if (typeof body.name !== "string" || !body.name.trim()) return false;
    if (typeof body.start_url !== "string" || body.start_url.indexOf("ow_company=" + id) === -1) return false;
    var startIds = uuidsIn(body.start_url);
    for (var s = 0; s < startIds.length; s++) if (startIds[s] !== id) return false;
    if (!body.icons || !body.icons.length) return false;
    for (var i = 0; i < body.icons.length; i++) {
      var src = body.icons[i] && body.icons[i].src;
      if (!iconSrcAllowedForCompany(src, id)) return false;
      var iconIds = uuidsIn(src);
      for (var n = 0; n < iconIds.length; n++) if (iconIds[n] !== id) return false;
    }
    return true;
  }

  root.owCompanyPwa = {
    isUuid: isUuid,
    companyCacheName: companyCacheName,
    matchCompanyPwaPath: matchCompanyPwaPath,
    installCompanyIdFromUrl: installCompanyIdFromUrl,
    shouldPreserveCompanyCache: shouldPreserveCompanyCache,
    iconSrcAllowedForCompany: iconSrcAllowedForCompany,
    manifestBodyMatchesCompany: manifestBodyMatchesCompany,
  };
})(typeof self !== "undefined" ? self : globalThis);
