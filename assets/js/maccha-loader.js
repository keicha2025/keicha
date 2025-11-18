
/**
 * KEICHA 抹茶代購總覽 - 全自動載入引擎
 * * 功能：
 * 1. 抓取「總表」Google Sheet
 * 2. 動態建立「品牌總覽」HTML
 * 3. 動態建立「詳細品項」HTML 骨架
 * 4. 動態建立 SEO 結構化資料 (JSON-LD)
 * 5. 異步抓取所有「詳細品項」的 CSV 並填入
 * * ★ Cloudflare 修正：
 * - 此檔案在 HTML 中被 <script data-cf-async="false"> 載入
 * - 使用 'load' 事件確保在 Rocket Loader 之後執行
 * - fetch 時使用 'no-store' 標頭
 */

// ★ [FIX] 改用 'load' 事件，確保在 Cloudflare 等所有資源載入後才執行
window.addEventListener('load', () => {

    // --- 您的後台設定區 ---
    // 只需要 1 個「總表」網址。
    // 這個總表必須包含 4 欄: key, name, status, product_csv_url
    //
    // ★ [FIX] 修正了 masterSheetUrl 漏掉 "://" 的錯誤
    const masterSheetUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRg7lbIAXPL0bOABXVzsELSwhhc0UQfZX2JOtxWkHH0wLlZwkWNK-8kNiRGpyvLyfNhAsl0zVaDKpIv/pub?gid=1151248789&single=true&output=csv";
    //
    // --- 設定區結束 ---

    
    // --- 全自動載入邏輯 (請勿輕易修改) ---
// ... (以下程式碼不變) ...
    /**
     * 強制清除快取的 Fetch
     */
    function fetchWithCacheBust(url) {
        if (!url || !url.startsWith('http') || url.includes("請貼上")) {
            return Promise.reject(new Error(`無效或缺失的 Google Sheet 網址: ${url}`));
        }
        
        return fetch(url, {
            cache: 'no-store', // 請求瀏覽器不要使用快取
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
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
     * 修正：清理 CSV 標頭中的隱藏字元
     */
    function cleanHeader(headerArray) {
        return headerArray.map(h => h.trim().replace(/[\uFEFF"']/g, ''));
    }

    /**
     * 統一的 CSV 解析器
     */
    function parseCSV(text, requiredHeaders) {
        const lines = text.split(/\r?\n/);
        if (lines.length < 2) return [];
        
        let header = cleanHeader(lines[0].split(','));
        
        if (!requiredHeaders.every(h => header.includes(h))) {
            console.error(`CSV 標頭缺少必要欄位:`, header, `應包含:`, requiredHeaders);
            throw new Error(`CSV 標頭缺少 ${requiredHeaders.join(', ')} 欄位。`);
        }
        
        const headerMap = {};
        requiredHeaders.forEach(h => {
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
            if (item[requiredHeaders[0]]) { 
                data.push(item);
            }
        }
        return data;
    }

/**
     * 渲染「品牌總覽」區塊 (動態生成)
     * [已更新：支援 2 欄佈局、奇數項目自動填滿、防止文字換行]
     */
    function renderStatusOverview(brands) {
        const container = document.getElementById('status-grid-container');
        const loader = document.getElementById('status-loader');
        if (!container || !loader) {
            console.error("找不到 'status-grid-container' 或 'status-loader'");
            return;
        }
        
        loader.style.display = 'none';
        container.innerHTML = ''; 

        if (brands.length === 0) {
            container.innerHTML = '<p class="text-center text-gray-500">目前沒有可顯示的品牌狀態。</p>';
            return;
        }

        const statusText = { 'available': '可供訂購', 'out-of-stock': '缺貨中' };
        const statusClass = { 'available': 'bg-brandGreen text-white', 'out-of-stock': 'bg-gray-200 text-gray-700' };

        // **修改 1: 加入 index 參數**
        brands.forEach((brand, index) => {
            const currentStatus = brand.status === 'available' ? 'available' : 'out-of-stock';
            const currentName = brand.name || '未知品牌';

            // **修改 2: 動態決定 class**
            // 基本 class (移除了 justify-between)
            let itemClasses = "bg-white p-5 md:p-6 rounded-lg shadow-md flex items-center transition-all duration-300 hover:shadow-lg hover:scale-105";

            const isOddTotal = brands.length % 2 !== 0;
            const isLastItem = index === brands.length - 1;

            // 如果總數是奇數，且這是最後一項，則加上 'md:col-span-2'
            if (isOddTotal && isLastItem) {
                itemClasses += " md:col-span-2";
            }

            // **修改 3: 更新 HTML 模板**
            const itemHTML = `
                <a href="#${brand.key}" class="${itemClasses}">
                    
                    <span class="text-lg md:text-xl font-medium text-gray-800 flex-1 min-w-0 truncate mr-4">
                        ${currentName}
                    </span>
                    
                    <span class="px-4 py-1.5 rounded-full text-sm font-bold ${statusClass[currentStatus]} whitespace-nowrap flex-shrink-0">
                        ${statusText[currentStatus]}
                    </span>
                </a>
            `;
            container.innerHTML += itemHTML;
        });
    }

    /**
     * 渲染「詳細品項」區塊 (動態生成)
     */
    function renderProductSections(brands) {
        const container = document.getElementById('product-list-container');
        if (!container) {
            console.error("找不到 'product-list-container'");
            return;
        }
        
        container.innerHTML = ''; 

        brands.forEach(brand => {
            const sectionHTML = `
                <section id="${brand.key}" class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl scroll-mt-28">
                    <h2 class="text-3xl font-bold text-center mb-10">${brand.name}</h2>
                    <div id="${brand.key}-loader" class="flex justify-center items-center h-32">
                        <div class="loader ease-linear rounded-full border-4 border-t-4 border-gray-200 h-12 w-12"></div>
                    </div>
                    <div id="${brand.key}-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <!-- 品項將異步載入 -->
                    </div>
                </section>
            `;
            container.innerHTML += sectionHTML;
        });
    }

    /**
     * 渲染「單一品牌」的品項卡片
     */
    function renderProductCards(brandKey, products) {
        const grid = document.getElementById(`${brandKey}-grid`);
        const loader = document.getElementById(`${brandKey}-loader`);
        if (!grid || !loader) {
            console.warn(`找不到 ${brandKey} 的 grid 或 loader`);
            return;
        }

        loader.style.display = 'none';
        grid.innerHTML = '';

        if (products.length === 0) {
            grid.innerHTML = `<p class="text-gray-500 text-center col-span-full">目前此品牌尚無代購品項，或暫時缺貨中。</p>`;
            return;
        }

        products.forEach(product => {
            const name = product.product_name || '未命名品項';
            const price = product.price ? parseInt(product.price) : 0;
            const priceMulti = product.price_multi ? parseInt(product.price_multi) : 0;
            const status = product.status || 'out-of-stock';
            
            const isAvailable = status === 'available';
            const cardClasses = isAvailable ? 'bg-white transform hover:scale-105' : 'bg-gray-100 opacity-70';
            
            const statusBadge = isAvailable
                ? `<span class="absolute top-3 right-3 bg-brandGreen text-white text-xs font-semibold px-2.5 py-0.5 rounded-full">可訂購</span>`
                : `<span class="absolute top-3 right-3 bg-gray-200 text-gray-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">缺貨中</span>`;

            let priceHTML = '';
            const priceTextClass = isAvailable ? 'text-brandGreen' : 'text-gray-500';

            if (priceMulti > 0 && priceMulti < price) {
                priceHTML = `
                <div class="price-discount">
                    <span class="price-original">單罐: NT$ ${price.toLocaleString()}</span>
                    <span class="${priceTextClass} price-current">2罐起單價: NT$ ${priceMulti.toLocaleString()}</span>
                </div>
            `;
            } else if (price > 0) {
                priceHTML = `<p class="${priceTextClass} price-current" style="font-size: 1.125rem; font-weight: 700;">NT$ ${price.toLocaleString()}</p>`;
            } else {
                priceHTML = `<p class="${priceTextClass} price-current" style="font-size: 1.125rem; font-weight: 700;">價格請洽詢</p>`;
            }

            const cardHTML = `
                <div class="${cardClasses} relative shadow-lg rounded-lg overflow-hidden transition-all duration-300 flex flex-col">
                    ${statusBadge}
                    <div class="p-6 flex-grow">
                        <h3 class="text-xl font-bold mb-2 ${isAvailable ? 'text-gray-900' : 'text-gray-600'}">${name}</h3>
                    </div>
                    <div class="bg-gray-50 px-6 py-4 border-t border-gray-200">
                        ${priceHTML}
                    </div>
                </div>
            `;
            grid.innerHTML += cardHTML;
        });
    }

    /**
     * 處理錯誤
     */
    function renderError(containerId, error) {
        const container = document.getElementById(containerId);
        const loader = document.getElementById(containerId.replace('-grid', '-loader').replace('-container', '-loader'));
        
        if (loader) loader.style.display = 'none';
        if (container) {
            container.innerHTML = `<p class="text-red-500 text-center col-span-full">載入資料時發生錯誤。<br>(訊息: ${error.message})</p>`;
        }
    }
    
    /**
     * 動態生成 SEO 結構化資料
     */
    function renderStructuredData(brands) {
        const container = document.getElementById('structured-data-container');
        if (!container) return;

        const itemListElements = brands.map((brand, index) => ({
            "@type": "ListItem",
            "position": index + 1,
            "name": brand.name,
            "url": `https://keicha2025.github.io/keicha/maccha.html#${brand.key}` // 確保網址正確
        }));

        const schema = {
            "@context": "https://schema.org",
            "@type": "ItemList",
            "name": "KEICHA 抹茶代購總覽",
            "description": "即時查看日本各大抹茶品牌（丸久小山園、山政小山園、星野製茶園、上林春松本店）的最新可訂購狀態。",
            "url": "https://keicha2025.github.io/keicha/maccha.html",
            "itemListElement": itemListElements
        };

        container.innerHTML = `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
    }


    // --- 主執行流程 ---
    
    const statusLoader = document.getElementById('status-loader');
    if (statusLoader) statusLoader.classList.remove('hidden');

    // 1. 抓取「總表」
    fetchWithCacheBust(masterSheetUrl)
        .then(csvText => {
            const masterBrandList = parseCSV(csvText, ['key', 'name', 'status', 'product_csv_url']);
            
            // 2. 渲染「總覽」HTML
            renderStatusOverview(masterBrandList);
            
            // 3. 渲染「品項區塊」的 HTML 骨架
            renderProductSections(masterBrandList);
            
            // 4. 動態生成 SEO <script>
            renderStructuredData(masterBrandList);

            // 5. 異步抓取所有「詳細品項」
            masterBrandList.forEach(brand => {
                const productUrl = brand.product_csv_url;
                if (productUrl && productUrl.startsWith('http')) {
                    fetchWithCacheBust(productUrl)
                        .then(productCsvText => {
                            const products = parseCSV(productCsvText, ['product_name', 'price', 'price_multi', 'status']);
                            renderProductCards(brand.key, products);
                        })
                        .catch(err => {
                            console.error(`抓取 ${brand.key} 品項時發生錯誤:`, err);
                            renderError(`${brand.key}-grid`, err);
                        });
                } else {
                    renderError(`${brand.key}-grid`, new Error(`總表中未提供 ${brand.name} 的品項網址。`));
                }
            });

        })
        .catch(err => {
            console.error("抓取「總表」時發生嚴重錯誤:", err);
            renderError('status-grid-container', err); 
            const productListContainer = document.getElementById('product-list-container');
            if (productListContainer) productListContainer.innerHTML = '';
        });

}); // 結束 'load' 事件
