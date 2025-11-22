/**
 * KEICHA 網路商店 - 全自動載入引擎 (含購物車 & 類別分組 & 純文字卡片支援)
 * (CSV 逗號分隔版)
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

function updateCartUI() {
    const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

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

    const container = document.getElementById('cart-items-container');
    if (container) {
        if (cart.length === 0) {
            container.innerHTML = '<p class="text-center text-gray-500 mt-10">您的購物車是空的</p>';
        } else {
            container.innerHTML = cart.map((item, index) => `
                <div class="cart-item">
                    <img src="${item.image}" alt="${item.name}" onerror="this.style.display='none'">
                    <div class="flex-grow">
                        <h4 class="text-sm font-bold text-gray-800 line-clamp-2">${item.name}</h4>
                        <p class="text-sm text-brandGreen font-semibold mt-1">NT$ ${item.price.toLocaleString()}</p>
                        <div class="flex items-center mt-2 gap-3">
                            <div class="flex items-center border rounded">
                                <button onclick="updateQuantity(${index}, -1)" class="px-2 py-0.5 text-gray-600 hover:bg-gray-100">-</button>
                                <span class="px-2 text-sm text-gray-800">${item.quantity}</span>
                                <button onclick="updateQuantity(${index}, 1)" class="px-2 py-0.5 text-gray-600 hover:bg-gray-100">+</button>
                            </div>
                            <button onclick="removeFromCart(${index})" class="text-xs text-red-500 hover:underline">刪除</button>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    }
}

window.addToCart = function(id, name, price, image) {
    const existingItem = cart.find(item => item.id === id);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({ id, name, price, image, quantity: 1 });
    }
    saveCart();
    window.toggleCart(true);
};

window.updateQuantity = function(index, change) {
    if (cart[index]) {
        cart[index].quantity += change;
        if (cart[index].quantity <= 0) cart.splice(index, 1);
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
    const orderDetails = cart.map(item => `${item.name} x${item.quantity}`).join('\n');
    const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    alert(`【訂單確認】\n\n${orderDetails}\n\n總金額：NT$ ${totalPrice.toLocaleString()}\n\n(此為測試功能，之後將串接金流)`);
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
            return Promise.reject(new Error(`無效或缺失的 Google Sheet 網址: ${url}`));
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

    // 解析商品 (CSV 版)
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

    // 解析設定 (CSV 版)
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

    // ★ [主要修改區] 渲染商品卡片 (自動分組 & 純文字判斷)
    function renderProductGrid(products) {
        const container = document.getElementById('product-grid-container');
        const loader = document.getElementById('products-loader');
        if (!container || !loader) return;
        
        loader.style.display = 'none';
        container.innerHTML = '';

        // 1. 移除原本 Grid 樣式，改為垂直堆疊 (因為要放標題區塊)
        container.className = 'space-y-16';

        if (products.length === 0) {
            container.innerHTML = '<p class="text-center text-gray-500 col-span-full">目前尚無商品。</p>';
            return;
        }

        // 2. 依照 category 分組
        const categories = {};
        products.forEach(product => {
            // 若沒有類別，預設為 "其他商品"
            const catName = product.category ? product.category.trim() : '其他商品';
            if (!categories[catName]) {
                categories[catName] = [];
            }
            categories[catName].push(product);
        });

        // 3. 遍歷類別並渲染
        Object.keys(categories).forEach(catName => {
            const items = categories[catName];

            // 建立區塊 HTML
            const section = document.createElement('div');
            
            // 標題
            const titleHTML = `
                <div class="flex items-center mb-6">
                    <h2 class="text-2xl font-bold text-gray-800 border-l-4 border-brandGreen pl-3">
                        ${catName}
                    </h2>
                    <div class="flex-grow ml-4 border-t border-gray-200"></div>
                </div>
            `;

            // Grid 容器
            const gridStart = `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10">`;
            
            // 卡片內容
            const cardsHTML = items.map(product => {
                const isAvailable = product.status === 'available';
                const statusText = isAvailable ? '可訂購' : '缺貨中';
                const statusClass = isAvailable ? 'status-available' : 'status-out-of-stock';
                
                let specsHTML = product.specs ? `<ul class="text-xs text-gray-500 mt-2 space-y-1">${product.specs.split('|').map(s => `<li>• ${s.trim()}</li>`).join('')}</ul>` : '';
                let notesHTML = product.special_notes ? `<div class="mt-3 pt-3 border-t border-gray-200">${product.special_notes.split('|').map(n => `<p class="text-xs text-brandGreen font-medium">・ ${n.trim()}</p>`).join('')}</div>` : '';

                // ★ [修改] 圖片邏輯：如果沒填 image_url，就變成純文字卡片
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
                    // 沒有圖片時，僅顯示狀態標籤在右上角
                    imageHTML = `
                       <div class="flex justify-end mb-2">
                            <span class="text-xs font-bold px-2 py-1 rounded-full ${isAvailable ? 'bg-brandGreen text-white' : 'bg-gray-200 text-gray-700'}">
                                ${statusText}
                            </span>
                       </div>
                    `;
                }
                
                const price = parseInt(product.price);
                const priceText = isNaN(price) ? "價格請洽詢" : `NT$ ${price.toLocaleString()}`;

                // 按鈕邏輯
                let buttonHTML;
                if (isAvailable) {
                    const safeName = product.product_name.replace(/'/g, "\\'");
                    const safeId = product.product_id;
                    // 若無圖片，傳入空字串給購物車
                    const cartImage = hasImage ? imageUrl : ''; 
                    
                    buttonHTML = `
                        <button onclick="addToCart('${safeId}', '${safeName}', ${price}, '${cartImage}')" 
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
        const announcementSection = document.getElementById('announcement-section');
        const announcementContent = document.getElementById('announcement-content');
        if (settings.announcement && announcementSection) {
            announcementContent.textContent = settings.announcement;
            announcementSection.classList.remove('hidden');
        }
        const notesContent = document.getElementById('general-notes-content');
        if (settings.general_notes && notesContent) {
            notesContent.innerHTML = settings.general_notes.replace(/\\n/g, '<br>').replace(/\n/g, '<br>');
        }
        const lineId = document.getElementById('contact-line-id');
        if (settings.contact_line_id && lineId) lineId.textContent = settings.contact_line_id;
        
        const emailText = document.getElementById('contact-email-text');
        const emailLink = document.getElementById('contact-email-link');
        if (settings.contact_email && emailText) {
            emailText.textContent = settings.contact_email;
            emailLink.href = `mailto:${settings.contact_email}`;
        }
    }
    
    function renderStructuredData(products) {
         const container = document.getElementById('structured-data-container');
         if(!container) return;
         // (SEO 略)
    }

    function handleMainError(error) {
        console.error("錯誤:", error);
        const loader = document.getElementById('products-loader');
        if(loader) loader.style.display = 'none';
        const errorDiv = document.getElementById('products-error');
        if(errorDiv) {
            errorDiv.textContent = `載入錯誤: ${error.message}`;
            errorDiv.classList.remove('hidden');
        }
    }

    Promise.all([
        fetchWithCacheBust(settings_csv_url).then(text => parseSettingsCSV(text)),
        fetchWithCacheBust(products_csv_url).then(text => parseProductsCSV(text))
    ])
    .then(([settings, products]) => {
        renderSettings(settings);
        renderProductGrid(products);
        renderStructuredData(products);
    })
    .catch(handleMainError);

});
