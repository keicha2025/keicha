/**
 * KEICHA 抹茶代購總覽 - 全自動載入引擎
 * * 功能：
 * 1. 抓取「總表」Google Sheet
 * 2. 動態建立「品牌總覽」HTML
 * 3. 動態建立「詳細品項」HTML 骨架
 * 4. 動態建立 SEO 結構化資料 (JSON-LD)
 * 5. 異步抓取所有「詳細品項」的 CSV 並填入 (含下架過濾)
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
    const masterSheetUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRg7lbIAXPL0bOABXVzsELSwhhc0UQfZX2JOtxWkHH0wLlZwkWNK-8kNiRGpyvLyfNhAsl0zVaDKpIv/pub?gid=1151248789&single=true&output=csv";
    //
    // --- 設定區結束 ---

    
    // --- 全自動載入邏輯 ---

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
     * 統一的 CSV 解析器 (增強版：容許非關鍵欄位缺失)
     */
    function parseCSV(text, requiredHeaders) {
        const lines = text.split(/\r?\n/);
        if (lines.length < 2) return [];
        
        let header = cleanHeader(lines[0].split(','));
        
        // ★ [UPDATED] 檢查必要欄位，但允許 'hidden' 這種擴充欄位缺失 (向下相容)
        const criticalHeaders = ['product_name', 'price', 'key', 'name']; // 絕對不能少的欄位
        const missingCritical = requiredHeaders.filter(h => 
            criticalHeaders.includes(h) && !header.includes(h)
        );

        if (missingCritical.length > 0) {
            console.error(`CSV 標頭缺少關鍵欄位:`, missingCritical);
            throw new Error(`CSV 標頭缺少 ${missingCritical.join(', ')} 欄位。`);
        }
        
        const headerMap = {};
        requiredHeaders.forEach(h => {
            // 如果欄位存在才紀錄索引，不存在則為 -1
            headerMap[h] = header.indexOf(h);
        });

        const data = [];
        // 判斷第一欄位的 key (通常是 product_name 或 key)
        const primaryKey = requiredHeaders[0]; 

        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            // 簡易 CSV 分割 (若欄位內有逗號需注意，此處假設單純價格表)
            const row = lines[i].split(',');
            const item = {};
            
            for (const key in headerMap) {
                const index = headerMap[key];
                // 如果該欄位存在於 CSV 中，且該行有資料，則讀取；否則為空字串
                if (index !== -1 && row[index] !== undefined) {
                    item[key] = row[index].trim();
                } else {
                    item[key] = ''; // 預設值
                }
            }

            // 確保主要欄位有值才加入 (過濾空行)
            if (item[primaryKey]) { 
                data.push(item);
            }
        }
        return data;
    }

/**
 * 渲染「單一品牌」的品項卡片
 * ★ [UPDATED] 支援 hidden 過濾、移除預設「可訂購」徽章，僅顯示 availability_note
 */
function renderProductCards(brandKey, products) {
    const grid = document.getElementById(`${brandKey}-grid`);
    const loader = document.getElementById(`${brandKey}-loader`);
    if (!grid || !loader) return;

    loader.style.display = 'none';
    grid.innerHTML = '';

    // 1. 先過濾出「要顯示」的商品
    const visibleProducts = products.filter(product => {
        if (!product.hidden) return true;
        const h = product.hidden.toString().toLowerCase().trim();
        return !['true', '1', 'yes', '下架'].includes(h);
    });

    // 2. 判斷過濾後的數量
    if (visibleProducts.length === 0) {
        grid.innerHTML = `<p class="text-gray-500 text-center col-span-full">目前此品牌尚無代購品項，或暫時缺貨中。</p>`;
        return;
    }

    // 3. 渲染清單
    visibleProducts.forEach(product => {
        const name = product.product_name || '未命名品項';
        const price = product.price ? parseInt(product.price) : 0;
        const priceMulti = product.price_multi ? parseInt(product.price_multi) : 0;
        const status = product.status || 'out-of-stock';
        
        const isAvailable = status === 'available';
        const cardClasses = isAvailable ? 'bg-white transform hover:scale-105' : 'bg-gray-100 opacity-70';
        
        // ★ [MODIFIED] 狀態徽章邏輯更新
        let statusBadge = '';

        if (isAvailable) {
            // 如果是可訂購狀態，檢查是否有 availability_note
            if (product.availability_note && product.availability_note.trim() !== '') {
                // 有備註才顯示綠色徽章
                statusBadge = `<span class="absolute top-3 right-3 bg-brandGreen text-white text-xs font-semibold px-2.5 py-0.5 rounded-full">${product.availability_note}</span>`;
            }
            // 如果沒有備註，statusBadge 維持空字串 (不顯示「可訂購」)
        } else {
            // 如果是缺貨/下架狀態，維持顯示灰色「缺貨中」
            statusBadge = `<span class="absolute top-3 right-3 bg-gray-200 text-gray-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">缺貨中</span>`;
        }

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
     * 渲染「詳細品項」區塊 (動態生成)
     */
    function renderProductSections(brands) {
        const container = document.getElementById('product-list-container');
        if (!container) return;
        
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
     * ★ [UPDATED] 支援 hidden 過濾功能
     */
function renderProductCards(brandKey, products) {
    const grid = document.getElementById(`${brandKey}-grid`);
    const loader = document.getElementById(`${brandKey}-loader`);
    if (!grid || !loader) return;

    loader.style.display = 'none';
    grid.innerHTML = '';

    // 過濾掉 hidden 商品
    const visibleProducts = products.filter(product => {
        if (product.hidden) {
            const h = product.hidden.toString().toLowerCase().trim();
            return !['true', '1', 'yes', '下架'].includes(h);
        }
        return true;
    });

    // 如果全部商品都 hidden → 顯示提示文字
    if (visibleProducts.length === 0) {
        grid.innerHTML = `<p class="text-gray-500 text-center col-span-full">目前此品牌尚無代購品項，或暫時缺貨中。</p>`;
        return;
    }

    visibleProducts.forEach(product => {
        const name = product.product_name || '未命名品項';
        const price = product.price ? parseInt(product.price) : 0;
        const priceMulti = product.price_multi ? parseInt(product.price_multi) : 0;
        const status = product.status || 'out-of-stock';
        
        const isAvailable = status === 'available';
        const cardClasses = isAvailable ? 'bg-white transform hover:scale-105' : 'bg-gray-100 opacity-70';

        // ★ 改成讀取 availability_note
        const statusBadge = product.availability_note 
            ? `<span class="absolute top-3 right-3 bg-brandGreen text-white text-xs font-semibold px-2.5 py-0.5 rounded-full">${product.availability_note}</span>`
            : '';

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
            "url": `https://keicha2025.github.io/keicha/maccha.html#${brand.key}`
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

     * 渲染「品牌狀態總覽」區塊 (補回遺失的函式)
     * ★ [REPAIRED & UPDATED] 渲染「品牌狀態總覽」
     * 加入中文化翻譯：available -> 可訂購, out-of-stock -> 缺貨中
     */
    function renderStatusOverview(brands) {
        const container = document.getElementById('status-grid-container');
        const loader = document.getElementById('status-loader');
        
        if (loader) loader.style.display = 'none';
        if (!container) return;

        container.innerHTML = '';

        brands.forEach(brand => {
            // 1. 取得原始狀態並轉小寫
            const rawStatus = (brand.status || '').toLowerCase().trim();
            
            // 2. 設定預設值 (灰底、原始文字)
            let statusText = brand.status || '未定';
            let statusColor = 'bg-gray-200 text-gray-600'; // 預設灰色

            // 3. 判斷邏輯與翻譯
            // 綠色：可訂購
            if (['available', 'open', '開團', '接收訂單中'].includes(rawStatus)) {
                statusText = '可訂購';
                statusColor = 'bg-brandGreen text-white';
            } 
            // 灰色：缺貨中
            else if (['out-of-stock', 'sold out', 'close', '關閉', '缺貨'].includes(rawStatus)) {
                statusText = '缺貨中';
                statusColor = 'bg-gray-200 text-gray-600';
            }

            const cardHTML = `
                <a href="#${brand.key}" class="block group transform hover:-translate-y-1 transition-transform duration-300">
                    <div class="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-4 border border-gray-100 flex justify-between items-center">
                        <span class="font-bold text-gray-800 text-lg group-hover:text-brandGreen transition-colors">${brand.name}</span>
                        <span class="${statusColor} text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap shadow-sm">
                            ${statusText}
                        </span>
                    </div>
                </a>
            `;
            container.innerHTML += cardHTML;
        });
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

            // 5. 抓取所有「詳細品項」
            masterBrandList.forEach(brand => {
                const productUrl = brand.product_csv_url;
                if (productUrl && productUrl.startsWith('http')) {
                    fetchWithCacheBust(productUrl)
                        .then(productCsvText => {
                            // ★ [FIXED] 這裡原本漏掉了 'availability_note'，請補上！
                            const products = parseCSV(productCsvText, [
                                'product_name', 
                                'price', 
                                'price_multi', 
                                'status', 
                                'hidden', 
                                'availability_note' // <--- 加上這個
                            ]); 
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
