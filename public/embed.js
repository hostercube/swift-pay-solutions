/*! PayNOC Embed v1 — https://paynoc.bd
 * Usage A (auto-button):
 *   <script src="https://pay.paynoc.bd/embed.js"
 *           data-invoice="INVOICE_ID"
 *           data-label="Pay now"
 *           data-auto-redirect="1"></script>
 *
 * Usage B (inline iframe placeholder):
 *   <div data-paynoc-inline data-invoice="INVOICE_ID" style="height:720px"></div>
 *   <script src="https://pay.paynoc.bd/embed.js"></script>
 *
 * Usage C (programmatic):
 *   PayNOC.open({ invoice: "INVOICE_ID", onSuccess: (d)=>{...} });
 */
(function () {
  var HOST =
    (document.currentScript && document.currentScript.dataset.host) ||
    (location.hostname.indexOf("paynoc.bd") > -1
      ? location.protocol + "//pay.paynoc.bd"
      : location.protocol + "//" + location.host);

  function checkoutUrl(id, opts) {
    var u = HOST + "/pay/" + encodeURIComponent(id);
    var q = [];
    if (opts && opts.autoRedirect) q.push("auto_redirect=1");
    return q.length ? u + "?" + q.join("&") : u;
  }

  function css(el, s) { for (var k in s) el.style[k] = s[k]; }

  function openModal(opts) {
    var overlay = document.createElement("div");
    overlay.setAttribute("data-paynoc-overlay", "");
    css(overlay, {
      position: "fixed", inset: "0", background: "rgba(6,10,24,.72)",
      zIndex: "2147483000", display: "flex",
      alignItems: "center", justifyContent: "center", padding: "16px",
      backdropFilter: "blur(6px)",
    });
    var box = document.createElement("div");
    css(box, {
      position: "relative", width: "100%", maxWidth: "480px",
      height: "min(760px, 92vh)", background: "#0b1220",
      borderRadius: "20px", overflow: "hidden",
      boxShadow: "0 30px 80px rgba(0,0,0,.5)",
    });
    var iframe = document.createElement("iframe");
    iframe.src = checkoutUrl(opts.invoice, opts);
    iframe.setAttribute("allow", "payment *");
    css(iframe, { border: "0", width: "100%", height: "100%", display: "block" });
    var close = document.createElement("button");
    close.type = "button"; close.setAttribute("aria-label", "Close"); close.textContent = "×";
    css(close, {
      position: "absolute", top: "10px", right: "10px", width: "34px", height: "34px",
      borderRadius: "999px", border: "0", background: "rgba(0,0,0,.55)", color: "#fff",
      fontSize: "22px", lineHeight: "1", cursor: "pointer", zIndex: "2",
    });
    close.onclick = function () { cleanup(); if (opts.onClose) opts.onClose(); };
    box.appendChild(iframe); box.appendChild(close); overlay.appendChild(box);
    document.body.appendChild(overlay);

    function onMsg(e) {
      var d = e && e.data; if (!d || d.source !== "paynoc") return;
      if (d.type === "paynoc:status") {
        if (opts.onEvent) opts.onEvent(d);
        if (d.status === "completed") {
          if (opts.onSuccess) opts.onSuccess(d);
          setTimeout(cleanup, 1200);
        }
      }
    }
    function cleanup() {
      window.removeEventListener("message", onMsg);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }
    window.addEventListener("message", onMsg);
    return { close: cleanup };
  }

  function mountInline(el) {
    var id = el.getAttribute("data-invoice"); if (!id) return;
    var iframe = document.createElement("iframe");
    iframe.src = checkoutUrl(id, { autoRedirect: el.getAttribute("data-auto-redirect") === "1" });
    iframe.setAttribute("allow", "payment *");
    css(iframe, { border: "0", width: "100%", height: "100%", minHeight: "640px", display: "block", borderRadius: "16px" });
    el.innerHTML = ""; el.appendChild(iframe);
  }

  function autoBoot() {
    // Inline placeholders
    var nodes = document.querySelectorAll("[data-paynoc-inline]");
    for (var i = 0; i < nodes.length; i++) mountInline(nodes[i]);

    // Script tag with data-invoice → render a button
    var s = document.currentScript;
    if (s && s.dataset && s.dataset.invoice) {
      var btn = document.createElement("button");
      btn.type = "button"; btn.textContent = s.dataset.label || "Pay now";
      css(btn, {
        display: "inline-flex", alignItems: "center", gap: "8px",
        padding: "12px 20px", borderRadius: "12px", border: "0",
        background: "linear-gradient(135deg,#6d5efc,#8f7bff)", color: "#fff",
        fontWeight: "600", fontSize: "15px", cursor: "pointer",
        boxShadow: "0 8px 24px rgba(109,94,252,.35)",
      });
      btn.onclick = function () {
        openModal({
          invoice: s.dataset.invoice,
          autoRedirect: s.dataset.autoRedirect === "1",
        });
      };
      s.parentNode.insertBefore(btn, s);
    }
  }

  window.PayNOC = {
    open: openModal,
    checkoutUrl: checkoutUrl,
    version: "1.0.0",
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoBoot);
  } else {
    autoBoot();
  }
})();
