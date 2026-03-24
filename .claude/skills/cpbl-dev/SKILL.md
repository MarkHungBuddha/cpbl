---
name: cpbl-dev
description: CPBL Explorer 專案業務邏輯參考。開發新功能、修 bug、理解資料流時使用。
---

# CPBL Explorer 業務邏輯

## 專案概要

基於 rebas.tw 的中華職棒數據分析工具。純前端 React (CDN + Babel standalone)，無 build tool。透過自建 proxy server 繞過 CORS 存取 rebas API。

## 啟動

```bash
node server.mjs   # http://localhost:3939
```

## 頁面架構

| 頁面 | 路徑 | 核心功能 |
|------|------|----------|
| API Explorer | `index.html` | Swagger 風格 API 測試工具，含登入面板 |
| 戰績表 | `standings.html` | 聯盟戰績、交叉對戰、進階指標 |
| 守備成績 | `fielding.html` | 按守位分列的 IP/PO/A/RF9 |
| 球員詳情 | `player.html` | 生涯打擊/投球成績 |
| 球隊詳情 | `team.html` | 賽季戰績、球員名單 |

## Proxy Server (`server.mjs`)

### 基本功能
- 靜態檔案服務 + HTTPS reverse proxy
- 端點: `/proxy?url=<encoded_url>`
- 轉發請求到 rebas.tw，移除上游 CORS headers

### 檔案快取
- 快取目錄: `.cache/`
- 單場比賽詳情 (`/games/{id}`): TTL 30 天（immutable）
- 其他端點（賽季、比賽列表）: TTL 5 分鐘
- 只快取 GET 2xx 回應
- 快取格式: JSON `{ statusCode, headers, body(base64) }`

## 戰績表 (`standings.html`) 業務邏輯

### 資料來源
1. `GET /api/seasons/{id}` → `standings[]` 陣列（勝敗和、勝率、勝差、連勝敗）
2. `GET /api/seasons/{id}/games?type=grouped` → 所有比賽（算得失分、交叉對戰）

### 計算邏輯
- **得分/失分 (RS/RA)**: 從 games 的 `away.runs` / `home.runs` 累加
- **預期勝率 (PYTH)**: `RS² / (RS² + RA²)` (Pythagorean expectation)
- **一分差勝率**: 篩選 `|awayRuns - homeRuns| === 1` 的比賽，計算勝敗
- **交叉對戰 (CrossTeamMatrix)**: 從 `winner_side` 建立 team×team 勝敗矩陣

### 賽季選擇
- 下拉選單含 2018–2026 所有賽季（例行賽、熱身賽、台灣大賽、挑戰賽、明星賽）
- 切換賽季時重新載入所有資料

## 守備成績 (`fielding.html`) 業務邏輯

### 資料流
1. `GET /api/seasons/{id}` → 球隊 lookup（名稱、縮寫、顏色）
2. `GET /api/seasons/{id}/games?type=grouped` → 已完成比賽列表
3. 逐場 `GET /api/seasons/{id}/games/{gameId}` → `PA_list`（逐打席資料）
4. `computeFielding()` → 從 PA_list 計算每位球員每個守位的 IP/PO/A

### 守備局數計算 (`creditOuts`)
- 每個 PA 的 `fielders[]` 陣列包含當時場上 9 個守位的球員
- `outsThisPA = pa.end_outs - pa.outs`
- 所有場上守備員都累加該 PA 產生的 outs
- Between-PA outs（盜壘失敗/牽制出局）: 比較相鄰 PA 的 outs 差距

### PO/A 計算 (`creditPOA`)
- **資料來源**: `events[].pitch.fielder_position`（守備鏈，如 `"643"` = SS→2B→1B）
  - 注意：PA 層級的 `location_code` 只是擊球落點區域，不是守備鏈
- **SO（三振）**: 捕手(2) 得 PO
- **FO/SF（飛球/犧牲飛）**: chain 第一位得 PO
- **GO/FC/SH（滾地/野選/犧牲觸擊）**: chain 最後一位得 PO，其餘得 A
- **GIDP（雙殺）**: chain[0]=A, 中間位=A+PO, 最後一位=PO
- **RF/9**: `(PO + A) / IP * 9`，按守位獨立計算

### 攤平顯示
- 表格每行 = 一位球員 × 一個守位（`flattenByPosition`）
- 確保 RF/9 永遠是單一守位的計算

### 規定局數
- 按各隊已賽場次獨立計算: `teamGameCounts[teamId] * 3 outs`

### 並行載入
- `fetchWithConcurrency(paths, limit=3, onProgress)` 控制同時請求數
- 顯示 progress bar

## 共用模式

### proxyFetch
```javascript
async function proxyFetch(apiPath) {
  const target = `https://www.rebas.tw${apiPath}`;
  const resp = await fetch(`/proxy?url=${encodeURIComponent(target)}`);
  return resp.json();
}
```

### 賽季 ID 格式
- `CPBL-{年份}-{hash}` (一軍), `CPBLmi-{年份}-{hash}` (二軍), `AWB-{年份}-{hash}` (冬盟)
- `team_uniqid` 跨賽季不變（如 `HCHks` = 中信兄弟）

### 球隊顏色
- `team.hex_color` 格式: `"#背景色;#文字色"`（如 `"#f4cf46;#000000"`）
- `getTeamColors(hexColorStr)` 解析

### React 模式
- CDN React 18 + Babel standalone（無 build）
- `useState` / `useEffect` / `useMemo` / `useCallback`
- 所有頁面獨立 SPA，無共用 component 檔案

## 常見開發任務

### 新增統計欄位到戰績表
1. 在 `teamRunsMap` useMemo 中從 games 累加新指標
2. 在 `displayStandings` useMemo 中加入計算
3. 在 `columns` 陣列加欄位定義
4. 在 `<tbody>` 加 `<td>` 渲染

### 新增守備指標
1. 在 `computeFielding` 的 `ensurePos` 增加欄位
2. 在 `creditPOA` 或 `creditOuts` 累加
3. 在 `flattenByPosition` 帶出
4. 在 `FieldingTable` 顯示

### 新增頁面
1. 建立 `xxx.html`（複製 standings.html 的 header/CSS 結構）
2. 在其他頁面的 nav 加連結
3. 使用 `proxyFetch` 存取 API
