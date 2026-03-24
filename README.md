# CPBL 數據工具 — Rebas API

基於 [rebas.tw 野球革命](https://www.rebas.tw/) 的中華職棒數據分析工具集。

**線上版：https://cpbl-alpha.vercel.app/**

## 快速開始

```bash
node server.mjs
```

開啟 http://localhost:3939

| 頁面 | 說明 |
|------|------|
| `/` | API Explorer — Swagger 風格互動式 API 測試工具 |
| `/standings.html` | 戰績表 — 勝率、預期勝率(PYTH)、一分差勝率、得失分、交叉對戰 |
| `/fielding.html` | 守備成績 — 按守位分列 IP / PO / A / RF9 |
| `/player.html` | 球員詳情 — 生涯打擊/投球成績、進階數據 |
| `/team.html` | 球隊詳情 — 賽季戰績、球員名單 |

## 專案結構

```
server.mjs        — Node.js 代理伺服器 (port 3939)，繞過 CORS + 檔案快取
index.html        — API Explorer (登入、球員搜尋、60+ 端點測試)
standings.html    — 戰績頁面 (2018–2026 多賽季選擇)
fielding.html     — 守備成績頁面 (按守位分列，RF/9 per position)
player.html       — 球員詳情頁面
team.html         — 球隊詳情頁面
api/proxy.js      — Vercel Serverless 代理 (部署用)
.cache/           — 代理快取目錄 (git ignored)
```

## Proxy 快取機制

`server.mjs` 內建檔案快取，避免重複呼叫 rebas API：

| 端點類型 | TTL | 說明 |
|----------|-----|------|
| 單場比賽詳情 `/games/{id}` | 30 天 | 比賽結束後資料不變 |
| 其他（賽季、比賽列表等） | 5 分鐘 | 需要追蹤最新狀態 |

快取檔案存放於 `.cache/` 目錄，可隨時刪除重建。

---

## Rebas API 文件

**Base URL:** `https://www.rebas.tw`

### 認證

| 項目 | 說明 |
|------|------|
| 登入頁面 | `https://account.rebas.tw/login` |
| 登入方式 | Email + 密碼 / Google OAuth / Facebook OAuth |
| Access Token | Cookie `RB_UID` (JWT) |
| Refresh Token | Cookie `RB_RID` (7 天有效) |
| 請求方式 | `Authorization: Bearer {RB_UID}` |

### 子網域

| 子網域 | 功能 |
|--------|------|
| `www.rebas.tw` | 主站 API |
| `account.rebas.tw` | 帳號認證 |
| `entertainment.rebas.tw` | 留言、預測遊戲 |
| `blog.rebas.tw` | WordPress 部落格 |
| `share.rebas.tw` | OG 分享預覽 |
| `member.rebas.tw` | 付費會員 PDF 報告 |
| `stats.rebas.tw` | 進階數據頁面 |
| `usermedia.rebas.tw` | 使用者媒體儲存 |

---

### 公開資訊（無需認證）

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/api/public_reports` | 公開分析報告列表 |
| GET | `/api/public_promos` | 促銷/活動資訊 |
| GET | `/api/news?limit={n}` | 最新比賽新聞 |
| GET | `/api/photos?limit={n}` | 最新比賽照片 |

### 聯盟與賽季

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/api/leagues/{league_uniqid}` | 聯盟資訊 |
| GET | `/api/seasons/` | 賽季列表 |
| GET | `/api/seasons/{season_uniqid}` | 賽季詳情（含戰績 `standings`） |
| GET | `/api/seasons/{season_uniqid}/brief` | 賽季簡介 |
| GET | `/api/seasons/{season_uniqid}/teams` | 賽季隊伍列表 |
| GET | `/api/seasons/{season_uniqid}/stats` | 賽季統計數據 |
| GET | `/api/seasons/{season_uniqid}/games?type=grouped` | 所有比賽（含比分、勝負） |
| GET | `/api/seasons/{season_uniqid}/games?start={date}&days={n}` | 賽程（日期篩選） |
| GET | `/api/seasons/{season_uniqid}/games?strikezone=true` | 含好球帶資料的比賽 |
| GET | `/api/seasons/{season_uniqid}/games/{game_uniqid}` | 單場比賽詳情 |
| GET | `/api/seasons/{season_uniqid}/games/{game_uniqid}/related_links` | 比賽相關連結 |
| GET | `/api/seasons/{season_uniqid}/leaders?type=&section=&pa=&until=` | 排行榜 |
| GET | `/api/seasons/{season_uniqid}/teams/{team_uniqid}/players` | 隊伍球員名單 |
| GET | `/api/seasons/{season_uniqid}/firstbase` | 賽季 FirstBase 數據 |

### 球員

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/api/players/{player_uniqid}` | 球員個人資訊 |
| GET | `/api/players/{player_uniqid}/stats` | 球員統計數據 |
| GET | `/api/players/{player_uniqid}/seasons/{season}/teams/{team}/logs` | 球員逐場紀錄 |
| GET | `/api/players/{player_uniqid}/posts` | 球員相關文章 |
| GET | `/api/players/{player_uniqid}/related` | 球員相關資源 |
| POST | `/api/players/{player_uniqid}/posts` | 建立球員文章 (auth) |
| PUT | `/api/players/{player_uniqid}/posts/{post_uniqid}` | 更新球員文章 (auth) |
| DELETE | `/api/players/{player_uniqid}/posts/{post_uniqid}` | 刪除球員文章 (auth) |
| GET | `/api/permission/player/{player_uniqid}/adopted` | 查詢球員認領權限 |

### 隊伍

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/api/teams/{team_uniqid}` | 隊伍詳情 |

### 職業聯盟 (Formal)

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/api/formal/leagues/` | 職業聯盟列表 |
| GET | `/api/formal/leagues/{league}/weee?before=&cases=` | 聯盟 weee 事件 |
| GET | `/api/formal/leagues/{league}/reee?before=&cases=` | 聯盟 reee 事件 |
| GET | `/api/formal/seasons/` | 職業賽季列表 |
| GET | `/api/formal/seasons/{season}/latest_games` | 最新比賽 |
| GET | `/api/formal/seasons/{season}/latest_games?overview=true` | 最新比賽概覽 |
| GET | `/api/formal/seasons/{season}/teams/` | 職業賽季隊伍 |
| GET | `/api/formal/seasons/{season}/pitch_stats` | 投球統計 |
| GET | `/api/formal/seasons/{season}/pa_logs?side=` | 打席紀錄 |
| GET | `/api/formal/calendar?start=&days=&league_uniqid=` | 職業賽事行事曆 |
| GET | `/api/formal/players/` | 職業球員列表 |
| GET | `/api/formal/players?position=&team=&season=` | 依守位/隊伍/賽季篩選 |
| GET | `/api/formal/players?query=` | 球員姓名搜尋 |
| GET | `/api/formal/players/{player}/season_stats` | 球員賽季統計 |
| GET | `/api/formal/search/players?query=` | 球員全文搜尋 |
| GET | `/api/formal/search/players?uniqid=` | 依 uniqid 批次查詢 |
| PUT | `/api/formal/seasons/{season}/games/{game}/gamenote` | 更新比賽解說 (auth) |

### FirstBase 進階分析

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/api/firstbase/BIG/coefficient` | BIG 係數 |
| GET | `/api/firstbase/teams/{team}/games` | 隊伍 FirstBase 數據 |
| GET | `/api/firstbase/teams/{team}/info` | 隊伍 FirstBase 資訊 |
| GET | `/api/leagues/{league}/firstbase/teams/{team}/games` | 指定聯盟 FirstBase |
| PUT | `/api/firstbase/teams/{team}/games/{game}/tags` | 更新比賽標籤 (auth) |
| PUT | `/api/firstbase/teams/{team}/filter_modules` | 更新篩選模組 (auth) |
| GET | `/api/tournament_firstbase_modules/share/{uniqid}` | 取得分享模組 |
| POST | `/api/tournament_firstbase_modules/share` | 建立分享模組 (auth) |

### 聯賽管理 (auth)

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/api/season_registries/` | 賽事報名列表 |
| POST | `/api/season_registries/` | 建立賽事報名 |
| GET | `/api/season_registries/{registry}/teams` | 報名隊伍列表 |
| POST | `/api/seasons/{season}/games/` | 新增比賽 |
| DELETE | `/api/seasons/{season}/games/{game}` | 刪除比賽 |

### 媒體上傳 (auth)

| 方法 | 端點 | 說明 |
|------|------|------|
| POST | `/api/media` | 上傳媒體檔案 (FormData) |
| POST | `/api/video` | 分段影片上傳 (Content-Range) |

### 會員/用戶

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/api/user/info` | 當前用戶資訊 |
| GET | `/api/user/permission` | 用戶權限 |
| GET | `/api/user/subscription` | 訂閱狀態 |
| GET | `/api/user/refresh_token` | 刷新 Token |
| GET | `/api/user/player_related_permission?relateds=` | 球員相關權限 |
| GET | `/api/user/formal_game_related_permission?relateds=` | 比賽相關權限 |
| GET | `/api/member/seasons/{season}/games/{game}/gamenote` | 比賽解說 (付費) |

### account.rebas.tw（認證）

| 方法 | 端點 | 說明 |
|------|------|------|
| POST | `/login` | Email 密碼登入 |
| POST | `/register` | 註冊新帳號 |
| GET | `/auth/google` | Google OAuth 登入 |
| GET | `/auth/facebook` | Facebook OAuth 登入 |
| POST | `/api/user/refresh_token` | 刷新 Token |
| POST | `/api/user/forget_password` | 忘記密碼 |
| POST | `/api/user/reset_password` | 重設密碼 |
| GET | `/api/user/exists?email=` | 檢查 Email 是否已註冊 |
| GET | `/api/flash?event=` | Flash 通知 |

### entertainment.rebas.tw（娛樂）

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/api/we_prediction/games/{game}` | 取得預測題目 |
| PUT | `/api/we_prediction/games/{game}` | 提交預測 |
| GET | `/api/we_prediction/self` | 自己的預測紀錄 |
| GET | `/api/ranking/we_prediction` | 預測排行榜 |
| GET | `/api/comments/{type}/{target}?page=&limit=` | 取得留言 |
| POST | `/api/comments/{type}/{target}` | 新增留言 |
| DELETE | `/api/comments/{type}/{target}` | 刪除留言 |

### blog.rebas.tw（部落格）

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/wp-json/wp/v2/posts?categories={id}&per_page=10&_embed` | 文章列表 |

### share.rebas.tw（分享）

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/preview?url={encoded_url}&nocache=true` | OG 預覽 |

---

## 已知 ID 對照表

### 聯盟

| ID | 名稱 |
|----|------|
| `CPBL` | 中華職棒 |
| `CPBLmi` | 中華職棒二軍 |
| `AWB` | 亞洲冬季棒球聯盟 |

### 一軍賽季 — 例行賽 (LEAGUE_MATCHES)

| ID | 賽季 |
|----|------|
| `CPBL-2025-JO` | 2025 例行賽 |
| `CPBL-2024-xa` | 2024 例行賽 |
| `CPBL-2023-sk` | 2023 例行賽 |
| `CPBL-2022-dG` | 2022 例行賽 |
| `CPBL-2021-fi` | 2021 例行賽 |
| `CPBL-2020-KS` | 2020 例行賽 |
| `CPBL-2019-Sf` | 2019 例行賽 |
| `CPBL-2018-Fq` | 2018 例行賽 |

### 一軍賽季 — 熱身賽 (SPRING_TRAINING)

| ID | 賽季 |
|----|------|
| `CPBL-2026-4j` | 2026 熱身賽 |
| `CPBL-2025-L0` | 2025 熱身賽 |
| `CPBL-2024-pJ` | 2024 熱身賽 |
| `CPBL-2023-yB` | 2023 熱身賽 |
| `CPBL-2022-s6` | 2022 熱身賽 |

### 一軍賽季 — 台灣大賽 (POSTSEASON)

| ID | 賽季 |
|----|------|
| `CPBL-2025-cF` | 2025 台灣大賽 |
| `CPBL-2024-Uz` | 2024 台灣大賽 |
| `CPBL-2023-Za` | 2023 台灣大賽 |
| `CPBL-2022-o7` | 2022 台灣大賽 |
| `CPBL-2021-53` | 2021 台灣大賽 |

### 一軍賽季 — 挑戰賽 (CHALLENGE)

| ID | 賽季 |
|----|------|
| `CPBL-2025-lX` | 2025 挑戰賽 |
| `CPBL-2024-HE` | 2024 挑戰賽 |
| `CPBL-2023-b1` | 2023 挑戰賽 |
| `CPBL-2022-yt` | 2022 挑戰賽 |

### 一軍賽季 — 明星賽 (ALL_STAR)

| ID | 賽季 |
|----|------|
| `CPBL-2025-28` | 2025 明星賽 |

### 二軍賽季

| ID | 賽季 |
|----|------|
| `CPBLmi-2025-xS` | 二軍 2025 挑戰賽 |
| `CPBLmi-2025-ED` | 二軍 2025 例行賽 |
| `CPBLmi-2024-S4` | 二軍 2024 挑戰賽 |
| `CPBLmi-2024-4l` | 二軍 2024 例行賽 |
| `CPBLmi-2023-GP` | 二軍 2023 例行賽 |
| `CPBLmi-2023-8O` | 二軍 2023 邀請賽 |
| `CPBLmi-2022-C2` | 二軍 2022 例行賽 |
| `CPBLmi-2021-Vw` | 二軍 2021 例行賽 |
| `CPBLmi-2020-cP` | 二軍 2020 例行賽 |

### 冬盟賽季

| ID | 賽季 |
|----|------|
| `AWB-2025-pi` | 冬盟 2025 例行賽 |
| `AWB-2024-OY` | 冬盟 2024 例行賽 |
| `AWB-2023-PH` | 冬盟 2023 例行賽 |

### 一軍球隊

| team_uniqid | 名稱 | 縮寫 | 2025 season_team |
|-------------|------|------|-----------------|
| `HCHks` | 中信兄弟 | 象 | `Kae1X` |
| `hThSB` | 統一7-ELEVEn獅 | 獅 | `Xs1sP` |
| `1zODE` | 樂天桃猿 | 猿 | `WyADE` |
| `TPKQm` | 富邦悍將 | 邦 | `wi4T3` |
| `0MJKt` | 味全龍 | 龍 | `R2VRh` |
| `LH4lt` | 台鋼雄鷹 | 鷹 | `t6zJf` |

> `team_uniqid` 跨賽季不變，`season_team_uniqid` 每季不同。完整列表呼叫 `/api/seasons/{season}/teams` 取得。

### 二軍球隊

| team_uniqid | 名稱 | 2025 season_team |
|-------------|------|-----------------|
| `OWtjM` | 中信兄弟二軍 | — |
| `BGUqH` | 統一7-ELEVEn獅二軍 | — |
| `20YyJ` | 樂天桃猿二軍 | — |
| `CI6C8` | 富邦悍將二軍 | — |
| `JniwU` | 味全龍二軍 | — |
| `8Nf4x` | 台鋼雄鷹二軍 | — |

### 冬盟球隊 (2025)

| team_uniqid | 名稱 |
|-------------|------|
| `FejhF` | 日本社會人 |
| `D8vWD` | 日職聯隊 |
| `HI4dn` | 台灣海洋 |
| `oonrL` | 韓職聯隊 |
| `Zk1zi` | 台灣山林 |

---

## API 回應範例

### 賽季戰績 `GET /api/seasons/CPBL-2025-JO`

```json
{
  "data": {
    "title": "中職2025年",
    "type": "LEAGUE_MATCHES",
    "start_at": "2025-03-29T00:00:00+08:00",
    "end_at": "2025-10-07T00:00:00+08:00",
    "standings": [
      {
        "order": 1,
        "wins": 70,
        "loses": 50,
        "draws": 0,
        "PCT": 0.583,
        "GB": 0,
        "DIFF": 69,
        "STRK": -1,
        "finished": 120,
        "team": {
          "name": "中信兄弟",
          "abbr": "象",
          "uniqid": "HCHks",
          "hex_color": "#f4cf46;#000000"
        }
      }
    ]
  }
}
```

### 比賽資料 `GET /api/seasons/CPBL-2025-JO/games?type=grouped`

```json
{
  "data": [
    {
      "uniqid": "Df3dE",
      "seq": 343,
      "away": {
        "team": "樂天桃猿",
        "team_uniqid": "1zODE",
        "runs": 5,
        "hits": 14
      },
      "home": {
        "team": "統一7-ELEVEn獅",
        "team_uniqid": "hThSB",
        "runs": 4,
        "hits": 10
      },
      "info": {
        "status": "FINISHED",
        "winner_side": "AWAY",
        "location": "澄清湖棒球場",
        "scheduled_start_at": "2025-10-06 17:05"
      }
    }
  ]
}
```
