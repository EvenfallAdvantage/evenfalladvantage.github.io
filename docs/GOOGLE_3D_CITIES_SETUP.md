# 3D Cities (Google Photorealistic 3D Tiles): setup

The Ops map's **3D Cities** basemap uses Google's Map Tiles API directly from the browser. The key is public by design (it ships in the page). Keeping it safe depends on the **restrictions** and **quota** below. Until the GitHub secret exists, the option is hidden.

Cost model: billing counts **root tileset requests** ("sessions"), not individual tiles. Each time someone turns on 3D Cities in a page load, that's one session, and a session lasts about 3 hours. Photorealistic 3D Tiles is an Enterprise SKU: 1,000 free sessions a month, then pay-as-you-go. Check the current price at https://mapsplatform.google.com/pricing/.

## 1. Create a Google Cloud project
1. Go to https://console.cloud.google.com/ and sign in with the business Google account.
2. Use the project picker (top bar), then **New project**. Name: `evenfall-maps`. Create it, then select it.

## 2. Turn on billing
1. Open **Billing** and link a billing account to `evenfall-maps` (create one with the business card if needed).
2. You can't use the Map Tiles API without billing, even within the free usage.

## 3. Enable the Map Tiles API
1. Go to **APIs & Services → Library**, search for **Map Tiles API**, and click **Enable**.
2. Don't enable anything else for this key.

## 4. Create the key with restrictions
1. Go to **APIs & Services → Credentials → Create credentials → API key**. Copy it somewhere private for step 7, and don't paste it into chat or email.
2. Click the key and name it `overwatch-3d-cities-web`.
3. **Application restrictions → Websites (HTTP referrers)**. Add:
   - `https://www.evenfalladvantage.com/*`
   - Optional, only if you want 3D Cities to work on the bare domain (it redirects to www): `https://evenfalladvantage.com/*`
4. **API restrictions → Restrict key → Map Tiles API** only.
5. Click **Save**. Restrictions can take a few minutes to apply.

## 5. Cap usage at ~500 sessions a day
1. Go to **APIs & Services → Enabled APIs → Map Tiles API → Quotas & system limits**.
2. Find **"Root tileset requests per day"** (Photorealistic 3D Tiles), click the pencil, set **500**, and submit.
3. Once the cap is reached, Google refuses new sessions for the rest of the day. The map then shows "3D Cities isn't available right now" and falls back to normal imagery.

## 6. $25 budget alert
1. Go to **Billing → Budgets & alerts → Create budget**.
2. Scope: project `evenfall-maps`. Amount: **$25** per month.
3. Alerts at 50%, 90% and 100% of actual spend, emailed to billing admins (add your address).
4. A budget only alerts; it doesn't stop spending. The daily quota in step 5 is the real cap.

## 7. Add the GitHub secret
1. Go to https://github.com/EvenfallAdvantage/evenfalladvantage.github.io/settings/secrets/actions and click **New repository secret**.
2. Name: `NEXT_PUBLIC_GOOGLE_MAP_TILES_KEY`. Value: the key from step 4.
3. The next Pages deploy (any merge to `main`, or re-run the latest "Build & Deploy to GitHub Pages" run) builds the key into the site, and **3D Cities** appears under Basemap in the new layers panel.

## 8. Terms housekeeping (one-time)
- The Google Maps Platform terms (§3.2.2(a)) require the app's own Terms of Service to say that the app uses Google Maps features and content, and that their use is subject to the Google Maps Additional Terms of Service (https://maps.google.com/help/terms_maps/) and the Google Privacy Policy (https://policies.google.com/privacy). Add a sentence like this to the Overwatch terms/EULA.
- Leave the Google logo and the data-provider credits along the bottom of the map as they are; they're required.

## How it behaves
- It's off by default for everyone. No preset turns it on, share links never carry it, and on phones it's an explicit opt-in with a data/battery note.
- One session per page load. Switching to another basemap hides the tiles and keeps the session for when the user comes back. After about 2.5 hours one new session is started.
- If Google returns a key, referrer, quota or session error, or a burst of tile failures, the map drops back to the standard satellite imagery for the rest of the page session.
- While it's on, FLIR, NVG, noir, CRT, bloom and sharpen are switched off. Re-tinting Google imagery isn't clearly allowed by the terms. The HUD still works.
- Radar, clouds and other imagery overlays need the standard globe, so they're hidden while 3D Cities is on. Pins, labels and vector data still show.

## Turning it off
Delete the GitHub secret (or remove the key in Google Cloud) and redeploy. The option disappears.
