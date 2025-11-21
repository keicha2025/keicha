/**
 * KEICHA 隱私權條款 - 自動載入引擎
 * 讀取 本地 TSV 檔案 並渲染條款內容
 */

window.addEventListener('load', () => {

    // --- 設定區 ---
    
    // ★ [FIX] 設定您的網站 Base URL (GitHub 儲存庫名稱)
    // 如果您的網址是 keicha2025.github.io/keicha，這裡就是 "/keicha"
    const BASE_URL = "/keicha";

    // ★ [FIX] 指向您儲存庫中的 TSV 檔案
    // 瀏覽器會去抓取: https://keicha2025.github.io/keicha/assets/data/privacy.tsv
    const privacy_tsv_url = BASE_URL + "/assets/data/privacy.tsv";
    
    // --- 設定結束 ---

    // 抓取容器
    const container = document.getElementById('privacy-container');
    const loader = document.getElementById('privacy-loader');

    // 強制清除快取的 Fetch
    function fetchWithCacheBust(url) {
        // 加上時間戳記，避免瀏覽器讀到舊的快取檔案
        const cacheBustUrl = url + '?v=' + new Date().getTime();
        
        return fetch(cacheBustUrl, {
            cache: 'no-store',
        }).then(res => {
            if (!res.ok) throw new Error(`檔案讀取失敗 (${res.status})`);
            return res.text();
        });
    }

    // 簡單 TSV 解析器
    function parseTSV(text) {
        const lines = text.split(/\r?\n/);
        if (lines.length < 2) return [];
        
        // 移除標頭中的 BOM 和引號
        let headers = lines[0].split('\t').map(h => h.trim().replace(/[\uFEFF"']/g, ''));
        
        const data = [];
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            const row = lines[i].split('\t');
            const item = {};
            headers.forEach((key, index) => {
                // 移除內容前後可能多餘的引號
                let val = row[index] ? row[index].trim() : '';
                if (val.startsWith('"') && val.endsWith('"')) {
                    val = val.slice(1, -1);
                }
                // 將由 Excel/GSheet 造成的雙引號還原
                val = val.replace(/""/g, '"'); 
                item[key] = val;
            });
            data.push(item);
        }
        return data;
    }

    // 渲染畫面
    function renderPrivacy(items) {
        if (!container) return;
        loader.style.display = 'none';
        container.innerHTML = '';

        // 依據 sort 排序 (如果有的話)
        items.sort((a, b) => parseInt(a.sort || 0) - parseInt(b.sort || 0));

        items.forEach(item => {
            if (!item.title && !item.content) return;

            const section = document.createElement('section');
            
            // 建立標題 (h3)
            if (item.title) {
                const h3 = document.createElement('h3');
                h3.textContent = item.title;
                section.appendChild(h3);
            }

            // 建立內容 (div) - 支援 HTML 語法
            if (item.content) {
                const contentDiv = document.createElement('div');
                // 處理換行：將 \n 轉為 <br> (如果檔案中是用 Alt+Enter 換行)
                let htmlContent = item.content.replace(/\n/g, '<br>');
                contentDiv.innerHTML = htmlContent;
                section.appendChild(contentDiv);
            }

            container.appendChild(section);
        });
    }

    // 執行
    if (container && loader) {
        fetchWithCacheBust(privacy_tsv_url)
            .then(text => parseTSV(text))
            .then(data => renderPrivacy(data))
            .catch(err => {
                console.error(err);
                loader.style.display = 'none';
                container.innerHTML = `<p class="text-red-600 text-center">載入條款失敗。請確認 /assets/data/privacy.tsv 檔案是否存在。<br>(${err.message})</p>`;
            });
    }
});
