-- ═══════════════════════════════════════════════════════════
-- 訪問計數器 — Supabase 資料庫設定
-- 在 Supabase Dashboard → SQL Editor 貼上整份執行一次即可。
-- ═══════════════════════════════════════════════════════════

-- 1. 計數表
create table if not exists public.counters (
  id         text        primary key,
  count      bigint      not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.counters (id, count)
values ('flags', 0)
on conflict (id) do nothing;

-- 2. 開啟 RLS，且「不」建立任何 policy
--    → anon 金鑰無法直接讀寫這張表，只能透過下面的函式操作。
--    這是安全性的關鍵：即使 anon key 公開在前端原始碼，
--    別人也無法竄改數值或撈走資料。
alter table public.counters enable row level security;

-- 3. 遞增並回傳新值（security definer：以函式擁有者權限執行，繞過 RLS）
create or replace function public.increment_counter(counter_id text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count bigint;
begin
  update public.counters
     set count = count + 1,
         updated_at = now()
   where id = counter_id
  returning count into new_count;

  if new_count is null then
    raise exception 'unknown counter: %', counter_id;
  end if;

  return new_count;
end;
$$;

-- 4. 只讀取，不遞增（同一個分頁重新整理時用）
create or replace function public.get_counter(counter_id text)
returns bigint
language sql
security definer
set search_path = public
as $$
  select count from public.counters where id = counter_id;
$$;

-- 5. 只把「執行這兩個函式」的權限給 anon，表本身完全不開放
revoke all on function public.increment_counter(text) from public, anon;
revoke all on function public.get_counter(text)       from public, anon;
grant execute on function public.increment_counter(text) to anon;
grant execute on function public.get_counter(text)       to anon;
