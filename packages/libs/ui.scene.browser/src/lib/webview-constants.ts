// Preload script injected into every <electrobun-webview>.
// Forwards keyboard shortcuts and detects ALL forms of URL changes.
export const SHORTCUT_PRELOAD = `
document.addEventListener('keydown', function(e) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    window.__electrobunSendToHost({ type: 'shortcut', key: 'cmd+k' });
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'l') {
    e.preventDefault();
    window.__electrobunSendToHost({ type: 'shortcut', key: 'cmd+l' });
  }
  if (e.key === 'Escape') {
    window.__electrobunSendToHost({ type: 'shortcut', key: 'escape' });
  }
});

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
`;
