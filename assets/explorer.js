
var Explorer = (function () {
  var STEPS = {1: "Search", 2: "Duplicates", 3: "Document type", 4: "Venue", 5: "Title and abstract",
               6: "Selection per question", 7: "Quality assessment"};
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
    return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]; }); }
  function chips(a) { return (a || []).map(function (x) { return '<span class="chip">' + esc(x) + '</span>'; }).join(""); }
  function doi(d) { return d ? '<a href="https://doi.org/' + esc(d) + '" target="_blank" rel="noopener">' + esc(d) + '</a>' : ""; }
  function title(p) { return '<span>' + esc(p.t) + '</span>' + (p.a ? '<br><span class="left">' + esc(p.a) + '</span>' : ""); }

  var COLS = {
    id: {label: "ID", cls: "id", get: function (p) { return p.id; }},
    db1: {label: "Database", get: function (p) { return p.db; }},
    st1: {label: "Search", get: function (p) { return p.st; }},
    f: {label: "Field", get: function (p) { return p.f; }},
    t: {label: "Title and authors", cls: "tt", get: function (p) { return p.t; }, html: title},
    y: {label: "Year", cls: "num", get: function (p) { return p.y; }},
    v: {label: "Venue", cls: "hide-s", get: function (p) { return p.v; }},
    d: {label: "DOI", cls: "hide-s", get: function (p) { return p.d; }, html: function (p) { return doi(p.d); }},
    db: {label: "Databases", cls: "hide-s", get: function (p) { return p.db.join(" "); }, html: function (p) { return chips(p.db); }},
    st: {label: "Searches", get: function (p) { return p.st.join(" "); }, html: function (p) { return chips(p.st); }},
    el: {label: "Record type", get: function (p) { return p.el; }},
    vr: {label: "Venue rank", get: function (p) { return p.vr; }},
    rq6: {label: "Questions (step 6)", get: function (p) { return p.rq6.join(" "); }, html: function (p) { return chips(p.rq6); }},
    qs: {label: "Quality score", cls: "num", get: function (p) { return p.qs === "" ? -1 : +p.qs; }, html: function (p) { return esc(p.qs); }},
    qb: {label: "Quality", get: function (p) { return p.qb; }},
    rq7: {label: "Questions (final)", get: function (p) { return p.rq7.join(" "); }, html: function (p) { return chips(p.rq7); }},
    reach: {label: "Reached step", cls: "num", get: function (p) { return reach(p); }},
    left: {label: "Why it left", cls: "why", get: function (p) { return p.left; }, html: function (p) { return '<span class="left">' + esc(p.left) + '</span>'; }}
  };
  var LAYOUT = {
    1: ["id", "db1", "st1", "f", "t", "y", "d"],
    2: ["id", "t", "y", "v", "db", "st", "d"],
    3: ["id", "t", "y", "v", "el", "d"],
    4: ["id", "t", "y", "v", "vr", "d"],
    5: ["id", "t", "y", "v", "d"],
    6: ["id", "t", "y", "rq6", "d"],
    7: ["id", "t", "y", "qs", "qb", "rq7", "d"],
    0: ["id", "t", "y", "st", "vr", "rq6", "qb", "rq7", "reach", "left", "d"]
  };
  var REMOVED = {3: ["left"], 4: ["left"], 5: ["left"], 6: ["rq6", "left"], 7: ["qs", "qb", "left"]};

  function reach(p) { var n = 2; for (var k = 3; k <= 7; k++) if (p["s" + k]) n = k; return n; }
  function inStep(p, n) { return n <= 2 ? true : !!p["s" + n]; }
  function uniq(rows, f) { var s = {}; rows.forEach(function (r) { [].concat(f(r)).forEach(function (v) { if (v !== "" && v != null) s[v] = 1; }); }); return Object.keys(s).sort(); }

  function start(cfg) {
    var app = document.getElementById("app");
    var n = cfg.step, all = n === 1 ? window.RESULTS : window.PAPERS;
    var state = {q: "", sort: null, dir: 1, page: 0, removed: false, f: {}};
    var filters = [];
    if (n === 1) filters = [["db", "Database", function (r) { return r.db; }], ["st", "Search", function (r) { return r.st; }],
                            ["f", "Field", function (r) { return r.f; }]];
    if (n === 0) filters = [
      ["reach", "In step", null, ["2", "3", "4", "5", "6", "7"], function (p, v) { return inStep(p, +v); },
       function (v) { return v + ". " + STEPS[v]; }],
      ["st", "Search", function (p) { return p.st; }],
      ["db", "Database", function (p) { return p.db; }],
      ["el", "Record type", function (p) { return p.el; }],
      ["vr", "Venue rank", function (p) { return p.vr; }],
      ["rq6", "Question (step 6)", function (p) { return p.rq6; }],
      ["rq7", "Question (final)", function (p) { return p.rq7; }],
      ["qb", "Quality", function (p) { return p.qb; }],
      ["y", "Year", function (p) { return p.y; }]];

    var html = '<div class="tools"><input type="search" id="q" placeholder="Search title, authors, venue, DOI or ID">';
    filters.forEach(function (f) {
      var opts = f[3] || uniq(all, f[2]);
      html += '<label>' + esc(f[1]) + ' <select data-k="' + f[0] + '"><option value="">All</option>' +
        opts.map(function (o) { return '<option value="' + esc(o) + '">' + esc(f[5] ? f[5](o) : o) + '</option>'; }).join("") + '</select></label>';
    });
    if (REMOVED[n]) html += '<label><input type="checkbox" id="rm"> Show the studies removed at this step</label>';
    html += '<button id="csv">Download CSV</button></div><div class="count" id="count"></div>' +
      '<div class="wrap"><table><thead id="th"></thead><tbody id="tb"></tbody></table></div><div class="pager" id="pager"></div>';
    app.innerHTML = html;

    function base() {
      if (n <= 1) return all;
      if (n === 0) return all;
      return all.filter(function (p) { return state.removed ? (inStep(p, n - 1) && !inStep(p, n)) : inStep(p, n); });
    }
    function cols() { return state.removed ? LAYOUT[n].filter(function (c) { return c !== "d"; }).concat(REMOVED[n].filter(function (c) { return LAYOUT[n].indexOf(c) < 0; })) : LAYOUT[n]; }
    function rows() {
      var q = state.q.toLowerCase();
      var r = base().filter(function (p) {
        if (q && (p.id + " " + p.t + " " + (p.a || "") + " " + (p.v || "") + " " + (p.d || "")).toLowerCase().indexOf(q) < 0) return false;
        for (var i = 0; i < filters.length; i++) {
          var f = filters[i], v = state.f[f[0]];
          if (!v) continue;
          if (f[4]) { if (!f[4](p, v)) return false; }
          else if ([].concat(f[2](p)).indexOf(v) < 0) return false;
        }
        return true;
      });
      if (state.sort) {
        var g = COLS[state.sort].get;
        r = r.slice().sort(function (a, b) { var x = g(a), y = g(b); return (x > y ? 1 : x < y ? -1 : 0) * state.dir; });
      }
      return r;
    }
    function draw() {
      var c = cols(), r = rows(), per = 100, pages = Math.max(1, Math.ceil(r.length / per));
      if (state.page >= pages) state.page = 0;
      document.getElementById("th").innerHTML = "<tr>" + c.map(function (k) {
        return '<th class="sort ' + (COLS[k].cls || "") + '" data-k="' + k + '">' + esc(COLS[k].label) + "</th>"; }).join("") + "</tr>";
      document.getElementById("tb").innerHTML = r.slice(state.page * per, state.page * per + per).map(function (p) {
        return "<tr>" + c.map(function (k) { var col = COLS[k];
          return '<td class="' + (col.cls || "") + '">' + (col.html ? col.html(p) : esc(col.get(p))) + "</td>"; }).join("") + "</tr>"; }).join("");
      document.getElementById("count").textContent = r.length.toLocaleString("en") + (n === 1 ? " results" : " studies") +
        (state.removed ? " removed at this step" : "") + " shown";
      document.getElementById("pager").innerHTML = pages > 1 ? '<button id="prev">Previous</button> Page ' + (state.page + 1) +
        " of " + pages + ' <button id="next">Next</button>' : "";
      var pv = document.getElementById("prev"), nx = document.getElementById("next");
      if (pv) pv.onclick = function () { if (state.page > 0) { state.page--; draw(); } };
      if (nx) nx.onclick = function () { if (state.page < pages - 1) { state.page++; draw(); } };
      Array.prototype.forEach.call(document.querySelectorAll("#th th"), function (th) {
        th.onclick = function () { var k = th.getAttribute("data-k"); state.dir = state.sort === k ? -state.dir : 1; state.sort = k; draw(); };
      });
    }
    document.getElementById("q").oninput = function (e) { state.q = e.target.value; state.page = 0; draw(); };
    Array.prototype.forEach.call(app.querySelectorAll("select"), function (s) {
      s.onchange = function () { state.f[s.getAttribute("data-k")] = s.value; state.page = 0; draw(); };
    });
    var rm = document.getElementById("rm");
    if (rm) rm.onchange = function () { state.removed = rm.checked; state.page = 0; draw(); };
    document.getElementById("csv").onclick = function () {
      var c = cols(), r = rows();
      var lines = [c.map(function (k) { return COLS[k].label; })].concat(r.map(function (p) {
        return c.map(function (k) { var v = COLS[k].get(p); return Array.isArray(v) ? v.join(" ") : v; }); }));
      var text = lines.map(function (l) { return l.map(function (v) { v = String(v == null ? "" : v);
        return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(","); }).join("\n");
      var a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([text], {type: "text/csv"}));
      a.download = (n === 0 ? "all_studies" : "step" + n + (state.removed ? "_removed" : "")) + ".csv";
      a.click();
    };
    draw();
  }
  return {start: start};
})();
