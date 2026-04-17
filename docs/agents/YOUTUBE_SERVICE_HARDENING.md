# YouTube Service Hardening & Resilience

This document outlines the systematic hardening of the YouTube integration in PodLearn to resolve persistent metadata hangs, bot-detection blocks, and "Format not available" errors.

## 核心策略 / Core Strategies

### 1. Metadata 兩階段提取 (Flat-First Strategy)
YouTube 常對特定影片（如受限影片、正在處理中或觸發機器人檢測的影片）進行格式解碼限制。
- **問題**：`yt-dlp` 在解析 `formats` 時若遇到 403 或 Bot Check 會直接報錯並終止，導致 Lesson 標題無法加載。
- **方案**：
    - **第一階段 (Flat)**：先使用 `extract_flat=True` 提取標籤、標題和縮影。此模式不解析串流，極少被攔截。
    - **第二階段 (Full)**：僅在需要格式或字幕且緩存未命中時，才進行完整解析。
    - **韌性**：設置 `ignore_no_formats_error=True` 確保即便解析失敗也返回部分 metadata。

### 2. 字幕直接下載 (Direct-GET Subtitles)
`yt-dlp` 的 `ydl.download()` 引擎過於沉重，在影片流受限時會拒絕下載字幕。
- **方案**：徹底棄用 `ydl.download()` 來獲取字幕。
- **流程**：
    1. 從 metadata 中提取字幕格式列表。
    2. 優先選取 `ext: 'vtt'`。
    3. 使用 `requests.get(url)` 直接下載並保存為 `.vtt`。
    4. 使用 `webvtt-py` 進行解析。
- **優勢**：100% 繞過 "Format not available" 錯誤，只要能看到網頁內容就能拿到字幕。

### 3. 全局緩存與自動升級 (Caching & Upgrade)
為了提升 UI 響應速度並減少 API 負載。
- **機制**：
    - `YT_INFO_CACHE` 存儲 `(timestamp, info_dict, is_flat)`。
    - **智能升級**：若請求完整數據（如字幕）但緩存中只有 "Flat" 數據，系統會自動觸發一次升級抓取。
- **TTL**：1 小時。

### 4. yt-dlp 配置鎖定 (Hardened Configuration)
中心化配置函數 `_get_ytdlp_opts` 提供以下保護：
- **`check_formats: False`**：不驗證串流可用性，跳過最易崩潰的檢查。
- **`ignoreerrors: True`**：防止一個錯誤導致整個進程崩潰。
- **Cookie 路徑堅固化**：自動尋找根目錄下的 `youtube_cookies.txt`，並提供顯著的終端 Loading 日誌。

## 給未來 Agent 的建議 / Lessons learned
1. **不要迷信 `ydl.download()`**：在伺服器端環境下，YouTube 對 `download` 接口的控制遠比對網頁數據的控制嚴格。優先使用 `extract_info` 並手動處理 URL。
2. **Terminal 透明度**：在 Flask Background Task 中，`print` 有時會被緩存。務必在關鍵步驟後調用 `sys.stdout.flush()` 或寫入 `sys.stderr`。
3. **格式容錯**：對於受限影片，YouTube 的 `formats` 列表可能為空，但 `subtitles` 通常是可用的。代碼邏輯必須能處理 `formats` 缺失的情況。

## 日誌標識 / Log Identifiers
- `[YT-CONFIG]`：配置加載日誌。
- `[YT-METADATA]`：Metadata 抓取狀態。
- `[YT-SUB]`：字幕處理日誌。
- `[YT-DEBUG]`：深度診斷（Stderr）。
