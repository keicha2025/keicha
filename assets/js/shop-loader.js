/**
 * KEICHA 網路商店 - 全自動載入引擎 (含購物車)
 */

// --- 1. 購物車全域變數與功能 ---
let cart = []; // 購物車陣列

// 從 LocalStorage 讀取購物車
function loadCart() {
    const savedCart = localStorage.getItem('keicha_cart');
    if (savedCart) {
        cart = JSON.parse(savedCart);
        updateCartUI();
    }
}

// 儲存購物車到 LocalStorage
function saveCart() {
    localStorage.setItem('keicha_cart', JSON.stringify(cart));
    updateCartUI();
}

// [核心] 更新購物車 UI (浮動按鈕 & 側邊欄)
function updateCartUI() {
    const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // 1. 更新浮動按鈕數字
    const floatingCount = document.getElementById('cart-floating-count');
    if (floatingCount) {
        floatingCount.textContent = totalCount;
        if (totalCount > 0) {
            floatingCount.classList.remove('hidden');
        } else {
            floatingCount.classList.add('hidden');
        }
    }

    // 2. 更新側邊欄標題數字
    const sidebarCount = document.getElementById('cart-total-count');
    if (sidebarCount) sidebarCount.textContent = totalCount;

    // 3. 更新總金額
    const totalEl = document.getElementById('cart-total-price');
    if (totalEl) totalEl.textContent = `NT$ ${totalPrice.toLocaleString()}`;

    // 4. 更新列表內容
    const container = document.getElementById('cart-items-container');
    if (container) {
        if (cart.length === 0) {
            container.innerHTML = '<p class="text-center text-gray-500 mt-10">您的購物車是空的</p>';
        } else {
            container.innerHTML = cart.map((item, index) => `
                <div class="cart-item">
                    <img src="${item.image}" alt="${item.name}">
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

// 全域函式：加入購物車
window.addToCart = function(id, name, price, image) {
    // 檢查是否已存在
    const existingItem = cart.find(item => item.id === id);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({ id, name, price, image, quantity: 1 });
    }
    saveCart();
    
    // 自動打開側邊欄
    window.toggleCart(true);
};

// 全域函式：更新數量
window.updateQuantity = function(index, change) {
    if (cart[index]) {
        cart[index].quantity += change;
        if (cart[index].quantity <= 0) {
            cart.splice(index, 1); // 數量為 0 則移除
        }
        saveCart();
    }
};

// 全域函式：移除商品
window.removeFromCart = function(index) {
    cart.splice(index, 1);
    saveCart();
};

// 全域函式：開關側邊欄
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

// 全域函式：結帳 (目前先 Alert，之後接金流)
window.checkout = function() {
    if (cart.length === 0) {
        alert('購物車是空的喔！');
        return;
    }
    
    // 這裡未來會換成「傳送訂單到 Google Apps Script」的程式碼
    const orderDetails = cart.map(item => `${item.name} x${item.quantity}`).join('\n');
    alert(`準備結帳以下商品：\n\n${orderDetails}\n\n(金流串接功能開發中...)`);
};


// --- 2. 頁面載入與資料抓取 ---

window.addEventListener('load', () => {
    
    // 初始化購物車
    loadCart();

    // --- 您的後台設定區 ---
    const products_csv_url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS8gwVZcW8WvKHAMPOO3qa2mjQzc_7JE7iy3NiMnjuQHVAW3pxg-s_a1qISsfwtfqqOGthHFp2omb_7/pub?gid=0&single=true&output=csv";
    const settings_csv_url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS8gwVZcW8WvKHAMPOO3qa2mjQzc_7JE7iy3NiMnjuQHVAW3pxg-s_a1qISsfwtfqqOGthHFp2omb_7/pub?gid=1849246580&single=true&output=csv";
    
    const BASE_URL = "/keicha";

    // ... (以下是 fetch, parseCSV, renderProductGrid 等原有函式，完全不變) ...
    // 為了節省篇幅，我這裡省略了 fetch 和 render 的程式碼 (與上一版相同)
    // 但請您保留原本的 parseProductsCSV, renderProductGrid 等函式
    // ★ 重要：請確保 renderProductGrid 裡的按鈕 HTML 是正確的 (呼叫 addToCart)
    
    // -----------------------------------------------------------
    // 以下為 fetch 與 render 邏輯 (請完整保留)
    // -----------------------------------------------------------

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

    function parseProductsCSV(text) {
        const lines = text.split(/\r?\n/);
        if (lines.length < 2) return [];
        // ★ 改為逗號分隔
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
            
            let specsHTML = product.specs ? `<ul class="text-xs text-gray-500 mt-2 space-y-1">${product.specs.split('|').map(s => `<li>• ${s.trim()}</li>`).join('')}</ul>` : '';
            let notesHTML = product.special_notes ? `<div class="mt-3 pt-3 border-t border-gray-200">${product.special_notes.split('|').map(n => `<p class="text-xs text-brandGreen font-medium">・ ${n.trim()}</p>`).join('')}</div>` : '';

            let imageUrl = product.image_url.startsWith('http') ? product.image_url : BASE_URL + (product.image_url.startsWith('/') ? product.image_url : '/' + product.image_url);
            
            const price = parseInt(product.price);
            const priceText = isNaN(price) ? "價格請洽詢" : `NT$ ${price.toLocaleString()}`;

            // ★ 按鈕邏輯
            let buttonHTML;
            if (isAvailable) {
                const safeName = product.product_name.replace(/'/g, "\\'");
                const safeId = product.product_id;
                buttonHTML = `
                    <button onclick="addToCart('${safeId}', '${safeName}', ${price}, '${imageUrl}')" 
                        class="mt-4 w-full bg-brandGreen text-white font-bold py-2 px-4 rounded hover:bg-opacity-90 transition duration-200 flex justify-center items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        加入購物車
                    </button>
                `;
            } else {
                buttonHTML = `
                    <button disabled class="mt-4 w-full bg-gray-300 text-gray-500 font-bold py-2 px-4 rounded cursor-not-allowed">
                        暫時缺貨
                    </button>
                `;
            }

            const cardHTML = `
                <div class="product-card flex flex-col bg-white rounded-lg shadow-md overflow-hidden transition-all duration-300 ${!isAvailable ? 'opacity-80' : 'hover:shadow-xl'}">
                    <div class="product-image-container">
                        <img src="${imageUrl}" alt="${product.product_name}" loading="lazy">
                        <div class="product-status-badge ${statusClass}">${statusText}</div>
                    </div>
                    <div class="p-5 flex flex-col flex-grow">
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
            container.innerHTML += cardHTML;
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
         // (省略 SEO 程式碼，以節省篇幅，請保留原有的)
         const container = document.getElementById('structured-data-container');
         if(!container) return;
         // ... (SEO logic)
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
