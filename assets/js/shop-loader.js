/**
 * KEICHA 網路商店 - 全自動載入引擎
 * * 任務：
 * 1. 抓取 GSheet `settings` (設定)
 * 2. 抓取 GSheet `products` (商品)
 * 3. 渲染公告 (如果存在)
 * 4. 渲染商品列表 (Product Grid)
 * 5. 渲染規則條款 (General Notes)
 * 6. 渲染聯絡資訊 (Contact Info)
 * 7. 渲染 SEO 結構化資料
 * * ★ Cloudflare 修正：
 * - 此檔案在 HTML 中被 <script data-cf-async="false"> 載入
 * - 使用 'load' 事件確保在 Rocket Loader 之後執行
 * - fetch 時使用 'no-store' 標頭
 */

// ★ [FIX] 改用 'load' 事件，確保在 Cloudflare 等所有資源載入後才執行
window.addEventListener('load', () => {

    // --- 您的後台設定區 ---
    //
    // ★ [必要] 請貼上您 GSheet 'products' 工作表的 .csv 網址
    const products_csv_url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS8gwVZcW8WvKHAMPOO3qa2mjQzc_7JE7iy3NiMnjuQHVAW3pxg-s_a1qISsfwtfqqOGthHFp2omb_7/pub?gid=0&single=true&output=csv";
    
    // ★ [必要] 請貼上您 GSheet 'settings' 工作表的 .csv 網址
    const settings_csv_url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS8gwVZcW8WvKHAMPOO3qa2mjQzc_7JE7iy3NiMnjuQHVAW3pxg-s_a1qISsfwtfqqOGthHFp2omb_7/pub?gid=1849246580&single=true&output=csv";
    //
    // --- 設定區結束 ---


    
    // --- 全自動載入邏輯 (請勿輕易修改) ---

    // 取得 Jekyll 傳來的 baseurl (如果有的話)
    const BASE_URL = window.KEICHA_BASEURL || '';

    /**
     * 強制清除快取的 Fetch
     */
    function fetchWithCacheBust(url) {
        if (!url || !url.startsWith('http') || url.includes("請貼上")) {
            return Promise.reject(new Error(`無效或缺失的 Google Sheet 網址: ${url}`));
        }
        
        return fetch(url, {
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
        })
        .then(response => {
            if (!response.ok) {
                const statusText = response.status === 0 ? 'Network/CORS Error' : response.status;
                throw new Error(`網路回應錯誤 (status: ${statusText})`);
            }
            return response.text();
        });
    }

    /**
     * 清理 CSV 標頭
     */
    function cleanHeader(headerArray) {
        return headerArray.map(h => h.trim().replace(/[\uFEFF"']/g, ''));
    }

    /**
     * 解析 Products CSV
     */
    function parseProductsCSV(text) {
        const lines = text.split(/\r?\n/);
        if (lines.length < 2) return [];
        
        const requiredHeaders = [
            'product_id', 'status', 'category', 'subcategory', 
            'product_name', 'seo_title', 'price', 'image_url', 
            'specs', 'special_notes'
        ];
        let header = cleanHeader(lines[0].split(','));
        
        if (!requiredHeaders.every(h => header.includes(h))) {
            console.error(`商品 CSV 標頭缺少必要欄位:`, header);
            throw new Error(`商品 CSV 標頭缺少 ${requiredHeaders.join(', ')} 欄位。`);
        }
        
        const headerMap = {};
        header.forEach(h => {
            headerMap[h] = header.indexOf(h);
        });

        const data = [];
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            const row = lines[i].split(',');
            const item = {};
            for (const key in headerMap) {
                item[key] = row[headerMap[key]] ? row[headerMap[key]].trim() : '';
            }
            if (item.product_id && item.status !== 'hidden') { // 確保有 ID 且非隱藏
                data.push(item);
            }
        }
        return data;
    }

    /**
     * 解析 Settings CSV (Key-Value)
     */
    function parseSettingsCSV(text) {
        const lines = text.split(/\r?\n/);
        if (lines.length < 2) return {};
        
        const requiredHeaders = ['key', 'value'];
        let header = cleanHeader(lines[0].split(','));

        if (!requiredHeaders.every(h => header.includes(h))) {
            console.error(`設定 CSV 標頭缺少 key 或 value 欄位:`, header);
            throw new Error('設定 CSV 標頭缺少 key 或 value 欄位。');
        }

        const headerMap = {
            key: header.indexOf('key'),
            value: header.indexOf('value')
        };

        const settings = {};
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            const row = lines[i].split(',');
            const key = row[headerMap.key] ? row[headerMap.key].trim() : '';
            const value = row[headerMap.value] ? row[headerMap.value].trim() : '';
            if (key) {
                settings[key] = value;
            }
        }
        return settings;
    }

    /**
     * 渲染商品卡片
     */
    function renderProductGrid(products) {
        const container = document.getElementById('product-grid-container');
        const loader = document.getElementById('products-loader');
        if (!container || !loader) return;
        
        loader.style.display = 'none';
        container.innerHTML = '';

        if (products.length === 0) {
            container.innerHTML = '<p class="text-center text-gray-500 col-span-full">目前尚無商品。</p>';
            return;
        }

        products.forEach(product => {
            const isAvailable = product.status === 'available';
            const statusText = isAvailable ? '可訂購' : '缺貨中';
            const statusClass = isAvailable ? 'status-available' : 'status-out-of-stock';
            
            // 處理規格 (specs)
            let specsHTML = '';
            if (product.specs) {
                const specsList = product.specs.split('|').map(s => s.trim());
                specsHTML = `<ul class="text-xs text-gray-500 mt-2 space-y-1">
                    ${specsList.map(spec => `<li>• ${spec}</li>`).join('')}
                </ul>`;
            }

            // 處理特殊說明 (special_notes)
            let notesHTML = '';
            if (product.special_notes) {
                const notesList = product.special_notes.split('|').map(n => n.trim());
                notesHTML = `<div class="mt-3 pt-3 border-t border-gray-200">
                    ${notesList.map(note => `<p class="text-xs text-brandGreen font-medium">・ ${note}</p>`).join('')}
                </div>`;
            }

            // 處理圖片路徑
            const imageUrl = product.image_url.startsWith('http') 
                ? product.image_url 
                : BASE_URL + product.image_url;

            const cardHTML = `
                <div class="product-card flex flex-col bg-white rounded-lg shadow-md overflow-hidden transition-all duration-300 ${!isAvailable ? 'opacity-60' : 'hover:shadow-xl'}">
                    
                    <!-- 1:1 圖片容器 -->
                    <div class="product-image-container">
                        <img src="${imageUrl}" alt="${product.product_name}" loading="lazy">
                        <div class="product-status-badge ${statusClass}">${statusText}</div>
                    </div>
                    
                    <div class="p-5 flex flex-col flex-grow">
                        <!-- 分類/品牌 -->
                        <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">${product.subcategory || product.category}</p>
                        
                        <!-- 品名 -->
                        <h3 class="text-lg font-bold text-gray-900 mt-1 mb-2">${product.product_name}</h3>
                        
                        <!-- 價格 -->
                        <p class="text-xl font-bold text-brandGreen mb-3">
                            NT$ ${parseInt(product.price).toLocaleString()}
                        </p>
                        
                        <!-- 規格 -->
                        ${specsHTML}
                        
                        <!-- 特殊說明 (推到最下方) -->
                        <div class="mt-auto">
                            ${notesHTML}
                        </div>
                    </div>
                </div>
            `;
            container.innerHTML += cardHTML;
        });
    }

    /**
     * 渲染全站設定
     */
    function renderSettings(settings) {
        // 1. 渲染公告
        const announcementSection = document.getElementById('announcement-section');
        const announcementContent = document.getElementById('announcement-content');
        if (settings.announcement && announcementSection && announcementContent) {
            announcementContent.textContent = settings.announcement;
            announcementSection.classList.remove('hidden');
        }

        // 2. 渲染規則條款 (支援 <br> 和 \n 換行)
        const notesContent = document.getElementById('general-notes-content');
        if (settings.general_notes && notesContent) {
            const notesWithBreaks = settings.general_notes.replace(/\\n/g, '<br>').replace(/\n/g, '<br>');
            notesContent.innerHTML = notesWithBreaks;
        } else if (notesContent) {
            notesContent.innerHTML = '<p class="text-center text-gray-500">載入條款時發生錯誤。</p>';
        }

        // 3. 渲染聯絡資訊
        const lineId = document.getElementById('contact-line-id');
        const emailText = document.getElementById('contact-email-text');
        const emailLink = document.getElementById('contact-email-link');
        
        if (settings.contact_line_id && lineId) {
            lineId.textContent = settings.contact_line_id;
        }
        if (settings.contact_email && emailText && emailLink) {
            emailText.textContent = settings.contact_email;
            emailLink.href = `mailto:${settings.contact_email}`;
        }
    }

    /**
     * 渲染 SEO 結構化資料 (Product)
     */
    function renderStructuredData(products) {
        const container = document.getElementById('structured-data-container');
        if (!container) return;

        const productItems = products.map(product => {
            const imageUrl = product.image_url.startsWith('http') 
                ? product.image_url 
                : `https://keicha2025.github.io${BASE_URL}${product.image_url}`; // GSC 需要絕對路徑

            return {
                "@type": "Product",
                "name": product.product_name,
                "description": product.seo_title || product.product_name,
                "productID": product.product_id,
                "image": imageUrl,
                "offers": {
                    "@type": "Offer",
                    "price": product.price,
                    "priceCurrency": "TWD",
                    "availability": product.status === 'available' ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
                    "url": "https://keicha2025.github.io/keicha/shop.html" // 應改為商品獨立頁面 (若有)
                },
                "brand": {
                    "@type": "Brand",
                    "name": product.subcategory
                }
            };
        });

        const schema = {
            "@context": "https://schema.org",
            "@type": "ItemList",
            "name": "KEICHA 網路商店商品",
            "itemListElement": productItems.map((item, index) => ({
                "@type": "ListItem",
                "position": index + 1,
                "item": item
            }))
        };
        
        container.innerHTML = `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
    }

    /**
     * 處理主錯誤
     */
    function handleMainError(error) {
        console.error("載入商店資料時發生嚴重錯誤:", error);
        const loader = document.getElementById('products-loader');
        const errorDiv = document.getElementById('products-error');
        if (loader) loader.style.display = 'none';
        if (errorDiv) {
            errorDiv.textContent = `載入商品時發生錯誤: ${error.message}。請檢查您的 GSheet 網址和欄位設定。`;
            errorDiv.classList.remove('hidden');
        }
        // 也順便隱藏公告
        const announcementSection = document.getElementById('announcement-section');
        if(announcementSection) announcementSection.classList.add('hidden');
    }


    // --- 主執行流程 ---
    
    // 我們需要同時抓取 settings 和 products
    // Promise.all 確保兩份資料都回來後，才開始渲染頁面
    
    Promise.all([
        fetchWithCacheBust(settings_csv_url).then(text => parseSettingsCSV(text)),
        fetchWithCacheBust(products_csv_url).then(text => parseProductsCSV(text))
    ])
    .then(([settings, products]) => {
        // 兩個 CSV 都成功抓取並解析
        
        // 1. 渲染設定 (公告, 條款, 聯絡)
        renderSettings(settings);

        // 2. 渲染商品 (卡片列表)
        renderProductGrid(products);
        
        // 3. 渲染 SEO (結構化資料)
        renderStructuredData(products);

    })
    .catch(error => {
        // 任何一個 fetch 失敗都會進入這裡
        handleMainError(error);
    });

}); // 結束 'load' 事件
