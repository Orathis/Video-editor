// Mount <hyperframes-player> into MDX marker divs, with a live variables panel.
// Mintlify's MDX sanitizer strips unknown custom elements, so pages declare
//   <div data-hf-player data-src="/public/..." data-width="1920" data-height="1080" />
// and this script (auto-injected by Mintlify) upgrades them client-side.
//
// Layout: video on the left, variables panel on the right (stacks when narrow).
// Controls are generated from the composition's own data-composition-variables
// schema (array entries {id,type,label,default,options,min,max} or an object
// map {name: {type, default}}). A data-knobs attribute on the marker div, when
// present, overrides the auto-parsed schema. Controls follow shadcn's design
// language, hand-rolled: real shadcn React components cannot run here because
// Mintlify's MDX pipeline strips imported components.
(function () {
  var STYLE_ID = "hf-knob-style";

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      ".hf-embed-row{display:flex;flex-direction:column;overflow:hidden;border-radius:16px;",
      "background:#0b0c0e;box-shadow:0 0 0 1px rgba(15,23,42,.12),0 12px 32px rgba(15,23,42,.08);}",
      ".hf-embed-row.hf-embed-preview{border-radius:0;box-shadow:none;}",
      ".hf-embed-row>[data-hf-player]{width:100%;}",
      "[data-hf-player]{position:relative;overflow:hidden;background:",
      "radial-gradient(circle at 50% 42%,#29303a 0,#15191f 42%,#0b0c0e 100%);}",
      "[data-hf-player]>hyperframes-player{position:absolute;inset:0;z-index:1;}",
      ".hf-player-poster{position:absolute;inset:0;z-index:2;display:block;width:100%;height:100%;",
      "object-fit:cover;opacity:1;transition:opacity .18s ease-out;}",
      ".hf-player-loading{position:absolute;right:12px;bottom:12px;z-index:3;padding:6px 9px;",
      "border-radius:999px;background:rgba(8,10,14,.78);color:#f8fafc;",
      "font:600 11px/1 system-ui,sans-serif;letter-spacing:.02em;",
      "box-shadow:0 0 0 1px rgba(255,255,255,.14);transition:opacity .18s ease-out;}",
      "[data-hf-ready] .hf-player-poster,[data-hf-ready] .hf-player-loading{opacity:0;pointer-events:none;}",
      "[data-hf-ready] [data-rmiz],[data-hf-ready] [data-rmiz-content]{pointer-events:none;}",
      ".hf-embed-preview [data-hf-player]{pointer-events:none;}",
      ".hf-player-error{position:absolute;inset:0;display:grid;place-items:center;padding:24px;",
      "z-index:4;background:#0b0c0e;color:#e2e8f0;",
      "font:500 14px/1.5 system-ui,sans-serif;text-align:center;}",
      ".hf-knob-panel{box-sizing:border-box;padding:14px 16px 16px;",
      "display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr));",
      "gap:12px 20px;align-items:end;border-top:1px solid var(--hfk-border);",
      "background:var(--hfk-panel);--hfk-border:#d9dee8;--hfk-panel:#f8fafc;",
      "--hfk-fg:#172033;--hfk-muted:#526079;--hfk-muted-bg:#e9edf3;",
      "--hfk-card:#ffffff;--hfk-ring:#315efb;}",
      ".dark .hf-knob-panel,[data-theme=dark] .hf-knob-panel{",
      "--hfk-border:#344054;--hfk-panel:#111827;--hfk-fg:#f1f5f9;",
      "--hfk-muted:#b8c3d4;--hfk-muted-bg:#263244;--hfk-card:#202938;--hfk-ring:#8fa8ff;}",
      ".hf-knob-panel .hfk-title{font-size:11px;font-weight:600;letter-spacing:.08em;",
      "text-transform:uppercase;color:var(--hfk-muted);margin:0;grid-column:1/-1;}",
      ".hfk-field-wide{grid-column:1/-1;}",
      ".hfk-field{display:flex;flex-direction:column;gap:6px;}",
      ".hfk-label{font-size:13px;font-weight:500;color:var(--hfk-fg);display:flex;justify-content:space-between;align-items:baseline;}",
      ".hfk-label .hfk-value{font-size:12px;font-weight:400;color:var(--hfk-muted);font-variant-numeric:tabular-nums;}",
      ".hfk-seg{display:inline-flex;width:100%;box-sizing:border-box;padding:3px;border-radius:8px;background:var(--hfk-muted-bg);gap:2px;}",
      ".hfk-seg button{flex:1 1 0;min-height:40px;border:0;border-radius:6px;padding:6px 8px;",
      "font-size:13px;font-weight:500;background:transparent;color:var(--hfk-muted);cursor:pointer;",
      "transition-property:background,color,box-shadow;transition-duration:.12s;}",
      ".hfk-seg button[aria-pressed=true]{background:var(--hfk-card);color:var(--hfk-fg);box-shadow:0 1px 2px rgba(0,0,0,.18);}",
      ".hfk-input{box-sizing:border-box;width:100%;height:40px;border-radius:8px;border:1px solid var(--hfk-border);",
      "background:transparent;color:var(--hfk-fg);padding:0 10px;font-size:13px;outline:none;}",
      ".hfk-range{width:100%;accent-color:var(--hfk-fg);height:40px;cursor:pointer;}",
      ".hfk-select{box-sizing:border-box;width:100%;height:40px;border-radius:8px;border:1px solid var(--hfk-border);",
      "background:var(--hfk-card);color:var(--hfk-fg);padding:0 10px;font-size:13px;outline:none;cursor:pointer;}",
      ".hfk-seg button:focus-visible,.hfk-input:focus-visible,.hfk-range:focus-visible,.hfk-select:focus-visible{",
      "outline:3px solid var(--hfk-ring);outline-offset:2px;}",
      "@media(max-width:520px){.hf-knob-panel{grid-template-columns:1fr;padding:14px;}",
      ".hfk-seg button,.hfk-input,.hfk-range,.hfk-select{min-height:44px;}}",
      "@media(prefers-reduced-motion:reduce){.hf-player-poster,.hf-player-loading{transition:none;}}",
    ].join("");
    var tag = document.createElement("style");
    tag.id = STYLE_ID;
    tag.textContent = css;
    document.head.appendChild(tag);
  }

  function decodeEntities(s) {
    var el = document.createElement("textarea");
    el.innerHTML = s;
    return el.value;
  }

  // Normalize both schema shapes into [{name,type,label,value,options,min,max}].
  function normalizeSchema(parsed) {
    var out = [];
    if (Array.isArray(parsed)) {
      parsed.forEach(function (v) {
        if (!v || typeof v !== "object") return;
        var name = v.id || v.name;
        if (!name) return;
        var options = null;
        if (Array.isArray(v.options)) {
          options = v.options.map(function (o) {
            return typeof o === "object"
              ? { value: o.value, label: o.label || o.value }
              : { value: o, label: o };
          });
        }
        out.push({
          name: name,
          type: v.type || (options ? "enum" : "string"),
          label: v.label || name,
          value: v.default !== undefined ? v.default : v.value,
          options: options,
          min: typeof v.min === "number" ? v.min : 0,
          max: typeof v.max === "number" ? v.max : 100,
        });
      });
    } else if (parsed && typeof parsed === "object") {
      Object.keys(parsed).forEach(function (name) {
        var v = parsed[name] || {};
        var options = Array.isArray(v.options)
          ? v.options.map(function (o) {
              return typeof o === "object"
                ? { value: o.value, label: o.label || o.value }
                : { value: o, label: o };
            })
          : null;
        out.push({
          name: name,
          type: v.type || (options ? "enum" : "string"),
          label: v.label || name,
          value: v.default !== undefined ? v.default : v.value,
          options: options,
          min: typeof v.min === "number" ? v.min : 0,
          max: typeof v.max === "number" ? v.max : 100,
        });
      });
    }
    return out;
  }

  // Pull every data-composition-variables attribute out of the fetched HTML
  // (host root and mounted sub-compositions both may declare one) and merge:
  // later declarations win per variable name, so the mounted primitive's
  // richer schema overrides a demo shell's plain one.
  function extractSchema(html) {
    var re = /data-composition-variables=(?:'([^']*)'|"([^"]*)")/g;
    var merged = {};
    var order = [];
    var m;
    while ((m = re.exec(html))) {
      var raw = decodeEntities(m[1] !== undefined ? m[1] : m[2]);
      var parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        continue;
      }
      normalizeSchema(parsed).forEach(function (item) {
        if (!(item.name in merged)) order.push(item.name);
        merged[item.name] = item;
      });
    }
    return order.map(function (n) {
      return merged[n];
    });
  }

  function buildPanel(el, knobs) {
    var values = {};
    var panel = document.createElement("div");
    panel.className = "hf-knob-panel";
    panel.setAttribute("data-hf-knobbar", "true");
    var title = document.createElement("p");
    title.className = "hfk-title";
    title.textContent = "Variables";
    panel.appendChild(title);

    var applyTimer = null;
    function apply(immediate) {
      if (applyTimer) clearTimeout(applyTimer);
      applyTimer = setTimeout(
        function () {
          el.seek(0);
          el.setAttribute("variables", JSON.stringify(values));
        },
        immediate ? 0 : 220,
      );
    }

    knobs.forEach(function (k) {
      values[k.name] = k.value;
      var field = document.createElement("div");
      field.className = "hfk-field";
      var label = document.createElement("span");
      label.className = "hfk-label";
      label.textContent = k.label;
      field.appendChild(label);

      if (k.options && k.options.length > 3) {
        var sel = document.createElement("select");
        sel.className = "hfk-select";
        sel.setAttribute("aria-label", k.label);
        k.options.forEach(function (o) {
          var opt = document.createElement("option");
          opt.value = o.value;
          opt.textContent = o.label;
          if (o.value === k.value) opt.selected = true;
          sel.appendChild(opt);
        });
        sel.addEventListener("change", function () {
          values[k.name] = sel.value;
          apply(true);
        });
        field.appendChild(sel);
      } else if (k.options && k.options.length) {
        var seg = document.createElement("div");
        seg.className = "hfk-seg";
        seg.setAttribute("role", "group");
        seg.setAttribute("aria-label", k.label);
        k.options.forEach(function (o) {
          var b = document.createElement("button");
          b.type = "button";
          b.textContent = o.label;
          b.setAttribute("aria-pressed", String(o.value === k.value));
          b.addEventListener("click", function () {
            values[k.name] = o.value;
            seg.querySelectorAll("button").forEach(function (x) {
              x.setAttribute("aria-pressed", "false");
            });
            b.setAttribute("aria-pressed", "true");
            apply(true);
          });
          seg.appendChild(b);
        });
        field.appendChild(seg);
      } else if (k.type === "number") {
        var val = document.createElement("span");
        val.className = "hfk-value";
        val.textContent = String(k.value);
        label.appendChild(val);
        var range = document.createElement("input");
        range.type = "range";
        range.className = "hfk-range";
        range.setAttribute("aria-label", k.label);
        range.min = String(k.min);
        range.max = String(k.max);
        range.value = String(k.value);
        range.addEventListener("input", function () {
          values[k.name] = Number(range.value);
          val.textContent = range.value;
          apply(false);
        });
        field.appendChild(range);
      } else {
        field.classList.add("hfk-field-wide");
        var input = document.createElement("input");
        input.type = "text";
        input.className = "hfk-input";
        input.setAttribute("aria-label", k.label);
        input.value = k.value === undefined || k.value === null ? "" : String(k.value);
        input.addEventListener("change", function () {
          values[k.name] = input.value;
          apply(true);
        });
        input.addEventListener("keydown", function (ev) {
          if (ev.key === "Enter") {
            values[k.name] = input.value;
            apply(true);
          }
        });
        field.appendChild(input);
      }
      panel.appendChild(field);
    });

    return panel;
  }

  function showError(host) {
    if (host.querySelector(".hf-player-error")) return;
    var error = document.createElement("div");
    error.className = "hf-player-error";
    error.setAttribute("role", "alert");
    error.textContent = "Preview unavailable.";
    host.setAttribute("aria-busy", "false");
    host.replaceChildren(error);
  }

  function mountKnobs(host, el, row) {
    // Author override first; else auto-parse the composition's schema.
    var knobSpec = host.getAttribute("data-knobs");
    var ready;
    if (knobSpec) {
      var knobs;
      try {
        knobs = normalizeSchema(JSON.parse(knobSpec));
      } catch {
        knobs = null;
      }
      ready = Promise.resolve(knobs);
    } else {
      var src = host.getAttribute("data-src") || "";
      ready = fetch(src, { credentials: "same-origin" })
        .then(function (r) {
          if (!r.ok) throw new Error("Unable to load composition");
          return r.text();
        })
        .then(function (html) {
          var re = /data-composition-src=(?:'([^']*)'|"([^"]*)")/g;
          var sources = [];
          var m;
          while ((m = re.exec(html))) {
            var raw = decodeEntities(m[1] !== undefined ? m[1] : m[2]);
            var resolved = new URL(raw, new URL(src, document.baseURI)).href;
            if (!sources.includes(resolved)) sources.push(resolved);
          }
          return Promise.all(
            sources.map(function (source) {
              return fetch(source, { credentials: "same-origin" }).then(function (r) {
                if (!r.ok) throw new Error("Unable to load sub-composition");
                return r.text();
              });
            }),
          ).then(function (children) {
            return extractSchema([html].concat(children).join("\n"));
          });
        })
        .catch(function () {
          showError(host);
          return null;
        });
    }
    ready.then(function (knobs) {
      if (!knobs || !knobs.length) return;
      row.appendChild(buildPanel(el, knobs));
    });
  }

  function mountPlayer(host) {
    if (!host.isConnected) {
      host.removeAttribute("data-hf-mounting");
      return;
    }
    if (host.hasAttribute("data-hf-mounted")) return;
    host.setAttribute("data-hf-mounted", "true");
    host.removeAttribute("data-hf-mounting");
    host.removeAttribute("data-hf-observed");
    var el = document.createElement("hyperframes-player");
    el.setAttribute("src", host.getAttribute("data-src") || "");
    el.setAttribute("muted", "");
    el.setAttribute("width", host.getAttribute("data-width") || "1920");
    el.setAttribute("height", host.getAttribute("data-height") || "1080");
    var poster = host.getAttribute("data-poster");
    if (poster) el.setAttribute("poster", poster);
    var preview = host.getAttribute("data-hf-preview") === "true";
    if (preview) {
      el.setAttribute("autoplay", "");
      el.setAttribute("loop", "");
      el.setAttribute("aria-hidden", "true");
    } else {
      el.setAttribute("controls", "");
    }
    el.addEventListener(
      "ready",
      function () {
        host.setAttribute("data-hf-ready", "true");
        host.setAttribute("aria-busy", "false");
      },
      { once: true },
    );
    el.addEventListener("error", function () {
      showError(host);
    });
    el.style.display = "block";
    el.style.width = "100%";
    // Without an explicit height the player's shadow wrappers collapse to
    // 0px under Mintlify's global CSS; the host div owns the aspect ratio.
    el.style.height = "100%";
    ensureStyles();
    var row = document.createElement("div");
    row.className = preview ? "hf-embed-row hf-embed-preview" : "hf-embed-row";
    host.parentNode.insertBefore(row, host);
    row.appendChild(host);
    host.appendChild(el);
    if (!preview) mountKnobs(host, el, row);
  }

  function mountAfterPoster(host) {
    if (host.hasAttribute("data-hf-mounting") || host.hasAttribute("data-hf-mounted")) return;
    host.setAttribute("data-hf-mounting", "true");
    var poster = host.querySelector(".hf-player-poster");
    if (!poster || typeof poster.decode !== "function") {
      mountPlayer(host);
      return;
    }
    poster
      .decode()
      .catch(function () {})
      .then(function () {
        mountPlayer(host);
      });
  }

  var observer =
    "IntersectionObserver" in window
      ? new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            observer.unobserve(entry.target);
            mountAfterPoster(entry.target);
          });
        })
      : null;

  function mountAll() {
    document
      .querySelectorAll(
        "[data-hf-player]:not([data-hf-mounted]):not([data-hf-mounting]):not([data-hf-observed])",
      )
      .forEach(function (host) {
        ensureStyles();
        var poster = host.getAttribute("data-poster");
        if (poster && !host.querySelector(".hf-player-poster")) {
          var img = document.createElement("img");
          img.className = "hf-player-poster";
          img.src = poster;
          img.alt = "";
          img.loading = host.getAttribute("data-hf-preview") === "true" ? "lazy" : "eager";
          img.decoding = "async";
          img.setAttribute("aria-hidden", "true");
          host.appendChild(img);
        }
        if (!host.querySelector(".hf-player-loading")) {
          var loading = document.createElement("span");
          loading.className = "hf-player-loading";
          loading.textContent = "Loading preview";
          host.appendChild(loading);
        }
        if (!observer) {
          mountAfterPoster(host);
          return;
        }
        host.setAttribute("data-hf-observed", "true");
        observer.observe(host);
      });
  }

  function start() {
    if (!("customElements" in window)) return;
    customElements.whenDefined("hyperframes-player").then(function () {
      mountAll();
      // Mintlify uses SPA routing: re-mount after client-side navigation.
      new MutationObserver(mountAll).observe(document.body, { childList: true, subtree: true });
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
