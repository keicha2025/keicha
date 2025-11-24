// ★ [FIX] 強力 CSV 解析器 (能正確處理引號內的逗號)
    function parseCSV(text, reqHeaders) {
        // 1. 處理換行 (相容各種作業系統)
        const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
        
        if (lines.length < 2) return [];

        // 2. 解析標頭 (Header)
        // 標頭通常沒有逗號，用簡單分割即可，並清理 BOM 和引號
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').replace(/^\ufeff/, ''));

        // 3. 檢查必要欄位
        if(reqHeaders && !reqHeaders.every(h => headers.includes(h))) {
            console.error("CSV 欄位缺失。需要的:", reqHeaders, "實際讀到:", headers);
            return [];
        }

        const map = {};
        headers.forEach((h, i) => map[h] = i);

        const data = [];

        // 4. 解析資料列 (使用正規表達式處理引號內的逗號)
        // 這個正則能區分 "1,750" 和 1,750
        const regex = /("((?:[^"]|"")*)"|[^,]*)(,|$)/g;

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const row = [];
            let match;
            // 重置正則索引
            regex.lastIndex = 0;
            
            // 逐欄解析
            while ((match = regex.exec(line)) !== null) {
                // 如果是最後一個空匹配，忽略
                if (match.index === regex.lastIndex) { regex.lastIndex++; }
                if (match[0] === '' && row.length >= headers.length) break; // 防止無限迴圈

                let value = match[1];
                // 去除前後引號並處理跳脫字元
                if (value.startsWith('"') && value.endsWith('"')) {
                    value = value.slice(1, -1).replace(/""/g, '"');
                }
                row.push(value);
                
                // 如果已經讀完最後一欄，跳出
                if (match[2] === '') break;
            }

            // 將陣列轉為物件
            const obj = {};
            // 只有當資料欄位數足夠時才處理 (寬容模式：允許資料列比標頭少，缺少的補空字串)
            for (const key in map) {
                const index = map[key];
                obj[key] = (index < row.length) ? row[index].trim() : '';
            }
            
            // 簡單過濾空行
            if (Object.keys(obj).length > 0) {
                data.push(obj);
            }
        }
        return data;
    }
```

### 還有一個小地方要檢查

在您的 `shop-loader_Dev.js` 下方，呼叫 `renderProducts` 的地方，原本的 `parseCSV` 參數可能只傳了 `['product_name', 'price']`。

為了讓購物車功能正常運作（需要圖片、限購數量等資訊），建議您修改讀取品項的那一行：

**找到這段 (約在 fetchCSV 之後)：**
```javascript
// 原本可能長這樣：
// const products = parseCSV(text, ['product_name', 'price']);

// ★ 請改成這樣 (加入更多欄位檢查，或是乾脆不傳第二個參數讓它讀全部)：
const products = parseCSV(text, ['product_name', 'price']); 
// 或是更保險的寫法，確保關鍵欄位都有：
// const products = parseCSV(text, ['product_name', 'price', 'status']);
