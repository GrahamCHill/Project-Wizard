# __PROJECT_NAME__

A Manifest V3 browser extension for **Chrome and other Chromium browsers**, **Firefox**, and **Safari**, built from one source folder. It shows how many words the current page has and how long it takes to read, with a toolbar badge, a popup, and a settings page.

```text
src/                    The extension: background, content script, popup, and options page
  shared/               Code every part uses: api.js, text.js, settings.js
manifests/base.json     Settings every browser shares
manifests/chrome.json   Chrome: a service worker
manifests/firefox.json  Firefox: a background script and an add-on id
manifests/safari.json   Safari: a background script
scripts/build.mjs       Builds dist/chrome, dist/firefox, and dist/safari
scripts/icons.mjs       Draws the placeholder icons, so no image files live in Git
scripts/safari.mjs      Turns the Safari build into an Xcode project (macOS only)
test/                   Unit tests and build checks
```

The browsers differ in two ways: how the background code runs, and a few manifest keys. `build.mjs` merges `base.json` with the browser's own file and copies `src/` unchanged. The code in `src/` uses one name, `api`, for `browser` or `chrome`, whichever the browser provides, and classic scripts so it loads the same way everywhere.

## Requirements

Node.js 22.18 or newer. Run `npm install` once.

```sh
npm install
npm test
npm run build
```

`npm test` checks the text logic, the background and content scripts with a fake browser API, and every built manifest, including that each file it refers to exists.

## Run it in each browser

| Browser | How |
| --- | --- |
| **Chrome, Edge, Brave, Opera** | Run `npm run build:chrome`. Open `chrome://extensions`, turn on **Developer mode**, choose **Load unpacked**, and select `dist/chrome`. After a change, rebuild and click the reload icon. |
| **Firefox** | Run `npm run run:firefox`. It builds, starts Firefox with the extension, and reloads it when files change. Or open `about:debugging`, choose **This Firefox → Load Temporary Add-on**, and select `dist/firefox/manifest.json`. |
| **Safari** | On a Mac with Xcode, run `npm run safari`. It builds `dist/safari` and uses Apple's converter to create an Xcode project in `safari/`. Open it, choose a signing team, run the app, then enable the extension in **Safari → Settings → Extensions**. During development, turn on **Develop → Allow Unsigned Extensions**. |

Open any regular website (not a `chrome://` or browser settings page). The toolbar icon shows the word count. Click it for the reading time, and use **Highlight the longest paragraph** to try the content script. Content scripts do not run in pages that were already open when you installed the extension, so reload them.

## Check it

```sh
npm run lint        # Mozilla's web-ext linter on the Firefox build
```

For Chrome, load the unpacked build and open `chrome://extensions` to see errors. For Safari, Xcode shows build errors, and Safari's **Develop → Web Extension Background Content** opens the console.

## Make it yours

1. In `manifests/base.json`, change `name` and `description`. The version comes from `package.json`.
2. In `manifests/firefox.json`, replace the `id` (`__PROJECT_SLUG__@example.com`) with an email-style id you control. Firefox keeps an add-on's settings tied to it.
3. In `scripts/safari.mjs`, replace the `com.example` bundle identifier with one you own.
4. Replace the generated icons by putting `icon-16.png`, `icon-32.png`, `icon-48.png`, and `icon-128.png` in `src/icons/`. The build copies them over the placeholders.
5. Narrow `content_scripts.matches` in `manifests/base.json` to the sites you need. Today it matches every `http` and `https` page, which makes browsers show a broad "read and change data on all sites" warning. An extension that acts only when the user clicks it can use the `activeTab` permission and `scripting.executeScript` instead, and needs no site access at all.

## Publish

```sh
npm run package
```

This builds all three browsers and writes `artifacts/chrome/*.zip` and `artifacts/firefox/*.zip`. Upload them to the [Chrome Web Store](https://chrome.google.com/webstore/devconsole) (also used by Edge Add-ons with the same package) and [Firefox Add-ons](https://addons.mozilla.org/developers/). Safari extensions ship inside a Mac or iOS app through App Store Connect, from the Xcode project that `npm run safari` creates. Firefox needs the add-on to say whether it collects data. This starter collects none and declares `"required": ["none"]` in `manifests/firefox.json`. Change that if you add data collection.

## How the parts talk

- The **content script** (`src/content.js`) runs in every page, counts the visible words, and answers the popup's `getStats` and `toggleHighlight` messages.
- It also sends the count to the **background** (`src/background.js`) once the page loads. The background sets the toolbar badge for that tab, unless the setting is off.
- The **popup** asks the active tab's content script directly, so it works even when the background is asleep.
- **Settings** live in `storage.sync`, so they follow the user between devices. `src/shared/settings.js` replaces any invalid stored value with a default.

[Chrome extension docs](https://developer.chrome.com/docs/extensions) · [Firefox extension docs](https://extensionworkshop.com/) · [Safari web extensions](https://developer.apple.com/documentation/safariservices/safari-web-extensions)
