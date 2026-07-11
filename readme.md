# OFFC6 直播介面

以 [Vue 3](https://vuejs.org/) + [Vite](https://vite.dev/) + [Vue Router](https://router.vuejs.org/) + [Tailwind CSS v4](https://tailwindcss.com/) 建構的直播 overlay。


| 畫面 | 網址（route） |
| --- | --- |
| Intro | `#/intro` |
| Actions（ban/pick/card） | `#/actions` |
| Gameplay | `#/gameplay` |
| Winner | `#/winner` |
| Showcase | `#/showcase` |
| Score（控制台） | `#/score` |

開啟根目錄 `/`（或 `#/`）會看到一個列出所有 overlay 連結的啟動頁面。

## 部署到 tosu

> 直播員要用的東西只有 dist/ 這個資料夾底下的東西，其餘都不用管它。

1. 將 **`dist/`** 這個資料夾放到 `tosu/static` 底下，變成 `tosu/static/dist`，可以自由改名（例如 `tosu/static/OFFC6`）。

2. 將 tosu socket 與 bridge server 的網址寫在 `dist/_data/config/endpoints.json`：

```json
{
  "tosuSocketUrl": "ws://localhost:24050/websocket/v2",
  "bridgeBaseUrl": "http://localhost:8383"
}
```

**這邊請務必填入正確的 bridgeBaseUrl（就是那個裁判程式的網址）**，不然會抓不到比分。

## 使用說明（很重要）

1. 記得把 `bridgeBaseUrl` 改成裁判網頁的網址（改 `endpoints.json` 即可，不必動程式碼）。
2. 直播前，請確保有打開 tosu、tourney client、ref bridge server、裁判有打開裁判程式。
3. 賽評用的頭貼樣式放在 `dist/vc.css`，連結 [Discord Streamkit](https://streamkit.discord.com/overlay) 之後貼到 obs 的 css 框框裡面 (應該都會用吧... 不會用的話再來問我...)
4. 房間建立之後，**必須先打開 score 畫面（`#/score`）連線到裁判程式**，且在整個直播過程中，obs 必須一直擷取這個畫面，資料才會透過 `localStorage['game-state']` 傳給其他畫面。
5. 隊伍/圖池的資訊放在 `public/_data/config/`，範例格式見裡面的 `mappools.json` 與 `teams.json`。

## 開發 (for developers)

到這裡直播員就可以不用看了 xd...

```bash
npm install
npm run dev      # http://localhost:5173/ ，各畫面用 #/route
npm run build    # 產出 dist/
npm run preview  # 預覽 dist/
```

本機測試用的假伺服器（與主專案共用根目錄的 `node_modules`，不需另外安裝）：

```bash
npm run mock:ws      # 假 tosu websocket（ws://127.0.0.1:3000/ws）
npm run mock:bridge  # 假 bridge server（http://127.0.0.1:8383）
```

> 要用假伺服器測試時，把 `public/_data/config/endpoints.json` 的 `tosuSocketUrl` 改成 `ws://127.0.0.1:3000/ws` 即可（`bridgeBaseUrl` 預設的 8383 與假 bridge 相同）。

## 專案結構

```
src/
├─ views/        # 五個畫面 + HomeView 啟動頁
├─ components/   # 共用元件（TeamHeader / ChatPanel / PlayerList / BackgroundVideo / StageLabel / PanelButton）
├─ composables/  # useTosuSocket / useConfig / useGameState / useChat
├─ lib/          # dataPath（_data 路徑）、config（讀 endpoints.json）、osu（hpColor / mods 換算 / 分數條樣式等純函式）
├─ workers/      # bridge-worker.js（score 畫面背景輪詢）
└─ router/
public/
├─ _data/        # 編譯後會原封複製到 dist/_data（config/fonts/img/video/deps/style.css）
└─ vc.css        # 獨立的 Discord 語音 overlay 樣式（不屬於任何 route）
debug/           # 本機測試用 mock 伺服器
```

### todo
- 自動選圖
- 自動判斷圖譜勝負
