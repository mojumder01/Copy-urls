# Tab URL Manager

A Chrome extension that shows how many tabs you have open, lets you copy all URLs with one click, and remove individual tabs from a popup list.

**Version 1.2.0** · Built by Muntasir

## Features

- **Toolbar badge** — the open-tab count is always visible on the extension icon itself (top-right corner), no click needed.
- **Copy All URLs** — copies every open tab's URL (newline-separated) to the clipboard in one click. If a search filter is active, only the filtered URLs are copied.
- **Sort options** — order the list by window (default grouping), title, domain, or most-recently-active tab. Your choice is remembered.
- **Grouped by window** — (when sorted "By window") tabs are listed under "Window 1", "Window 2", etc., with the currently focused window tagged `current`.
- **Close Duplicates** — one click closes every tab that shares a URL with an earlier tab, keeping the first of each (or the pinned one — see below).
- **Export as Bookmarks** — saves the current (or filtered) tab list into a new, timestamped Chrome bookmarks folder in one click.
- **Pin/protect tabs** — mark a tab with 📌 to exclude it from "Close Duplicates" and block its close button (🔒) until unpinned. Protection persists across popup sessions, keyed by URL.
- **Dark / light theme toggle** — cycle the popup between System, Light, and Dark via the header button; your choice is remembered.
- Per-tab actions: switch to a tab, copy just its URL, pin/unpin, or close it — without leaving the popup.
- Search box to filter the list by title or URL (badge/count still reflects the true total; Copy All, Close Duplicates, and Export respect the active filter where relevant).
- **Keyboard shortcut** to open the popup (default `Ctrl+Shift+U` / `Cmd+Shift+U` on Mac) — fully user-editable. Use the "Customize keyboard shortcut" link in the popup footer, or go to `chrome://extensions/shortcuts` directly.
- List and badge stay in sync automatically as tabs open, close, or move between windows.

## Installing (unpacked, for development)

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select this folder.
4. Click the extension icon in the toolbar (or press the keyboard shortcut) to open the popup.

## Files

- `manifest.json` — Manifest V3 config (`tabs`, `clipboardWrite`, `bookmarks`, `storage` permissions, popup action, keyboard command).
- `background.js` — service worker that keeps the toolbar badge count up to date.
- `popup.html` / `popup.css` / `popup.js` — the popup UI and logic.
- `icons/` — toolbar/extension icons.
