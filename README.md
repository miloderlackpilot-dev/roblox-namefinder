# Roblox Name Finder

A static website that generates short Roblox username ideas and lets a person check availability one name at a time.

## Features
- Generate random 3-letter or 4-letter username ideas.
- Manually check an individual generated name.
- Manually enter and check another username.
- Display available, taken, invalid, rate-limited, or unconfirmed results.
- No account creation, login, registration form submission, or automatic bulk scanning.

## GitHub Pages
The repository has a GitHub Actions workflow at `.github/workflows/pages.yml`. Set **Settings → Pages → Source** to **GitHub Actions**. Commits to `main` deploy the site.

## Connect availability checks
The browser cannot reliably call Roblox's validation endpoint directly due to cross-origin restrictions. A Cloudflare Worker relays an individual user-requested check. It does not create accounts or submit registration forms.

1. Create a Cloudflare account and open **Workers & Pages**.
2. Create a Worker named `roblox-name-checker`.
3. Choose **Edit code** and replace the sample with [worker/roblox-checker.js](worker/roblox-checker.js).
4. Deploy it and copy its `workers.dev` URL.
5. In `app.js`, replace the `CHECKER_API` placeholder with your exact Worker URL.
6. Commit the change to `main`. GitHub Actions deploys the updated website.

The Worker accepts requests from this project's GitHub Pages origin and forwards one username validation request. Roblox may still rate-limit or change the endpoint. When verification fails, the website shows an unconfirmed result. Availability can change before registration.
