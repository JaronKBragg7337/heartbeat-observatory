/**
 * Loaded on every page of the site. Two jobs:
 *
 * 1. Phone fixes every page needs (runs for everyone, before anything else).
 * 2. The site editor loader. Visitors who are not signed in stop after one
 *    localStorage read. A signed-in browser loads the editor, which asks the
 *    database whether this account is the site admin and shows the Edit button
 *    only if it is. See hb-editor-app.js.
 */
(function () {
  "use strict";

  /* 1. Phone fixes.
   * iPhone Safari zooms the whole page into any text box whose text is under
   * 16px, and on the 3D pages (which lock pinch-zoom so two-finger look does
   * not zoom the page) there was then no way back out: Jaron hit this on the
   * theater's link box, 2026-09-24. Every text box on a touch screen is 16px
   * or larger, so the zoom never starts. If a locked page is zoomed anyway,
   * leaving the box puts the page back to normal size. Desktop is untouched. */
  try {
    if (!document.getElementById("hb-phone-fixes")) {
      var style = document.createElement("style");
      style.id = "hb-phone-fixes";
      style.textContent =
        "@media (pointer: coarse) {" +
        "input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]):not([type=file]):not([type=button]):not([type=submit]):not([type=reset]):not([type=image])," +
        "textarea, select { font-size: max(16px, 1em) !important; }" +
        "}";
      (document.head || document.documentElement).appendChild(style);
    }
    var meta = document.querySelector('meta[name="viewport"]');
    var locked = meta && /user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0*)?(\s|,|$)/i.test(meta.content);
    if (locked && window.visualViewport) {
      document.addEventListener("focusout", function (e) {
        var t = e.target && e.target.tagName;
        if (t !== "INPUT" && t !== "TEXTAREA" && t !== "SELECT") return;
        if (window.visualViewport.scale <= 1.01) return;
        // Re-applying the viewport tag is what makes iOS drop the zoom.
        var original = meta.content;
        meta.content = original + ", maximum-scale=1";
        setTimeout(function () { meta.content = original; }, 60);
      }, true);
    }
  } catch (e) {}

  /* 2. The site editor, for the signed-in admin only. */
  try {
    if (!localStorage.getItem("sb-ygjpnvrwhkrowkrskftk-auth-token")) return;
  } catch (e) {
    return;
  }
  // pages shown inside the phone (or any frame) never get their own Edit button (2026-09-26)
  if (window.top !== window) return;
  if (window.__hbEditorLoader) return;
  window.__hbEditorLoader = true;
  function go() {
    import("/hb-editor-app.js").catch(function () {});
  }
  if (document.readyState === "complete") setTimeout(go, 300);
  else window.addEventListener("load", function () { setTimeout(go, 300); });
})();
