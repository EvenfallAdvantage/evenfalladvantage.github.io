# Company PWA install

This is a manual phone check. It was not run on a device in CI, and a green deploy does not mean a handset was verified.

The public file `/overwatch/manifest.json` stays the default Overwatch app. It does not name a company or a logo. Choosing a company on **More → Install company app** writes a separate manifest at `/overwatch/pwa/{company-id}/manifest.webmanifest` into a cache named `overwatch-company-{company-id}` on that phone. The service worker serves that URL only from that cache. A deploy does not delete those caches. Switching the active company does not write them.

The home-screen app opens `/overwatch/?ow_company={company-id}`. After sign-in, Overwatch selects that company only when the account has an active membership loaded by the normal profile read. Any other id is ignored and does not open that company's records.

Logos are used only when the membership's logo is already an `https` object in the public `company-logos` bucket for that same company. The page draws it into opaque PNG icons and stores those in the company cache. If the logo is missing or cannot be read, the install uses the default Overwatch icons. The manifest does not point at the storage URL.

Android Chrome identifies an installed app by the manifest `id`. Desktop Chrome can keep two apps from one site when those ids differ. Android's WebAPK installer may still keep a single home-screen icon for `evenfalladvantage.com`, and a second install can replace the first. Overlapping scope (`/overwatch/`) can also make Android open the app that is already installed. There is no second origin and no other workaround. Record what the phone actually does.

iOS may keep the site's default apple touch icon even when the manifest lists a company icon.

The live theme-color meta still follows whichever company is active on screen. That does not change the cached company icons. A WebAPK icon update, when Android does one, runs only after the installed app is opened and only if the page's manifest id matches that install. It is often delayed by a day or more.

## Steps

1. On Android Chrome, sign in as someone who belongs to two companies. Give one a logo under HQ Config → company profile, and leave the other without a logo.
2. Open More → Install company app.
3. Tap Install for the company with a logo, wait for the page to reload, then tap Add or use the browser menu (Install app / Add to Home screen).
4. Check the home-screen name and icon. The name should be that company. The icon should be its logo, or the Overwatch mark if the logo could not be saved.
5. Open that home-screen icon, switch to the other company inside Overwatch, and leave the app. The home-screen icon and name should still be the company you installed.
6. In Chrome (not the home-screen app), repeat the install for the second company.
7. Write down whether Android added a second icon or replaced the first. Either result can be the platform. Replacing it is not caused by the in-app company switch.
8. Sign in as an account that is not a member of the first company and open `https://www.evenfalladvantage.com/overwatch/?ow_company=` plus that company id. You should get your own companies only, not the other company's records.

Repeat the Add to Home Screen step on an iPhone and note whether the icon stayed the Overwatch mark.
