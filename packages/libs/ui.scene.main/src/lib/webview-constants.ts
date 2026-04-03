// Preload script injected into every <electrobun-webview>.
// Forwards keyboard shortcuts and detects ALL forms of URL changes.
export const SHORTCUT_PRELOAD = `
(function() {
  // Shortcuts to forward to the host app (not standard editing keys)
  var FORWARD = new Set([
    'cmd+t', 'cmd+w', 'cmd+k', 'cmd+l', 'cmd+d', 'cmd+shift+d',
    'cmd+[', 'cmd+]',
    'cmd+1', 'cmd+2', 'cmd+3', 'cmd+4', 'cmd+5', 'cmd+6', 'cmd+7', 'cmd+8', 'cmd+9'
  ]);

  document.addEventListener('keydown', function(e) {
    if (e.metaKey || e.ctrlKey) {
      var parts = ['cmd'];
      if (e.shiftKey) parts.push('shift');
      if (e.altKey) parts.push('alt');
      parts.push(e.key.toLowerCase());
      var key = parts.join('+');
      if (FORWARD.has(key)) {
        e.preventDefault();
        window.__electrobunSendToHost({ type: 'shortcut', key: key });
      }
      return;
    }
    if (e.key === 'Escape') {
      window.__electrobunSendToHost({ type: 'shortcut', key: 'escape' });
    }
  });
})();

// Universal URL change detection — covers pushState, replaceState,
// Navigation API, popstate, and any other mechanism.
(function() {
  var last = location.href;
  function check() {
    if (location.href !== last) {
      last = location.href;
      if (window.__electrobunSendToHost) {
        window.__electrobunSendToHost({ type: 'url-change', url: last });
      }
    }
  }
  // Wrap History API
  var _push = history.pushState;
  var _replace = history.replaceState;
  history.pushState = function() { var r = _push.apply(this, arguments); check(); return r; };
  history.replaceState = function() { var r = _replace.apply(this, arguments); check(); return r; };
  window.addEventListener('popstate', check);
  window.addEventListener('hashchange', check);
  // Navigation API (Safari 17.4+, used by YouTube)
  if (window.navigation) {
    window.navigation.addEventListener('navigatesuccess', check);
  }
  // Fallback: periodic check for any missed navigations
  setInterval(check, 2000);
})();

// Title change detection — reports via host-message
(function() {
  function sendTitle() {
    if (document.title && window.__electrobunSendToHost) {
      window.__electrobunSendToHost({ type: 'title-change', title: document.title });
    }
  }
  // Report title on page load
  window.addEventListener('load', function() { setTimeout(sendTitle, 100); });
  // Watch for dynamic title changes (SPAs)
  var titleEl = document.querySelector('title');
  if (titleEl) {
    new MutationObserver(sendTitle).observe(titleEl, { childList: true, characterData: true, subtree: true });
  } else {
    // Title might be added later
    new MutationObserver(function(mutations, obs) {
      var t = document.querySelector('title');
      if (t) {
        obs.disconnect();
        sendTitle();
        new MutationObserver(sendTitle).observe(t, { childList: true, characterData: true, subtree: true });
      }
    }).observe(document.head || document.documentElement, { childList: true, subtree: true });
  }
})();
`;
