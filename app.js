(function () {
  'use strict';

  var MAP = window.MAP, C = window.C;
  if (!MAP || !C) return;

  var SVGNS = 'http://www.w3.org/2000/svg';
  var svg   = document.getElementById('map');
  var panel = document.getElementById('panel');
  var tip   = document.getElementById('tip');
  var mapbox = svg.parentNode;

  // ── 小國（110m 圖資畫不出來）的英文名與所屬洲 ──────────
  var MICRO = {
    ad: ['Andorra', 'Europe'],            ag: ['Antigua and Barbuda', 'North America'],
    bh: ['Bahrain', 'Asia'],              bb: ['Barbados', 'North America'],
    cv: ['Cabo Verde', 'Africa'],         km: ['Comoros', 'Africa'],
    dm: ['Dominica', 'North America'],    gd: ['Grenada', 'North America'],
    ki: ['Kiribati', 'Oceania'],          li: ['Liechtenstein', 'Europe'],
    mv: ['Maldives', 'Asia'],             mt: ['Malta', 'Europe'],
    mh: ['Marshall Islands', 'Oceania'],  mu: ['Mauritius', 'Africa'],
    fm: ['Micronesia', 'Oceania'],        mc: ['Monaco', 'Europe'],
    nr: ['Nauru', 'Oceania'],             pw: ['Palau', 'Oceania'],
    kn: ['Saint Kitts and Nevis', 'North America'],
    lc: ['Saint Lucia', 'North America'],
    vc: ['Saint Vincent and the Grenadines', 'North America'],
    ws: ['Samoa', 'Oceania'],             sm: ['San Marino', 'Europe'],
    st: ['Sao Tome and Principe', 'Africa'], sc: ['Seychelles', 'Africa'],
    sg: ['Singapore', 'Asia'],            to: ['Tonga', 'Oceania'],
    tv: ['Tuvalu', 'Oceania'],            va: ['Vatican City', 'Europe']
  };

  var CONT_ZH = {
    'Asia': '亞洲', 'Europe': '歐洲', 'Africa': '非洲',
    'North America': '北美洲', 'South America': '南美洲', 'Oceania': '大洋洲'
  };

  var FAM_ZH = {
    nordic: '北歐十字', tri: '法式三色旗', panaf: '泛非色', arab: '泛阿拉伯色',
    slav: '泛斯拉夫色', union: '米字旗系統', crescent: '星月旗', miranda: '米蘭達三色'
  };

  // ── 把地圖資料與國旗資料併成一張總表 ──────────────────
  var INFO = {};   // code -> {zh, en, cont, y, r, s, fam}
  MAP.countries.forEach(function (o) {
    if (!C[o.c]) return;
    INFO[o.c] = { zh: C[o.c].zh, en: o.name, cont: o.cont, y: C[o.c].y, r: C[o.c].r, s: C[o.c].s, fam: C[o.c].fam || [] };
  });
  Object.keys(MICRO).forEach(function (c) {
    if (!C[c]) return;
    INFO[c] = { zh: C[c].zh, en: MICRO[c][0], cont: MICRO[c][1], y: C[c].y, r: C[c].r, s: C[c].s, fam: C[c].fam || [] };
  });

  var CODES = Object.keys(INFO);

  // ══════════════ 畫地圖 ══════════════
  svg.setAttribute('viewBox', '0 0 ' + MAP.w + ' ' + MAP.h);

  var gLand = document.createElementNS(SVGNS, 'g');
  var gDot  = document.createElementNS(SVGNS, 'g');

  MAP.countries.forEach(function (o) {
    var p = document.createElementNS(SVGNS, 'path');
    p.setAttribute('d', o.d);
    p.setAttribute('class', 'land ' + (INFO[o.c] ? 'has' : 'no'));
    if (INFO[o.c]) p.setAttribute('data-c', o.c);
    gLand.appendChild(p);
  });

  // 每個小國畫兩個圓：看得見的小圓 ＋ 看不見的大圓（手指點得到）
  MAP.dots.forEach(function (o) {
    if (!INFO[o.c]) return;
    ['hit', 'dot'].forEach(function (cls) {
      var ci = document.createElementNS(SVGNS, 'circle');
      ci.setAttribute('cx', o.cx);
      ci.setAttribute('cy', o.cy);
      ci.setAttribute('class', cls);
      ci.setAttribute('data-c', o.c);
      gDot.appendChild(ci);
    });
  });

  // ── 國名標籤 ──────────────────────────────────────
  // 地圖上放不下全名的國家，改用短名
  var SHORT = {
    tw: '臺灣', ba: '波赫', cd: '剛果（金）', cg: '剛果（布）', pg: '巴紐',
    st: '聖多美', kn: '聖克里斯多福', vc: '聖文森', tt: '千里達', ag: '安地卡',
    fm: '密克羅尼西亞', cf: '中非', sa: '沙烏地', ae: '阿聯', gq: '赤道幾內亞',
    do: '多明尼加', mk: '北馬其頓', sz: '史瓦帝尼'
  };

  var gLbl = document.createElementNS(SVGNS, 'g');
  gLbl.setAttribute('class', 'labels');
  var labels = [];

  function addLabel(code, cx, cy, bw, bh, isDot) {
    var t = document.createElementNS(SVGNS, 'text');
    t.setAttribute('class', 'lbl');
    t.setAttribute('data-c', code);      // 國名本身也要能點——見 pickAt
    t.setAttribute('x', cx);
    t.setAttribute('y', cy);
    t.textContent = SHORT[code] || INFO[code].zh;
    gLbl.appendChild(t);
    labels.push({ el: t, n: t.textContent.length, bw: bw, bh: bh, dot: isDot, x: cx, cy: cy });
  }

  MAP.countries.forEach(function (o) {
    if (INFO[o.c]) addLabel(o.c, o.cx, o.cy, o.bw, o.bh, false);
  });
  MAP.dots.forEach(function (o) {
    if (INFO[o.c]) addLabel(o.c, o.cx, o.cy, 0, 0, true);
  });

  svg.appendChild(gLand);
  svg.appendChild(gDot);
  svg.appendChild(gLbl);

  var nodesOf = {};   // code -> [elements]
  Array.prototype.forEach.call(svg.querySelectorAll('[data-c]'), function (el) {
    var c = el.getAttribute('data-c');
    (nodesOf[c] = nodesOf[c] || []).push(el);
  });

  // 每個小國圓點到最近的另一個圓點的距離（SVG 單位），用來限制點擊區大小
  var NEAR = {};
  MAP.dots.forEach(function (o) { if (o.nd) NEAR[o.c] = o.nd; });

  // 各國在地圖上的中心點（給搜尋時定位用）
  var CENTER = {};
  MAP.countries.forEach(function (o) { CENTER[o.c] = [o.cx, o.cy]; });
  MAP.dots.forEach(function (o) { CENTER[o.c] = [o.cx, o.cy]; });

  // ══════════════ 縮放與平移 ══════════════
  var view = { x: 0, y: 0, w: MAP.w, h: MAP.h };
  var MINW = MAP.w / 14, MAXW = MAP.w;
  var svgW = 0;                            // 地圖目前實際寬度（像素），由 ResizeObserver 維護

  function applyView() {
    svg.setAttribute('viewBox', view.x + ' ' + view.y + ' ' + view.w + ' ' + view.h);

    // 圓點在螢幕上維持固定像素大小，不論縮放或螢幕寬度。
    // 手機上地圖只有三百多像素寬，若用固定的 SVG 半徑，圓點會小到點不到。
    //
    // 寬度由 ResizeObserver 提供而不是當場量：第一次執行時版面可能還沒算完，
    // getBoundingClientRect() 會回傳錯誤的寬度，讓圓點大得離譜。
    var px = (svgW || MAP.w) / view.w;      // 每個 SVG 單位幾像素

    // 點擊區只在放大後才長大。全圖時整個歐洲只有約 100px 寬，
    // 固定 26px 的點擊區會把德國、義大利、西班牙等十幾個國家整片蓋住。
    var grow = Math.min(1, (MAP.w / view.w - 1) / 3);   // 放大到 4 倍時達到最大
    var rDot = 4.5 / px;
    var rHitPx = 4.5 + 9 * grow;

    Array.prototype.forEach.call(gDot.childNodes, function (n) {
      // 用 classList 而非字串比對：被選取或家族高亮時 class 會變成 "hit sel"／"hit fam"
      if (!n.classList.contains('hit')) { n.setAttribute('r', rDot); return; }
      // 再受限於「最近的另一個圓點」——加勒比海那幾個島國靠得極近，
      // 點擊區放太大會互相搶走點擊。放大之後距離拉開，這個上限自然失效。
      var nd = NEAR[n.getAttribute('data-c')];
      var capPx = nd ? 0.45 * nd * px : Infinity;
      n.setAttribute('r', Math.max(rDot, Math.min(rHitPx, capPx) / px));
    });

    updateLabels(px);
  }

  // ── 標籤：字級固定在螢幕上 11px，放得下才顯示 ──────────
  // 197 個國名同時出現會糊成一團，所以用「這個國家在畫面上夠不夠大」
  // 來決定要不要標——全圖只看得到大國，放大後小國的名字才浮現。
  var FS = 11, labelsOn = true, lastPx = -1;

  function updateLabels(px) {
    if (!labelsOn) return;
    if (px === lastPx) return;              // 平移不需重算，只有縮放才要
    lastPx = px;

    var fs = FS / px;                       // 螢幕 11px 換算成 SVG 單位
    var zoomK = MAP.w / view.w;

    // 第一輪：這個國家在畫面上放得下自己的名字嗎
    var cand = [];
    for (var i = 0; i < labels.length; i++) {
      var L = labels[i];
      var ok = L.dot
        ? zoomK >= 4                        // 小島國放大後才標
        : (L.bw * px > L.n * FS * 1.15 && L.bh * px > FS * 1.5);
      if (!ok) { L.el.style.display = 'none'; continue; }
      // 碰撞框比字面稍大：中文字約 1em 寬，再加字距與 3px 的白色描邊光暈
      var y = L.dot ? L.cy + 9 / px : L.cy;
      var hw = (L.n * fs * 1.06) / 2 + 3 / px;
      var hh = fs * 0.75 + 3 / px;
      cand.push({ L: L, y: y, x0: L.x - hw, x1: L.x + hw, y0: y - hh, y1: y + hh });
    }

    // 第二輪：大國優先擺放，會撞到已擺放者的就讓位。
    // 沒有這一步，歐洲一放大就會擠成一團互相疊字。
    cand.sort(function (a, b) { return (b.L.bw * b.L.bh) - (a.L.bw * a.L.bh); });

    var placed = [];
    for (var k = 0; k < cand.length; k++) {
      var c = cand[k], hit = false;
      for (var m = 0; m < placed.length; m++) {
        var q = placed[m];
        if (c.x0 < q.x1 && q.x0 < c.x1 && c.y0 < q.y1 && q.y0 < c.y1) { hit = true; break; }
      }
      if (hit) { c.L.el.style.display = 'none'; continue; }
      placed.push(c);
      c.L.el.style.display = '';
      c.L.el.setAttribute('font-size', fs);
      c.L.el.setAttribute('y', c.y);
    }
  }

  var lblBtn = document.getElementById('lbl');
  lblBtn.addEventListener('click', function () {
    labelsOn = !labelsOn;
    lblBtn.setAttribute('aria-pressed', labelsOn ? 'true' : 'false');
    gLbl.style.display = labelsOn ? '' : 'none';
    if (labelsOn) { lastPx = -1; applyView(); }
  });

  function clamp() {
    view.w = Math.max(MINW, Math.min(MAXW, view.w));
    view.h = view.w * MAP.h / MAP.w;
    view.x = Math.max(-view.w * 0.15, Math.min(MAP.w - view.w * 0.85, view.x));
    view.y = Math.max(-view.h * 0.15, Math.min(MAP.h - view.h * 0.85, view.y));
  }

  // 螢幕座標 → SVG 座標
  function toSvg(clientX, clientY) {
    var b = svg.getBoundingClientRect();
    return [
      view.x + (clientX - b.left) / b.width * view.w,
      view.y + (clientY - b.top) / b.height * view.h
    ];
  }

  function zoomAt(sx, sy, factor) {
    var nw = Math.max(MINW, Math.min(MAXW, view.w * factor));
    var k = nw / view.w;
    view.x = sx - (sx - view.x) * k;
    view.y = sy - (sy - view.y) * k;
    view.w = nw;
    clamp();
    applyView();
  }

  function zoomCenter(factor) {
    zoomAt(view.x + view.w / 2, view.y + view.h / 2, factor);
  }

  function flyTo(cx, cy, w) {
    view.w = Math.max(MINW, Math.min(MAXW, w));
    view.h = view.w * MAP.h / MAP.w;
    view.x = cx - view.w / 2;
    view.y = cy - view.h / 2;
    clamp();
    applyView();
  }

  svg.addEventListener('wheel', function (e) {
    e.preventDefault();
    var p = toSvg(e.clientX, e.clientY);
    zoomAt(p[0], p[1], e.deltaY > 0 ? 1.18 : 1 / 1.18);
  }, { passive: false });

  document.getElementById('zin').onclick  = function () { zoomCenter(1 / 1.5); };
  document.getElementById('zout').onclick = function () { zoomCenter(1.5); };
  document.getElementById('zrst').onclick = function () {
    view = { x: 0, y: 0, w: MAP.w, h: MAP.h };
    applyView();
  };

  // 指標拖曳 ＋ 雙指縮放
  var ptrs = {}, dragFrom = null, pinchDist = 0, tapSlop = 10, downAt = null;

  mapbox.addEventListener('pointerdown', function (e) {
    // 按下再放開幾乎一定會晃個幾像素——觸控板按壓、手指離開螢幕都會。
    // 門檻設太嚴（原本滑鼠 5px）會讓點擊被默默吃掉，使用者只覺得「點了沒反應」。
    // 真正要平移地圖時位移遠大於此，放寬不會誤判。
    tapSlop = e.pointerType === 'touch' ? 16 : 10;

    // 每次按下都重新記下起點。點擊與否只看「這一次按下到放開移動了多遠」，
    // 不依賴任何跨手勢累積的狀態——那種狀態一旦卡住，之後每次點擊都會失效。
    downAt = { x: e.clientX, y: e.clientY };

    ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
    var ids = Object.keys(ptrs);
    if (ids.length === 1) {
      dragFrom = { sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
      svg.classList.add('dragging');
      try { mapbox.setPointerCapture(e.pointerId); } catch (_) {}
    } else if (ids.length === 2) {
      dragFrom = null;
      pinchDist = dist(ptrs[ids[0]], ptrs[ids[1]]);
    }
  });

  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  mapbox.addEventListener('pointermove', function (e) {
    if (ptrs[e.pointerId]) { ptrs[e.pointerId].x = e.clientX; ptrs[e.pointerId].y = e.clientY; }
    var ids = Object.keys(ptrs);

    if (ids.length === 2 && pinchDist) {
      var d = dist(ptrs[ids[0]], ptrs[ids[1]]);
      if (d > 0) {
        var mid = toSvg((ptrs[ids[0]].x + ptrs[ids[1]].x) / 2, (ptrs[ids[0]].y + ptrs[ids[1]].y) / 2);
        zoomAt(mid[0], mid[1], pinchDist / d);
        pinchDist = d;
      }
      return;
    }

    if (dragFrom) {
      var b = svg.getBoundingClientRect();
      var dx = (e.clientX - dragFrom.sx) / b.width * view.w;
      var dy = (e.clientY - dragFrom.sy) / b.height * view.h;
      view.x = dragFrom.vx - dx;
      view.y = dragFrom.vy - dy;
      clamp();
      applyView();
      return;
    }

    // 沒在拖曳時顯示提示標籤——用和點擊相同的判定，避免標籤寫著義大利卻選到梵蒂岡
    var c = pickAt(e.clientX, e.clientY);
    if (c) {
      var bb = mapbox.getBoundingClientRect();
      tip.textContent = INFO[c].zh;
      tip.style.left = (e.clientX - bb.left) + 'px';
      tip.style.top  = (e.clientY - bb.top) + 'px';
      tip.hidden = false;
    } else {
      tip.hidden = true;
    }
  });

  function endPtr(e) {
    delete ptrs[e.pointerId];
    var n = Object.keys(ptrs).length;
    if (n < 2) pinchDist = 0;
    if (!n) { dragFrom = null; svg.classList.remove('dragging'); }
  }
  mapbox.addEventListener('pointerup', endPtr);
  mapbox.addEventListener('pointercancel', endPtr);
  mapbox.addEventListener('pointerleave', function () { tip.hidden = true; });

  // 指標在地圖外放開時（拖到視窗邊緣、切到別的視窗、手指滑出畫面），
  // .mapbox 收不到 pointerup，那個指標會永遠留在 ptrs 裡。下一次按下就會被
  // 當成「第二根手指」進入雙指縮放模式——從此拖曳與點擊全部失效，直到重新整理。
  // 這正是「每一國都點不動」的成因，所以在 window 層級再收一次尾。
  window.addEventListener('pointerup', endPtr);
  window.addEventListener('pointercancel', endPtr);
  window.addEventListener('blur', function () {
    ptrs = {}; dragFrom = null; pinchDist = 0; downAt = null;
    svg.classList.remove('dragging');
  });

  // 決定某個座標「應該」選到哪一國。
  //
  // 微型國家的圓點就畫在別國國土上——梵蒂岡在義大利身上、列支敦斯登在瑞士旁邊。
  // 單純看最上層元素的話，點義大利中部會跑出梵蒂岡，非常違反直覺。
  // 規則：縮小時大國優先（想點微型國就放大，或用搜尋框）；放大後小國優先。
  // 這個點是否真的落在該國的「填色」裡，而不只是碰到它的邊框線。
  // 國界描邊不隨縮放變細，全圖時甘比亞、以色列、寮國這種細長國家整個
  // 只有一兩像素寬，鄰國的描邊會蓋住它們，導致永遠點不到。
  function inFill(el, x, y) {
    if (!el.isPointInFill || !svg.createSVGPoint) return false;
    var m = svg.getScreenCTM();
    if (!m) return false;
    var pt = svg.createSVGPoint();
    pt.x = x; pt.y = y;
    try { return el.isPointInFill(pt.matrixTransform(m.inverse())); }
    catch (_) { return false; }
  }

  // 優先順序：踩在誰的國土上 > 小國圓點 > 點到誰的名字 > 只碰到誰的邊框
  //
  // 國名不能有絕對優先權——法國的名字會壓在比利時、荷蘭、德國、瑞士上頭，
  // 那樣點這四國都會變成法國。但它是很好的退路：智利在全圖上只有幾像素寬，
  // 「智利」兩個字卻有二十幾像素，字懸在太平洋上的那半邊本來點了沒反應。
  function pickAt(x, y) {
    var els = document.elementsFromPoint(x, y);
    var dot = null, fill = null, edge = null, text = null;
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (!el.getAttribute) continue;
      var c = el.getAttribute('data-c');
      if (!c || !INFO[c]) continue;
      if (el.tagName === 'text') { if (!text) text = c; }
      else if (el.tagName === 'circle') { if (!dot) dot = c; }
      else {
        if (!edge) edge = c;                          // 只碰到邊框線
        if (!fill && inFill(el, x, y)) fill = c;      // 填色真的包含此點
      }
    }
    // 縮小時大國優先，放大後小國圓點優先
    var first = (MAP.w / view.w < 3) ? (fill || dot) : (dot || fill);
    return first || text || edge;
  }

  svg.addEventListener('click', function (e) {
    // 只比對「這一次按下的位置」與放開的位置。downAt 為空時放行（寧可多選也不要沒反應）。
    var d = downAt;
    downAt = null;
    if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > tapSlop) return;   // 拖曳而非點擊
    var c = pickAt(e.clientX, e.clientY);
    if (c) select(c);
  });

  // ══════════════ 選取與詳情面板 ══════════════
  var current = null;

  function select(code, opts) {
    opts = opts || {};
    if (!INFO[code]) return;

    if (current && nodesOf[current]) {
      nodesOf[current].forEach(function (n) { n.classList.remove('sel'); });
    }
    current = code;
    if (nodesOf[code]) nodesOf[code].forEach(function (n) { n.classList.add('sel'); });

    render(code);

    if (opts.fly) {
      var ct = CENTER[code];
      if (ct) flyTo(ct[0], ct[1], MAP.dots.some(function (d) { return d.c === code; }) ? MAP.w / 6 : MAP.w / 3);
    }
    if (opts.scroll) {
      document.getElementById('map-sec').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (window.matchMedia('(max-width: 900px)').matches) {
      panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    if (history.replaceState) history.replaceState(null, '', '#c-' + code);
  }

  function render(code) {
    var d = INFO[code];
    var meta = [];
    if (d.cont) meta.push('<li><span>洲別</span> ' + (CONT_ZH[d.cont] || d.cont) + '</li>');
    if (d.y) meta.push('<li><span>現行版本</span> ' + d.y + ' 年</li>');
    if (d.r) meta.push('<li><span>比例</span> ' + d.r + '</li>');

    var fam = '';
    if (d.fam && d.fam.length) {
      fam = '<p class="pfam">旗幟家族：' + d.fam.map(function (f) {
        return '<button type="button" data-gofam="' + f + '">' + (FAM_ZH[f] || f) + '</button>';
      }).join('') + '</p>';
    }

    panel.innerHTML =
      '<img class="pflag" src="flags/' + code + '.svg" alt="' + d.zh + '國旗">' +
      '<h3 class="pname">' + d.zh + '</h3>' +
      '<p class="pen">' + d.en + '</p>' +
      (meta.length ? '<ul class="pmeta">' + meta.join('') + '</ul>' : '') +
      '<p class="pstory">' + d.s + '</p>' +
      fam;
  }

  panel.addEventListener('click', function (e) {
    var f = e.target.getAttribute && e.target.getAttribute('data-gofam');
    if (f) toggleFam(f, true);
  });

  // ══════════════ 旗幟家族高亮 ══════════════
  var famOn = null;
  var fambar = document.getElementById('fambar');

  function toggleFam(f, force) {
    var next = (famOn === f && !force) ? null : f;
    famOn = next;

    Array.prototype.forEach.call(svg.querySelectorAll('.fam'), function (n) { n.classList.remove('fam'); });
    Array.prototype.forEach.call(fambar.querySelectorAll('button'), function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-fam') === next ? 'true' : 'false');
    });

    if (!next) return;
    CODES.forEach(function (c) {
      if (INFO[c].fam.indexOf(next) < 0 || !nodesOf[c]) return;
      nodesOf[c].forEach(function (n) { n.classList.add('fam'); });
    });
    document.getElementById('map-sec').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  fambar.addEventListener('click', function (e) {
    var f = e.target.getAttribute && e.target.getAttribute('data-fam');
    if (f) toggleFam(f);
  });

  // ══════════════ 搜尋 ══════════════
  var input = document.getElementById('search');
  var results = document.getElementById('results');
  var hits = [], cursor = -1;

  function search(q) {
    q = q.trim().toLowerCase();
    if (!q) return [];
    var starts = [], contains = [];
    CODES.forEach(function (c) {
      var d = INFO[c];
      var zh = d.zh, en = d.en.toLowerCase();
      if (zh.indexOf(q) === 0 || en.indexOf(q) === 0 || c === q) starts.push(c);
      else if (zh.indexOf(q) >= 0 || en.indexOf(q) >= 0) contains.push(c);
    });
    return starts.concat(contains).slice(0, 12);
  }

  function showResults() {
    if (!hits.length) { results.hidden = true; results.innerHTML = ''; return; }
    results.innerHTML = hits.map(function (c, i) {
      return '<li data-c="' + c + '" role="option" aria-selected="' + (i === cursor) + '">' +
             '<img src="flags/' + c + '.svg" alt="">' +
             '<span>' + INFO[c].zh + '</span>' +
             '<span class="en">' + INFO[c].en + '</span></li>';
    }).join('');
    results.hidden = false;
  }

  input.addEventListener('input', function () {
    hits = search(input.value);
    cursor = hits.length ? 0 : -1;
    showResults();
  });

  input.addEventListener('keydown', function (e) {
    if (!hits.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); cursor = (cursor + 1) % hits.length; showResults(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); cursor = (cursor - 1 + hits.length) % hits.length; showResults(); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (cursor >= 0) { pick(hits[cursor]); }
    } else if (e.key === 'Escape') { results.hidden = true; }
  });

  results.addEventListener('click', function (e) {
    var li = e.target.closest ? e.target.closest('li[data-c]') : null;
    if (li) pick(li.getAttribute('data-c'));
  });

  function pick(c) {
    results.hidden = true;
    input.value = INFO[c].zh;
    input.blur();
    select(c, { fly: true });
  }

  document.addEventListener('click', function (e) {
    if (!results.hidden && !e.target.closest('.searchbox')) results.hidden = true;
  });

  // ══════════════ 全部國旗一覽 ══════════════
  var ORDER = ['Asia', 'Europe', 'Africa', 'North America', 'South America', 'Oceania'];
  var byCont = {};
  CODES.forEach(function (c) {
    var k = INFO[c].cont || 'Other';
    (byCont[k] = byCont[k] || []).push(c);
  });

  var grid = document.getElementById('allgrid');
  grid.innerHTML = ORDER.filter(function (k) { return byCont[k]; }).map(function (k) {
    var list = byCont[k].sort(function (a, b) { return INFO[a].zh.localeCompare(INFO[b].zh, 'zh-Hant'); });
    return '<div class="contblock"><h3>' + (CONT_ZH[k] || k) + '　<span style="font-weight:400">' + list.length + ' 國</span></h3>' +
      '<div class="flags">' + list.map(function (c) {
        return '<button type="button" class="fcard" data-c="' + c + '">' +
               '<img src="flags/' + c + '.svg" loading="lazy" alt="' + INFO[c].zh + '國旗">' +
               '<span>' + INFO[c].zh + '</span></button>';
      }).join('') + '</div></div>';
  }).join('');

  grid.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('.fcard') : null;
    if (b) select(b.getAttribute('data-c'), { fly: true, scroll: true });
  });

  // ══════════════ 從網址還原選取 ══════════════
  var m = /^#c-([a-z]{2,3})$/.exec(location.hash || '');
  if (m && INFO[m[1]]) select(m[1], { fly: true });

  // 地圖寬度一有變化就重算圓點半徑——涵蓋初次版面計算完成、視窗縮放、
  // 轉向、字體載入造成的重排。比在腳本執行當下量一次可靠得多。
  //
  // ⚠️ 觀察的是容器 div 而不是 <svg>：ResizeObserver 對 SVG 元素回報的是
  //    SVG 使用者座標單位（永遠是 viewBox 的 1000），不是 CSS 像素。
  // 先同步量一次當起始值，不要等 ResizeObserver 的第一次回呼——
  // 在某些不進行畫面合成的環境裡（背景分頁、隱藏的 iframe）它可能一直不觸發。
  function measure() {
    var w = mapbox.clientWidth || svg.getBoundingClientRect().width;
    if (w && w !== svgW) { svgW = w; applyView(); }
  }
  measure();

  if (window.ResizeObserver) {
    new ResizeObserver(function (entries) {
      var w = entries[0].contentRect.width;
      if (w && w !== svgW) { svgW = w; applyView(); }
    }).observe(mapbox);
  } else {
    var rt;
    window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(measure, 150); });
    window.addEventListener('load', measure);
  }

  applyView();
})();
