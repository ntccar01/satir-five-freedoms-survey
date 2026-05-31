# Satir 五種自由問卷

這是一個靜態網頁問卷，用來讓填答者針對 Satir 五種自由評估：

- 重視程度
- 使用頻率
- 熟悉程度

填答後會產生個人雷達圖、團體平均雷達圖，以及每位填答者的 2x2 雷達圖總覽。

## 使用方式

直接開啟 `index.html` 即可使用。

如果要把回應寫入 Google Sheet，請：

1. 建立一份 Google 試算表。
2. 在試算表中開啟 `擴充功能` -> `Apps Script`。
3. 將 `google-apps-script.gs` 的內容貼到 Apps Script。
4. 部署為 Web App。
5. 將 Web App URL 貼到網頁的「Google Sheet 紀錄設定」並儲存。

Web App URL 只會存在使用者自己的瀏覽器本機，不會寫入 GitHub 專案檔案。

## 新課程重置

按下「備份並開始新課程」後，Google Sheet 會先將目前回應表複製成新的備份工作表，再清空主要回應表，方便下一班重新使用。
