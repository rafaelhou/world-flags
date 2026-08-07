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

  svg.appendChild(gLand);
  svg.appendChild(gDot);

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
  }

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
  var ptrs = {}, dragFrom = null, moved = 0, pinchDist = 0, tapSlop = 5;

  mapbox.addEventListener('pointerdown', function (e) {
    // 手指按下再放開幾乎一定會晃個幾像素，門檻跟滑鼠一樣嚴會讓手機上點不動
    tapSlop = e.pointerType === 'touch' ? 14 : 5;
    ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
    var ids = Object.keys(ptrs);
    if (ids.length === 1) {
      dragFrom = { sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
      moved = 0;
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
      moved = Math.max(moved, Math.hypot(e.clientX - dragFrom.sx, e.clientY - dragFrom.sy));
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
    if (Object.keys(ptrs).length < 2) pinchDist = 0;
    if (!Object.keys(ptrs).length) { dragFrom = null; svg.classList.remove('dragging'); }
  }
  mapbox.addEventListener('pointerup', endPtr);
  mapbox.addEventListener('pointercancel', endPtr);
  mapbox.addEventListener('pointerleave', function () { tip.hidden = true; });

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

  function pickAt(x, y) {
    var els = document.elementsFromPoint(x, y);
    var dot = null, land = null, landAny = null;
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (!el.getAttribute) continue;
      var c = el.getAttribute('data-c');
      if (!c || !INFO[c]) continue;
      if (el.tagName === 'circle') {
        if (!dot) dot = c;
      } else {
        if (!landAny) landAny = c;                    // 只碰到邊框也算，當退路
        if (!land && inFill(el, x, y)) land = c;      // 填色真的包含此點者優先
      }
    }
    land = land || landAny;
    return (MAP.w / view.w < 3) ? (land || dot) : (dot || land);
  }

  svg.addEventListener('click', function (e) {
    if (moved > tapSlop) return;                 // 拖曳而非點擊
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
