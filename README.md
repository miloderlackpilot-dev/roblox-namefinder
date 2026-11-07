# Roblox Name Finder

A static website that generates short Roblox username ideas and checks availability through a Cloudflare Worker.

## Features
- Generate random 3-letter or 4-letter combinations.
- Generate curated English words that are exactly 3 or 4 letters long.
- Check individual generated ideas or enter a username manually.
- Automatically search across batches until a possible available name appears, the user stops, or Roblox cannot confirm a result.
- Live dashboard showing website-to-Worker traffic and Worker-to-Roblox check rates.
- Persistent adaptive rate controller. It queues checks, honors Roblox's Retry-After header, pauses after HTTP 429, reduces its request rate, and increases it gradually only after stable successful checks.
- No account creation, login, signup submission, or registration automation.

## GitHub Pages
The `.github/workflows/pages.yml` workflow validates the JavaScript, UI references, and word lists before deploying the site. Set **Settings → Pages → Source** to **GitHub Actions**.

## Cloudflare Worker deployment

The rate controller now uses a Durable Object so its rate state and counters persist across Worker restarts.

1. Open Cloudflare **Workers & Pages**.
2. Open the existing `roblox-name-checker` Worker.
3. Deploy this repository with Wrangler using the included `wrangler.toml` and `worker/roblox-checker.js`. The Durable Object binding and first migration are defined in `wrangler.toml`.
4. From the repository root, run `npx wrangler deploy` with a Cloudflare account authorized for this Worker.
5. Confirm the deployed Worker URL matches `CHECKER_API` in `app.js`.
6. Open `https://YOUR-WORKER-URL/metrics` from the website origin to confirm the metrics endpoint responds. The site dashboard polls it every five seconds.

If you previously created the Worker in the Cloudflare dashboard, make sure the Wrangler project targets the same Worker name and account. Do not create a second Worker by accident.

## Rate control behavior
- The controller starts at one upstream check every 2.5 seconds.
- All requests pass through one persistent Durable Object queue.
- On Roblox HTTP 429, it honors `Retry-After` when supplied, otherwise applies a cooldown, doubles the interval, and pauses until the cooldown expires.
- After 20 successful checks, it cautiously reduces the interval by 5%, never going faster than the 2.5-second baseline.
- The metrics endpoint reports rolling requests per minute, totals, errors, rate limits, cooldown state, and the current target rate.
- The controller only sends checks when the website requests them. It does not continuously probe Roblox while idle. Its stored state persists 24/7, but live rates naturally become zero when no checks are being requested.

This system responds to Roblox's published rate-limit signals. It does not bypass or attempt to evade Roblox limits. If Roblox changes its endpoint or applies a longer restriction, checks remain paused or slow until responses recover.

## Search behavior
Automatic search checks usernames sequentially from the website. The Worker enforces the actual upstream interval, so multiple browser requests cannot make Roblox checks run faster than the controller permits. Search stops on the first possible available name, an unconfirmed result, an unexpected error, or a user stop request.

An available result is indicative only. Confirm the username on Roblox before registering.
