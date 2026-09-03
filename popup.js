const tabListEl = document.getElementById("tab-list");
const tabCountEl = document.getElementById("tab-count");
const emptyStateEl = document.getElementById("empty-state");
const searchEl = document.getElementById("search");
const sortByEl = document.getElementById("sort-by");
const copyAllBtn = document.getElementById("copy-all");
const closeDuplicatesBtn = document.getElementById("close-duplicates");
const exportBookmarksBtn = document.getElementById("export-bookmarks");
const editShortcutBtn = document.getElementById("edit-shortcut");
const themeToggleBtn = document.getElementById("theme-toggle");
const copyStatusEl = document.getElementById("copy-status");
const versionEl = document.getElementById("version");
const openUrlsInput = document.getElementById("open-urls-input");
const openUrlsBtn = document.getElementById("open-urls-btn");
const openNewWindowCheckbox = document.getElementById("open-new-window");

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

// --- actions ---

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

async function copyAllUrls() {
  const source = filterTabs();
  const urls = source.map((tab) => tab.url).filter(Boolean).join("\n");
  await navigator.clipboard.writeText(urls);
  showStatus(`Copied ${source.length} URL${source.length === 1 ? "" : "s"}`);
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

function openShortcutSettings() {
  chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
}

function toOpenableUrl(rawLine) {
  const trimmed = rawLine.trim();
  if (!trimmed) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed;
  if (/^[\w-]+(\.[\w-]+)+([/?#].*)?$/.test(trimmed)) return `https://${trimmed}`;
  return null;
}

async function openUrlsFromInput() {
  const rawLines = openUrlsInput.value.split("\n");
  const urls = [...new Set(rawLines.map(toOpenableUrl).filter(Boolean))];

  if (urls.length === 0) {
    showStatus("Paste at least one valid URL");
    return;
  }

  if (openNewWindowCheckbox.checked) {
    await chrome.windows.create({ url: urls });
  } else {
    for (const url of urls) {
      await chrome.tabs.create({ url, active: false });
    }
  }

  openUrlsInput.value = "";
  showStatus(`Opened ${urls.length} URL${urls.length === 1 ? "" : "s"}`);
  await loadTabs();
}

searchEl.addEventListener("input", render);
sortByEl.addEventListener("change", (e) => setSortBy(e.target.value));
copyAllBtn.addEventListener("click", copyAllUrls);
closeDuplicatesBtn.addEventListener("click", closeDuplicateTabs);
exportBookmarksBtn.addEventListener("click", exportAsBookmarks);
editShortcutBtn.addEventListener("click", openShortcutSettings);
themeToggleBtn.addEventListener("click", cycleTheme);
openUrlsBtn.addEventListener("click", openUrlsFromInput);

chrome.tabs.onCreated.addListener(loadTabs);
chrome.tabs.onRemoved.addListener(loadTabs);
chrome.tabs.onUpdated.addListener(loadTabs);
chrome.tabs.onAttached.addListener(loadTabs);
chrome.tabs.onDetached.addListener(loadTabs);

(async function init() {
  await Promise.all([loadTheme(), loadSortPreference(), loadProtectedUrls()]);
  await loadTabs();
})();
