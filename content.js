(function () {
  if (window.__tabUrlManagerContentLoaded) return;
  window.__tabUrlManagerContentLoaded = true;

  let hoveredAnchor = null;
  let selectionLinks = [];
  let isSelecting = false;
  let selectStart = null;
  let selectBoxEl = null;
  let toastTimer = null;

  function resolveLinks(elements) {
    const seen = new Map();
    for (const a of elements) {
      const href = a.href;
      if (!href || !/^https?:\/\//i.test(href)) continue;
      if (!seen.has(href)) {
        seen.set(href, { url: href, text: (a.textContent || "").trim().slice(0, 200) });
      }
    }
    return [...seen.values()];
  }

  function findAllLinks() {
    return resolveLinks(document.querySelectorAll("a[href]"));
  }

  function copyText(text) {
    navigator.clipboard.writeText(text).catch(() => {});
  }

  function showToast(message, actions) {
    const existing = document.getElementById("tum-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "tum-toast";
    toast.className = "tum-toast";

    const text = document.createElement("span");
    text.textContent = message;
    toast.appendChild(text);

    for (const action of actions || []) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = action.label;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        action.onClick();
        toast.remove();
      });
      toast.appendChild(btn);
    }

    document.documentElement.appendChild(toast);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.remove(), 6000);
  }

  // --- hover + Ctrl/Cmd+C copy ---

  document.addEventListener(
    "mouseover",
    (e) => {
      const a = e.target instanceof Element ? e.target.closest("a[href]") : null;
      hoveredAnchor = a || null;
    },
    true
  );

  document.addEventListener(
    "keydown",
    (e) => {
      const isCopyCombo = (e.ctrlKey || e.metaKey) && (e.key === "c" || e.key === "C");
      if (!isCopyCombo || !hoveredAnchor) return;
      const href = hoveredAnchor.href;
      if (!href) return;
      e.preventDefault();
      copyText(href);
      showToast(`Copied link: ${href}`);
    },
    true
  );

  // --- Ctrl+drag area select ---

  function rectsIntersect(a, b) {
    return !(b.left > a.right || b.right < a.left || b.top > a.bottom || b.bottom < a.top);
  }

  function ensureSelectBox() {
    if (!selectBoxEl) {
      selectBoxEl = document.createElement("div");
      selectBoxEl.className = "tum-select-box";
      document.documentElement.appendChild(selectBoxEl);
    }
    return selectBoxEl;
  }

  function updateSelectBox(x1, y1, x2, y2) {
    const box = ensureSelectBox();
    box.style.left = `${Math.min(x1, x2)}px`;
    box.style.top = `${Math.min(y1, y2)}px`;
    box.style.width = `${Math.abs(x2 - x1)}px`;
    box.style.height = `${Math.abs(y2 - y1)}px`;
    box.style.display = "block";
  }

  function clearHighlights() {
    document.querySelectorAll(".tum-highlight").forEach((el) => el.classList.remove("tum-highlight"));
  }

  document.addEventListener(
    "mousedown",
    (e) => {
      if (!e.ctrlKey || e.button !== 0) return;
      isSelecting = true;
      selectStart = { x: e.pageX, y: e.pageY };
      clearHighlights();
      e.preventDefault();
    },
    true
  );

  document.addEventListener(
    "mousemove",
    (e) => {
      if (!isSelecting || !selectStart) return;
      updateSelectBox(selectStart.x, selectStart.y, e.pageX, e.pageY);
    },
    true
  );

  document.addEventListener(
    "mouseup",
    (e) => {
      if (!isSelecting || !selectStart) return;
      isSelecting = false;
      if (selectBoxEl) selectBoxEl.style.display = "none";

      const x1 = Math.min(selectStart.x, e.pageX);
      const y1 = Math.min(selectStart.y, e.pageY);
      const x2 = Math.max(selectStart.x, e.pageX);
      const y2 = Math.max(selectStart.y, e.pageY);
      selectStart = null;

      if (x2 - x1 < 4 && y2 - y1 < 4) return;

      const selRect = { left: x1, top: y1, right: x2, bottom: y2 };
      const matches = [];
      document.querySelectorAll("a[href]").forEach((a) => {
        const r = a.getBoundingClientRect();
        const pageRect = {
          left: r.left + window.scrollX,
          top: r.top + window.scrollY,
          right: r.right + window.scrollX,
          bottom: r.bottom + window.scrollY,
        };
        if (rectsIntersect(selRect, pageRect)) {
          a.classList.add("tum-highlight");
          matches.push(a);
        }
      });

      selectionLinks = resolveLinks(matches);

      if (selectionLinks.length === 0) {
        showToast("No links found in selection");
        return;
      }

      showToast(`${selectionLinks.length} link${selectionLinks.length === 1 ? "" : "s"} selected`, [
        {
          label: "Copy",
          onClick: () => {
            copyText(selectionLinks.map((l) => l.url).join("\n"));
            showToast("Copied to clipboard");
          },
        },
        {
          label: "Open All",
          onClick: () => {
            chrome.runtime.sendMessage({
              type: "OPEN_LINKS",
              urls: selectionLinks.map((l) => l.url),
            });
          },
        },
      ]);
    },
    true
  );

  // --- extract URLs from a right-click text selection ---

  document.addEventListener("contextmenu", () => {
    const selectedText = window.getSelection ? String(window.getSelection()) : "";
    window.__tumLastSelectedText = selectedText;
  });

  // --- messaging with popup / background ---

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "FIND_ALL_LINKS") {
      sendResponse({ links: findAllLinks() });
    } else if (message.type === "GET_SELECTION_LINKS") {
      sendResponse({ links: selectionLinks });
    } else if (message.type === "GET_LAST_SELECTED_TEXT") {
      sendResponse({ text: window.__tumLastSelectedText || "" });
    }
    return true;
  });
})();
