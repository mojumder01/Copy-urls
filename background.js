const BADGE_COLOR = "#2563eb";

async function updateBadge() {
  const tabs = await chrome.tabs.query({});
  const count = tabs.length;
  const text = count > 999 ? "999+" : String(count);
  await chrome.action.setBadgeText({ text });
  await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR });
}

chrome.tabs.onCreated.addListener(updateBadge);
chrome.tabs.onRemoved.addListener(updateBadge);
chrome.tabs.onAttached.addListener(updateBadge);
chrome.tabs.onDetached.addListener(updateBadge);
chrome.tabs.onReplaced.addListener(updateBadge);
chrome.windows.onRemoved.addListener(updateBadge);

chrome.runtime.onStartup.addListener(updateBadge);
chrome.runtime.onInstalled.addListener(updateBadge);

chrome.runtime.onMessage.addListener((message) => {
  if (message && message.type === "OPEN_LINKS" && Array.isArray(message.urls)) {
    for (const url of message.urls) {
      chrome.tabs.create({ url, active: false });
    }
  }
});

updateBadge();
