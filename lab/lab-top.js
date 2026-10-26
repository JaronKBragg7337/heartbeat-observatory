// Way back for the lab pages (Jaron 10/26: "once you are in it you can't press anything to get back").
// Same standard as Library/Theater/World Printer Lab: "<- Heartbeat Observatory" at the top, 44 px tall, taps home.
// It goes first inside the page's own header (.top / header / .wrap / main) so it never sits on top of controls;
// a page with no header gets a floating pill. Pages that already have the link are left alone.
(function () {
  if (document.getElementById("hb-top")) return;
  var has = [].some.call(document.querySelectorAll('a[href="/"]'), function (x) { return /Heartbeat Observatory/i.test(x.textContent); });
  if (has) return;
  var a = document.createElement("a");
  a.id = "hb-top"; a.href = "/"; a.textContent = "← Heartbeat Observatory";
  var s = a.style;
  s.display = "inline-flex"; s.alignItems = "center"; s.minHeight = "44px"; s.font = "600 14px/1 system-ui,-apple-system,sans-serif";
  s.color = "#e8c98a"; s.textDecoration = "none"; s.pointerEvents = "auto"; s.position = "relative"; s.zIndex = "5";
  var box = document.querySelector("[data-hb-top-in], .top, header, .wrap, main");
  if (box) {
    var row = document.createElement("div"); row.style.margin = "0 0 2px"; row.style.pointerEvents = "auto"; row.appendChild(a);
    box.insertBefore(row, box.firstChild);
  } else {
    s.position = "fixed"; s.zIndex = "2147483000"; s.top = "calc(env(safe-area-inset-top, 0px) + 8px)"; s.left = "8px";
    s.padding = "0 14px"; s.borderRadius = "22px"; s.background = "rgba(22,18,15,.78)"; s.border = "1px solid rgba(232,180,90,.35)";
    document.body.appendChild(a);
  }
})();
