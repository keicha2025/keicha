/**
 * KEICHA 抹茶代購總覽 - GAS JSON 驅動版 (邏輯修正)
 */

window.addEventListener('load', () => {

    const gasUrl = "您的_GAS_WEB_APP_URL"; 

    const statusGrid = document.getElementById('status-grid-container');
    const statusLoader = document.getElementById('status-loader');
    const productContainer = document.getElementById('product-list-container');

    fetch(gasUrl)
        .then(res => res.json())
        .then(data => {
            const { brands, products } = data;

            // 1. 品牌排序
            const sortedBrands = brands.sort((a, b) => {
                const orderA = (a.order === "" || a.order === null) ? 999 : parseInt(a.order);
                const orderB = (b.order === "" || b.order === null) ? 999 : parseInt(b.order);
                return orderA - orderB;
            });

            if (statusLoader) statusLoader.style.display = 'none';

            // 2. 渲染總覽
            renderBrands(sortedBrands);

            // 3. 渲染產品 (帶入新邏輯)
            renderProducts(sortedBrands, products);

            // 4. SEO
            renderSEO(sortedBrands);
        })
        .catch(err => {
            console.error("載入失敗:", err);
            if (statusGrid) statusGrid.innerHTML = `<p class="text-red-500 col-span-full text-center">資料載入失敗</p>`;
        });

    function renderBrands(brands) {
        if (!statusGrid) return;
        statusGrid.innerHTML = '';
        brands.forEach(brand => {
            const isAvailable = brand.status !== 'out-of-stock'; // 空白或 available 皆視為有貨
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

    function renderProducts(brands, allProducts) {
        if (!productContainer) return;
        productContainer.innerHTML = '';

        brands.forEach(brand => {
            const brandProducts = allProducts.filter(p => {
                const isStatusOut = p.status === 'out-of-stock';
                const hasTag = (p.tag && p.tag.trim() !== '');
                // 邏輯 A：如 status 為 out-of-stock 且沒 tag，就完全隱藏不顯示
                if (isStatusOut && !hasTag) return false;
                return p.brand_key === brand.key;
            });

            const section = document.createElement('section');
            section.id = brand.key;
            section.className = "container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl scroll-mt-28 mb-16";
            
            let productCardsHTML = '';
            
            brandProducts.forEach(p => {
                const isStatusOut = p.status === 'out-of-stock';
                const isStockZero = (p.stock === 0 || p.stock === '0');
                const hasTag = (p.tag && p.tag.trim() !== '');
                
                // 標籤邏輯：tag 優先，沒 tag 且 stock:0 顯示缺貨
                let badge = '';
                if (hasTag) {
                    badge = `<span class="absolute top-3 right-3 bg-brandGreen text-white text-xs font-bold px-2.5 py-1 rounded-full">${p.tag}</span>`;
                } else if (isStockZero) {
                    badge = `<span class="absolute top-3 right-3 bg-gray-300 text-gray-700 text-xs font-bold px-2.5 py-1 rounded-full">缺貨中</span>`;
                }

                // 價格邏輯：status 為 out-of-stock 則不顯示價格
                let priceHTML = '';
                if (isStatusOut) {
                    priceHTML = `<p class="text-gray-400 text-sm">請私訊詢價</p>`; // 或是留空
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

                // 名稱與規格：spec 直接串接不加括號
                const displayName = p.spec ? `${p.name} ${p.spec}` : p.name;
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

            section.innerHTML = `
                <h2 class="text-3xl font-bold text-center mb-10">${brand.name}</h2>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    ${productCardsHTML || '<p class="text-gray-400 text-center col-span-full">尚無品項</p>'}
                </div>`;
            productContainer.appendChild(section);
        });
    }

    function renderSEO(brands) {
        /* 保持原樣 */
    }
});
