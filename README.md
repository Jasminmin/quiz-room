# Quiz Room

個人用的計時模擬測驗網站（純靜態，部署在 GitHub Pages）。

題目資料以密碼加密（PBKDF2-SHA256 60 萬次 + AES-256-GCM）後才放進 repo，網站在瀏覽器中輸入密碼解密；沒有密碼只會看到亂碼。明文資料只存在本機的 `tools/private/`，不會被 commit。

## 功能

- 計時模擬考：90 題、90 分鐘、依配分抽題、標記／刪去法／交卷前檢閱
- 100–900 分量尺成績、各分類答對率、逐題繁體中文詳解
- 練習模式（即時詳解）、錯題本、情境題、題目搜尋
- 作答紀錄只存在自己的瀏覽器（localStorage）

## 本機預覽

```bash
python3 -m http.server 8701
```

## 更新題目或詳解

明文來源在 `tools/private/`（已列入 `.gitignore`）：

```
tools/private/
  questions_raw.json    原始題目
  explanations/*.json   詳解（d=分類、l=章節、a=覆寫答案、e=詳解）
  img/                  題目附圖
  .password             目前的網站密碼
```

修改後：

```bash
python3 tools/build.py && node tools/encrypt.mjs
```

會重新產生 `data/vault.json`，commit 並 push 即可。

## 更換密碼

```bash
QUIZ_PASSWORD='新的密碼' node tools/encrypt.mjs
```

新密碼會寫入 `tools/private/.password`。換密碼後，各裝置上記住的舊登入會自動失效，需要重新輸入。

> 注意：`tools/private/` 沒有上傳到 GitHub，請自行備份，遺失就無法再更新題庫。
