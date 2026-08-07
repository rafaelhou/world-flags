// 從 hampusborgos/country-flags（Public Domain）下載國旗 SVG
const fs = require('fs');
const path = require('path');

const DEST = path.join(__dirname, '..', 'flags');
const BASE = 'https://raw.githubusercontent.com/hampusborgos/country-flags/main/svg/';
const UA = 'WorldFlagsGuide/1.0 (+https://github.com/rafaelhou)';

const CODES = ('af al dz ad ao ag ar am au at az bs bh bd bb by be bz bj bt bo ba bw br bn bg bf bi cv kh cm ca cf td cl cn co km cg cd cr ci hr cu cy cz dk dj dm do ec eg sv gq er ee sz et fj fi fr ga gm ge de gh gr gd gt gn gw gy ht hn hu is in id ir iq ie il it jm jp jo kz ke ki kp kr kw kg la lv lb ls lr ly li lt lu mg mw my mv ml mt mh mr mu mx fm md mc mn me ma mz mm na nr np nl nz ni ne ng mk no om pk pw pa pg py pe ph pl pt qa ro ru rw kn lc vc ws sm st sa sn rs sc sl sg sk si sb so za ss es lk sd sr se ch sy tj tz th tl tg to tt tn tr tm tv ug ua ae gb us uy uz vu va ve vn ye zm zw ps tw xk')
  .split(' ');

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function grab(code) {
  const dest = path.join(DEST, code + '.svg');
  if (fs.existsSync(dest) && fs.statSync(dest).size > 200) return 'skip';
  const res = await fetch(BASE + code + '.svg', { headers: { 'User-Agent': UA } });
  if (!res.ok) return 'FAIL ' + res.status;
  const txt = await res.text();
  if (!txt.includes('<svg')) return 'FAIL not-svg';
  fs.writeFileSync(dest, txt, 'utf8');
  return 'ok ' + (txt.length / 1024).toFixed(0) + 'KB';
}

(async () => {
  const fails = [];
  // 分批並行，避免打太兇
  for (let i = 0; i < CODES.length; i += 12) {
    const batch = CODES.slice(i, i + 12);
    const rs = await Promise.all(batch.map(async c => {
      try { return [c, await grab(c)]; } catch (e) { return [c, 'ERR ' + e.message]; }
    }));
    for (const [c, r] of rs) if (r.startsWith('FAIL') || r.startsWith('ERR')) fails.push(c + ':' + r);
    await sleep(250);
  }
  const got = fs.readdirSync(DEST).filter(f => f.endsWith('.svg'));
  const total = got.reduce((s, f) => s + fs.statSync(path.join(DEST, f)).size, 0);
  console.log(`下載完成 ${got.length}/${CODES.length} 面，共 ${(total / 1024 / 1024).toFixed(1)} MB`);
  if (fails.length) console.log('失敗：', fails.join('  '));
  // 找出特別肥的檔案（有些國徽細節很多）
  const big = got.map(f => [f, fs.statSync(path.join(DEST, f)).size])
    .filter(([, s]) => s > 300 * 1024).sort((a, b) => b[1] - a[1]);
  if (big.length) console.log('大於 300KB：', big.map(([f, s]) => `${f} ${(s / 1024).toFixed(0)}KB`).join('  '));
})();
