(function () {
  "use strict";

  const root = document.documentElement;
  const nav = navigator || {};
  const screenPixels = Math.max(1, (screen.width || innerWidth || 1) * (screen.height || innerHeight || 1));
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const isCoarse = matchMedia("(pointer: coarse)").matches || (nav.maxTouchPoints || 0) > 0;
  const memory = typeof nav.deviceMemory === "number" ? nav.deviceMemory : null;
  const cores = typeof nav.hardwareConcurrency === "number" ? nav.hardwareConcurrency : null;

  function getGlCaps() {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: false })
      || canvas.getContext("webgl", { failIfMajorPerformanceCaveat: false })
      || canvas.getContext("experimental-webgl", { failIfMajorPerformanceCaveat: false });
    if (!gl) return { available: false, version: "none", extensions: [] };
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    const extensions = gl.getSupportedExtensions ? gl.getSupportedExtensions() || [] : [];
    return {
      available: true,
      version: typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext ? "webgl2" : "webgl1",
      renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      vendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      maxRenderbufferSize: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
      extensions,
      compressedTextures: {
        astc: extensions.includes("WEBGL_compressed_texture_astc"),
        etc: extensions.includes("WEBGL_compressed_texture_etc") || extensions.includes("WEBGL_compressed_texture_etc1"),
        pvrtc: extensions.includes("WEBGL_compressed_texture_pvrtc") || extensions.includes("WEBKIT_WEBGL_compressed_texture_pvrtc"),
        s3tc: extensions.includes("WEBGL_compressed_texture_s3tc")
      }
    };
  }

  const gl = getGlCaps();
  const strongPhone = isCoarse
    && gl.version === "webgl2"
    && (memory === null || memory >= 4)
    && (cores === null || cores >= 6)
    && gl.maxTextureSize >= 8192
    && dpr <= 3.5;
  const weakPhone = isCoarse && (
    !gl.available
    || gl.version !== "webgl2"
    || (memory !== null && memory <= 2)
    || (cores !== null && cores <= 4)
    || screenPixels * dpr * dpr > 14000000
  );

  const tier = !gl.available
    ? "no-webgl"
    : isCoarse
      ? (strongPhone && !weakPhone ? "mobile-high" : "mobile-lite")
      : "desktop";

  function rendererPixelRatio(maxDesktop, maxMobileHigh, maxMobileLite) {
    const desktopMax = typeof maxDesktop === "number" ? maxDesktop : 2;
    const highMax = typeof maxMobileHigh === "number" ? maxMobileHigh : 1.5;
    const liteMax = typeof maxMobileLite === "number" ? maxMobileLite : 1.15;
    if (tier === "desktop") return Math.min(dpr, desktopMax);
    if (tier === "mobile-high") return Math.min(dpr, highMax);
    return Math.min(dpr, liteMax);
  }

  const quality = {
    tier,
    isTouch: isCoarse,
    webgl2: gl.version === "webgl2",
    allowShadows: tier === "desktop" || tier === "mobile-high",
    allowBloom: tier === "desktop" || tier === "mobile-high",
    allowDenseProps: tier !== "mobile-lite" && tier !== "no-webgl",
    preferCompressedTextures: gl.compressedTextures && Object.values(gl.compressedTextures).some(Boolean),
    maxPixelRatio: rendererPixelRatio(2, 1.5, 1.15),
    textureBudgetMB: tier === "desktop" ? 384 : tier === "mobile-high" ? 160 : 80
  };

  const caps = { tier, isCoarse, dpr, screenPixels, memory, cores, gl, quality };
  window.HBDevice = Object.freeze({
    caps,
    tier,
    quality,
    rendererPixelRatio,
    isAtLeastMobileHigh: function () { return tier === "desktop" || tier === "mobile-high"; }
  });

  root.dataset.hbTier = tier;
  root.dataset.hbWebgl = gl.version;
  root.classList.add("hb-tier-" + tier);
  if (isCoarse) root.classList.add("hb-touch");
  root.style.setProperty("--hb-render-scale", String(quality.maxPixelRatio));
  window.dispatchEvent(new CustomEvent("hb:device-tier", { detail: caps }));
})();
