# Roblox Name Finder

A static website that generates short Roblox username ideas and checks availability through a Cloudflare Worker.

## Features
- Generate random 3-letter or 4-letter combinations.
- Generate curated English words that are exactly 3 or 4 letters long.
- Check individual generated ideas or enter a username manually.
- Automatically generate and check new batches until a possible available name is found, the user stops the search, or Roblox cannot confirm a result.
- Display available, taken, invalid, rate-limited, and unconfirmed states.
- No account creation, login, signup submission, or registration automation.

## GitHub Pages
The `.github/workflows/pages.yml` workflow validates the JavaScript, UI references, and word lists before deploying the site. Set **Settings → Pages → Source** to **GitHub Actions**.

## Cloudflare Worker
The browser calls a Cloudflare Worker because Roblox's validation endpoint does not reliably allow direct browser requests.

1. Open Cloudflare **Workers & Pages**.
2. Open the existing `roblox-name-checker` Worker.
3. Replace its code with [worker/roblox-checker.js](worker/roblox-checker.js).
4. Deploy the Worker.
5. Confirm the `CHECKER_API` URL in `app.js` matches the deployed Worker URL.

The Worker only forwards username validation requests. It does not create accounts or submit registration forms. Roblox can rate-limit requests or change its endpoint. An available result is an indication only. Confirm the username on Roblox before registering.

## Search behavior
Automatic search checks names sequentially with a 2.5-second delay between requests. It starts the next batch automatically when every name in the current batch is taken or invalid. It stops on the first possible available name, a rate limit, an unconfirmed result, an unexpected error, or a user stop request.
