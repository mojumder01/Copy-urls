# Tab URL Manager

A Chrome extension that shows how many tabs you have open, lets you copy all URLs with one click, and remove individual tabs from a popup list.

## Features

- Live count of all open tabs (across all windows), shown as a badge next to the title.
- **Copy All URLs** — copies every open tab's URL (newline-separated) to the clipboard in one click. If a search filter is active, only the filtered URLs are copied.
- Per-tab actions: switch to a tab, copy just its URL, or close it — without leaving the popup.
- Search box to filter the list by title or URL.
- List stays in sync automatically as tabs open, close, or navigate.

## Installing (unpacked, for development)

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select this folder.
4. Click the extension icon in the toolbar to open the popup.

## Files

- `manifest.json` — Manifest V3 config (`tabs` + `clipboardWrite` permissions, popup action).
- `popup.html` / `popup.css` / `popup.js` — the popup UI and logic.
- `icons/` — toolbar/extension icons.
