const tabListEl = document.getElementById("tab-list");
const tabCountEl = document.getElementById("tab-count");
const emptyStateEl = document.getElementById("empty-state");
const searchEl = document.getElementById("search");
const sortByEl = document.getElementById("sort-by");
const copyAllBtn = document.getElementById("copy-all");
const closeDuplicatesBtn = document.getElementById("close-duplicates");
const exportBookmarksBtn = document.getElementById("export-bookmarks");
const exportFileBtn = document.getElementById("export-file");
const addReadingListBtn = document.getElementById("add-reading-list");
const editShortcutBtn = document.getElementById("edit-shortcut");
const themeToggleBtn = document.getElementById("theme-toggle");
const copyStatusEl = document.getElementById("copy-status");
const versionEl = document.getElementById("version");

const openUrlsInput = document.getElementById("open-urls-input");
const openUrlsBtn = document.getElementById("open-urls-btn");
const pasteUrlsBtn = document.getElementById("paste-urls");
const copyUrlsInputBtn = document.getElementById("copy-urls-input");
const clearUrlsInputBtn = document.getElementById("clear-urls-input");
const extractUrlsBtn = document.getElementById("extract-urls");
const optNoLoad = document.getElementById("opt-no-load");
const optRandomOrder = document.getElementById("opt-random-order");
const optReverseOrder = document.getElementById("opt-reverse-order");
const optIgnoreDuplicates = document.getElementById("opt-ignore-duplicates");
const optNonUrlSearch = document.getElementById("opt-non-url-search");
const optPreserveInput = document.getElementById("opt-preserve-input");
const optRemoveOpened = document.getElementById("opt-remove-opened");
const optRememberList = document.getElementById("opt-remember-list");
const tabGroupSelect = document.getElementById("tab-group-select");
const openFirstNInput = document.getElementById("open-first-n");

const copyCustomTemplateEl = document.getElementById("copy-custom-template");
const restoreCopyDefaultsBtn = document.getElementById("restore-copy-defaults");
const copyHelpBtn = document.getElementById("copy-help");

const findAllPageLinksBtn = document.getElementById("find-all-page-links");
const getSelectionLinksBtn = document.getElementById("get-selection-links");
const pageLinksResultEl = document.getElementById("page-links-result");
const copyPageLinksBtn = document.getElementById("copy-page-links");
const sendPageLinksToOpenBtn = document.getElementById("send-page-links-to-open");
const openUrlsPanelEl = document.getElementById("open-urls-panel");

versionEl.textContent = `v${chrome.runtime.getManifest().version}`;

let allTabs = [];
let currentWindowId = null;
let statusTimer = null;
let sortBy = "window";
let theme = "system";
let protectedUrls = new Set();

function showStatus(message) {
  clearTimeout(statusTimer);
  copyStatusEl.textContent = message;
  copyStatusEl.hidden = false;
  statusTimer = setTimeout(() => {
    copyStatusEl.hidden = true;
  }, 1800);
}

function normalizeUrl(url) {
  if (!url) return "";
  return url.replace(/\/$/, "");
}

function getDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function getDuplicateUrlSet(tabs) {
  const seen = new Map();
  for (const tab of tabs) {
    const key = normalizeUrl(tab.url);
    if (!key) continue;
    seen.set(key, (seen.get(key) || 0) + 1);
  }
  const duplicates = new Set();
  for (const [url, count] of seen) {
    if (count > 1) duplicates.add(url);
  }
  return duplicates;
}

// --- theme ---

function applyTheme() {
  if (theme === "system") {
    document.documentElement.removeAttribute("data-theme");
    themeToggleBtn.textContent = "🖥️";
  } else if (theme === "light") {
    document.documentElement.setAttribute("data-theme", "light");
    themeToggleBtn.textContent = "☀️";
  } else {
    document.documentElement.setAttribute("data-theme", "dark");
    themeToggleBtn.textContent = "🌙";
  }
  themeToggleBtn.title = `Theme: ${theme} (click to change)`;
}

async function loadTheme() {
  const { theme: stored } = await chrome.storage.local.get("theme");
  theme = stored || "system";
  applyTheme();
}

async function cycleTheme() {
  theme = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
  await chrome.storage.local.set({ theme });
  applyTheme();
}

// --- sort ---

async function loadSortPreference() {
  const { sortBy: stored } = await chrome.storage.local.get("sortBy");
  sortBy = stored || "window";
  sortByEl.value = sortBy;
}

async function setSortBy(value) {
  sortBy = value;
  await chrome.storage.local.set({ sortBy });
  render();
}

function sortTabsFlat(tabs) {
  const copy = [...tabs];
  if (sortBy === "title") {
    copy.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  } else if (sortBy === "domain") {
    copy.sort((a, b) => getDomain(a.url).localeCompare(getDomain(b.url)));
  } else if (sortBy === "recent") {
    copy.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
  }
  return copy;
}

// --- protected (pinned) tabs ---

async function loadProtectedUrls() {
  const { protectedUrls: stored } = await chrome.storage.local.get("protectedUrls");
  protectedUrls = new Set(stored || []);
}

async function toggleProtected(tab) {
  const key = normalizeUrl(tab.url);
  if (!key) return;
  if (protectedUrls.has(key)) {
    protectedUrls.delete(key);
  } else {
    protectedUrls.add(key);
  }
  await chrome.storage.local.set({ protectedUrls: [...protectedUrls] });
  render();
}

// --- data loading ---

async function loadTabs() {
  const [tabs, current] = await Promise.all([
    chrome.tabs.query({}),
    chrome.windows.getCurrent(),
  ]);
  allTabs = tabs.sort((a, b) => a.windowId - b.windowId || a.index - b.index);
  currentWindowId = current.id;
  render();
}

function filterTabs() {
  const query = searchEl.value.trim().toLowerCase();
  if (!query) return allTabs;
  return allTabs.filter(
    (tab) =>
      (tab.title || "").toLowerCase().includes(query) ||
      (tab.url || "").toLowerCase().includes(query)
  );
}

// --- rendering ---

function render() {
  const filtered = filterTabs();
  const duplicateUrls = getDuplicateUrlSet(allTabs);

  tabCountEl.textContent = allTabs.length;
  tabListEl.innerHTML = "";
  emptyStateEl.hidden = filtered.length > 0;

  if (sortBy === "window") {
    const groups = new Map();
    for (const tab of filtered) {
      if (!groups.has(tab.windowId)) groups.set(tab.windowId, []);
      groups.get(tab.windowId).push(tab);
    }
    let windowNumber = 0;
    for (const [windowId, tabs] of groups) {
      windowNumber += 1;
      tabListEl.appendChild(buildWindowHeader(windowId, windowNumber, tabs.length));
      for (const tab of tabs) {
        tabListEl.appendChild(buildTabItem(tab, duplicateUrls.has(normalizeUrl(tab.url))));
      }
    }
  } else {
    const sorted = sortTabsFlat(filtered);
    for (const tab of sorted) {
      tabListEl.appendChild(buildTabItem(tab, duplicateUrls.has(normalizeUrl(tab.url))));
    }
  }
}

function buildWindowHeader(windowId, windowNumber, count) {
  const header = document.createElement("li");
  header.className = "window-header";

  const label = document.createElement("span");
  label.textContent = `Window ${windowNumber} · ${count} tab${count === 1 ? "" : "s"}`;
  header.appendChild(label);

  if (windowId === currentWindowId) {
    const tag = document.createElement("span");
    tag.className = "current-tag";
    tag.textContent = "current";
    header.appendChild(tag);
  }

  return header;
}

function buildTabItem(tab, isDuplicate) {
  const li = document.createElement("li");
  li.className = "tab-item";
  li.dataset.tabId = String(tab.id);

  const isProtected = protectedUrls.has(normalizeUrl(tab.url));

  const favicon = document.createElement("img");
  favicon.className = "tab-favicon";
  favicon.src = tab.favIconUrl || "icons/icon16.png";
  favicon.alt = "";
  favicon.addEventListener("error", () => {
    favicon.src = "icons/icon16.png";
  });

  const info = document.createElement("div");
  info.className = "tab-info";

  const titleRow = document.createElement("div");
  titleRow.className = "tab-title";
  titleRow.textContent = tab.title || "(untitled)";
  if (isDuplicate) {
    const tag = document.createElement("span");
    tag.className = "duplicate-tag";
    tag.textContent = "dup";
    titleRow.appendChild(document.createTextNode(" "));
    titleRow.appendChild(tag);
  }

  const url = document.createElement("div");
  url.className = "tab-url";
  url.textContent = tab.url || "";

  info.append(titleRow, url);

  const actions = document.createElement("div");
  actions.className = "tab-actions";

  const gotoBtn = document.createElement("button");
  gotoBtn.className = "icon-btn goto-btn";
  gotoBtn.title = "Switch to this tab";
  gotoBtn.textContent = "↗";
  gotoBtn.addEventListener("click", () => switchToTab(tab));

  const pinBtn = document.createElement("button");
  pinBtn.className = "icon-btn pin-btn" + (isProtected ? " active" : "");
  pinBtn.title = isProtected ? "Unprotect this tab" : "Protect this tab from closing";
  pinBtn.textContent = "📌";
  pinBtn.addEventListener("click", () => toggleProtected(tab));

  const copyBtn = document.createElement("button");
  copyBtn.className = "icon-btn copy-btn";
  copyBtn.title = "Copy this URL";
  copyBtn.textContent = "⧉";
  copyBtn.addEventListener("click", () => copySingleUrl(tab));

  const closeBtn = document.createElement("button");
  closeBtn.className = "icon-btn close-btn";
  if (isProtected) {
    closeBtn.title = "Protected — unpin to close";
    closeBtn.textContent = "🔒";
    closeBtn.addEventListener("click", () => showStatus("Unpin this tab to close it"));
  } else {
    closeBtn.title = "Close this tab";
    closeBtn.textContent = "✕";
    closeBtn.addEventListener("click", () => closeTab(tab.id));
  }

  actions.append(gotoBtn, pinBtn, copyBtn, closeBtn);
  li.append(favicon, info, actions);
  return li;
}

// --- tab actions ---

async function switchToTab(tab) {
  await chrome.tabs.update(tab.id, { active: true });
  await chrome.windows.update(tab.windowId, { focused: true });
}

async function copySingleUrl(tab) {
  await navigator.clipboard.writeText(tab.url || "");
  showStatus("URL copied");
}

async function closeTab(tabId) {
  await chrome.tabs.remove(tabId);
  allTabs = allTabs.filter((t) => t.id !== tabId);
  render();
}

async function closeDuplicateTabs() {
  const byUrl = new Map();
  for (const tab of allTabs) {
    const key = normalizeUrl(tab.url);
    if (!key) continue;
    if (!byUrl.has(key)) byUrl.set(key, []);
    byUrl.get(key).push(tab);
  }

  const idsToClose = [];
  for (const tabs of byUrl.values()) {
    if (tabs.length < 2) continue;
    const keeper = tabs.find((t) => protectedUrls.has(normalizeUrl(t.url))) || tabs[0];
    for (const tab of tabs) {
      if (tab.id === keeper.id) continue;
      if (protectedUrls.has(normalizeUrl(tab.url))) continue;
      idsToClose.push(tab.id);
    }
  }

  if (idsToClose.length === 0) {
    showStatus("No duplicate tabs to close");
    return;
  }

  await chrome.tabs.remove(idsToClose);
  allTabs = allTabs.filter((t) => !idsToClose.includes(t.id));
  render();
  showStatus(`Closed ${idsToClose.length} duplicate tab${idsToClose.length === 1 ? "" : "s"}`);
}

async function exportAsBookmarks() {
  const source = filterTabs().filter((tab) => tab.url);
  if (source.length === 0) {
    showStatus("No tabs to export");
    return;
  }

  const folderTitle = `Tab URL Manager – ${new Date().toLocaleString()}`;
  const folder = await chrome.bookmarks.create({ title: folderTitle });
  await Promise.all(
    source.map((tab) =>
      chrome.bookmarks.create({
        parentId: folder.id,
        title: tab.title || tab.url,
        url: tab.url,
      })
    )
  );
  showStatus(`Exported ${source.length} tab${source.length === 1 ? "" : "s"} to bookmarks`);
}

function getFileExtensionForFormat(format) {
  switch (format) {
    case "csv":
      return "csv";
    case "json":
      return "json";
    case "html":
      return "html";
    default:
      return "txt";
  }
}

async function exportToFile() {
  const source = getCopySourceTabs();
  if (source.length === 0) {
    showStatus("No matching tabs to export");
    return;
  }

  const text = formatTabsForCopy(source);
  const ext = getFileExtensionForFormat(copySettings.format);
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const filename = `tab-url-manager-${Date.now()}.${ext}`;

  try {
    await chrome.downloads.download({ url, filename, saveAs: true });
    showStatus(`Exported ${source.length} tab${source.length === 1 ? "" : "s"} to file`);
  } catch {
    showStatus("Download failed or was cancelled");
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
}

async function addToReadingList() {
  if (!chrome.readingList) {
    showStatus("Reading List isn't available in this Chrome version");
    return;
  }

  const source = getCopySourceTabs();
  if (source.length === 0) {
    showStatus("No matching tabs to add");
    return;
  }

  let added = 0;
  for (const tab of source) {
    try {
      await chrome.readingList.addEntry({
        title: tab.title || tab.url,
        url: tab.url,
        hasBeenRead: false,
      });
      added++;
    } catch {
      // already in the Reading List, or an unsupported URL scheme — skip it
    }
  }
  showStatus(`Added ${added} of ${source.length} tab${source.length === 1 ? "" : "s"} to Reading List`);
}

// --- Page Links (content script) ---

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function requestLinksFromContentScript(type) {
  const tab = await getActiveTab();
  if (!tab || !/^https?:\/\//i.test(tab.url || "")) {
    showStatus("This page doesn't support link scanning");
    return null;
  }
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type });
    return response ? response.links : [];
  } catch {
    showStatus("Reload the page, then try again");
    return null;
  }
}

function renderPageLinks(links) {
  if (!links) return;
  pageLinksResultEl.value = links.map((l) => l.url).join("\n");
  showStatus(`${links.length} link${links.length === 1 ? "" : "s"} found`);
}

async function findAllPageLinks() {
  renderPageLinks(await requestLinksFromContentScript("FIND_ALL_LINKS"));
}

async function getSelectionLinks() {
  const links = await requestLinksFromContentScript("GET_SELECTION_LINKS");
  if (links && links.length === 0) {
    showStatus("No selection yet — Ctrl+drag on the page first");
    return;
  }
  renderPageLinks(links);
}

async function copyPageLinks() {
  await navigator.clipboard.writeText(pageLinksResultEl.value);
  showStatus("Copied to clipboard");
}

function sendPageLinksToOpenUrls() {
  if (!pageLinksResultEl.value.trim()) {
    showStatus("Nothing to send");
    return;
  }
  openUrlsInput.value = pageLinksResultEl.value;
  openUrlsPanelEl.open = true;
  updateOpenUrlsButtonLabel();
  showStatus("Sent to Open URLs panel");
}

function openShortcutSettings() {
  chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
}

// --- Copy Settings ---

const DEFAULT_COPY_SETTINGS = {
  scope: "all",
  exportFrom: "all",
  format: "url",
  customTemplate: "{title} - {url}",
};

let copySettings = { ...DEFAULT_COPY_SETTINGS };

function applyCopySettingsToForm() {
  document.querySelector(`input[name="copy-scope"][value="${copySettings.scope}"]`).checked = true;
  document.querySelector(
    `input[name="copy-export-from"][value="${copySettings.exportFrom}"]`
  ).checked = true;
  document.querySelector(`input[name="copy-format"][value="${copySettings.format}"]`).checked = true;
  copyCustomTemplateEl.value = copySettings.customTemplate;
  copyCustomTemplateEl.hidden = copySettings.format !== "custom";
}

function readCopySettingsFromForm() {
  copySettings = {
    scope: document.querySelector('input[name="copy-scope"]:checked').value,
    exportFrom: document.querySelector('input[name="copy-export-from"]:checked').value,
    format: document.querySelector('input[name="copy-format"]:checked').value,
    customTemplate: copyCustomTemplateEl.value || DEFAULT_COPY_SETTINGS.customTemplate,
  };
  copyCustomTemplateEl.hidden = copySettings.format !== "custom";
}

async function persistCopySettings() {
  readCopySettingsFromForm();
  await chrome.storage.local.set({ copySettings });
}

async function loadCopySettings() {
  const { copySettings: stored } = await chrome.storage.local.get("copySettings");
  copySettings = { ...DEFAULT_COPY_SETTINGS, ...(stored || {}) };
  applyCopySettingsToForm();
}

async function restoreCopyDefaults() {
  copySettings = { ...DEFAULT_COPY_SETTINGS };
  applyCopySettingsToForm();
  await chrome.storage.local.set({ copySettings });
  showStatus("Copy settings restored to defaults");
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function formatTabsForCopy(tabs) {
  const rows = tabs.map((t) => ({ title: t.title || t.url || "", url: t.url || "" }));

  switch (copySettings.format) {
    case "titleUrl":
      return rows.map((r) => `${r.title}\n${r.url}`).join("\n\n");
    case "html":
      return rows
        .map((r) => `<a href="${escapeHtml(r.url)}">${escapeHtml(r.title)}</a>`)
        .join("\n");
    case "csv":
      return rows
        .map((r) => `"${r.title.replace(/"/g, '""')}","${r.url.replace(/"/g, '""')}"`)
        .join("\n");
    case "json":
      return JSON.stringify(rows, null, 2);
    case "custom":
      return rows
        .map((r) => copySettings.customTemplate.replaceAll("{title}", r.title).replaceAll("{url}", r.url))
        .join("\n");
    case "url":
    default:
      return rows.map((r) => r.url).join("\n");
  }
}

function getCopySourceTabs() {
  let source = filterTabs();
  if (copySettings.exportFrom === "current") {
    source = source.filter((t) => t.windowId === currentWindowId);
  }
  if (copySettings.scope === "web") {
    source = source.filter((t) => /^https?:\/\//i.test(t.url || ""));
  }
  return source.filter((t) => t.url);
}

async function copyAllUrls() {
  const source = getCopySourceTabs();
  if (source.length === 0) {
    showStatus("No matching tabs to copy");
    return;
  }
  const text = formatTabsForCopy(source);
  await navigator.clipboard.writeText(text);
  showStatus(`Copied ${source.length} URL${source.length === 1 ? "" : "s"}`);
}

// --- Open URLs settings ---

const DEFAULT_OPEN_SETTINGS = {
  noLoad: false,
  randomOrder: false,
  reverseOrder: false,
  ignoreDuplicates: true,
  nonUrlSearch: true,
  mode: "tab",
  firstN: 25,
  tabGroup: "none",
  preserveInput: false,
  removeOpened: false,
  rememberList: false,
};

let openSettings = { ...DEFAULT_OPEN_SETTINGS };

function applyOpenSettingsToForm() {
  optNoLoad.checked = openSettings.noLoad;
  optRandomOrder.checked = openSettings.randomOrder;
  optReverseOrder.checked = openSettings.reverseOrder;
  optIgnoreDuplicates.checked = openSettings.ignoreDuplicates;
  optNonUrlSearch.checked = openSettings.nonUrlSearch;
  optPreserveInput.checked = openSettings.preserveInput;
  optRemoveOpened.checked = openSettings.removeOpened;
  optRememberList.checked = openSettings.rememberList;
  tabGroupSelect.value = openSettings.tabGroup;
  openFirstNInput.value = openSettings.firstN;
  document.querySelector(`input[name="open-mode"][value="${openSettings.mode}"]`).checked = true;
}

function readOpenSettingsFromForm() {
  openSettings = {
    noLoad: optNoLoad.checked,
    randomOrder: optRandomOrder.checked,
    reverseOrder: optReverseOrder.checked,
    ignoreDuplicates: optIgnoreDuplicates.checked,
    nonUrlSearch: optNonUrlSearch.checked,
    mode: document.querySelector('input[name="open-mode"]:checked').value,
    firstN: parseInt(openFirstNInput.value, 10) || 25,
    tabGroup: tabGroupSelect.value,
    preserveInput: optPreserveInput.checked,
    removeOpened: optRemoveOpened.checked,
    rememberList: optRememberList.checked,
  };
}

async function persistOpenSettings() {
  readOpenSettingsFromForm();
  await chrome.storage.local.set({ openSettings });
  if (!openSettings.rememberList) {
    await chrome.storage.local.remove("openUrlListText");
  } else {
    await chrome.storage.local.set({ openUrlListText: openUrlsInput.value });
  }
}

async function loadOpenSettings() {
  const { openSettings: stored, openUrlListText } = await chrome.storage.local.get([
    "openSettings",
    "openUrlListText",
  ]);
  openSettings = { ...DEFAULT_OPEN_SETTINGS, ...(stored || {}) };
  applyOpenSettingsToForm();
  if (openSettings.rememberList && openUrlListText) {
    openUrlsInput.value = openUrlListText;
  }
}

function parseUrlLines(text) {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function toOpenableUrl(rawLine, handleNonUrlAsSearch) {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(rawLine)) return rawLine;
  if (/^[\w-]+(\.[\w-]+)+([/?#].*)?$/.test(rawLine)) return `https://${rawLine}`;
  if (handleNonUrlAsSearch) {
    return `https://www.google.com/search?q=${encodeURIComponent(rawLine)}`;
  }
  return null;
}

function buildEntriesToOpen() {
  readOpenSettingsFromForm();
  const rawLines = parseUrlLines(openUrlsInput.value);
  let entries = rawLines
    .map((line) => ({ line, url: toOpenableUrl(line, openSettings.nonUrlSearch) }))
    .filter((e) => e.url);

  if (openSettings.ignoreDuplicates) {
    const seen = new Set();
    entries = entries.filter((e) => {
      if (seen.has(e.url)) return false;
      seen.add(e.url);
      return true;
    });
  }

  if (openSettings.reverseOrder) entries.reverse();
  if (openSettings.randomOrder) {
    for (let i = entries.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [entries[i], entries[j]] = [entries[j], entries[i]];
    }
  }

  if (openSettings.mode === "first-n") {
    entries = entries.slice(0, openSettings.firstN);
  }

  return entries;
}

function updateOpenUrlsButtonLabel() {
  readOpenSettingsFromForm();
  const count = buildEntriesToOpen().length;
  openUrlsBtn.textContent = `Open URLs (${count})`;
}

async function openUrlsFromInput() {
  const entries = buildEntriesToOpen();
  if (entries.length === 0) {
    showStatus("Paste at least one valid URL");
    return;
  }

  const createdTabIds = [];

  if (openSettings.mode === "window") {
    for (const entry of entries) {
      const win = await chrome.windows.create({ url: entry.url });
      const createdTab = win.tabs && win.tabs[0];
      if (openSettings.noLoad && createdTab) {
        try {
          await chrome.tabs.discard(createdTab.id);
        } catch {
          // discard can fail on the active tab of a brand-new window; ignore
        }
      }
    }
  } else {
    for (const entry of entries) {
      const tab = await chrome.tabs.create({ url: entry.url, active: false });
      createdTabIds.push(tab.id);
    }
    if (openSettings.noLoad) {
      for (const id of createdTabIds) {
        try {
          await chrome.tabs.discard(id);
        } catch {
          // ignore tabs that can't be discarded
        }
      }
    }
    if (openSettings.tabGroup === "new" && createdTabIds.length > 0 && chrome.tabs.group) {
      try {
        const groupId = await chrome.tabs.group({ tabIds: createdTabIds });
        await chrome.tabGroups.update(groupId, { title: "Opened URLs" });
      } catch {
        // tab groups may be unavailable in this Chrome version; ignore
      }
    }
  }

  if (openSettings.removeOpened) {
    const openedLines = new Set(entries.map((e) => e.line));
    const remaining = parseUrlLines(openUrlsInput.value).filter((l) => !openedLines.has(l));
    openUrlsInput.value = remaining.join("\n");
  } else if (!openSettings.preserveInput) {
    openUrlsInput.value = "";
  }

  if (openSettings.rememberList) {
    await chrome.storage.local.set({ openUrlListText: openUrlsInput.value });
  }

  updateOpenUrlsButtonLabel();
  showStatus(`Opened ${entries.length} URL${entries.length === 1 ? "" : "s"}`);
  await loadTabs();
}

const URL_IN_TEXT_REGEX = /\bhttps?:\/\/[^\s<>"')\]]+/gi;

function extractUrlsFromText() {
  const matches = openUrlsInput.value.match(URL_IN_TEXT_REGEX) || [];
  if (matches.length === 0) {
    showStatus("No URLs found in text");
    return;
  }
  openUrlsInput.value = matches.join("\n");
  updateOpenUrlsButtonLabel();
}

async function pasteIntoUrlsInput() {
  try {
    const text = await navigator.clipboard.readText();
    openUrlsInput.value = text;
    updateOpenUrlsButtonLabel();
  } catch {
    showStatus("Clipboard read was blocked");
  }
}

async function copyUrlsInputToClipboard() {
  await navigator.clipboard.writeText(openUrlsInput.value);
  showStatus("Copied input to clipboard");
}

function clearUrlsInput() {
  openUrlsInput.value = "";
  updateOpenUrlsButtonLabel();
}

// --- wire-up ---

searchEl.addEventListener("input", render);
sortByEl.addEventListener("change", (e) => setSortBy(e.target.value));
copyAllBtn.addEventListener("click", copyAllUrls);
closeDuplicatesBtn.addEventListener("click", closeDuplicateTabs);
exportBookmarksBtn.addEventListener("click", exportAsBookmarks);
exportFileBtn.addEventListener("click", exportToFile);
addReadingListBtn.addEventListener("click", addToReadingList);
editShortcutBtn.addEventListener("click", openShortcutSettings);
themeToggleBtn.addEventListener("click", cycleTheme);

findAllPageLinksBtn.addEventListener("click", findAllPageLinks);
getSelectionLinksBtn.addEventListener("click", getSelectionLinks);
copyPageLinksBtn.addEventListener("click", copyPageLinks);
sendPageLinksToOpenBtn.addEventListener("click", sendPageLinksToOpenUrls);

document.querySelectorAll('#copy-settings-panel input[type="radio"]').forEach((el) => {
  el.addEventListener("change", persistCopySettings);
});
copyCustomTemplateEl.addEventListener("change", persistCopySettings);
restoreCopyDefaultsBtn.addEventListener("click", restoreCopyDefaults);
copyHelpBtn.addEventListener("click", () => {
  chrome.tabs.create({ url: "https://github.com/mojumder01/Copy-urls#readme" });
});

openUrlsBtn.addEventListener("click", openUrlsFromInput);
openUrlsInput.addEventListener("input", updateOpenUrlsButtonLabel);
pasteUrlsBtn.addEventListener("click", pasteIntoUrlsInput);
copyUrlsInputBtn.addEventListener("click", copyUrlsInputToClipboard);
clearUrlsInputBtn.addEventListener("click", clearUrlsInput);
extractUrlsBtn.addEventListener("click", extractUrlsFromText);

document
  .querySelectorAll("#open-urls-panel input, #open-urls-panel select")
  .forEach((el) => {
    el.addEventListener("change", () => {
      persistOpenSettings();
      updateOpenUrlsButtonLabel();
    });
  });

chrome.tabs.onCreated.addListener(loadTabs);
chrome.tabs.onRemoved.addListener(loadTabs);
chrome.tabs.onUpdated.addListener(loadTabs);
chrome.tabs.onAttached.addListener(loadTabs);
chrome.tabs.onDetached.addListener(loadTabs);

(async function init() {
  await Promise.all([
    loadTheme(),
    loadSortPreference(),
    loadProtectedUrls(),
    loadCopySettings(),
    loadOpenSettings(),
  ]);
  updateOpenUrlsButtonLabel();
  await loadTabs();
})();
