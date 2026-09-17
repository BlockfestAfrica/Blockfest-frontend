(function () {
  "use strict";

  var current =
    document.currentScript ||
    document.querySelector("script[data-site][src*='script.js']");
  if (!current) return;

  var siteId = current.getAttribute("data-site");
  if (!siteId) return;

  // Optional declared domain from the install snippet (documentation / future checks).
  var siteDomain =
    current.getAttribute("data-domain") || current.getAttribute("domain") || "";

  // Short path. "/collect" is commonly blocked by Arc / uBlock filter lists.
  var endpoint =
    current.getAttribute("data-api") ||
    new URL("/api/e", current.src).href;

  function storageGet(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function storageSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  }

  function randomId() {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  var visitorKey = "sb_vid_" + siteId;
  var sessionKey = "sb_sid_" + siteId;
  var sessionTsKey = "sb_sts_" + siteId;
  var attrKey = "sb_attr_" + siteId;

  var visitorId = storageGet(visitorKey);
  if (!visitorId) {
    visitorId = randomId();
    storageSet(visitorKey, visitorId);
  }

  var now = Date.now();
  var sessionId = storageGet(sessionKey);
  var sessionTs = Number(storageGet(sessionTsKey) || 0);
  if (!sessionId || now - sessionTs > 30 * 60 * 1000) {
    sessionId = randomId();
    storageSet(sessionKey, sessionId);
  }
  storageSet(sessionTsKey, String(now));

  function captureAttribution() {
    try {
      var params = new URLSearchParams(location.search);
      var next = {};
      var keys = [
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_content",
        "utm_term",
      ];
      var found = false;
      for (var i = 0; i < keys.length; i++) {
        var value = params.get(keys[i]);
        if (value && value.trim()) {
          next[keys[i]] = value.trim().slice(0, 128);
          found = true;
        }
      }
      if (!found) return;
      // First-touch within this browser profile: keep existing campaign if set.
      var existingRaw = storageGet(attrKey);
      if (existingRaw) {
        try {
          var existing = JSON.parse(existingRaw);
          if (existing && existing.utm_campaign) return;
        } catch {
          /* replace below */
        }
      }
      storageSet(attrKey, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  function getAttribution() {
    try {
      var raw = storageGet(attrKey);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed
        : {};
    } catch {
      return {};
    }
  }

  /**
   * Query string with sb_vid, sb_sid, and UTMs for any off-page handoff
   * (checkout, booking, auth, Typeform, etc.).
   */
  function handoffParams() {
    var params = new URLSearchParams();
    params.set("sb_vid", visitorId);
    params.set("sb_sid", sessionId);
    var attr = getAttribution();
    var keys = Object.keys(attr);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (typeof attr[key] === "string" && attr[key]) {
        params.set(key, attr[key]);
      }
    }
    // Prefer live URL UTMs when present (last click on this page).
    try {
      var live = new URLSearchParams(location.search);
      [
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_content",
        "utm_term",
      ].forEach(function (key) {
        var value = live.get(key);
        if (value && value.trim()) params.set(key, value.trim());
      });
    } catch {
      /* ignore */
    }
    return params.toString();
  }

  /** @deprecated use handoffParams */
  function checkoutParams() {
    return handoffParams();
  }

  /** Append handoff params to any outbound URL (merges with existing query). */
  function appendHandoffParams(url) {
    var extra = handoffParams();
    if (!extra) return url;
    try {
      var parsed = new URL(url, location.href);
      var incoming = new URLSearchParams(extra);
      incoming.forEach(function (value, key) {
        parsed.searchParams.set(key, value);
      });
      return parsed.toString();
    } catch {
      var sep = url.indexOf("?") >= 0 ? "&" : "?";
      return url + sep + extra;
    }
  }

  captureAttribution();

  function isArcBrowser() {
    try {
      var styles = getComputedStyle(document.documentElement);
      // Only present on some Arc setups (e.g. themed/Boost sites), after load.
      return !!(
        styles.getPropertyValue("--arc-palette-title").trim() ||
        styles.getPropertyValue("--arc-palette-background").trim() ||
        styles.getPropertyValue("--arc-palette-hover").trim()
      );
    } catch {
      return false;
    }
  }

  function detectBrowserSync() {
    if (isArcBrowser()) return "Arc";

    try {
      var brands =
        navigator.userAgentData && navigator.userAgentData.brands
          ? navigator.userAgentData.brands
          : [];
      for (var i = 0; i < brands.length; i++) {
        var brand = (brands[i].brand || "").toLowerCase();
        if (brand.indexOf("brave") !== -1) return "Brave";
        if (brand.indexOf("arc") !== -1) return "Arc";
      }
    } catch {
      /* ignore */
    }

    var ua = navigator.userAgent || "";
    if (/Brave/i.test(ua)) return "Brave";
    return null;
  }

  function send(path, type, browser, extra) {
    var body = {
      siteId: siteId,
      type: type || "page_view",
      path: path || location.pathname + location.search,
      referrer: document.referrer || null,
      hostname: location.hostname || null,
      visitorId: visitorId,
      sessionId: sessionId,
    };
    if (browser) body.browser = browser;
    if (extra) {
      if (extra.vitalName) body.vitalName = extra.vitalName;
      if (typeof extra.vitalValue === "number") body.vitalValue = extra.vitalValue;
      if (extra.eventName) body.eventName = extra.eventName;
      if (extra.props) body.props = extra.props;
    }

    var payload = JSON.stringify(body);

    if (typeof fetch === "function") {
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
        mode: "cors",
        credentials: "omit",
      }).catch(function () {});
      return;
    }

    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        endpoint,
        new Blob([payload], { type: "application/json" }),
      );
    }
  }

  var cachedBrowser = detectBrowserSync();
  var booted = false;

  function boot(browser) {
    if (booted) return;
    booted = true;
    cachedBrowser = browser || cachedBrowser || detectBrowserSync();
    send(undefined, undefined, cachedBrowser);
  }

  function track(name, props) {
    if (!name || typeof name !== "string") return;
    var eventName = name.trim().slice(0, 64);
    if (!eventName) return;

    var cleanProps = {};

    if (props && typeof props === "object" && !Array.isArray(props)) {
      var keys = Object.keys(props);
      for (var i = 0; i < keys.length && Object.keys(cleanProps).length < 12; i++) {
        var key = keys[i];
        if (typeof key !== "string" || key.length > 32) continue;
        var value = props[key];
        if (
          value === null ||
          typeof value === "boolean" ||
          (typeof value === "number" && isFinite(value)) ||
          typeof value === "string"
        ) {
          cleanProps[key] =
            typeof value === "string" ? value.slice(0, 128) : value;
        }
      }
    }

    var attr = getAttribution();
    var attrKeys = Object.keys(attr);
    for (var a = 0; a < attrKeys.length && Object.keys(cleanProps).length < 12; a++) {
      var attrKeyName = attrKeys[a];
      if (cleanProps[attrKeyName] !== undefined) continue;
      if (typeof attr[attrKeyName] === "string") {
        cleanProps[attrKeyName] = attr[attrKeyName];
      }
    }

    if (Object.keys(cleanProps).length === 0) cleanProps = undefined;

    send(undefined, "custom", cachedBrowser, {
      eventName: eventName,
      props: cleanProps,
    });
  }

  function observeWebVitals() {
    if (!window.PerformanceObserver) return;

    var vitalPath = location.pathname + location.search;
    var lcp = 0;
    var inp = 0;
    var cls = 0;
    var sent = false;

    function observe(type, callback) {
      try {
        var observer = new PerformanceObserver(function (list) {
          callback(list.getEntries());
        });
        observer.observe(
          type === "event"
            ? { type: type, buffered: true, durationThreshold: 40 }
            : { type: type, buffered: true },
        );
      } catch {
        // The browser does not support this Web Vitals entry type.
      }
    }

    observe("largest-contentful-paint", function (entries) {
      var last = entries[entries.length - 1];
      if (last) lcp = Math.round(last.startTime);
    });

    observe("event", function (entries) {
      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i];
        if (entry.interactionId && entry.duration > inp) {
          inp = Math.round(entry.duration);
        }
      }
    });

    observe("layout-shift", function (entries) {
      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i];
        if (!entry.hadRecentInput) cls += entry.value;
      }
    });

    function sendVitals() {
      if (sent) return;
      sent = true;
      if (lcp > 0) send(vitalPath, "web_vital", cachedBrowser, { vitalName: "LCP", vitalValue: lcp });
      if (inp > 0) send(vitalPath, "web_vital", cachedBrowser, { vitalName: "INP", vitalValue: inp });
      send(vitalPath, "web_vital", cachedBrowser, { vitalName: "CLS", vitalValue: Math.round(cls * 1000) / 1000 });
    }

    addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") sendVitals();
    });
    addEventListener("pagehide", sendVitals);
  }

  if (navigator.brave && typeof navigator.brave.isBrave === "function") {
    try {
      Promise.resolve(navigator.brave.isBrave())
        .then(function (isBrave) {
          boot(isBrave ? "Brave" : cachedBrowser);
        })
        .catch(function () {
          boot(cachedBrowser);
        });
    } catch {
      boot(cachedBrowser);
    }
  } else if (!cachedBrowser) {
    // Best-effort Arc: CSS vars may appear shortly after load.
    function finish() {
      boot(detectBrowserSync());
    }
    if (document.readyState === "complete") {
      setTimeout(finish, 300);
    } else {
      window.addEventListener("load", function () {
        setTimeout(finish, 300);
      });
    }
    setTimeout(finish, 1200);
  } else {
    boot(cachedBrowser);
  }

  observeWebVitals();

  var lastPath = location.pathname + location.search;
  var pushState = history.pushState;
  history.pushState = function () {
    pushState.apply(history, arguments);
    var next = location.pathname + location.search;
    if (next !== lastPath) {
      lastPath = next;
      send(next, undefined, cachedBrowser);
    }
  };

  window.addEventListener("popstate", function () {
    var next = location.pathname + location.search;
    if (next !== lastPath) {
      lastPath = next;
      send(next, undefined, cachedBrowser);
    }
  });

  function isOutboundHref(href) {
    if (!href) return false;
    var trimmed = href.trim();
    if (
      !trimmed ||
      trimmed.charAt(0) === "#" ||
      trimmed.indexOf("javascript:") === 0 ||
      trimmed.indexOf("mailto:") === 0 ||
      trimmed.indexOf("tel:") === 0
    ) {
      return false;
    }
    try {
      var parsed = new URL(trimmed, location.href);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return false;
      }
      var targetHost = parsed.hostname.replace(/^www\./i, "").toLowerCase();
      var currentHost = location.hostname.replace(/^www\./i, "").toLowerCase();
      return targetHost.length > 0 && targetHost !== currentHost;
    } catch {
      return false;
    }
  }

  function normalizeOutboundLabel(href) {
    try {
      var parsed = new URL(href, location.href);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return null;
      }
      var host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
      if (!host) return null;
      var path =
        parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/+$/, "");
      var query = parsed.search || "";
      var hash = parsed.hash || "";
      return (host + path + query + hash).slice(0, 2048);
    } catch {
      return null;
    }
  }

  function trackOutboundClick(href) {
    var label = normalizeOutboundLabel(href);
    if (!label) return;
    send(label, "outbound_click", cachedBrowser);
  }

  document.addEventListener(
    "click",
    function (event) {
      var target = event.target;
      if (!target || !target.closest) return;
      var anchor = target.closest("a[href]");
      if (!anchor) return;
      var href = anchor.getAttribute("href");
      if (!isOutboundHref(href)) return;
      trackOutboundClick(href);
    },
    true,
  );

  window.sabilytics = {
    track: track,
    siteId: siteId,
    domain: siteDomain || null,
    visitorId: visitorId,
    sessionId: sessionId,
    getAttribution: getAttribution,
    handoffParams: handoffParams,
    appendHandoffParams: appendHandoffParams,
    checkoutParams: checkoutParams,
  };
})();
