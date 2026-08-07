// 把 Natural Earth 110m GeoJSON 轉成 Robinson 投影的 SVG path
// 輸出 ../map-data.js  →  window.MAP = { w, h, countries:[{c,name,zh,d,cx,cy}] }
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'ne110m.geojson');
const OUT = path.join(__dirname, '..', 'map-data.js');

// ── Robinson 投影對照表（緯度 0–90，每 5 度）─────────────
const TBL = [
  [1.0000, 0.0000], [0.9986, 0.0620], [0.9954, 0.1240], [0.9900, 0.1860],
  [0.9822, 0.2480], [0.9730, 0.3100], [0.9600, 0.3720], [0.9427, 0.4340],
  [0.9216, 0.4958], [0.8962, 0.5571], [0.8679, 0.6176], [0.8350, 0.6769],
  [0.7986, 0.7346], [0.7597, 0.7903], [0.7186, 0.8435], [0.6732, 0.8936],
  [0.6213, 0.9394], [0.5722, 0.9761], [0.5322, 1.0000],
];

function robinson(lon, lat) {
  const a = Math.min(Math.abs(lat), 90);
  const i = Math.min(Math.floor(a / 5), 17);
  const t = (a - i * 5) / 5;
  const X = TBL[i][0] + (TBL[i + 1][0] - TBL[i][0]) * t;
  const Y = TBL[i][1] + (TBL[i + 1][1] - TBL[i][1]) * t;
  return [
    0.8487 * X * (lon * Math.PI / 180),
    1.3523 * Y * (lat < 0 ? -1 : 1),
  ];
}

// ── 出圖範圍 ─────────────────────────────────────────
const W = 1000;
const [xMax] = robinson(180, 0);          // 0.8487 * π
const yMax = 1.3523;                      // 極點
const SCALE = W / (2 * xMax);
const H = Math.round(2 * yMax * SCALE);

const project = (lon, lat) => {
  const [x, y] = robinson(lon, lat);
  return [x * SCALE + W / 2, H / 2 - y * SCALE];
};

const r1 = n => Math.round(n * 10) / 10;

// 略過的地物：南極洲太佔版面且非國家
const SKIP = new Set(['Antarctica', 'Fr. S. Antarctic Lands']);

// Natural Earth 缺 ISO 的未受承認地區，給自訂碼避免 key 衝突
const FALLBACK = { 'N. Cyprus': 'XNC', 'Somaliland': 'XSL' };

const geo = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const out = [];

for (const f of geo.features) {
  const p = f.properties;
  if (SKIP.has(p.NAME)) continue;

  let code = p.ISO_A2_EH;
  if (!code || code === '-99') code = FALLBACK[p.NAME];
  if (!code) continue;

  // 多邊形 → path，順便算面積加權重心（用最大環當代表點）
  const rings = f.geometry.type === 'Polygon'
    ? [f.geometry.coordinates]
    : f.geometry.coordinates;

  let d = '';
  let best = { area: -1, cx: 0, cy: 0 };

  for (const poly of rings) {
    for (const ring of poly) {
      if (ring.length < 4) continue;
      const pts = ring.map(([lon, lat]) => project(lon, lat));

      // 面積與重心（shoelace）
      let A = 0, cx = 0, cy = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
        const cr = x0 * y1 - x1 * y0;
        A += cr; cx += (x0 + x1) * cr; cy += (y0 + y1) * cr;
      }
      A /= 2;
      if (Math.abs(A) > best.area) {
        best = { area: Math.abs(A), cx: cx / (6 * A), cy: cy / (6 * A) };
      }

      d += 'M' + pts.map(([x, y]) => `${r1(x)} ${r1(y)}`).join('L') + 'Z';
    }
  }

  if (!d) continue;

  out.push({
    c: code.toLowerCase(),
    name: p.NAME_EN || p.NAME,
    zh: p.NAME_ZHT || p.NAME_ZH || p.NAME,
    cont: p.CONTINENT,
    d,
    cx: r1(best.cx),
    cy: r1(best.cy),
  });
}

out.sort((a, b) => a.c.localeCompare(b.c));

// ── 110m 圖資畫不出來的小國，改用可點擊圓點 ───────────
const MICRO = {
  ad: [42.50, 1.52], ag: [17.08, -61.80], bh: [26.03, 50.55], bb: [13.16, -59.55],
  cv: [15.12, -23.61], km: [-11.70, 43.26], dm: [15.41, -61.37], gd: [12.12, -61.68],
  ki: [1.33, 173.02], li: [47.15, 9.55], mv: [3.20, 73.22], mt: [35.90, 14.51],
  mh: [7.11, 171.38], mu: [-20.29, 57.55], fm: [6.92, 158.16], mc: [43.73, 7.42],
  nr: [-0.52, 166.93], pw: [7.50, 134.62], kn: [17.30, -62.73], lc: [13.91, -60.98],
  vc: [13.25, -61.20], ws: [-13.76, -172.10], sm: [43.94, 12.46], st: [0.34, 6.73],
  sc: [-4.62, 55.45], sg: [1.35, 103.82], to: [-21.18, -175.20], tv: [-8.52, 179.20],
  va: [41.90, 12.45],
};

const dots = Object.entries(MICRO).map(([c, [lat, lon]]) => {
  const [x, y] = project(lon, lat);
  return { c, cx: r1(x), cy: r1(y) };
}).sort((a, b) => a.c.localeCompare(b.c));

// 每個圓點到「最近的另一個圓點」的距離。前端用它限制點擊區大小——
// 加勒比海那幾個島國彼此只差幾個單位，點擊區放太大就會互相搶點擊。
for (const d of dots) {
  let min = Infinity;
  for (const o of dots) {
    if (o === d) continue;
    min = Math.min(min, Math.hypot(d.cx - o.cx, d.cy - o.cy));
  }
  d.nd = r1(min);
}

fs.writeFileSync(
  OUT,
  'window.MAP = ' + JSON.stringify({ w: W, h: H, countries: out, dots }) + ';\n',
  'utf8'
);

console.log(`viewBox 0 0 ${W} ${H}`);
console.log(`${out.length} 國路徑 + ${dots.length} 個小國圓點，輸出 ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
console.log('抽樣：', out.filter(o => ['tw', 'jp', 'us', 'br', 'za'].includes(o.c))
  .map(o => `${o.c}=${o.zh}(${o.cx},${o.cy})`).join('  '));
