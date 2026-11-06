# Company PWA install

This is a manual phone check. It was not run on a device in CI, and a green deploy does not mean a handset was verified. The Chromium check in `src/__tests__/pwa-company-manifest.browser.test.ts` runs only when Google Chrome is installed on the machine running the tests. It reads the manifest with `Page.getAppManifest`. It does not install an Android WebAPK.

The public file `/overwatch/manifest.json` stays the default Overwatch app. It does not name a company or a logo. Choosing a company on **More → Install company app** writes a separate manifest at `/overwatch/pwa/{company-id}/manifest.webmanifest` into a cache named `overwatch-company-{company-id}` on that phone. The service worker serves that URL only from that cache. A cache miss is a 404. The worker does not fetch the network for that URL and does not substitute the shared manifest. A deploy does not delete those caches. Switching the active company does not write them.

## What the browser reads

Next's root metadata emits `<link rel="manifest" href="/overwatch/manifest.json">` on every page ([metadata `manifest`](https://nextjs.org/docs/app/api-reference/functions/generate-metadata#manifest)). A nested layout cannot clear that field, and `exportPathMap` is a Pages Router hook. This app is the App Router, so `npm run build` rewrites only `out/install/index.html` and removes manifest links from that file. Every other exported page still has the shared link.

The install document's head script (`ow-install-manifest`) runs during parse. The app shell's data may still name the shared manifest; while `?company=` is a uuid the script removes that link if it shows up after parse.

- `/overwatch/install/?company={uuid}` gets one link, `/overwatch/pwa/{uuid}/manifest.webmanifest`, with the href set before the element is inserted. The [manifest spec](https://www.w3.org/TR/appmanifest/) allows a page to replace its manifest link. This page does not rely on a later rewrite of the shared link, because that link is not in the file.
- `/overwatch/install/` with no company id gets the shared manifest link back, so the chooser is not left without one.
- Any other page is unchanged unless it was opened from an installed company's start URL.

The Install button writes the cache, waits until a service worker is active, then navigates **this tab** to `/overwatch/install/?company={uuid}`. [`navigator.serviceWorker.ready`](https://www.w3.org/TR/service-workers/#navigator-service-worker-ready) means an active worker exists. It does not mean the current document is controlled. The next navigation is the document the worker controls, which is what can answer the manifest request during parse. A new tab often is not controlled yet, so the button does not open one. If that install URL is opened while this document is still uncontrolled, the page reloads once after the worker is active and does not loop.

The company id in that URL is the membership the person pressed Install for. It is not whichever company is currently active, and a launch-session id does not replace it. The id has to be an active membership or the cache is not written.

The home-screen app opens `/overwatch/?ow_company={company-id}`. After sign-in, Overwatch selects that company only when the account has an active membership loaded by the normal profile read. Any other id is ignored and does not open that company's records.

Logos are used only when the membership's logo is already an `https` object in the public `company-logos` bucket for that same company. The page draws it into opaque PNG icons and stores those in the company cache. If the logo is missing or cannot be read, the install uses the default Overwatch icons. The manifest does not point at the storage URL.

## Android and desktop installs

Desktop Chromium can keep two apps from one site when the manifest `id` values differ. The company id is `/overwatch/pwa/{company-id}/`.

Android Chrome installs a WebAPK. Chrome checks that manifest when the installed app is launched, not merely when the browser is opened, and the check is not immediate ([WebAPK update frequency](https://developer.chrome.com/blog/webapk-update-frequency)). Name and icon updates are treated separately from other manifest fields; Chrome does not download a new icon when the `icons` list is unchanged, and a name or icon change can wait for the user to accept it ([improvements to web app updates](https://developer.chrome.com/blog/improvements-to-web-app-updates)). None of that was observed on a phone for this change. Removing the home-screen app and installing again from the company URL is the reliable way to see a new name and icon:

1. Long-press the home-screen icon.
2. Open App info (or the info control) and uninstall. Dragging the icon to Remove does the same job on some launchers.
3. In Chrome or Brave, open More → Install company app, press Install for that company, and install again from `/overwatch/install/?company={company-id}`.

Overlapping scope (`/overwatch/`) can also make Android open the app that is already installed. There is no second origin. Record what the phone actually does.

iOS may keep the site's default apple touch icon even when the manifest lists a company icon.

The live theme-color meta still follows whichever company is active on screen. That does not change the cached company icons.

## Steps

1. On Android Chrome, sign in as someone who belongs to two companies. Give one a logo under HQ Config → company profile, and leave the other without a logo.
2. Open More → Install company app.
3. Tap Install for the company with a logo. The same tab opens `/overwatch/install/?company=` plus that company's id. Then tap Add, or use the browser menu (Install app / Add to Home screen) while that page is open. The menu reads this page's manifest.
4. Check the home-screen name and icon. The name should be that company. The icon should be its logo, or the Overwatch mark if the logo could not be saved. If an older home-screen app is still there, remove it (see above) and install again before deciding the icon is wrong.
5. Open that home-screen icon, switch to the other company inside Overwatch, and leave the app. The home-screen icon and name should still be the company you installed.
6. In Chrome (not the home-screen app), repeat the install for the second company.
7. Write down whether Android added a second icon or replaced the first. Either result can be the platform. Replacing it is not caused by the in-app company switch.
8. Sign in as an account that is not a member of the first company and open `https://www.evenfalladvantage.com/overwatch/?ow_company=` plus that company id. You should get your own companies only, not the other company's records.

Repeat the Add to Home Screen step on an iPhone and note whether the icon stayed the Overwatch mark.
