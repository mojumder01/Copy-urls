# Tab URL Manager

A Chrome extension that shows how many tabs you have open, lets you copy all URLs with one click, and remove individual tabs from a popup list.

**Version 1.5.0** · Built by Muntasir

## Features

- **Toolbar badge** — the open-tab count is always visible on the extension icon itself (top-right corner), no click needed.
- **Sort options** — order the list by window (default grouping), title, domain, or most-recently-active tab. Your choice is remembered.
- **Grouped by window** — (when sorted "By window") tabs are listed under "Window 1", "Window 2", etc., with the currently focused window tagged `current`.
- **Close Duplicates** — one click closes every tab that shares a URL with an earlier tab, keeping the first of each (or the pinned one — see below).
- **Export as Bookmarks** — saves the current (or filtered) tab list into a new, timestamped Chrome bookmarks folder in one click.
- **Export to File** — downloads the same (filtered/formatted) tab list as a `.csv`/`.json`/`.html`/`.txt` file, matching the active Copy Settings format.
- **Add to Reading List** — adds the matching tabs to Chrome's built-in Reading List.
- **Pin/protect tabs** — mark a tab with 📌 to exclude it from "Close Duplicates" and block its close button (🔒) until unpinned. Protection persists across popup sessions, keyed by URL.
- **Dark / light theme toggle** — cycle the popup between System, Light, and Dark via the header button; your choice is remembered.
- Per-tab actions: switch to a tab, copy just its URL, pin/unpin, or close it — without leaving the popup.
- Search box to filter the list by title or URL (badge/count still reflects the true total; Copy All, Close Duplicates, and Export respect the active filter where relevant).
- **Keyboard shortcut** to open the popup (default `Ctrl+Shift+U` / `Cmd+Shift+U` on Mac) — fully user-editable. Use the "Customize keyboard shortcut" link in the popup footer, or go to `chrome://extensions/shortcuts` directly.
- List and badge stay in sync automatically as tabs open, close, or move between windows.

### Page Links (on-page link finder)

A content script runs on every page you visit, so this needs the broader "read and change data on all websites" permission at install. It adds:

- **Find All Links on Page** (popup button) — scans the active tab's page and lists every `http(s)://` link.
- **Select-area link finder** — hold **Ctrl** and drag a box on any page to highlight and grab just the links inside it; a small on-page toast offers quick **Copy** / **Open All** actions, or pull the same results into the popup with **Get Last Selection**.
- **Hover + Ctrl+C copy** — hover any link on a page and press **Ctrl+C** (or **Cmd+C** on Mac) to copy its URL instantly, with an on-page confirmation toast.
- **Send to Open URLs** — pipe scanned/selected page links straight into the Open URLs panel to reuse all of its bulk-open options.

### Copy Settings

Click **Copy Settings** above the tab list to control what "Copy All URLs" copies:

- **Include**: all URLs, or only `http://`/`https://` pages.
- **Export tabs from**: all windows, or just the current (active) window.
- **Format**: URLs only, Title + URL, HTML links, CSV, JSON, or a **Custom** template using `{title}` and `{url}` placeholders.
- **Restore default settings** resets all of the above; settings persist between popup opens.

### Open URLs

Click **Open URLs** to expand a panel for bulk-opening a pasted list:

- **Paste / Copy / Clear** the URL list, or **Extract URLs from text** to pull `http(s)://` links out of any pasted blob of text.
- **Do not load tabs until selected** — opens tabs discarded (unloaded) so they only load once clicked.
- **Load in random / reverse order**, **Ignore duplicate URLs**, **Handle non-URLs as search queries** (turns non-URL lines into a Google search).
- **Tab group**: open the new tabs ungrouped, or into a new tab group.
- **Open each URL in new tab** / **in a separate new window** / **only the first N URLs**.
- **Preserve input** (keep the list after opening), **Remove opened URLs from the list** (strip just the opened lines), **Remember the URL List** (persist the textarea contents across popup sessions).
- The **Open URLs (N)** button label updates live as you type or change settings.

## Not included (yet)

The Crawler, site Recipes/presets, and PDF Grab features were scoped out for now — flagged as the largest, riskiest additions (multi-page crawling, a preset library, PDF text parsing). Happy to pick any of those up next.

## Installing (unpacked, for development)

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select this folder.
4. Click the extension icon in the toolbar (or press the keyboard shortcut) to open the popup. For **Page Links** to work on tabs that were already open before install, reload them once.

## Files

- `manifest.json` — Manifest V3 config (`tabs`, `tabGroups`, `clipboardWrite`, `clipboardRead`, `bookmarks`, `storage`, `downloads`, `readingList` permissions; `<all_urls>` content script; popup action; keyboard command).
- `background.js` — service worker that keeps the toolbar badge count up to date and relays "Open All" from the on-page toast.
- `content.js` / `content.css` — injected on every page: link scanning, Ctrl+drag area selection, hover+Ctrl+C copy, and the on-page toast UI.
- `popup.html` / `popup.css` / `popup.js` — the popup UI and logic.
- `icons/` — toolbar/extension icons.
