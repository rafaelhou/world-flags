/* ═══════════════════════════════════════════════════════════
   訪問計數器 — Supabase

   設定方式：把下面兩個值換成你的 Supabase 專案資訊
   （Dashboard → Project Settings → API）。

   ⚠️ anon key 本來就是設計成公開的，它會出現在前端原始碼裡，
      這不是設定錯誤。安全性由資料庫端保證：counters 表開了 RLS
      且沒有任何 policy，anon 只能執行 increment_counter /
      get_counter 兩個函式，無法直接讀寫資料。
      前提是你有照 sql/counter.sql 設定 —— 沒跑那份 SQL 就把
      anon key 放上來才是真的危險。
   ═══════════════════════════════════════════════════════════ */

const SUPABASE_URL  = 'https://ciptftupkllmwwnrqmkt.supabase.co';
const SUPABASE_ANON = 'sb_publishable_wlrk7HnxRKzo2bhSsRgbEQ_U4KzaFZz';
const COUNTER_ID    = 'flags';

(function () {
  const el = document.getElementById('view-count');
  const box = document.getElementById('counter');
  if (!el || !box) return;

  // 尚未設定 → 靜靜隱藏，不要在頁面上留一個壞掉的東西
  if (SUPABASE_URL.indexOf('YOUR-PROJECT') !== -1 || SUPABASE_ANON.indexOf('YOUR-ANON') !== -1) {
    box.hidden = true;
    return;
  }

  // 同一個分頁重新整理不重複計數
  let counted = false;
  try { counted = sessionStorage.getItem('wf-counted') === '1'; } catch (e) {}

  const fn = counted ? 'get_counter' : 'increment_counter';

  fetch(SUPABASE_URL + '/rest/v1/rpc/' + fn, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON,
      'Authorization': 'Bearer ' + SUPABASE_ANON,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ counter_id: COUNTER_ID })
  })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (n) {
      if (typeof n !== 'number') throw new Error('unexpected payload');
      try { sessionStorage.setItem('wf-counted', '1'); } catch (e) {}
      el.textContent = n.toLocaleString('zh-TW');
      box.hidden = false;
    })
    .catch(function () {
      // 連不上就整塊藏起來，不影響閱讀
      box.hidden = true;
    });
})();
