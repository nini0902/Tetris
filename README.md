# Neon Grid Tetris

一個用 TDD 開發的俄羅斯方塊網站專案，採用 Vite + Vitest，並透過 GitHub Actions 自動部署到 GitHub Pages。

## 開發與測試

```bash
npm install
npm test
npm run dev
```

本機預設開啟位址：`http://localhost:4173/Tetris/`

## 操作方式

- `←` `→`: 左右移動
- `↓`: 快速下落（soft drop）
- `↑` 或 `W`: 旋轉
- `Space`: 直接落到底（hard drop）
- `R`: 重新開始

## TDD 重點

- 核心規則測試在 `tests/gameEngine.test.js`
- 遊戲邏輯在 `src/gameEngine.js`
- 目前包含：移動、旋轉（含 wall kick）、鎖定、消行、計分、遊戲結束判斷

## GitHub Pages 部署

1. 到 GitHub Repository `Settings > Pages`
2. `Build and deployment` 選擇 `GitHub Actions`
3. push 到 `main` 後，`.github/workflows/deploy-pages.yml` 會自動執行測試、建置並部署