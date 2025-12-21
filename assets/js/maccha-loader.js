/**
 * KEICHA 抹茶代購總覽 - GAS JSON 驅動版
 * 更新日期：2025-12-21
 */

window.addEventListener('load', () => {

    // --- 設定區 ---
    const gasUrl = "https://script.google.com/macros/s/AKfycbxnxbcdCdxH2Qmuek5Up8BqTWeOLUcLR30jfUi0lMbMn5ocn9tY1f_c7yEyd9KSZ4Um/exec"; // 請在此貼上您的 GAS 部署網址
    // --- 設定區結束 ---

    const statusGrid = document.getElementById('status-grid-container');
    const statusLoader = document.getElementById('status-loader');
    const productContainer = document.getElementById('product-list-container');

    // 1. 抓取 GAS 資料
    fetch(gasUrl)
        .then(response => {
            if (!response.ok) throw new Error('網路回應錯誤');
            return response.json();
        })
        .then(data => {
            const { brands, products } = data;

            // A. 品牌排序邏輯：依照 order 數字小到大排，沒填的排最後
            const sortedBrands = brands.sort((a, b) => {
                const orderA = (a.order === "" || a.order === null) ? 999 : parseInt(a.order);
                const orderB = (b.order === "" || b.order === null) ? 999 : parseInt(b.order);
                return orderA - orderB;
            });

            // B. 隱藏載入動畫
            if (statusLoader) statusLoader.style.display = 'none';

            // C. 渲染「品牌總覽」
            renderBrands(sortedBrands);

            // D. 渲染「產品區塊」
            renderProducts(sortedBrands, products);

            // E. 生成 SEO 結構化資料
            renderSEO(sortedBrands);
        })
        .catch(err => {
            console.error("載入失敗:", err);
            if (statusGrid) statusGrid.innerHTML = `<p class="text-red-500 col-span-full text-center">資料載入失敗，請稍後再試。</p>`;
        });

    /**
     * 渲染品牌總覽小卡
     */
    function renderBrands(brands) {
        if (!statusGrid) return;
        statusGrid.innerHTML = '';

        brands.forEach(brand => {
            const isAvailable = brand.status === 'available';
            const statusText = isAvailable ? '可訂購' : '缺貨中';
            const statusColor = isAvailable ? 'bg-brandGreen text-white' : 'bg-gray-200 text-gray-600';

            statusGrid.innerHTML += `
                <a href="#${brand.key}" class="block group transform hover:-translate-y-1 transition-all">
                    <div class="bg-white rounded-lg shadow-sm p-4 border border-gray-100 flex justify-between items-center">
                        <span class="font-bold text-gray-800 text-lg group-hover:text-brandGreen">${brand.name}</span>
                        <span class="${statusColor} text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                            ${statusText}
                        </span>
                    </div>
                </a>
            `;
        });
    }

    /**
     * 渲染產品詳細區塊
     */
    function renderProducts(brands, allProducts) {
        if (!productContainer) return;
        productContainer.innerHTML = '';

        brands.forEach(brand => {
            // 篩選屬於該品牌的產品
            const brandProducts = allProducts.filter(p => p.brand_key === brand.key);

            // 建立品牌 Section
            const section = document.createElement('section');
            section.id = brand.key;
            section.className = "container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl scroll-mt-28";
            
            let productCardsHTML = '';
            
            if (brandProducts.length === 0) {
                productCardsHTML = `<p class="text-gray-400 text-center col-span-full py-8">目前暫無品項</p>`;
            } else {
                brandProducts.forEach(p => {
                    const isAvailable = p.status === 'available' && p.stock > 0;
                    const cardClass = isAvailable ? 'bg-white transform hover:scale-105' : 'bg-gray-100 opacity-70';
                    
                    // 標籤顯示 (對應 GAS 的 tag 欄位)
                    let badge = '';
                    if (!isAvailable) {
                        badge = `<span class="absolute top-3 right-3 bg-gray-300 text-gray-700 text-xs font-bold px-2.5 py-1 rounded-full">缺貨中</span>`;
                    } else if (p.tag) {
                        badge = `<span class="absolute top-3 right-3 bg-brandGreen text-white text-xs font-bold px-2.5 py-1 rounded-full">${p.tag}</span>`;
                    }

                    // 價格顯示 (支援 price_multi 折扣)
                    let priceHTML = '';
                    if (p.price_multi > 0 && p.price_multi < p.price) {
                        priceHTML = `
                            <div class="price-discount">
                                <span class="price-original">單罐: NT$ ${p.price.toLocaleString()}</span>
                                <span class="text-brandGreen price-current">2罐起單價: NT$ ${p.price_multi.toLocaleString()}</span>
                            </div>`;
                    } else {
                        priceHTML = `<p class="text-brandGreen price-current">NT$ ${p.price.toLocaleString()}</p>`;
                    }

                    // 規格顯示
                    const displayName = p.spec ? `${p.name} <span class="text-sm font-normal text-gray-500">(${p.spec})</span>` : p.name;

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
                        </div>
                    `;
                });
            }

            section.innerHTML = `
                <h2 class="text-3xl font-bold text-center mb-10">${brand.name}</h2>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    ${productCardsHTML}
                </div>
            `;
            productContainer.appendChild(section);
        });
    }

    /**
     * 生成 JSON-LD SEO 資料
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
