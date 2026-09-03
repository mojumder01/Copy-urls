const tabListEl = document.getElementById("tab-list");
const tabCountEl = document.getElementById("tab-count");
const emptyStateEl = document.getElementById("empty-state");
const searchEl = document.getElementById("search");
const copyAllBtn = document.getElementById("copy-all");
const copyStatusEl = document.getElementById("copy-status");

let allTabs = [];
let statusTimer = null;

function showStatus(message) {
  clearTimeout(statusTimer);
  copyStatusEl.textContent = message;
  copyStatusEl.hidden = false;
  statusTimer = setTimeout(() => {
    copyStatusEl.hidden = true;
  }, 1800);
}

async function loadTabs() {
  allTabs = await chrome.tabs.query({});
  allTabs.sort((a, b) => a.index - b.index || a.windowId - b.windowId);
  render();
}

function render() {
  const query = searchEl.value.trim().toLowerCase();
  const filtered = query
    ? allTabs.filter(
        (tab) =>
          (tab.title || "").toLowerCase().includes(query) ||
          (tab.url || "").toLowerCase().includes(query)
      )
    : allTabs;

  tabCountEl.textContent = allTabs.length;
  tabListEl.innerHTML = "";
  emptyStateEl.hidden = filtered.length > 0;

  for (const tab of filtered) {
    tabListEl.appendChild(buildTabItem(tab));
  }
}

function buildTabItem(tab) {
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

  const title = document.createElement("div");
  title.className = "tab-title";
  title.textContent = tab.title || "(untitled)";

  const url = document.createElement("div");
  url.className = "tab-url";
  url.textContent = tab.url || "";

  info.append(title, url);

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
  closeBtn.addEventListener("click", () => closeTab(tab.id, li));

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

async function closeTab(tabId, listItemEl) {
  await chrome.tabs.remove(tabId);
  allTabs = allTabs.filter((t) => t.id !== tabId);
  listItemEl.remove();
  tabCountEl.textContent = allTabs.length;
  emptyStateEl.hidden = tabListEl.children.length > 0;
}

async function copyAllUrls() {
  const query = searchEl.value.trim().toLowerCase();
  const source = query
    ? allTabs.filter(
        (tab) =>
          (tab.title || "").toLowerCase().includes(query) ||
          (tab.url || "").toLowerCase().includes(query)
      )
    : allTabs;

  const urls = source.map((tab) => tab.url).filter(Boolean).join("\n");
  await navigator.clipboard.writeText(urls);
  showStatus(`Copied ${source.length} URL${source.length === 1 ? "" : "s"}`);
}

searchEl.addEventListener("input", render);
copyAllBtn.addEventListener("click", copyAllUrls);

chrome.tabs.onCreated.addListener(loadTabs);
chrome.tabs.onRemoved.addListener(loadTabs);
chrome.tabs.onUpdated.addListener(loadTabs);

loadTabs();
