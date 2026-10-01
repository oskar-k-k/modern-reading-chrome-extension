# Modern Reading

A local-first Chrome Manifest V3 extension for adjustable word-prefix highlighting, inspired by Bionic Reading. This is an independent implementation, not the official Bionic Reading product or algorithm. It makes no promise of increased reading speed or comprehension.

## Install the development version

From this project directory:

```powershell
npm.cmd install
npm.cmd run build
```

1. Open `chrome://extensions` in desktop Chrome.
2. Enable **Developer mode** in the top right.
3. Choose **Load unpacked** and select `dist`.
4. Pin **Modern Reading** using Chrome's Extensions menu.
5. Open a normal website. Longer text is highlighted automatically; no setup is needed.

The build already produces the complete installable directory. No server, account, API key or backend is required. After source changes, rebuild and click **Reload** on Chrome's extension card, then reload your test website. This extension has not been published to the Chrome Web Store.

## Use

- **Enable reading** is the single main switch. It pauses/resumes reading across all websites and remembers your choice across reloads and browser restarts.
- New installations default to **on**. HTTP/HTTPS host access is declared in the manifest so Chrome requests it during normal store installation. Unpacked developer loading may not show the same prompt. Protected browser pages remain inaccessible.
- Existing installations preserve saved preferences, including an explicit off setting. When updating from 0.1.0, Chrome may require approval of the added installation-time permissions before re-enabling the extension. Reload the extension and existing website tabs after a local rebuild.
- The popup keeps the same width when advanced settings open; space for its internal scrollbar is reserved. Mouse interactions do not show focus outlines; keyboard navigation retains a subtle green focus indicator.
- The status reports whether reading mode is enabled, not whether all website paragraphs were detected.
- **Advanced** starts collapsed. It contains the current-site exception, prefix strength (20–70%), a short live preview, minimum paragraph length and language.
- **Pause on this website** stores the exact origin (scheme, hostname and port), not all its subdomains.
- **Reset reading settings** turns reading on, clears exclusions, restores 50% strength and a 120-character minimum, and preserves the selected language.
- Language initially follows Chrome's English/German locale, with English as fallback. Preferences are stored locally, not synced to a remote service.
- Chrome's site-access controls remain authoritative. Restricting access to selected sites limits where the reader can run without changing the global preference. Restore access through Chrome's extension controls if needed.

## How it works

Chrome reads `manifest.json` to discover the popup, permissions and background worker. The popup is ordinary HTML/CSS with bundled TypeScript. A content script runs in an isolated JavaScript world but can modify the page DOM. The service worker registers or unregisters automatic injection according to the global switch; Chrome enforces site-access grants.

`src/model.ts` validates persisted settings and splits Unicode words using `Intl.Segmenter`. `src/reader.ts` adds presentation-only spans to eligible text nodes without replacing surrounding elements or event handlers. It restores original text nodes on disable, preserves site edits inside its spans, and observes added/changed text. Processing yields between blocks. No remote scripts, analytics, page-text storage or uploads are used.

This is a standalone repository with its own dependencies, lockfile, tests and build. Translations are bundled from `src/modern-reading.mjs`. Oskar Lab is not needed to develop, build or run it.

## Scope and limitations

- Works with ordinary top-level HTML text in paragraphs, list items, quotes and other common text containers.
- Skips code, navigation, headers/footers, form controls, editable regions and explicitly hidden content.
- Chrome internal pages, browser PDF viewers, the Chrome Web Store and other protected pages reject injection. Embedded frames, shadow roots, canvas text and image text are not processed. Local `file://` pages are outside the requested permissions.
- An individual text node above 20,000 characters is skipped to avoid a long synchronous transform. Rendering and segmentation costs still depend on page size.
- Some heavily scripted sites may replace or manage their own text nodes. Disable the reader on those sites if their editor or rendering conflicts with DOM highlighting. Website compatibility is best-effort, not a guarantee for every URL.
- Chrome desktop is the install target. The popup has an intrinsic width of 380 CSS pixels and a scrollable advanced section; its default view fits without scrolling. This is not an Android Chrome extension.

## Verify

From this project directory:

```powershell
npm.cmd run check
npm.cmd test
npx.cmd playwright install chromium
npm.cmd run test:browser
```

The browser check loads the unchanged production build in an isolated persistent Chromium profile. It checks automatic first use before any popup interaction, persistent global pause, origin exclusions, keyboard operation, collapsed height, intrinsic width, both languages, reset and dynamic text. The test opens the popup as a tab and overrides only its active-tab query to point to the local fixture. Storage, injection, registration and messaging use real extension APIs. Screenshots are written to ignored `test-results/`.

`MODERN_READING_BROWSER=msedge` can use an installed Edge version that still supports sideloading flags; otherwise use Playwright Chromium. The browser suite additionally opens the real toolbar popup and verifies its 380-pixel width and compact height through the DevTools protocol. The native Chrome Web Store installation/permission dialog still requires a manual store-install check.

## Related reading approaches

- Word-prefix fixation: [Bionic Reading](https://bionic-reading.com/).
- Line color gradients: [BeeLine Reader](https://www.beelinereader.com/).
- Line focus, spacing, syllables and read-aloud highlighting: [Microsoft Immersive Reader](https://support.microsoft.com/en-us/accessibility/word/use-immersive-reader-in-word).
- One-word-at-a-time presentation (RSVP): [Spritz Reader](https://www.spritzreader.com/about).

Only adjustable prefix highlighting is implemented in this first version. The other approaches are possible future modes.

## Toolbar artwork

Green MR icons are included at 16, 32, 48 and 128 pixels for the toolbar and extension manager. The source is `public/icons/mark.svg`. Regenerate the committed PNG files with `npm run icons` using Playwright Chromium (or `MODERN_READING_BROWSER=msedge`). Normal builds copy the PNGs and do not launch a browser.

Privacy, the purpose of website access, compatibility limits, reading expectations and the current version are shown only at the bottom of Advanced. These product notes are not a substitute for the public store privacy policy or applicable publisher disclosures.

## Store archive

Run `npm.cmd run package` to create `release/modern-reading-0.2.2.zip` on Windows. The archive contains the contents of dist with manifest.json at its root. Upload this ZIP in the Chrome Web Store developer dashboard; do not upload source, node_modules or the repository. Store listing, privacy disclosures and review remain separate publication steps. On other systems, ZIP the contents of dist.

The project was extracted from Oskar Lab. Earlier history remains in that repository; this repository starts with the extracted standalone source.

## Support links

The normal popup links to the creator's Ko-fi and Patreon pages. Both links open in a new tab only when clicked; no third-party widgets or network requests are used to render them. Logos are bundled locally from [Simple Icons](https://github.com/simple-icons/simple-icons), distributed under CC0; the respective brand trademarks remain with their owners.
