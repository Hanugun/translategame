# Deploy on Render (Static Site)

Use these settings for this repository.

## Render service type

- `Static Site`

## Build settings

- `Root Directory`: leave empty
- `Build Command`: `npm install && npm run build`
- `Publish Directory`: `dist`

## Environment

- Node 20+ recommended (current build also works on Node 22).

## Common issue: blank/blue screen

If deploy is "live" but UI is blank:

1. Open browser devtools on the deployed URL and check Console for JS runtime errors.
2. Confirm `Publish Directory` is exactly `dist`.
3. Make sure the latest commit with `index.html` + `src/` changes is deployed.
4. Hard refresh (`Ctrl+Shift+R`) to clear stale cached assets.

## Mobile permissions checklist

1. Open the site in Chrome/Edge on phone.
2. Allow camera and microphone.
3. If speech does not start, reload once and verify site has HTTPS (Render does by default).
