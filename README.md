# Roblox Name Finder

A static browser-based tool for generating 3- and 4-letter username candidates and checking them against Roblox's public username validation endpoint.

## Features

- Generates all 3-letter and 4-letter combinations in a shuffled, reproducible order.
- Checks candidates one at a time.
- Checks a single username on demand without starting a scan.
- Saves progress and confirmed available names in browser local storage.
- Supports pausing, resuming, and exporting available names to a text file.
- Does not ask for a Roblox password, session cookie, or authentication token.
- Stops when Roblox returns a rate-limit response.

## Run locally

Open `index.html` in a modern browser, or serve this folder with any static web server.

## Publish with GitHub Pages

1. Open the repository's **Settings**.
2. Select **Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select the default branch and the `/ (root)` folder.
5. Save. GitHub will provide the published site URL after deployment.

## Availability checking

The app calls Roblox's public username validation endpoint from the browser. Direct browser access may fail because of cross-origin restrictions, network policies, or changes to Roblox's API. If a request fails, the app labels that candidate as **unconfirmed**, never as available.

Roblox documents the username validation endpoint under the Auth domain:
https://create.roblox.com/docs/cloud/reference/domains/auth

The checker uses one request at a time with a configurable delay. A rate-limit response stops the current scan. It does not use proxies, IP rotation, CAPTCHA bypasses, or other methods to evade Roblox restrictions.

## Important limitations

- A result is only a point-in-time response. A username may be claimed before you register it.
- The browser stores progress locally. Clearing browser data removes that progress.
- The initial version limits each run to 5,000 checks. Continue in later runs to resume.
- This project is unofficial and is not affiliated with Roblox Corporation.


## Connect the Roblox checker (one-time setup)

GitHub Pages cannot call Roblox's username-validation API directly from a browser because Roblox does not allow the required cross-origin browser request. This project uses a small Cloudflare Worker as a server-side relay.

1. Create a free account at [Cloudflare](https://dash.cloudflare.com/).
2. Open **Workers & Pages**, choose **Create**, then **Create Worker**.
3. Give it a name such as `roblox-name-checker`.
4. Choose **Edit code** and replace the sample code with the complete contents of [worker/roblox-checker.js](worker/roblox-checker.js) from this repository.
5. Save and deploy the Worker. Copy its public URL, for example `https://roblox-name-checker.YOUR-SUBDOMAIN.workers.dev`.
6. In `app.js`, replace the `CHECKER_API` placeholder with your exact Worker URL, including `https://`.
7. Commit the change to `main`. GitHub Actions will publish the updated website.

The Worker only accepts requests from this project's GitHub Pages origin and only checks one username per request. The browser scan remains sequential and stops when Roblox rate-limits it. A server-side relay fixes browser CORS restrictions, but it does not guarantee that Roblox will always accept requests or that a name will remain available.
