# 世界國旗地圖

點擊地圖上的國家，看見那面國旗背後的故事。197 面國旗、八個旗幟家族、國旗設計的五個原則。

**線上瀏覽**
- https://world-flags.pages.dev/
- https://rafaelhou.github.io/world-flags/

## 內容

| 區塊 | 說明 |
|---|---|
| 互動地圖 | Robinson 投影的世界地圖，可縮放、平移、搜尋。點任一國家看國旗故事 |
| 旗幟家族 | 北歐十字、法式三色旗、泛非色、泛阿拉伯色、泛斯拉夫色、米字旗系統、星月旗、米蘭達三色 |
| 設計原理 | NAVA《Good Flag, Bad Flag》的五條原則 |
| 世界之最 | 最古老、唯一非四邊形、正反面不同、唯一有步槍…… |
| 全部國旗 | 197 面國旗依洲別排列 |

收錄範圍：聯合國 193 個會員國 ＋ 2 個觀察員（梵蒂岡、巴勒斯坦）＋ 中華民國 ＋ 科索沃。

## 技術

沒有框架、沒有建置工具，就是 HTML / CSS / 原生 JS。地圖是自己算的 SVG，不依賴任何地圖函式庫或外部 API。

```
index.html          頁面
style.css
app.js              地圖互動、搜尋、家族高亮
map-data.js         產生出來的地圖路徑（勿手改，見下方）
data/*.js           各國國旗資料，依洲別分檔
flags/*.svg         197 面國旗
counter.js          Supabase 瀏覽計數
sql/counter.sql     計數器的資料庫設定
build/              資料產生腳本
```

### 重新產生地圖資料

`map-data.js` 是腳本產生的，不要手動編輯。原始圖資（`build/ne110m.geojson`，約 820 KB）沒有進版控，需要先抓：

```bash
curl -o build/ne110m.geojson https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson
node build/make-map.js
```

`make-map.js` 做三件事：

1. 用 **Robinson 投影**把經緯度轉成 SVG 座標（比麥卡托更適合世界全圖，高緯度不會被誇張放大）
2. 用 shoelace 公式算每個國家最大陸塊的重心，當作搜尋定位點
3. 補上 29 個小島國——1:110m 的圖資解析度畫不出它們，改用可點擊的圓點

### 重新下載國旗

```bash
node build/get-flags.js
```

已存在的檔案會跳過。

### 為什麼小國要畫兩個圓

每個小島國其實畫了兩個同心圓：看得見的 `.dot`（螢幕上固定 9px）和透明的 `.hit`（26px）。
半徑會隨縮放與螢幕寬度反向調整，維持固定的螢幕像素大小——手機上地圖只有三百多像素寬，
若用固定的 SVG 半徑，圓點會小到手指點不到。

## 資料來源

- [Natural Earth](https://www.naturalearthdata.com/) — 地圖向量圖資，公有領域
- [hampusborgos/country-flags](https://github.com/hampusborgos/country-flags) — 國旗 SVG，公有領域
- [NAVA · Good Flag, Bad Flag](https://nava.org/good-flag-bad-flag/) — 設計五原則

國旗的歷史敘述常有多種說法，尤其那些「傳說」——站上在這類地方都標明了是傳說。發現錯誤歡迎開 issue。
