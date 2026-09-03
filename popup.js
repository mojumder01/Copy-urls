const tabListEl = document.getElementById("tab-list");
const tabCountEl = document.getElementById("tab-count");
const emptyStateEl = document.getElementById("empty-state");
const searchEl = document.getElementById("search");
const copyAllBtn = document.getElementById("copy-all");
const closeDuplicatesBtn = document.getElementById("close-duplicates");
const editShortcutBtn = document.getElementById("edit-shortcut");
const copyStatusEl = document.getElementById("copy-status");

let allTabs = [];
let currentWindowId = null;
let statusTimer = null;

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

function render() {
  const filtered = filterTabs();
  const duplicateUrls = getDuplicateUrlSet(allTabs);

  tabCountEl.textContent = allTabs.length;
  tabListEl.innerHTML = "";
  emptyStateEl.hidden = filtered.length > 0;

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

  const copyBtn = document.createElement("button");
  copyBtn.className = "icon-btn copy-btn";
  copyBtn.title = "Copy this URL";
  copyBtn.textContent = "⧉";
  copyBtn.addEventListener("click", () => copySingleUrl(tab));

  const closeBtn = document.createElement("button");
  closeBtn.className = "icon-btn close-btn";
  closeBtn.title = "Close this tab";
  closeBtn.textContent = "✕";
  closeBtn.addEventListener("click", () => closeTab(tab.id));

  actions.append(gotoBtn, copyBtn, closeBtn);
  li.append(favicon, info, actions);
  return li;
}

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
  const seenUrls = new Set();
  const idsToClose = [];
  for (const tab of allTabs) {
    const key = normalizeUrl(tab.url);
    if (!key) continue;
    if (seenUrls.has(key)) {
      idsToClose.push(tab.id);
    } else {
      seenUrls.add(key);
    }
  }

  if (idsToClose.length === 0) {
    showStatus("No duplicate tabs found");
    return;
  }

  await chrome.tabs.remove(idsToClose);
  allTabs = allTabs.filter((t) => !idsToClose.includes(t.id));
  render();
  showStatus(`Closed ${idsToClose.length} duplicate tab${idsToClose.length === 1 ? "" : "s"}`);
}

function openShortcutSettings() {
  chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
}

searchEl.addEventListener("input", render);
copyAllBtn.addEventListener("click", copyAllUrls);
closeDuplicatesBtn.addEventListener("click", closeDuplicateTabs);
editShortcutBtn.addEventListener("click", openShortcutSettings);

chrome.tabs.onCreated.addListener(loadTabs);
chrome.tabs.onRemoved.addListener(loadTabs);
chrome.tabs.onUpdated.addListener(loadTabs);
chrome.tabs.onAttached.addListener(loadTabs);
chrome.tabs.onDetached.addListener(loadTabs);

loadTabs();
