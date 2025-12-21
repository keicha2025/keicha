 /**
 * KEICHA 抹茶代購總覽 - 全自動載入引擎
 * 整合：GAS JSON 資料串接 + 一期一會載入動畫控制
 */

window.addEventListener('load', () => {

    // 1. 設定區：您的 Google Apps Script 網址
    const gasUrl = "https://script.google.com/macros/s/AKfycbxnxbcdCdxH2Qmuek5Up8BqTWeOLUcLR30jfUi0lMbMn5ocn9tY1f_c7yEyd9KSZ4Um/exec"; 

    // 2. 取得頁面元素
    const productContainer = document.getElementById('product-list-container');
    const statusGrid = document.getElementById('status-grid-container');
    const statusLoader = document.getElementById('status-loader');

    // 3. 開始抓取資料
    fetch(gasUrl)
        .then(res => res.json())
        .then(data => {
            const { brands, products } = data;

            // A. 品牌排序邏輯 (依 order 欄位，小到大)
            const sortedBrands = brands.sort((a, b) => {
                const orderA = (a.order === "" || a.order === null) ? 999 : parseInt(a.order);
                const orderB = (b.order === "" || b.order === null) ? 999 : parseInt(b.order);
                return orderA - orderB;
            });

            // B. 隱藏品牌區塊的小圈圈 loader (因為全屏遮罩已經蓋住了，這個其實看不見，但還是隱藏以防萬一)
            if (statusLoader) statusLoader.style.display = 'none';

            // C. 執行渲染功能
            renderBrands(sortedBrands);
            renderProducts(sortedBrands, products);
            renderSEO(sortedBrands);

            // D. ★關鍵步驟：資料全部渲染完畢後，移除「一期一會」全屏遮罩
            hidePreloader();
        })
        .catch(err => {
            console.error("載入失敗:", err);
            // 發生錯誤時也要移除遮罩，避免使用者卡在白畫面，並顯示錯誤訊息
            hidePreloader();
            if (statusGrid) statusGrid.innerHTML = `<p class="text-red-500 col-span-full text-center">資料載入失敗，請稍後再試。</p>`;
        });

    // --- 功能函式區 ---

    /**
     * 控制全屏遮罩淡出
     */
    function hidePreloader() {
        const preloader = document.getElementById('matcha-preloader');
        if (preloader) {
            // 設定 600ms 的緩衝，確保使用者能看清「一期一會」的優雅
            setTimeout(() => {
                preloader.classList.add('fade-out'); // 觸發 CSS opacity 0
                
                // 等待 CSS transition (0.8s) 結束後，將 display 設為 none
                setTimeout(() => {
                    preloader.style.display = 'none';
                }, 800); 
            }, 600);
        }
    }

    /**
     * 渲染品牌狀態小卡
     */
    function renderBrands(brands) {
        if (!statusGrid) return;
        statusGrid.innerHTML = '';
        brands.forEach(brand => {
            const isAvailable = brand.status !== 'out-of-stock';
            const statusText = isAvailable ? '可訂購' : '缺貨中';
            const statusColor = isAvailable ? 'bg-brandGreen text-white' : 'bg-gray-200 text-gray-600';

            statusGrid.innerHTML += `
                <a href="#${brand.key}" class="block group transform hover:-translate-y-1 transition-all">
                    <div class="bg-white rounded-lg shadow-sm p-4 border border-gray-100 flex justify-between items-center">
                        <span class="font-bold text-gray-800 text-lg group-hover:text-brandGreen">${brand.name}</span>
                        <span class="${statusColor} text-xs font-bold px-3 py-1 rounded-full">${statusText}</span>
                    </div>
                </a>`;
        });
    }

    /**
     * 渲染產品列表 (包含複雜邏輯)
     */
    function renderProducts(brands, allProducts) {
        if (!productContainer) return;
        productContainer.innerHTML = '';

        brands.forEach(brand => {
            // 篩選邏輯：同品牌 + (非缺貨 OR 有 Tag)
            const brandProducts = allProducts.filter(p => {
                const isStatusOut = p.status === 'out-of-stock';
                const hasTag = (p.tag && p.tag.trim() !== '');
                // 如果是 out-of-stock 且沒有 Tag，就過濾掉 (不顯示)
                if (isStatusOut && !hasTag) return false;
                return p.brand_key === brand.key;
            });

            const section = document.createElement('section');
            section.id = brand.key;
            section.className = "container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl scroll-mt-28 mb-16";
            
            let productCardsHTML = '';
            
            if (brandProducts.length === 0) {
                productCardsHTML = `<p class="text-gray-400 text-center col-span-full py-8">目前暫無品項</p>`;
            } else {
                brandProducts.forEach(p => {
                    const isStatusOut = p.status === 'out-of-stock';
                    const isStockZero = (p.stock === 0 || p.stock === '0');
                    const hasTag = (p.tag && p.tag.trim() !== '');
                    
                    // 1. 標籤顯示邏輯 (Tag 優先於 Stock)
                    let badge = '';
                    if (hasTag) {
                        badge = `<span class="absolute top-3 right-3 bg-brandGreen text-white text-xs font-bold px-2.5 py-1 rounded-full">${p.tag}</span>`;
                    } else if (isStockZero) {
                        badge = `<span class="absolute top-3 right-3 bg-gray-300 text-gray-700 text-xs font-bold px-2.5 py-1 rounded-full">缺貨中</span>`;
                    }

                    // 2. 價格顯示邏輯 (out-of-stock 隱藏價格)
                    let priceHTML = '';
                    if (isStatusOut) {
                        priceHTML = `<p class="text-gray-400 text-sm">暫不提供價格</p>`;
                    } else {
                        if (p.price_multi > 0 && p.price_multi < p.price) {
                            priceHTML = `
                                <div class="price-discount">
                                    <span class="price-original">單罐: NT$ ${p.price.toLocaleString()}</span>
                                    <span class="text-brandGreen price-current">2罐起單價: NT$ ${p.price_multi.toLocaleString()}</span>
                                </div>`;
                        } else {
                            priceHTML = `<p class="text-brandGreen price-current">NT$ ${p.price.toLocaleString()}</p>`;
                        }
                    }

                    // 3. 品名與規格樣式 (灰色小字)
                    const displayName = `
                        ${p.name} 
                        ${p.spec ? `<span class="text-sm font-normal text-gray-500 ml-1">${p.spec}</span>` : ''}
                    `;
                    
                    const cardClass = isStatusOut || isStockZero ? 'bg-gray-100 opacity-80' : 'bg-white transform hover:scale-105';

                    productCardsHTML += `
                        <div class="${cardClass} relative shadow-lg rounded-lg overflow-hidden transition-all duration-300 flex flex-col">
                            ${badge}
                            <div class="p-6 flex-grow">
                                <h3 class="text-xl font-bold mb-2">${displayName}</h3>
                                ${p.note ? `<p class="text-sm text-gray-500">${p.note}</p>` : ''}
                            </div>
                            <div class="bg-gray-50 px-6 py-4 border-t border-gray-200">
                                ${priceHTML}
                            </div>
                        </div>`;
                });
            }

            section.innerHTML = `
                <h2 class="text-3xl font-bold text-center mb-10">${brand.name}</h2>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    ${productCardsHTML}
                </div>`;
            productContainer.appendChild(section);
        });
    }

    /**
     * 生成 SEO 結構化資料
     */
    function renderSEO(brands) {
        const container = document.getElementById('structured-data-container');
        if (!container) return;
        const schema = {
            "@context": "https://schema.org",
            "@type": "ItemList",
            "name": "KEICHA 抹茶代購總覽",
            "itemListElement": brands.map((b, i) => ({
                "@type": "ListItem",
                "position": i + 1,
                "name": b.name,
                "url": `https://keicha2025.github.io/keicha/maccha.html#${b.key}`
            }))
        };
        container.innerHTML = `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
    }
});
