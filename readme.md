# OFFC6 直播介面

With [Vue](https://vuejs.org/) & [Tailwind CSS](https://tailwindcss.com/)

## 使用說明(很重要)


1. 把整個資料夾下載到 `tosu/static` 底下，變成 `tosu/static/OFFC6`。

2. 進到 `./score/score.js` 裡面，把第三行 `const BRIDGE_BASE_URL = 'http://localhost:8383';` 這個網址改成裁判網頁的網址。

3. 直播前，請確保有打開 tosu、tourney client、ref bridge server、裁判有打開裁判程式

4. 房間建立之後，**必須先打開 score 畫面連線到裁判程式**，資料才會讀進去。

5. 隊伍/圖池的資訊要放在 `./_data/config` 裡面，範例格式可以看裡面的 `mappools.json` 與 `teams.json`。

### do to 
countup.js
自動選圖
自動判斷圖譜勝負
EZ multiplier
TB畫面