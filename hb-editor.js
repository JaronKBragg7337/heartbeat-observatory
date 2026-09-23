/**
 * Site editor loader. On every page, costs one localStorage read.
 *
 * Visitors who are not signed in stop here. A signed-in browser loads the
 * editor, which asks the database whether this account is the site admin and
 * shows the Edit button only if it is. See hb-editor-app.js.
 */
(function () {
  "use strict";
  try {
    if (!localStorage.getItem("sb-ygjpnvrwhkrowkrskftk-auth-token")) return;
  } catch (e) {
    return;
  }
  if (window.__hbEditorLoader) return;
  window.__hbEditorLoader = true;
  function go() {
    import("/hb-editor-app.js").catch(function () {});
  }
  if (document.readyState === "complete") setTimeout(go, 300);
  else window.addEventListener("load", function () { setTimeout(go, 300); });
})();
