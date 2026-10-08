# 夜間實驗室 原始碼

- `src/chem.js` 化學資料（元素、物質、反應、電解）、`src/logic.js` 遊戲邏輯、`src/levels.js` 故事關卡
- `src/ui.js` 畫面、`src/style.css`、`src/template.html`
- `node build.mjs` → `dist/nightlab.html`；`node pwa.mjs` → `dist/pwa/`（複製 index.html、manifest、sw.js 到 repo 根目錄就是線上版）
- 測試：
  - `node test/logic.test.js` 單元測試（配平、物態、儀器、關卡資料、謎題可解）
  - `node test/bot.js 40 [關卡前綴]` 電腦玩家：每關過關率、星數、估計時間
  - `node test/calib.js`、`node test/tune.js` 校準目標門檻
  - `npm i playwright@1.48.2 --no-save` 之後：`node test/shot.mjs`（三種尺寸截圖）、`node test/tut.mjs`（教學）、`node test/puzzles.mjs`（六個謎題）
- 設計見 `DESIGN.md`，進度見 `PROGRESS.md`
