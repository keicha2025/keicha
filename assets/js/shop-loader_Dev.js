/**
 * KEICHA 網路商店 - 全自動載入引擎
 * (含購物車、類別分組、同品牌混搭折扣、客服區塊更新)
 */

// --- 1. 購物車全域變數與功能 ---
let cart = []; 

function loadCart() {
    const savedCart = localStorage.getItem('keicha_cart');
    if (savedCart) {
        cart = JSON.parse(savedCart);
        updateCartUI();
    }
}

function saveCart() {
    localStorage.setItem('keicha_cart', JSON.stringify(cart));
    updateCartUI();
}

/**
 * ★ [核心修改] 更新 UI 與 金額計算 (同品牌混搭邏輯)
 */
function updateCartUI() {
    // 1. 先統計每個品牌的總數量
    const brandCounts = {};
    cart.forEach(item => {
        // 如果沒有品牌資訊，歸類為 'other'
        const brand = item.brand || 'other';
        brandCounts[brand] = (brandCounts[brand] || 0) + item.quantity;
    });

    // 2. 計算總金額與總件數
    let totalCount = 0;
    let totalPrice = 0;

    cart.forEach(item => {
        totalCount += item.quantity;
        
        const brand = item.brand || 'other';
        const totalBrandQty = brandCounts[brand] || 0;
        
        // ★ 判斷邏輯：若該品牌總數量 >= 2 且該商品有設定優惠價，則使用優惠價
        const finalPrice = (totalBrandQty >= 2 && item.price_multi > 0) ? item.price_multi : item.price;
        
        totalPrice += finalPrice * item.quantity;
    });

    // 3. 更新介面顯示
    const floatingCount = document.getElementById('cart-floating-count');
    if (floatingCount) {
        floatingCount.textContent = totalCount;
        if (totalCount > 0) floatingCount.classList.remove('hidden');
        else floatingCount.classList.add('hidden');
    }

    const sidebarCount = document.getElementById('cart-total-count');
    if (sidebarCount) sidebarCount.textContent = totalCount;

    const totalEl = document.getElementById('cart-total-price');
    if (totalEl) totalEl.textContent = `NT$ ${totalPrice.toLocaleString()}`;

    // 4. 更新購物車列表
    const container = document.getElementById('cart-items-container');
    if (container) {
        if (cart.length === 0) {
            container.innerHTML = '<p class="text-center text-gray-500 mt-10">您的購物車是空的</p>';
        } else {
            container.innerHTML = cart.map((item, index) => {
                // 重新判斷一次單價顯示
                const brand = item.brand || 'other';
                const totalBrandQty = brandCounts[brand] || 0;
                const isDiscounted = (totalBrandQty >= 2 && item.price_multi > 0);
                const displayPrice = isDiscounted ? item.price_multi : item.price;
                const priceClass = isDiscounted ? 'text-brandGreen font-bold' : 'text-gray-600';
                const discountTag = isDiscounted ? '<span class="text-xs bg-red-100 text-red-600 px-1 rounded ml-2">優惠中</span>' : '';

                return `
                <div class="cart-item">
                    <img src="${item.image}" alt="${item.name}" onerror="this.style.display='none'">
                    <div class="flex-grow">
                        <h4 class="text-sm font-bold text-gray-800 line-clamp-2">${item.name}</h4>
                        <div class="flex items-center mt-1">
                            <p class="text-sm ${priceClass}">NT$ ${displayPrice.toLocaleString()}</p>
                            ${discountTag}
                        </div>
                        <p class="text-xs text-gray-400 mt-0.5">品牌: ${brand}</p>
                        
                        <div class="flex items-center mt-2 gap-3">
                            <div class="flex items-center border rounded">
                                <button onclick="updateQuantity(${index}, -1)" class="px-2 py-0.5 text-gray-600 hover:bg-gray-100">-</button>
                                <span class="px-2 text-sm text-gray-800">${item.quantity}</span>
                                <button onclick="updateQuantity(${index}, 1)" class="px-2 py-0.5 text-gray-600 hover:bg-gray-100" ${item.quantity >= (item.max_limit || 99) ? 'disabled' : ''}>+</button>
                            </div>
                            <button onclick="removeFromCart(${index})" class="text-xs text-red-500 hover:underline">刪除</button>
                        </div>
                    </div>
                </div>
            `}).join('');
        }
    }
}

// ★ [UPDATED] 加入購物車 (新增 priceMulti 與 brand 參數)
window.addToCart = function(id, name, price, priceMulti, image, maxLimit, brand) {
    const limit = parseInt(maxLimit) || 99;
    const pMulti = parseInt(priceMulti) || 0;

    const existingItem = cart.find(item => item.id === id);
    
    if (existingItem) {
        if (existingItem.quantity >= limit) {
            alert(`抱歉，此商品每人限購 ${limit} 件。`);
            return;
        }
        existingItem.quantity += 1;
    } else {
        cart.push({ 
            id, name, price, 
            price_multi: pMulti, 
            image, 
            quantity: 1, 
            max_limit: limit,
            brand: brand // ★ 儲存品牌資訊
        });
    }
    saveCart();
    window.toggleCart(true);
};

window.updateQuantity = function(index, change) {
    if (cart[index]) {
        const newQty = cart[index].quantity + change;
        const limit = cart[index].max_limit || 99;

        if (newQty > limit) {
            alert(`抱歉，此商品每人限購 ${limit} 件。`);
            return;
        }
        if (newQty <= 0) {
            cart.splice(index, 1);
        } else {
            cart[index].quantity = newQty;
        }
        saveCart();
    }
};

window.removeFromCart = function(index) {
    cart.splice(index, 1);
    saveCart();
};

window.toggleCart = function(isOpen) {
    const sidebar = document.getElementById('cart-sidebar');
    const overlay = document.getElementById('cart-overlay');
    if (isOpen) {
        sidebar.classList.add('open');
        overlay.classList.add('open');
    } else {
        sidebar.classList.remove('open');
        overlay.classList.remove('open');
    }
};

window.checkout = function() {
    if (cart.length === 0) {
        alert('購物車是空的喔！');
        return;
    }
    // 這裡之後會接金流，目前先計算總價檢查邏輯
    const total = document.getElementById('cart-total-price').textContent;
    const details = cart.map(i => `${i.name} x${i.quantity}`).join('\n');
    alert(`準備結帳：\n${details}\n\n總金額：${total}`);
};


// --- 2. 頁面載入與資料抓取 ---

window.addEventListener('load', () => {
    loadCart();

    // --- 您的後台設定區 ---
    const products_csv_url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS8gwVZcW8WvKHAMPOO3qa2mjQzc_7JE7iy3NiMnjuQHVAW3pxg-s_a1qISsfwtfqqOGthHFp2omb_7/pub?gid=0&single=true&output=csv";
    const settings_csv_url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS8gwVZcW8WvKHAMPOO3qa2mjQzc_7JE7iy3NiMnjuQHVAW3pxg-s_a1qISsfwtfqqOGthHFp2omb_7/pub?gid=1849246580&single=true&output=csv";
    
    const BASE_URL = "/keicha"; 

    function fetchWithCacheBust(url) {
        if (!url || !url.startsWith('http') || url.includes("請貼上")) {
            return Promise.reject(new Error(`無效 URL`));
        }
        return fetch(url, {
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
        }).then(res => {
            if (!res.ok) throw new Error(`網路錯誤 ${res.status}`);
            return res.text();
        });
    }

    function cleanHeader(arr) { return arr.map(h => h.trim().replace(/[\uFEFF"']/g, '')); }

    function parseProductsCSV(text) {
        const lines = text.split(/\r?\n/);
        if (lines.length < 2) return [];
        
        let header = cleanHeader(lines[0].split(','));
        const headerMap = {};
        header.forEach(h => headerMap[h] = header.indexOf(h));

        const data = [];
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            const row = lines[i].split(',');
            const item = {};
            for (const key in headerMap) {
                item[key] = row[headerMap[key]] ? row[headerMap[key]].trim() : '';
            }
            if (item.product_id && item.status !== 'hidden') data.push(item);
        }
        return data;
    }

    function parseSettingsCSV(text) {
        const lines = text.split(/\r?\n/);
        if (lines.length < 2) return {};
        let header = cleanHeader(lines[0].split(','));
        const headerMap = { key: header.indexOf('key'), value: header.indexOf('value') };
        const settings = {};
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            const row = lines[i].split(',');
            const key = row[headerMap.key] ? row[headerMap.key].trim() : '';
            const value = row[headerMap.value] ? row[headerMap.value].trim() : '';
            if (key) settings[key] = value;
        }
        return settings;
    }

    // ★ [UPDATED] 渲染商品卡片 (傳遞 brand 和 price_multi)
    function renderProductGrid(products) {
        const container = document.getElementById('product-grid-container');
        const loader = document.getElementById('products-loader');
        if (!container || !loader) return;
        
        loader.style.display = 'none';
        container.innerHTML = '';
        container.className = 'space-y-16';

        if (products.length === 0) {
            container.innerHTML = '<p class="text-center text-gray-500 col-span-full">目前尚無商品。</p>';
            return;
        }

        const categories = {};
        products.forEach(product => {
            const catName = product.category ? product.category.trim() : '其他商品';
            if (!categories[catName]) categories[catName] = [];
            categories[catName].push(product);
        });

        Object.keys(categories).forEach(catName => {
            const items = categories[catName];
            const section = document.createElement('div');
            
            const titleHTML = `
                <div class="flex items-center mb-6">
                    <h2 class="text-2xl font-bold text-gray-800 border-l-4 border-brandGreen pl-3">
                        ${catName}
                    </h2>
                    <div class="flex-grow ml-4 border-t border-gray-200"></div>
                </div>
            `;

            const gridStart = `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10">`;
            
            const cardsHTML = items.map(product => {
                const isAvailable = product.status === 'available';
                const statusText = isAvailable ? '可訂購' : '缺貨中';
                const statusClass = isAvailable ? 'status-available' : 'status-out-of-stock';
                
                let specsHTML = product.specs ? `<ul class="text-xs text-gray-500 mt-2 space-y-1">${product.specs.split('|').map(s => `<li>• ${s.trim()}</li>`).join('')}</ul>` : '';
                let notesHTML = product.special_notes ? `<div class="mt-3 pt-3 border-t border-gray-200">${product.special_notes.split('|').map(n => `<p class="text-xs text-brandGreen font-medium">・ ${n.trim()}</p>`).join('')}</div>` : '';

                // 圖片處理
                let hasImage = false;
                let imageUrl = '';
                let imageHTML = '';
                if (product.image_url && product.image_url.trim() !== '') {
                    hasImage = true;
                    if (product.image_url.startsWith('http')) {
                        imageUrl = product.image_url;
                    } else {
                        const cleanPath = product.image_url.startsWith('/') ? product.image_url : '/' + product.image_url;
                        imageUrl = BASE_URL + cleanPath;
                    }
                    imageHTML = `
                        <div class="product-image-container">
                            <img src="${imageUrl}" alt="${product.product_name}" loading="lazy">
                            <div class="product-status-badge ${statusClass}">${statusText}</div>
                        </div>
                    `;
                } else {
                    imageHTML = `
                       <div class="flex justify-end mb-2">
                            <span class="text-xs font-bold px-2 py-1 rounded-full ${isAvailable ? 'bg-brandGreen text-white' : 'bg-gray-200 text-gray-700'}">
                                ${statusText}
                            </span>
                       </div>
                    `;
                }
                
                const price = parseInt(product.price);
                const priceMulti = parseInt(product.price_multi) || 0;
                const priceText = isNaN(price) ? "價格請洽詢" : `NT$ ${price.toLocaleString()}`;

                // 按鈕 HTML
                let buttonHTML;
                if (isAvailable) {
                    const safeName = product.product_name.replace(/'/g, "\\'");
                    const safeId = product.product_id;
                    const cartImage = hasImage ? imageUrl : ''; 
                    const maxLimit = product.max_limit ? parseInt(product.max_limit) : 99;
                    const safeBrand = (product.subcategory || product.category || 'other').replace(/'/g, "\\'");
                    
                    // ★ 傳遞所有參數給 addToCart，包含 brand
                    buttonHTML = `
                        <button onclick="addToCart('${safeId}', '${safeName}', ${price}, ${priceMulti}, '${cartImage}', ${maxLimit}, '${safeBrand}')" 
                            class="mt-4 w-full bg-brandGreen text-white font-bold py-2 px-4 rounded hover:bg-opacity-90 transition duration-200 flex justify-center items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            加入
                        </button>
                    `;
                } else {
                    buttonHTML = `
                        <button disabled class="mt-4 w-full bg-gray-300 text-gray-500 font-bold py-2 px-4 rounded cursor-not-allowed">
                            缺貨
                        </button>
                    `;
                }

                return `
                    <div class="product-card flex flex-col bg-white rounded-lg shadow-md overflow-hidden transition-all duration-300 ${!isAvailable ? 'opacity-80' : 'hover:shadow-xl'} p-4">
                        ${imageHTML}
                        <div class="flex flex-col flex-grow ${hasImage ? 'pt-4' : ''}">
                            <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">${product.subcategory || product.category}</p>
                            <h3 class="text-lg font-bold text-gray-900 mt-1 mb-2">${product.product_name}</h3>
                            <p class="text-xl font-bold text-brandGreen mb-3">${priceText}</p>
                            ${specsHTML}
                            <div class="mt-auto">
                                ${notesHTML}
                                ${buttonHTML}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            const gridEnd = `</div>`;
            section.innerHTML = titleHTML + gridStart + cardsHTML + gridEnd;
            container.appendChild(section);
        });
    }

    function renderSettings(settings) {
        const announcementSection = document.getElementById
