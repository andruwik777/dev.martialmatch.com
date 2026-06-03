/**
 * QR-code fullscreen dialog — isolated from current-matches.js so the main app
 * never depends on qrcodegen or QR overlay logic at init time.
 */
(function () {
  "use strict";

  var qrNavBtn = document.getElementById("mm-cm-nav-qr");
  var qrRootEl = document.getElementById("mm-cm-qr-root");
  var qrCloseBtn = document.getElementById("mm-cm-qr-close");
  var qrCanvasEl = document.getElementById("mm-cm-qr-canvas");
  var qrErrorEl = document.getElementById("mm-cm-qr-error");

  if (!qrNavBtn || !qrRootEl) return;

  var qrcodegenLoadPromise = null;

  function qrcodegenScriptUrl() {
    var scripts = document.getElementsByTagName("script");
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].getAttribute("src") || "";
      if (src.indexOf("qr-overlay.js") === -1) continue;
      return new URL("qrcodegen.js", new URL(src, window.location.href)).href;
    }
    return new URL("qrcodegen.js", window.location.href).href;
  }

  function ensureQrcodegenLoaded() {
    if (typeof qrcodegen !== "undefined") {
      return Promise.resolve();
    }
    if (qrcodegenLoadPromise) return qrcodegenLoadPromise;
    qrcodegenLoadPromise = new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = qrcodegenScriptUrl();
      script.onload = function () {
        if (typeof qrcodegen !== "undefined") resolve();
        else reject(new Error("qrcodegen_missing"));
      };
      script.onerror = function () {
        reject(new Error("qrcodegen_load_failed"));
      };
      document.head.appendChild(script);
    });
    return qrcodegenLoadPromise;
  }

  function showQrError(message) {
    if (!qrCanvasEl || !qrErrorEl) return;
    qrCanvasEl.classList.add("is-hidden");
    qrCanvasEl.setAttribute("aria-hidden", "true");
    qrErrorEl.textContent = message;
    qrErrorEl.classList.remove("is-hidden");
  }

  function drawQrCodeOnCanvas(url, canvas) {
    if (!canvas || typeof qrcodegen === "undefined") {
      throw new Error("qr_unavailable");
    }
    var qr = qrcodegen.QrCode.encodeText(url, qrcodegen.QrCode.Ecc.LOW);
    var border = 4;
    var moduleCount = qr.size + border * 2;
    var maxCssPx = Math.min(
      window.innerWidth * 0.85,
      Math.min(window.innerHeight * 0.55, 288)
    );
    var scale = Math.max(1, Math.floor(maxCssPx / moduleCount));
    var width = moduleCount * scale;
    canvas.width = width;
    canvas.height = width;
    canvas.style.width = width + "px";
    canvas.style.height = width + "px";
    var ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas_context");
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, width, width);
    for (var y = -border; y < qr.size + border; y++) {
      for (var x = -border; x < qr.size + border; x++) {
        if (qr.getModule(x, y)) {
          ctx.fillStyle = "#000000";
          ctx.fillRect(
            (x + border) * scale,
            (y + border) * scale,
            scale,
            scale
          );
        }
      }
    }
  }

  function renderQrContent() {
    if (!qrCanvasEl || !qrErrorEl) return;
    qrErrorEl.textContent = "";
    qrErrorEl.classList.add("is-hidden");
    qrCanvasEl.classList.remove("is-hidden");
    qrCanvasEl.removeAttribute("aria-hidden");
    ensureQrcodegenLoaded()
      .then(function () {
        try {
          drawQrCodeOnCanvas(window.location.href, qrCanvasEl);
        } catch (err) {
          showQrError(
            "Could not generate QR code for this link — it may be too long."
          );
        }
      })
      .catch(function () {
        showQrError(
          "Could not load QR generator — check your connection and try again."
        );
      });
  }

  function openQrOverlay() {
    renderQrContent();
    qrRootEl.classList.remove("is-hidden");
    qrRootEl.setAttribute("aria-hidden", "false");
    document.body.classList.add("mm-cm-help-open");
    qrNavBtn.setAttribute("aria-expanded", "true");
    if (qrCloseBtn) qrCloseBtn.focus();
  }

  function closeQrOverlay() {
    qrRootEl.classList.add("is-hidden");
    qrRootEl.setAttribute("aria-hidden", "true");
    document.body.classList.remove("mm-cm-help-open");
    qrNavBtn.setAttribute("aria-expanded", "false");
    qrNavBtn.focus();
  }

  qrNavBtn.setAttribute("aria-expanded", "false");
  qrNavBtn.addEventListener("click", function () {
    if (qrRootEl.classList.contains("is-hidden")) openQrOverlay();
    else closeQrOverlay();
  });
  if (qrCloseBtn) {
    qrCloseBtn.addEventListener("click", closeQrOverlay);
  }

  document.addEventListener("keydown", function (ev) {
    if (ev.key !== "Escape") return;
    if (!qrRootEl.classList.contains("is-hidden")) {
      ev.preventDefault();
      closeQrOverlay();
    }
  });
})();
