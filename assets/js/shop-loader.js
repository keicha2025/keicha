/**
 * KEICHA 網路商店 - 全自動載入引擎 (含購物車功能)
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

// 全域函式：結帳 (目前先 Alert，之後可接金流)
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
    
    // 初始化購物車
    loadCart();

    // --- 您的後台設定區 (維持不變) ---
    const products_csv_url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS8gwVZcW8WvKHAMPOO3qa2mjQzc_7JE7iy3NiMnjuQHVAW3pxg-s_a1qISsfwtfqqOGthHFp2omb_7/pub?gid=0&single=true&output=csv";
    const settings_csv_url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS8gwVZcW8WvKHAMPOO3qa2mjQzc_7JE7iy3NiMnjuQHVAW3pxg-s_a1qISsfwtfqqOGthHFp2omb_7/pub?gid=1849246580&single=true&output=csv";
    // --- 設定區結束 ---

    
    // --- 全自動載入邏輯 ---

    const BASE_URL = "/keicha";

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

    function cleanHeader(headerArray) {
        return headerArray.map(h => h.trim().replace(/[\uFEFF"']/g, ''));
    }

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
            if (item.product_id && item.status !== 'hidden') { 
                data.push(item);
            }
        }
        return data;
    }

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
     * 渲染商品卡片 (含加入購物車按鈕)
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
            
            let specsHTML = '';
            if (product.specs) {
                const specsList = product.specs.split('|').map(s => s.trim());
                specsHTML = `<ul class="text-xs text-gray-500 mt-2 space-y-1">
                    ${specsList.map(spec => `<li>• ${spec}</li>`).join('')}
                </ul>`;
            }

            let notesHTML = '';
            if (product.special_notes) {
                const notesList = product.special_notes.split('|').map(n => n.trim());
                notesHTML = `<div class="mt-3 pt-3 border-t border-gray-200">
                    ${notesList.map(note => `<p class="text-xs text-brandGreen font-medium">・ ${note}</p>`).join('')}
                </div>`;
            }

            let imageUrl;
            if (product.image_url.startsWith('http')) {
                imageUrl = product.image_url;
            } else {
                const cleanImagePath = product.image_url.startsWith('/') 
                    ? product.image_url 
                    : '/' + product.image_url;
                imageUrl = BASE_URL + cleanImagePath;
            }

            const price = parseInt(product.price);
            const priceText = isNaN(price) ? "價格請洽詢" : `NT$ ${price.toLocaleString()}`;

            // ★ [NEW] 加入購物車按鈕
            let buttonHTML;
            if (isAvailable) {
                const safeName = product.product_name.replace(/'/g, "\\'");
                const safeId = product.product_id;
                
                buttonHTML = `
                    <button onclick="addToCart('${safeId}', '${safeName}', ${price}, '${imageUrl}')" 
                        class="mt-4 w-full bg-brandGreen text-white font-bold py-2 px-4 rounded hover:bg-opacity-90 transition duration-200 flex justify-center items-center gap-2 shadow-sm">
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
                <div class="product-card flex flex-col bg-white rounded-lg shadow-md overflow-hidden transition-all duration-300 ${!isAvailable ? 'opacity-60' : 'hover:shadow-xl'}">
                    
                    <div class="product-image-container">
                        <img src="${imageUrl}" alt="${product.product_name}" loading="lazy">
                        <div class="product-status-badge ${statusClass}">${statusText}</div>
                    </div>
                    
                    <div class="p-5 flex flex-col flex-grow">
                        <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">${product.subcategory || product.category}</p>
                        <h3 class="text-lg font-bold text-gray-900 mt-1 mb-2">${product.product_name}</h3>
                        <p class="text-xl font-bold text-brandGreen mb-3">
                            ${priceText}
                        </p>
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
        if (settings.announcement && announcementSection && announcementContent) {
            announcementContent.textContent = settings.announcement;
            announcementSection.classList.remove('hidden');
        }

        const notesContent = document.getElementById('general-notes-content');
        if (settings.general_notes && notesContent) {
            const notesWithBreaks = settings.general_notes.replace(/\\n/g, '<br>').replace(/\n/g, '<br>');
            notesContent.innerHTML = notesWithBreaks;
        } else if (notesContent) {
            notesContent.innerHTML = '<p class="text-center text-gray-500">載入條款時發生錯誤。</p>';
        }

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

    function renderStructuredData(products) {
        const container = document.getElementById('structured-data-container');
        if (!container) return;

        const productItems = products.map(product => {
            let imageUrl;
            if (product.image_url.startsWith('http')) {
                imageUrl = product.image_url;
            } else {
                const cleanImagePath = product.image_url.startsWith('/') ? product.image_url : '/' + product.image_url;
                imageUrl = `https://keicha2025.github.io${BASE_URL}${cleanImagePath}`; 
            }
            
            const price = parseInt(product.price);

            return {
                "@type": "Product",
                "name": product.product_name,
                "description": product.seo_title || product.product_name,
                "productID": product.product_id,
                "image": imageUrl,
                "offers": {
                    "@type": "Offer",
                    "price": isNaN(price) ? "0" : price.toString(),
                    "priceCurrency": "TWD",
                    "availability": product.status === 'available' ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
                    "url": "https://keicha2025.github.io/keicha/shop.html"
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

    function handleMainError(error) {
        console.error("載入商店資料時發生嚴重錯誤:", error);
        const loader = document.getElementById('products-loader');
        const errorDiv = document.getElementById('products-error');
        if (loader) loader.style.display = 'none';
        if (errorDiv) {
            errorDiv.textContent = `載入商品時發生錯誤: ${error.message}。請檢查您的 GSheet 網址和欄位設定。`;
            errorDiv.classList.remove('hidden');
        }
        const announcementSection = document.getElementById('announcement-section');
        if(announcementSection) announcementSection.classList.add('hidden');
    }


    // --- 主執行流程 ---
    
    Promise.all([
        fetchWithCacheBust(settings_csv_url).then(text => parseSettingsCSV(text)),
        fetchWithCacheBust(products_csv_url).then(text => parseProductsCSV(text))
    ])
    .then(([settings, products]) => {
        
        renderSettings(settings);
        renderProductGrid(products);
        renderStructuredData(products);

    })
    .catch(error => {
        handleMainError(error);
    });

}); // 結束 'load' 事件
