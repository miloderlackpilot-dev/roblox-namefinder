# Roblox Name Finder

A static browser-based tool for generating 3- and 4-letter username candidates and checking them against Roblox's public username validation endpoint.

## Features

- Generates all 3-letter and 4-letter combinations in a shuffled, reproducible order.
- Checks candidates one at a time.
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
