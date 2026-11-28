/* SAFEGUARD literature review: study explorer (v2). No libraries. Data: window.PAPERS, window.RESULTS. */
var App = (function () {
  "use strict";
  var P = window.PAPERS || [], R = window.RESULTS || [], CFG = {};
  var RQ = {RQ1: "Definition, instruments and cut-offs", RQ2: "Digital biomarkers",
            RQ3: "Psychological disorders and human values", RQ4: "Systems, data pipelines and AI"};
  var SEARCH = {A: "A · instruments (RQ1)", B: "B · sensing (RQ2)", C: "C · artificial intelligence (RQ4)",
                D: "D · mental health and values (RQ3)"};
  var DBS = ["Scopus", "Web of Science", "Europe PMC", "PubMed", "SpringerLink", "IEEE Xplore", "ACM"];

  // ---------- small helpers ----------
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
    return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]; }); }
  function fmt(n) { return Number(n).toLocaleString("en"); }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function count(arr, f) { var m = {}; arr.forEach(function (x) { [].concat(f(x)).forEach(function (k) {
    if (k !== "" && k != null) m[k] = (m[k] || 0) + 1; }); }); return m; }
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

  // tooltip
  var tipEl;
  function tip(html, e) {
    if (!tipEl) { tipEl = document.createElement("div"); tipEl.className = "tip"; document.body.appendChild(tipEl); }
    if (!html) { tipEl.style.opacity = 0; return; }
    tipEl.innerHTML = html; tipEl.style.opacity = 1;
    var x = e.clientX + 14, y = e.clientY + 14, w = tipEl.offsetWidth, h = tipEl.offsetHeight;
    if (x + w > window.innerWidth - 8) x = e.clientX - w - 14;
    if (y + h > window.innerHeight - 8) y = e.clientY - h - 14;
    tipEl.style.left = x + "px"; tipEl.style.top = y + "px";
  }
  function hover(node, html) {
    node.addEventListener("mousemove", function (e) { tip(typeof html === "function" ? html() : html, e); });
    node.addEventListener("mouseleave", function () { tip(null); });
  }
  function countUp(node, to) {
    if (reduce) { node.textContent = fmt(to); return; }
    var t0 = null, d = 1100;
    function step(t) { if (!t0) t0 = t; var k = Math.min(1, (t - t0) / d), e = 1 - Math.pow(1 - k, 3);
      node.textContent = fmt(Math.round(to * e)); if (k < 1) requestAnimationFrame(step); }
    requestAnimationFrame(step);
  }
  function grow(root) {   // bars start at 0 and grow to their size
    var segs = $$("[data-w]", root);
    segs.forEach(function (s) { s.style.transform = reduce ? "none" : "scaleX(0)"; });
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      segs.forEach(function (s, i) { s.style.transitionDelay = reduce ? "0s" : (i * 0.025) + "s"; s.style.transform = "scaleX(1)"; });
    }); });
  }

  // ---------- step logic ----------
  function reach(p) { var n = 2; for (var k = 3; k <= 7; k++) if (p["s" + k]) n = k; return n; }
  function inStep(p, n) { return n <= 2 ? true : !!p["s" + n]; }
  function outcome7(p) {
    if (!p.s6) return "";
    if (p.s7) return "Included";
    if (/quality score/.test(p.left)) return "Below 3.5";
    if (/not obtained/.test(p.left)) return "Full text not obtained";
    return "Not eligible";
  }
  function venue4(p) {
    if (p.s4) return /^CORE/.test(p.vr) ? "Ranked conference" : p.vr;
    if (p.el === "Review") return "Review (set aside)";
    return p.vr === "Not ranked" ? "Not ranked" : (/^CORE/.test(p.vr) ? "Conference, " + p.vr : p.vr);
  }

  // ---------- shared pieces ----------
  function theme() {
    var saved = store("sg-theme");
    if (saved) document.documentElement.setAttribute("data-theme", saved);
    var b = $("#theme");
    if (b) b.onclick = function () {
      var cur = document.documentElement.getAttribute("data-theme") ||
        (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      var next = cur === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next); store("sg-theme", next);
    };
  }
  function rail(n) {
    return '<nav class="rail" aria-label="Selection steps">' + CFG.steps.map(function (s) {
      var cls = s.n === n ? "on" : (s.n < n ? "done" : "");
      return '<a class="' + cls + '" href="step' + s.n + '.html"><b>' + fmt(CFG.counts[s.n]) + '</b>' + s.n + ". " + esc(s.name) + "</a>";
    }).join("") + "</nav>";
  }

  // horizontal bars: items [{label, sub, parts:[{v, cls, name}], click}]
  function bars(node, items, opts) {
    opts = opts || {};
    var max = opts.max || Math.max.apply(null, items.map(function (it) {
      return it.parts.reduce(function (a, b) { return a + b.v; }, 0); }).concat([1]));
    node.innerHTML = '<div class="bars">' + items.map(function (it, i) {
      var tot = it.parts.reduce(function (a, b) { return a + b.v; }, 0);
      return '<div class="bar' + (it.click ? " click" : "") + '" data-i="' + i + '"><div class="lab" title="' + esc(it.label) + '">' +
        esc(it.label) + (it.sub ? "<small>" + esc(it.sub) + "</small>" : "") + '</div><div class="trk">' +
        it.parts.filter(function (pt) { return pt.v > 0; }).map(function (pt, j) {
          return '<span class="seg ' + pt.cls + '" data-w data-j="' + j + '" style="width:' + (100 * pt.v / max) + '%"></span>'; }).join("") +
        '</div><div class="val">' + fmt(tot) + "</div></div>";
    }).join("") + "</div>";
    $$(".bar", node).forEach(function (row) {
      var it = items[+row.getAttribute("data-i")];
      hover(row, function () {
        return "<b>" + esc(it.label) + "</b>" + it.parts.filter(function (pt) { return pt.v > 0; }).map(function (pt) {
          return '<div class="t2">' + esc(pt.name || "Studies") + ": <b>" + fmt(pt.v) + "</b></div>"; }).join("") +
          (it.click ? '<div class="t2">Click to list them</div>' : "");
      });
      if (it.click) row.onclick = it.click;
    });
    grow(node);
  }
  function legend(items) {
    return '<div class="legend">' + items.map(function (it) { return '<span><i class="' + it[0] + '"></i>' + esc(it[1]) + "</span>"; }).join("") + "</div>";
  }
  function card(title, sub, inner, id) {
    return '<section class="card rise"' + (id ? ' id="' + id + '"' : "") + '><div class="head"><h2>' + esc(title) + "</h2>" +
      (sub ? "<p>" + esc(sub) + "</p>" : "") + "</div>" + (inner || "") + "</section>";
  }

  // vertical columns (SVG): cols [{label, parts:[{v, color, name}], click}], opts.cut = index before which a dashed line is drawn
  function columns(node, cols, opts) {
    opts = opts || {};
    var W = Math.max(520, node.clientWidth || 640), H = 230, L = 34, B = 26, T = 18;
    var max = Math.max.apply(null, cols.map(function (c) { return c.parts.reduce(function (a, b) { return a + b.v; }, 0); }).concat([1]));
    var stp = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000].filter(function (v) { return max / v <= 5; })[0] || 1000;
    var nice = Math.ceil(max / stp) * stp, cw = (W - L - 8) / cols.length, bw = Math.min(46, cw * 0.62);
    var y = function (v) { return T + (H - T - B) * (1 - v / nice); };
    var s = '<svg viewBox="0 0 ' + W + " " + H + '" width="100%" role="img" aria-label="' + esc(opts.aria || "Chart") + '">';
    for (var gv = 0; gv <= nice; gv += stp) { var gy = y(gv);
      s += '<line class="axis" x1="' + L + '" x2="' + (W - 4) + '" y1="' + gy + '" y2="' + gy + '" opacity="' + (gv ? 0.5 : 1) + '"/>' +
        '<text x="' + (L - 6) + '" y="' + (gy + 4) + '" text-anchor="end">' + fmt(Math.round(gv)) + "</text>"; }
    cols.forEach(function (c, i) {
      var x = L + i * cw + (cw - bw) / 2, acc = 0, tot = c.parts.reduce(function (a, b) { return a + b.v; }, 0);
      s += '<g class="col" data-i="' + i + '">';
      c.parts.forEach(function (pt) { if (!pt.v) return;
        var y1 = y(acc + pt.v), y0 = y(acc); acc += pt.v;
        s += '<rect x="' + x + '" y="' + y1 + '" width="' + bw + '" height="' + Math.max(0, y0 - y1 - 2) + '" rx="3" fill="' + pt.color + '"/>'; });
      if (tot) s += '<text x="' + (x + bw / 2) + '" y="' + (y(tot) - 5) + '" text-anchor="middle" class="in" style="fill:var(--ink)">' + tot + "</text>";
      s += '<text x="' + (x + bw / 2) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(c.label) + "</text>";
      s += '<rect class="hit" x="' + (L + i * cw) + '" y="' + T + '" width="' + cw + '" height="' + (H - T - B) + '"/></g>';
    });
    if (opts.cut != null) { var cx = L + opts.cut * cw;
      s += '<line class="cut" x1="' + cx + '" x2="' + cx + '" y1="' + (T - 6) + '" y2="' + (H - B) + '"/>' +
        '<text x="' + (cx - 6) + '" y="' + (T + 2) + '" text-anchor="end" style="fill:var(--ink)">' + esc(opts.cutLabel || "") + "</text>"; }
    node.innerHTML = '<div class="chart">' + s + "</svg></div>";
    $$("g.col", node).forEach(function (gn) {
      var c = cols[+gn.getAttribute("data-i")];
      hover(gn, function () { return "<b>" + esc(opts.tipLabel ? opts.tipLabel(c) : c.label) + "</b>" +
        c.parts.filter(function (pt) { return pt.v; }).map(function (pt) {
          return '<div class="t2">' + esc(pt.name) + ": <b>" + fmt(pt.v) + "</b></div>"; }).join("") +
        (c.click ? '<div class="t2">Click to list them</div>' : ""); });
      if (c.click) { gn.style.cursor = "pointer"; gn.onclick = c.click; }
    });
  }

  // heatmap (SVG): rows x cols of numbers, sequential single hue
  function heatmap(node, rows, cols, val, click) {
    var L = 130, T = 30, avail = Math.max(420, node.clientWidth || 700);
    var cell = Math.max(64, Math.min(170, (avail - L - 80) / cols.length)), rowH = 40, W = L + cols.length * cell + 80, H = T + rows.length * rowH + 12;
    var max = 0; rows.forEach(function (r) { cols.forEach(function (c) { max = Math.max(max, val(r, c)); }); });
    var s = '<svg viewBox="0 0 ' + W + " " + H + '" width="100%" style="max-width:' + W + 'px" role="img" aria-label="Results per source and search">';
    cols.forEach(function (c, j) { s += '<text x="' + (L + j * cell + cell / 2) + '" y="' + (T - 10) + '" text-anchor="middle" style="fill:var(--ink);font-weight:600">' + esc(SEARCH[c] || c) + "</text>"; });
    s += '<text x="' + (L + cols.length * cell + 40) + '" y="' + (T - 10) + '" text-anchor="middle">Total</text>';
    rows.forEach(function (r, i) {
      var y = T + i * rowH, tot = 0;
      s += '<text x="' + (L - 10) + '" y="' + (y + rowH / 2 + 4) + '" text-anchor="end" style="fill:var(--ink)">' + esc(r) + "</text>";
      cols.forEach(function (c, j) {
        var v = val(r, c); tot += v;
        var a = v ? 0.12 + 0.88 * Math.sqrt(v / max) : 0;
        s += '<g class="hc" data-r="' + esc(r) + '" data-c="' + esc(c) + '" data-v="' + v + '"><rect class="cell" x="' + (L + j * cell) + '" y="' + y + '" width="' + cell + '" height="' + rowH + '" rx="6" fill="' +
          (v ? "var(--kept)" : "var(--faint)") + '" fill-opacity="' + (v ? a : 1) + '"/>' +
          '<text class="in" x="' + (L + j * cell + cell / 2) + '" y="' + (y + rowH / 2 + 4) + '" text-anchor="middle" style="fill:' +
          (a > 0.55 ? "#fff" : "var(--ink)") + '">' + (v ? fmt(v) : "") + "</text></g>";
      });
      s += '<text x="' + (L + cols.length * cell + 40) + '" y="' + (y + rowH / 2 + 4) + '" text-anchor="middle" style="fill:var(--ink);font-weight:600">' + fmt(tot) + "</text>";
    });
    node.innerHTML = '<div class="chart">' + s + "</svg></div>";
    $$("g.hc", node).forEach(function (g) {
      var r = g.getAttribute("data-r"), c = g.getAttribute("data-c"), v = +g.getAttribute("data-v");
      hover(g, "<b>" + esc(r) + " · search " + esc(c) + "</b><div class='t2'>Results: <b>" + fmt(v) + "</b></div>" + (v ? "<div class='t2'>Click to list them</div>" : ""));
      if (v) { g.style.cursor = "pointer"; g.onclick = function () { click(r, c); }; }
    });
  }

  // in / kept / removed strip
  function flowStrip(n, onKept, onRemoved) {
    var inn = CFG.counts[n - 1], kept = CFG.counts[n], rem = inn - kept;
    var html = '<section class="card rise"><div class="flow"><div class="nums">' +
      '<div class="num"><div class="v" data-count="' + inn + '">0</div><div class="l">in</div></div>' +
      '<div class="num kept"><div class="v" data-count="' + kept + '">0</div><div class="l">' + (n === 7 ? "included" : "kept") + "</div></div>" +
      '<div class="num"><div class="v" data-count="' + rem + '">0</div><div class="l">' + (n === 2 ? "merged" : "removed") + "</div></div></div>" +
      '<div><div class="split"><span class="k" style="flex-grow:' + kept + '" title="Kept"></span><span class="r" style="flex-grow:' + rem + '" title="Removed"></span></div>' +
      legend([["c-kept", n === 7 ? "Included" : "Kept"], ["c-removed", n === 2 ? "Merged into another record" : "Removed"]]) + "</div></div></section>";
    return {html: html, bind: function () {
      var k = $(".split .k"), r = $(".split .r");
      hover(k, "<b>" + fmt(kept) + "</b> " + (n === 7 ? "included" : "kept") + (onKept ? "<div class='t2'>Click to list them</div>" : ""));
      hover(r, "<b>" + fmt(rem) + "</b> " + (n === 2 ? "merged" : "removed") + (onRemoved ? "<div class='t2'>Click to list them</div>" : ""));
      if (onKept) k.onclick = onKept; if (onRemoved) r.onclick = onRemoved;
    }};
  }

  // ---------- the table ----------
  var COLS = {
    id: {label: "ID", cls: "id", get: function (p) { return p.id; }},
    db1: {label: "Database", get: function (p) { return p.db; }},
    st1: {label: "Search", get: function (p) { return p.st; }},
    f: {label: "Field", get: function (p) { return p.f; }},
    t: {label: "Title and authors", cls: "tt", get: function (p) { return p.t; },
        html: function (p) { return esc(p.t) + (p.a ? '<div class="a">' + esc(p.a) + "</div>" : ""); }},
    y: {label: "Year", cls: "num", get: function (p) { return p.y; }},
    v: {label: "Venue", cls: "hide-s", get: function (p) { return p.v; }},
    d: {label: "DOI", cls: "hide-s", get: function (p) { return p.d; },
        html: function (p) { return p.d ? '<a href="https://doi.org/' + esc(p.d) + '" target="_blank" rel="noopener">' + esc(p.d) + "</a>" : ""; }},
    db: {label: "Databases", cls: "hide-s", get: function (p) { return p.db.join(" "); }, html: function (p) { return chips(p.db); }},
    st: {label: "Searches", get: function (p) { return p.st.join(" "); }, html: function (p) { return chips(p.st); }},
    el: {label: "Record type", get: function (p) { return p.el; }},
    vr: {label: "Venue rank", get: function (p) { return p.vr; }},
    rq6: {label: "Questions (step 6)", get: function (p) { return p.rq6.join(" "); }, html: function (p) { return chips(p.rq6); }},
    qs: {label: "Score", cls: "num", get: function (p) { return p.qs === "" ? -1 : +p.qs; }, html: function (p) { return esc(p.qs); }},
    qb: {label: "Quality", get: function (p) { return p.qb; }},
    rq7: {label: "Questions", get: function (p) { return p.rq7.join(" "); }, html: function (p) { return chips(p.rq7, true); }},
    out: {label: "Outcome", get: outcome7, html: function (p) { var o = outcome7(p);
      return o === "Included" ? '<span class="chip hi">Included</span>' : '<span class="chip">' + esc(o) + "</span>"; }},
    reach: {label: "Last step passed", cls: "num", get: reach},
    left: {label: "Why it left", cls: "why", get: function (p) { return p.left; }}
  };
  function chips(a, hi) { return (a || []).map(function (x) { return '<span class="chip' + (hi ? " hi" : "") + '">' + esc(x) + "</span>"; }).join(""); }
  var LAYOUT = {1: ["id", "db1", "st1", "f", "t", "y", "d"], 2: ["id", "t", "y", "v", "db", "st", "d"],
    3: ["id", "t", "y", "v", "el", "d"], 4: ["id", "t", "y", "v", "vr", "d"], 5: ["id", "t", "y", "v", "st", "d"],
    6: ["id", "t", "y", "rq6", "d"], 7: ["id", "t", "y", "qs", "out", "rq7", "d"],
    0: ["id", "t", "y", "st", "vr", "rq6", "qb", "rq7", "reach", "left", "d"]};

  function table(node, n) {
    var all = n === 1 ? R : (n === 7 ? P.filter(function (p) { return p.s6; }) : P);
    var st = {q: "", sort: null, dir: 1, page: 0, f: {}};
    var F = [];   // [key, label, getter or options, test]
    var keep = function (p) { return st.f.keep === "Removed" ? (inStep(p, n - 1) && !inStep(p, n)) :
                                     st.f.keep === "All" ? inStep(p, n - 1) : inStep(p, n); };
    if (n === 1) F = [["db", "Database", function (r) { return r.db; }, DBS], ["st", "Search", function (r) { return r.st; }],
                      ["f", "Field", function (r) { return r.f; }]];
    if (n === 2) F = [["db", "Database", function (p) { return p.db; }, DBS], ["st", "Search", function (p) { return p.st; }]];
    if (n >= 3 && n <= 6) F = [["keep", "Show", null, ["Kept", "Removed", "All"]]];
    if (n === 3) F.push(["el", "Record type", function (p) { return p.el; }]);
    if (n === 4) F.push(["v4", "Venue", venue4]);
    if (n === 5) F.push(["st", "Search", function (p) { return p.st; }]);
    if (n === 6) F.push(["rq6", "Question", function (p) { return p.rq6; }]);
    if (n === 7) F = [["out", "Outcome", outcome7, ["Included", "Below 3.5", "Not eligible", "Full text not obtained"]],
                      ["rq7", "Question", function (p) { return p.rq7; }], ["qs", "Score", function (p) { return p.qs; }]];
    if (n === 0) F = [["reach", "Last step passed", reach, ["2", "3", "4", "5", "6", "7"]],
                      ["st", "Search", function (p) { return p.st; }], ["db", "Database", function (p) { return p.db; }, DBS],
                      ["el", "Record type", function (p) { return p.el; }], ["vr", "Venue rank", function (p) { return p.vr; }],
                      ["rq7", "Question (final)", function (p) { return p.rq7; }], ["qb", "Quality", function (p) { return p.qb; }]];
    function opts(f) {
      if (f[3]) return f[3];
      var m = {}; all.forEach(function (p) { [].concat(f[2](p)).forEach(function (v) { if (v !== "" && v != null) m[v] = 1; }); });
      return Object.keys(m).sort();
    }
    var h = '<div class="tools"><div class="search"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>' +
      '<input type="search" id="q" placeholder="Search title, authors, venue, DOI or ID" aria-label="Search"></div>';
    F.forEach(function (f) {
      h += "<label>" + esc(f[1]) + ' <select data-k="' + f[0] + '">' + (f[0] === "keep" ? "" : '<option value="">All</option>') +
        opts(f).map(function (o) { return '<option value="' + esc(o) + '">' + esc(o) + "</option>"; }).join("") + "</select></label>";
    });
    h += '<button class="btn" id="csv">Download CSV</button></div><div class="count" id="count"></div>' +
      '<div class="wrap"><table><thead id="th"></thead><tbody id="tb"></tbody></table></div><div class="pager" id="pager"></div>';
    node.innerHTML = h;
    if (n >= 3 && n <= 6) st.f.keep = "Kept";

    function cols() {
      var c = LAYOUT[n].slice();
      if (st.f.keep === "Removed" || st.f.keep === "All") { c = c.filter(function (k) { return k !== "d"; }); c.push("left"); }
      if (n === 7 && st.f.out && st.f.out !== "Included") c.push("left");
      return c;
    }
    function rows() {
      var q = st.q.toLowerCase();
      var r = all.filter(function (p) {
        if (n >= 3 && n <= 6 && !keep(p)) return false;
        if (q && (p.id + " " + p.t + " " + (p.a || "") + " " + (p.v || "") + " " + (p.d || "")).toLowerCase().indexOf(q) < 0) return false;
        for (var i = 0; i < F.length; i++) {
          var f = F[i], v = st.f[f[0]];
          if (!v || f[0] === "keep") continue;
          if ([].concat(f[2](p)).map(String).indexOf(v) < 0) return false;
        }
        return true;
      });
      if (st.sort) { var g = COLS[st.sort].get;
        r = r.slice().sort(function (a, b) { var x = g(a), y = g(b); return (x > y ? 1 : x < y ? -1 : 0) * st.dir; }); }
      return r;
    }
    function draw() {
      var c = cols(), r = rows(), per = 50, pages = Math.max(1, Math.ceil(r.length / per));
      if (st.page >= pages) st.page = 0;
      $("#th", node).innerHTML = "<tr>" + c.map(function (k) { return '<th class="' + (COLS[k].cls || "") + '" data-k="' + k + '">' +
        esc(COLS[k].label) + (st.sort === k ? '<span class="ar">' + (st.dir > 0 ? "↑" : "↓") + "</span>" : "") + "</th>"; }).join("") + "</tr>";
      $("#tb", node).innerHTML = r.slice(st.page * per, st.page * per + per).map(function (p) {
        return "<tr>" + c.map(function (k) { var col = COLS[k];
          return '<td class="' + (col.cls || "") + '">' + (col.html ? col.html(p) : esc(col.get(p))) + "</td>"; }).join("") + "</tr>"; }).join("");
      var active = Object.keys(st.f).some(function (k) { return st.f[k] && !(k === "keep" && st.f[k] === "Kept") && !(k === "out" && st.f[k] === "Included"); }) || st.q;
      $("#count", node).innerHTML = "<b>" + fmt(r.length) + "</b> " + (n === 1 ? "results" : "studies") + " shown" +
        (active ? ' <button class="reset" id="reset">Clear filters</button>' : "");
      $("#pager", node).innerHTML = pages > 1 ? '<button class="btn" id="prev">Previous</button> Page ' + (st.page + 1) + " of " + pages +
        ' <button class="btn" id="next">Next</button>' : "";
      var pv = $("#prev", node), nx = $("#next", node), rs = $("#reset", node);
      if (pv) pv.onclick = function () { if (st.page > 0) { st.page--; draw(); } };
      if (nx) nx.onclick = function () { if (st.page < pages - 1) { st.page++; draw(); } };
      if (rs) rs.onclick = function () { api.reset(); };
      $$("#th th", node).forEach(function (th) { th.onclick = function () { var k = th.getAttribute("data-k");
        st.dir = st.sort === k ? -st.dir : 1; st.sort = k; draw(); }; });
      $$("select", node).forEach(function (s) { s.classList.toggle("set", !!st.f[s.getAttribute("data-k")] && !(s.getAttribute("data-k") === "keep" && s.value === "Kept")); });
    }
    $("#q", node).oninput = function (e) { st.q = e.target.value; st.page = 0; draw(); };
    $$("select", node).forEach(function (s) { s.onchange = function () { st.f[s.getAttribute("data-k")] = s.value; st.page = 0; draw(); }; });
    $("#csv", node).onclick = function () {
      var c = cols(), r = rows();
      var lines = [c.map(function (k) { return COLS[k].label; })].concat(r.map(function (p) {
        return c.map(function (k) { var v = COLS[k].get(p); return Array.isArray(v) ? v.join(" ") : v; }); }));
      var text = lines.map(function (l) { return l.map(function (v) { v = String(v == null ? "" : v);
        return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(","); }).join("\n");
      var a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([text], {type: "text/csv"}));
      a.download = (n === 0 ? "all_studies" : "step" + n) + ".csv"; a.click();
    };
    var api = {
      set: function (vals, scroll) {
        Object.keys(st.f).forEach(function (k) { if (k !== "keep") st.f[k] = ""; });
        Object.keys(vals).forEach(function (k) { st.f[k] = vals[k]; });
        $$("select", node).forEach(function (s) { var k = s.getAttribute("data-k"); s.value = st.f[k] || (k === "keep" ? "Kept" : ""); });
        st.page = 0; draw();
        if (scroll !== false) node.scrollIntoView({behavior: reduce ? "auto" : "smooth", block: "start"});
      },
      reset: function () { st.q = ""; $("#q", node).value = ""; api.set(n >= 3 && n <= 6 ? {keep: "Kept"} : (n === 7 ? {out: "Included"} : {}), false); }
    };
    // a link can open the page already filtered, e.g. step1.html?db=Scopus&st=A
    var params = new URLSearchParams(window.location.search), init = {};
    if (n >= 3 && n <= 6) init.keep = params.get("removed") === "1" ? "Removed" : "Kept";
    if (n === 7) init.out = params.get("out") || "Included";
    F.forEach(function (f) { var v = params.get(f[0]); if (v !== null) init[f[0]] = v; });
    if (params.get("q")) { st.q = params.get("q"); $("#q", node).value = st.q; }
    api.set(init, false);
    return api;
  }

  // ---------- pages ----------
  function header(n) {
    var s = CFG.steps[n - 1];
    return '<p class="kicker rise">Step ' + n + " of 7</p>" + '<h1 class="rise">' + esc(s.name) + "</h1>" +
      '<p class="sub rise">' + esc(s.what) + ". The rule is described in the paper (Method, section " + CFG.method[n] + ").</p>" + rail(n);
  }
  function animateNumbers(root) { $$("[data-count]", root).forEach(function (el) { countUp(el, +el.getAttribute("data-count")); }); }

  function stepPage(n) {
    var app = $("#app"), T, html = header(n), charts = [];
    var flow = n > 1 ? flowStrip(n,
      n >= 3 ? function () { T.set(n === 7 ? {out: "Included"} : {keep: "Kept"}); } : null,
      n >= 3 ? function () { T.set(n === 7 ? {out: "Not eligible"} : {keep: "Removed"}); } : null) : null;
    if (flow) html += flow.html;

    if (n === 1) {
      html += '<div class="tiles rise"><div class="tile"><div class="v" data-count="' + R.length + '">0</div><div class="l">results</div></div>' +
        '<div class="tile"><div class="v">7</div><div class="l">sources</div></div><div class="tile"><div class="v">4</div><div class="l">searches</div></div>' +
        '<div class="tile"><div class="v">3</div><div class="l">fields: title, abstract, keywords</div></div></div>';
      html += card("Results per source and search", "Darker cells hold more results. Click a cell to list its results.", '<div id="c1"></div>');
      html += card("Results per field", "Searches A, B and C were run on titles, abstracts and author keywords; search D on titles only.", '<div id="c2"></div>');
      charts.push(function () {
        var m = {}; R.forEach(function (r) { var k = r.db + "|" + r.st; m[k] = (m[k] || 0) + 1; });
        heatmap($("#c1"), DBS, ["A", "B", "C", "D"], function (r, c) { return m[r + "|" + c] || 0; },
                function (r, c) { T.set({db: r, st: c}); });
        var f = count(R, function (r) { return r.f; });
        bars($("#c2"), ["Title", "Abstract", "Author keywords"].map(function (k) {
          return {label: k, parts: [{v: f[k] || 0, cls: "c-kept", name: "Results"}], click: function () { T.set({f: k}); }}; }));
      });
    }
    if (n === 2) {
      html += card("How many times each study was found", "Across sources, searches and fields. One bar per number of times.", '<div id="c1"></div>');
      charts.push(function () {
        var per = count(R, function (r) { return r.id; }), h = {};
        Object.keys(per).forEach(function (id) { var k = Math.min(per[id], 10); h[k] = (h[k] || 0) + 1; });
        var cols = []; for (var k = 1; k <= 10; k++) cols.push({label: k === 10 ? "10+" : String(k),
          parts: [{v: h[k] || 0, color: "var(--kept)", name: "Studies"}]});
        columns($("#c1"), cols, {aria: "Studies by number of times found",
          tipLabel: function (c) { return "Found " + c.label + (c.label === "1" ? " time" : " times"); }});
      });
    }
    if (n === 3) {
      html += card("What was removed", "Items that are not research papers. Click a bar to list them.", '<div id="c1"></div>');
      charts.push(function () {
        var m = count(P.filter(function (p) { return !p.s3; }), function (p) { return p.el; });
        bars($("#c1"), Object.keys(m).sort(function (a, b) { return m[b] - m[a]; }).map(function (k) {
          return {label: k, parts: [{v: m[k], cls: "c-removed", name: "Removed"}], click: function () { T.set({keep: "Removed", el: k}); }}; }));
      });
    }
    if (n === 4) {
      html += card("Venues of the studies", "Kept: journals ranked Q1 or Q2 and ranked conferences. Click a bar to list the studies.",
        '<div id="c1"></div>' + legend([["c-kept", "Kept"], ["c-removed", "Removed"], ["c-faint", "Review, set aside"]]));
      charts.push(function () {
        var s3 = P.filter(function (p) { return p.s3; }), m = count(s3, venue4);
        var order = ["Q1", "Q2", "Ranked conference", "Q3", "Q4", "Conference, CORE C", "Not ranked", "Review (set aside)"];
        bars($("#c1"), order.filter(function (k) { return m[k]; }).map(function (k) {
          var kept = ["Q1", "Q2", "Ranked conference"].indexOf(k) >= 0, rev = k === "Review (set aside)";
          return {label: k, parts: [{v: m[k], cls: kept ? "c-kept" : (rev ? "c-faint" : "c-removed"), name: kept ? "Kept" : (rev ? "Set aside" : "Removed")}],
            click: function () { T.set({keep: kept ? "Kept" : "Removed", v4: k}); }}; }));
      });
    }
    if (n === 5) {
      html += card("Screening by search", "A study found by several searches counts once in each. Click a bar to list the studies.",
        '<div id="c1"></div>' + legend([["c-kept", "Kept"], ["c-removed", "Removed"]]));
      charts.push(function () {
        var s4 = P.filter(function (p) { return p.s4; });
        bars($("#c1"), ["A", "B", "C", "D"].map(function (k) {
          var inS = s4.filter(function (p) { return p.st.indexOf(k) >= 0; }), kept = inS.filter(function (p) { return p.s5; }).length;
          return {label: SEARCH[k], parts: [{v: kept, cls: "c-kept", name: "Kept"}, {v: inS.length - kept, cls: "c-removed", name: "Removed"}],
            click: function () { T.set({keep: "All", st: k}); }}; }));
      });
    }
    if (n === 6) {
      html += '<div class="grid2">' + card("Studies kept per question", "Click a question to list its studies.", '<div id="c1"></div>') +
        card("Kept for how many questions", "A study can answer more than one question.", '<div id="c2"></div>') + "</div><div style='height:18px'></div>";
      charts.push(function () {
        var s6 = P.filter(function (p) { return p.s6; }), m = count(s6, function (p) { return p.rq6; });
        bars($("#c1"), ["RQ1", "RQ2", "RQ3", "RQ4"].map(function (k) {
          return {label: k, sub: RQ[k], parts: [{v: m[k] || 0, cls: "c-kept", name: "Studies"}], click: function () { T.set({keep: "Kept", rq6: k}); }}; }));
        var h = count(s6, function (p) { return String(p.rq6.length); });
        bars($("#c2"), ["1", "2", "3", "4"].filter(function (k) { return h[k]; }).map(function (k) {
          return {label: k + (k === "1" ? " question" : " questions"), parts: [{v: h[k], cls: "c-kept", name: "Studies"}]}; }));
      });
    }
    if (n === 7) {
      html += '<div class="grid2">' + card("What happened to the 93 studies", "Click a bar to list the studies.", '<div id="c1"></div>') +
        card("Included studies per question", "Some studies answer more than one question.", '<div id="c3"></div>' +
          legend([["c-kept", "High quality (5 to 6)"], ["c-second", "Moderate quality (3.5 to 4.5)"]])) + "</div><div style='height:18px'></div>";
      html += card("Quality scores", "Six questions, each scored 1, 0.5 or 0. Studies scoring below 3.5 were removed. Click a column to list its studies.",
        '<div id="c2"></div>' + legend([["c-kept", "Included"], ["c-second", "Below 3.5"], ["c-removed", "Not eligible"]]));
      charts.push(function () {
        var s6 = P.filter(function (p) { return p.s6; }), m = count(s6, outcome7);
        var cls = {"Included": "c-kept", "Below 3.5": "c-second", "Not eligible": "c-removed", "Full text not obtained": "c-faint"};
        bars($("#c1"), ["Included", "Below 3.5", "Not eligible", "Full text not obtained"].map(function (k) {
          return {label: k, parts: [{v: m[k] || 0, cls: cls[k], name: "Studies"}], click: function () { T.set({out: k}); }}; }));
        var inc = s6.filter(function (p) { return p.s7; });
        bars($("#c3"), ["RQ1", "RQ2", "RQ3", "RQ4"].map(function (k) {
          var q = inc.filter(function (p) { return p.rq7.indexOf(k) >= 0; }), hi = q.filter(function (p) { return p.qb === "High"; }).length;
          return {label: k, sub: RQ[k], parts: [{v: hi, cls: "c-kept", name: "High"}, {v: q.length - hi, cls: "c-second", name: "Moderate"}],
            click: function () { T.set({out: "Included", rq7: k}); }}; }));
        var scored = s6.filter(function (p) { return p.qs !== ""; }), cols = [];
        for (var v = 1; v <= 6; v += 0.5) {
          var key = v.toFixed(1), g = scored.filter(function (p) { return p.qs === key; });
          var by = count(g, outcome7);
          cols.push({label: key, key: key, parts: [{v: by["Included"] || 0, color: "var(--kept)", name: "Included"},
            {v: by["Below 3.5"] || 0, color: "var(--second)", name: "Below 3.5"}, {v: by["Not eligible"] || 0, color: "var(--removed)", name: "Not eligible"}]});
        }
        cols.forEach(function (c) { if (c.parts.some(function (pt) { return pt.v; })) c.click = function () { T.set({out: "", qs: c.key}); }; });
        columns($("#c2"), cols, {cut: 5, cutLabel: "cut-off 3.5", aria: "Quality scores",
          tipLabel: function (c) { return "Score " + c.label; }});
      });
    }
    html += '<section class="card rise" id="list"><div class="head"><h2>' + (n === 1 ? "The results" : "The studies") + "</h2><p>" +
      (n === 1 ? "One row per result: a study found by several sources, searches or fields appears once for each. The ID is the study it belongs to."
               : "Search, filter, sort and download. Each study links to its DOI.") + '</p></div><div id="tbl"></div></section>';
    app.innerHTML = html;
    if (flow) flow.bind();
    T = table($("#tbl"), n);
    charts.forEach(function (f) { f(); });
    animateNumbers(app);
  }

  function overview() {
    var app = $("#app"), c = CFG.counts, inc = P.filter(function (p) { return p.s7; });
    var html = '<p class="kicker rise">SAFEGUARD · systematic literature review</p>' +
      '<h1 class="rise">4,520 search results. <span class="dim">47 studies.</span></h1>' +
      '<p class="sub rise">How smartphone addiction in young people is measured, what phone data show, which psychological factors and values go with it, and how artificial intelligence detects it. Every selection step can be explored below.</p>';
    html += '<section class="card rise"><div class="head"><h2>The selection, step by step</h2><p>Bar length is to scale. Click a step to explore it.</p></div><div class="funnel">' +
      CFG.steps.map(function (s) {
        var prev = s.n > 1 ? c[s.n - 1] : null, d = prev ? prev - c[s.n] : null;
        return '<a class="frow' + (s.n === 7 ? " last" : "") + '" href="step' + s.n + '.html" data-n="' + s.n + '"><span class="n">' + s.n + '</span>' +
          '<span class="name">' + esc(s.name) + "<small>" + esc(s.what) + '</small></span><span class="trk"><span class="ghost" style="width:' + (100 * (prev || c[1]) / c[1]) + '%"></span>' +
          '<span class="fill" data-w style="width:' + (100 * c[s.n] / c[1]) + '%"></span></span>' +
          '<span class="v" data-count="' + c[s.n] + '">0</span><span class="d">' + (d ? "−" + fmt(d) : "results") + "</span></a>";
      }).join("") + "</div></section>";
    html += '<div class="tiles rise">' +
      [[7, "sources searched"], [4, "searches, one per question"], [CFG.read, "full texts read"], [CFG.scored, "studies scored for quality"], [c[7], "studies included"]].map(function (t) {
        return '<div class="tile"><div class="v" data-count="' + t[0] + '">0</div><div class="l">' + esc(t[1]) + "</div></div>"; }).join("") + "</div>";
    html += '<section class="card rise"><div class="head"><h2>The 47 included studies, by question</h2><p>Click a question to see its studies.</p></div><div class="qs">' +
      ["RQ1", "RQ2", "RQ3", "RQ4"].map(function (k) {
        var q = inc.filter(function (p) { return p.rq7.indexOf(k) >= 0; }), hi = q.filter(function (p) { return p.qb === "High"; }).length;
        return '<a class="q" href="step7.html?rq7=' + k + '"><div class="id">' + k + '</div><div class="t">' + esc(RQ[k]) + '</div><div class="v">' + q.length +
          "<small>studies</small></div>" + '<div class="mini"><span class="c-kept" style="flex:' + hi + '"></span><span class="c-second" style="flex:' + (q.length - hi) + '"></span></div>' +
          '<div class="legend"><span><i class="c-kept"></i>' + hi + ' high</span><span><i class="c-second"></i>' + (q.length - hi) + " moderate</span></div></a>";
      }).join("") + "</div></section>";
    html += '<div class="cta rise"><a class="btn primary" href="explorer.html">Explore all ' + fmt(c[2]) + ' studies</a><a class="btn" href="protocol.html">Protocol</a>' +
      '<a class="btn" href="data/studies.csv">studies.csv</a><a class="btn" href="data/search_results.csv">search_results.csv</a></div>' +
      '<p class="foot">Bibliographic details, decisions and quality scores only. Abstracts and full texts are not included; each study links to its DOI.</p>';
    app.innerHTML = html;
    $$(".frow", app).forEach(function (a) { var s = CFG.steps[+a.getAttribute("data-n") - 1];
      hover(a, "<b>Step " + s.n + ". " + esc(s.name) + "</b><div class='t2'>" + esc(s.what) + "</div><div class='t2'>Left: <b>" + fmt(c[s.n]) + "</b></div>"); });
    grow(app); animateNumbers(app);
  }

  function explorer() {
    var app = $("#app"), T;
    var html = '<p class="kicker rise">All studies</p><h1 class="rise">' + fmt(P.length) + ' studies, <span class="dim">one journey each</span></h1>' +
      '<p class="sub rise">Every study found by the search, the last step it passed and why it left. Click a bar or combine the filters to find any group.</p>' + rail(0);
    html += card("Where each study left", "Each study is counted once, at the step where it was removed. Together the bars add up to all 1,447. Click a bar to list those studies.", '<div id="c1"></div>');
    html += '<section class="card rise" id="list"><div class="head"><h2>The studies</h2><p>Search, filter, sort and download.</p></div><div id="tbl"></div></section>';
    app.innerHTML = html;
    T = table($("#tbl"), 0);
    var m = count(P, function (p) { return String(reach(p)); });
    var label = {"2": "Removed at step 3 · document type", "3": "Removed at step 4 · venue", "4": "Removed at step 5 · title and abstract",
                 "5": "Removed at step 6 · selection per question", "6": "Removed at step 7 · full text and quality", "7": "Included"};
    bars($("#c1"), ["2", "3", "4", "5", "6", "7"].map(function (k) {
      return {label: label[k], parts: [{v: m[k] || 0, cls: k === "7" ? "c-kept" : "c-removed", name: "Studies"}], click: function () { T.set({reach: k}); }}; }));
  }

  function start(cfg) {
    CFG = cfg; theme();
    if (cfg.page === "overview") overview();
    else if (cfg.page === "step") stepPage(cfg.step);
    else if (cfg.page === "all") explorer();
  }
  return {start: start, theme: theme};
})();
