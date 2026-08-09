# Progress Log — 變更紀錄

> 用途：記錄每次由 AI 協助進行的程式碼修改，方便追蹤「改了什麼、為什麼改、影響哪些檔案」。
> 完整的問題盤點與待辦狀態請見 [`implementation.md`](./implementation.md)；本檔案只記錄實際變更的時間軸。

---

## 2026-08-02 — 全專案問題盤點 + 第一輪修復

### 背景
遍歷整個 `nz-travel` repo（`app/` Next.js 專案、`data/`、`scripts/`、README、git 狀態），列出安全性、程式碼品質、依賴與內容一致性四大類問題，寫成 `implementation.md`，再依優先順序實作可自動修復的部分。

### 變更摘要

**安全性**
- `app/src/app/ledger/page.tsx`：新增 `session` state（`supabase.auth.getSession()` + `onAuthStateChange` 訂閱），「手動新增」「+ 新增」「編輯」三個寫入操作按鈕改成 `{session && (...)}` 條件渲染，行為對齊 `gallery`、`map` 頁面既有的權限顯示邏輯。

**型別安全**
- 新增 `app/src/lib/types.ts`：定義 `Trip`、`City`、`Spot`、`Photo`、`Expense`、`SpotType`、`ExpenseCategory` 型別，對應 Supabase 的 `trips`/`cities`/`spots`/`photos`/`expenses` 資料表。
- 套用至 `ledger/page.tsx`、`gallery/page.tsx`、`AddExpenseModal.tsx`、`MapComponent.tsx`、`SpotFormModal.tsx`、`UploadPhotoModal.tsx`，移除所有 `any`（約 15 處）。
- `session` 相關 state 改用 `@supabase/supabase-js` 匯出的 `Session` 型別。

**React Hooks 規則修正**（`react-hooks/set-state-in-effect`、`react-hooks/exhaustive-deps`）
- `fetchExpenses`（ledger）、`fetchPhotos`（gallery）、`loadData`（MapComponent）改寫為 `useCallback` 包裝、回傳 `supabase...then(...)` 形式，setState 移到非同步 callback 內執行，effect 依賴陣列補齊。
- `AddExpenseModal.tsx`、`UploadPhotoModal.tsx` 原本用 `useEffect` 把 `initialData`/`isOpen` 同步進 state（reset-effect 模式），改為讓父元件（`ledger/page.tsx` 用 `key` prop、`gallery/page.tsx` 改為條件渲染）在開啟時重新掛載元件，直接用 `useState` 初始值取代，徹底移除該 effect。`UploadPhotoModal` 因此拿掉 `isOpen` prop。
- `ThemeProvider.tsx`（讀 `localStorage` 還原主題）、`Particles.tsx`（SSR hydration 用的 mounted-gate）維持同步 `setState`，但這是官方文件承認的有效例外，加上精確對齊觸發行的 `eslint-disable-next-line react-hooks/set-state-in-effect` 註解及理由說明。

**`next/image` 遷移**
- `app/next.config.ts`：新增 `images.remotePatterns`，允許 `res.cloudinary.com`。
- `MapComponent.tsx` 側欄照片、`gallery/page.tsx` 燈箱大圖改用 `next/image`。
- `gallery/page.tsx` 瀑布流縮圖**刻意保留** `<img>`：masonry 排版依賴每張照片原本不同的長寬比，`photos` 資料表未儲存寬高，強制套用 `next/image` 會需要固定尺寸或裁切，破壞版面效果；已加註解說明並保留 `eslint-disable-next-line`。

**死代碼清理**
- 刪除 `app/src/app/page.module.css`（`create-next-app` 模板殘留，未被任何檔案引用）。
- 刪除 `app/src/components/ui/Button.tsx`、`app/src/components/ui/Card.tsx`（未被任何頁面引用；`ui/Sidebar.tsx` 因為有實際使用而保留）。
- 移除 `app/src/app/page.tsx` 中未使用的 `IconNZ` 函式。
- `UploadPhotoModal.tsx` 的 `catch (err: any)` 改為 `catch (err)` + `err instanceof Error` 型別窄化。

### 驗證結果
```
npm run lint   → 0 errors, 0 warnings（修復前：23 errors, 6 warnings）
npm run build  → Compiled successfully, TypeScript 檢查通過，7 個路由全部產生成功
```

### 修改的檔案
| 類型 | 檔案 |
|---|---|
| 新增 | `app/src/lib/types.ts` |
| 新增 | `implementation.md` |
| 修改 | `app/src/app/ledger/page.tsx` |
| 修改 | `app/src/app/gallery/page.tsx` |
| 修改 | `app/src/app/page.tsx` |
| 修改 | `app/next.config.ts` |
| 修改 | `app/src/components/AddExpenseModal.tsx` |
| 修改 | `app/src/components/UploadPhotoModal.tsx` |
| 修改 | `app/src/components/MapComponent.tsx` |
| 修改 | `app/src/components/SpotFormModal.tsx` |
| 修改 | `app/src/components/ThemeProvider.tsx` |
| 修改 | `app/src/components/Particles.tsx` |
| 刪除 | `app/src/app/page.module.css` |
| 刪除 | `app/src/components/ui/Button.tsx` |
| 刪除 | `app/src/components/ui/Card.tsx` |

### 未處理項目（需使用者決策，詳見 `implementation.md` 第五節）
- 補齊資料庫 schema / RLS 的 SQL 檔案（目前 repo 中完全沒有）
- `data/` 目錄目前被 `.gitignore` 排除，是否要納入版控
- `tesseract.js`、`cloudinary`（server SDK）兩個已安裝但未使用的依賴，是否移除
- 大量 inline style 的重構（範圍大，未執行）
- 是否要將本次與先前既有的未 commit 變更一併 commit

---

## 2026-08-02 — README 更新 + 建立本進度紀錄檔

### 變更摘要
- `README.md`：
  - 技術棧章節更新為 Next.js 16（原寫 15），補充 `next/image` 用於讀取 Cloudinary 遠端圖片、`app/src/lib/types.ts` 共用型別定義的說明。
  - 「資料庫初始化」章節加上明確警語：repo 內目前沒有 Schema/RLS 建置 SQL，`data/` 目錄未納入版控，新 clone 專案不會有 seed 檔案；並列出各資料表的欄位結構，供手動建置參考。
  - 「專案結構」章節更新為實際目錄（`app/src/lib/` 內含 `supabase/`、`cloudinary.ts`、`types.ts`；新增 `implementation.md`、`progress.md` 的說明）。
  - 「權限管理」章節補充說明地圖/相冊/記帳三頁的寫入按鈕都已改為登入才顯示。
  - 新增「已知限制」段落，列出 OCR 掃描尚未串接、資料庫腳本待補齊，並連結 `implementation.md`、`progress.md`。
- 新增 `progress.md`（本檔案）：記錄每次修改的變更紀錄時間軸。

### 修改的檔案
| 類型 | 檔案 |
|---|---|
| 修改 | `README.md` |
| 新增 | `progress.md` |

---

## 2026-08-02 — 雙幣別記帳 + 每日歷史匯率 + CSV 批次匯入

### 背景
使用者要求：(1) 記帳金額改成有台幣就算台幣、只有紐幣才算紐幣，個別項目兩種幣別都顯示，總金額預設拆分顯示、可切換成全部換算台幣；(2) 自動抓取旅程期間每日 NZD→TWD 歷史匯率，取代原本手動輸入單一匯率；(3) 開銷資料改用 CSV 批次匯入。

### 變更摘要

**資料庫 schema（尚待使用者在 Supabase SQL Editor 執行）**
- 新增 `data/migration_currency_and_rates.sql`：
  - `expenses` 新增 `amount_twd numeric(10,2)`（可為 null），`amount_nzd` 改為可 null，加上 CHECK constraint 保證兩者至少一個非 null。
  - 新增 `exchange_rates(date PK, nzd_to_twd, source, created_at)` 表，RLS 設定為公開可讀、登入者可寫。

**歷史匯率抓取**
- 新增 `scripts/fetch_exchange_rates.mjs`：串接免費的 [fawazahmed0/currency-api](https://github.com/fawazahmed0/exchange-api)（無需 API Key），抓取指定日期範圍的每日 NZD→TWD 匯率，輸出 `data/seed_exchange_rates.sql` 與 `data/exchange_rates.json`。
- 已實際執行，抓到 2026-06-26 ~ 2026-07-28（本次旅程日期）共 33 天的匯率，範圍 17.97 ~ 18.98。

**CSV 批次匯入**
- 新增 `scripts/import_expenses_csv.mjs`：讀取 `data/expenses.csv`（欄位：`date, store_name, item_name, amount_nzd, amount_twd, category, note`），驗證格式後產生 `data/seed_expenses_from_csv.sql`。
- 新增 `data/expenses_template.csv` 作為欄位格式範例。
- 已用範例 CSV 測試腳本可正常解析並產生正確的 SQL（含中文欄位、NULL 金額、必填欄位缺漏時的錯誤訊息）。

**前端計算與顯示邏輯**
- 新增 `app/src/lib/money.ts`：統一定義 `splitTotal`（拆分小計）、`sumAsTwd`/`convertExpenseToTwd`（換算單一台幣總額，只有紐幣的項目查當天歷史匯率概算並標記「≈」）、`formatExpenseAmount`/`formatSplitTotal`/`formatTWD`/`formatNZD` 等格式化函式。
- `app/src/lib/types.ts`：`Expense` 新增 `amount_twd: number | null`，`amount_nzd` 改為 `number | null`；新增 `ExchangeRate` 型別。
- `app/src/app/ledger/page.tsx`：
  - 移除原本的「自訂匯率」文字輸入框，改成「全部顯示為台幣」勾選開關（歷史匯率載入完成前停用並顯示提示）。
  - 總花費、日期小計、店家小計、單筆金額全部改用 `money.ts` 的邏輯計算與顯示。
  - 圓餅圖的分類佔比一律換算成台幣顯示（避免混合幣別無法直接加總比較）。
  - 新增 `exchange_rates` 的抓取 effect。
- `app/src/app/page.tsx`：首頁「總花費」統計卡改用拆分顯示（`NZ$xx + NT$xx`），改抓 `date, amount_nzd, amount_twd` 三個欄位。
- `app/src/components/AddExpenseModal.tsx`：原本單一「金額 (NZD)」欄位拆成「紐幣金額」「台幣金額」兩個欄位（至少填一個），並附上說明文字。

### 驗證結果
```
npm run lint   → 0 errors, 0 warnings
npm run build  → Compiled successfully, TypeScript 檢查通過
node scripts/fetch_exchange_rates.mjs → 成功抓取 33 天匯率並寫入 SQL/JSON
node scripts/import_expenses_csv.mjs data/expenses_template.csv → 成功解析 4 筆範例資料（測試後已刪除產生的暫存 SQL）
```

### 修改的檔案
| 類型 | 檔案 |
|---|---|
| 新增 | `data/migration_currency_and_rates.sql` |
| 新增 | `scripts/fetch_exchange_rates.mjs` |
| 新增 | `data/seed_exchange_rates.sql`（已執行產生） |
| 新增 | `data/exchange_rates.json`（已執行產生） |
| 新增 | `scripts/import_expenses_csv.mjs` |
| 新增 | `data/expenses_template.csv` |
| 新增 | `app/src/lib/money.ts` |
| 修改 | `app/src/lib/types.ts` |
| 修改 | `app/src/app/ledger/page.tsx` |
| 修改 | `app/src/app/page.tsx` |
| 修改 | `app/src/components/AddExpenseModal.tsx` |

### 未處理項目（需使用者操作）
- 尚未對 Supabase 執行 `migration_currency_and_rates.sql`（僅有 anon key，需使用者自行在 SQL Editor 跑一次）。
- 舊的 `data/開銷.md` + `scripts/parse_expenses.mjs` 流程與新的 CSV 流程目前並存，尚未決定是否棄用前者。
- 使用者尚未提供實際要匯入的 CSV 資料（`data/expenses.csv`），目前只有範例格式檔。

## 2026-08-02 — 開銷分類值由 `clothing` 統一改為 `shopping`

### 背景
使用者決定將內部開銷分類值 `clothing` 改為 `shopping`；中文顯示名稱維持「購物」，以避免前端、CSV、seed 與資料庫出現不同分類值。

### 變更摘要
- 前端 `ExpenseCategory`、分類顏色/標籤映射、分類下拉選單與 CSS badge class 全部改用 `shopping`。
- CSV 匯入腳本的分類白名單與說明改用 `shopping`。
- 舊 Markdown 解析器在處理洗衣服與 `macpac` 紀錄時改產生 `shopping`。
- seed SQL、CSV 範例與設計/實作文件中的分類清單同步更新。
- `data/migration_currency_and_rates.sql` 新增：
  - `UPDATE expenses SET category = 'shopping' WHERE category = 'clothing';`
  - 此語句可重複執行，供使用者將 Supabase 既有資料中的舊分類值一次轉換。

### 修改的檔案
| 類型 | 檔案 |
|---|---|
| 修改 | `app/src/lib/types.ts` |
| 修改 | `app/src/app/ledger/page.tsx` |
| 修改 | `app/src/components/AddExpenseModal.tsx` |
| 修改 | `app/src/app/globals.css` |
| 修改 | `scripts/import_expenses_csv.mjs` |
| 修改 | `scripts/parse_expenses.mjs` |
| 修改 | `data/seed_expenses.sql` |
| 修改 | `data/expenses_template.csv` |
| 修改 | `data/implementation_plan1.md` |
| 修改 | `implementation.md` |
| 修改 | `data/migration_currency_and_rates.sql` |

## 2026-08-02 — 修正 Supabase enum migration 執行順序

### 問題
直接執行 `UPDATE expenses SET category = 'shopping' WHERE category = 'clothing';` 時，Supabase 回報 `expense_category` enum 尚未包含 `shopping`。

### 修正
- `data/migration_currency_and_rates.sql` 現在會先加入：
  ```sql
  ALTER TYPE public.expense_category ADD VALUE IF NOT EXISTS 'shopping';
  ```
- 因 PostgreSQL 要求新增 enum 值先提交後才能用於 `UPDATE`，migration 文件已改為明確要求分兩階段執行：先單獨執行 `ALTER TYPE`，成功後再重新執行完整 migration。

## 2026-08-02 — 補齊 expense_category 的 `shopping` 與 `other`

### 問題
執行 `data/seed_expenses_from_csv.sql` 時，Supabase 回報 `invalid input value for enum expense_category: "shopping"`；該 seed 也包含 `other`，而遠端 enum 目前兩者都可能尚未建立。

### 修正
- `data/migration_currency_and_rates.sql` 補上 `shopping` 與 `other` 的 enum 初始化說明與語句。
- `data/seed_expenses_from_csv.sql` 補上執行前置條件與正確的 enum 初始化指令。
- 既有 `clothing` 轉換改用 `category::text = 'clothing'` 比對，避免舊 enum 定義不同時在 WHERE 解析階段失敗。

### Supabase 執行順序
1. 單獨執行 `ALTER TYPE ... 'shopping'`，確認成功並提交。
2. 單獨執行 `ALTER TYPE ... 'other'`，確認成功並提交。
3. 執行 `data/migration_currency_and_rates.sql`。
4. 最後執行 `data/seed_expenses_from_csv.sql`。

## 2026-08-02 — 記帳與分析頁：預付拆分、每日趨勢、篩選器

### 背景
花費資料已改為手動輸入 CSV 後批次匯入，收據 OCR 辨識不再需要。同時發現所有行前預付項目（機票 49714 / 45108、簽證、學費 442120、住宿、intercity、觀星、滑雪）都集中在 `2026-06-25` 這一天且只有台幣金額，導致分類佔比圓餅圖幾乎被「學習」吃掉，日均與趨勢也完全失真。

### 變更摘要

**1. 行前預付 vs 旅途中在地消費拆分**
- `app/src/lib/money.ts` 新增：
  - `isPrepaid()`：判斷規則為 `amount_nzd === null && amount_twd !== null`
  - `partitionByPrepaid()`：把支出拆成 `prepaid` / `onsite` 兩組
  - `buildDailyTotals()`：依日期彙總成每日台幣總額（含當日是否為概算的標記）
  - `averageDailyTwd()`：平均每日花費，分母為實際有消費紀錄的天數
  - `DailyTotal` 型別
- 記帳頁新增「花費結構」卡：比例條 + 兩組金額與筆數 + 平均每日 + 最高單日。

**2. 移除假 OCR 掃描卡片**
- 移除 `isScanning` state、`handleScanClick`（原本只是 `setTimeout` + `alert`）、整個拖放上傳 UI 與脈衝動畫。
- 原本佔據 dashboard 一半版位的卡片改為「花費結構」分析卡。
- `app/package.json` 移除未使用的 `tesseract.js` 依賴。
- `README.md` 的「已知限制」改為說明 OCR 已取消、預付判斷是推導而來、台幣趨勢多為概算。
- `implementation.md` 的 3.1 狀態改為已處理。

**3. 每日花費趨勢**
- 新增全寬 `BarChart`：只包含在地消費（排除行前預付），金額統一換算台幣。
- 平均值以 `ReferenceLine` 虛線標示；超過平均的日子用紅色長條，未超過用綠色。
- X 軸只顯示月日，Y 軸以千元為單位縮寫。

**4. 篩選與搜尋**
- 新增篩選器卡：關鍵字（店家/品項/備註）、花費範圍（全部 / 旅途中消費 / 行前預付）、分類、起訖日期、排序（日期新舊、金額高低）。
- 顯示「符合條件 N 筆（共 M 筆）」與「清除篩選」按鈕。
- 總花費、分類佔比、花費結構、每日趨勢、明細清單全部改用 `filteredExpenses`，切換條件時上下數字一致。
- 空狀態會區分「沒有符合篩選條件」與「還沒有任何記帳紀錄」。
- `rateMap` 改用 `useMemo`，避免每次 render 重建而讓下游 `useMemo` 失效。

### 修改的檔案
| 類型 | 檔案 |
|---|---|
| 修改 | `app/src/lib/money.ts` |
| 修改 | `app/src/app/ledger/page.tsx` |
| 修改 | `app/package.json` |
| 修改 | `README.md` |
| 修改 | `implementation.md` |

### 驗證
- `npm run lint` → 0 errors、0 warnings
- `npm run build` → 成功（7 個路由全部產生）

### 未處理項目
- 換匯成本分析（比較隱含匯率與 `exchange_rates` 官方匯率）尚未實作。
- 店家排行榜、品項單價變化、分類 × 時間堆疊圖尚未實作。
- 城市維度花費需要 `expenses` 新增城市欄位或用日期推斷，尚未決定做法。
- 預算對比曲線需要使用者提供預算數字。

---

## 2026-08-09 — 地圖大改版：雙地圖分島 + 城市聚合標記

### 背景
原本只有單一全紐西蘭地圖，南北島比例差距大，加上景點分佈不均，導致點位密集難以辨識。

### 變更摘要

**雙地圖並排（南島 / 北島）**
- `MapComponent.tsx` 重構：單一 `mapRef` 改為 `northMapRef` / `southMapRef`，`mapInstancesRef` 改為 `Partial<Record<Island, L.Map>>`。
- 地圖容器改用 CSS Grid `1fr 1fr` 並排，各自以 `maxBounds` 鎖定南、北島邊界。
- `ResizeObserver` + `hasSettled` 機制：避免 CSS Grid 未確定尺寸時 `fitBounds()` 鎖入錯誤縮放層級。

**城市聚合標記（展開 / 收合）**
- 從 Supabase 拉取 `cities` 表（原本只拉 `spots`），用 `city.lat > -41.5` 判斷南北島歸屬。
- 預設顯示每座城市的圓形計數標記（顯示符合篩選條件的地點數）；點擊後展開該城市所有地點的個別標記，再點一次收合。
- `expandedCityIds: Set<string>` 管理展開狀態；計數標記圖示依狀態切換顏色與符號（數字 / `−`）。
- 展開城市時用 `flyToBounds` / `flyTo` 飛入對焦，讓密集地點自動拉開。

**`citiesRef` 解決 stale closure**
- 地圖點擊 handler 在空 deps effect 中只注冊一次，直接讀 `cities` state 會拿到 stale 初始值；改用 `citiesRef` 同步當前 `cities`，handler 讀 ref。

**`hasValidCoordinates` 型別守衛**
- 新增 helper，過濾 `lat` / `lng` 為 `null` 或 `NaN` 的城市與地點資料，避免 Leaflet 收到無效座標崩潰。

**新增地點時自動帶入最近城市**
- 點擊地圖新增地點時，用平方距離近似法 `findNearestCity()` 自動找最近城市，傳入 `SpotFormModal` 的 `cityId` prop。
- `SpotFormModal` 補上 `cityId: string` prop 並寫入 `INSERT` 語句。

**地點篩選面板說明文字**
- 篩選面板新增一行說明文字，解釋圓點數字的含義與點擊展開的互動方式。

### Bug 修正
- `createCityCountIcon` 中 expanded 狀態背景色原寫 `var(--color-trip1)`（不存在的 CSS 變數），修正為 `var(--color-primary)`。

### 驗證結果
```
npm run lint   → 0 errors, 0 warnings
npm run build  → Compiled successfully（Next.js 16, Turbopack, 7 routes）
```

### 修改的檔案
| 類型 | 檔案 |
|---|---|
| 修改 | `app/src/components/MapComponent.tsx` |
| 修改 | `app/src/components/SpotFormModal.tsx` |

---

## 2026-08-09 — 首頁統計卡「總花費」數字溢出修正 + 改為台幣加總顯示

### 背景
首頁 `.stat-card` 使用固定 `minmax(200px, 1fr)` 的 Grid 欄，而 `.stat-number` 字體為固定 `48px`；「≈NT$267,600」等長金額字串超出 200px 容器，被 `overflow: hidden` 截斷。

同一次改動也把首頁「總花費」從雙幣別拆分顯示（`NZ$xx + NT$xx`）改為全部換算成台幣加總（與 `/ledger` 頁「顯示為台幣」模式一致，只有紐幣的項目用歷史匯率概算）。

### 變更摘要
- `globals.css`：
  - `.stat-number` 字體從固定 `48px` → `clamp(24px, 8vw, 48px)`，讓字體隨容器寬度自適應縮小。
  - 補上 `overflow-wrap: break-word` / `word-break: break-word` 作為極端情況的安全網。
  - `@media (max-width: 480px)` 中的 `.stat-number` 從固定 `38px` → `clamp(20px, 7vw, 32px)`。
- `page.tsx`：
  - 匯入由 `formatSplitTotal + splitTotal` 改為 `buildRateMap + formatTWD + sumAsTwd`。
  - 費用查詢改為 `Promise.all` 同時抓 `expenses` 與 `exchange_rates`。
  - 統計卡 `sub` 欄位由 `'NZD+TWD'` 改為 `'TWD'`。

### 驗證結果
```
npm run lint   → 0 errors, 0 warnings
npm run build  → Compiled successfully
```

### 修改的檔案
| 類型 | 檔案 |
|---|---|
| 修改 | `app/src/app/globals.css` |
| 修改 | `app/src/app/page.tsx` |

