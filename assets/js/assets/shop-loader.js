/**
 * KEICHA 網路商店 - 全自動載入引擎 (賣貨便小幫手版)
 * 功能：讀取 GSheet、產生商品卡片、自動計算賣貨便字串、底部懸浮工具列
 */

// --- 1. 全域變數 ---
let cart = []; 

// 初始化
function loadCart() {
    const savedCart = localStorage.getItem('keicha_cart');
    if (savedCart) {
        cart = JSON.parse(savedCart);
    }
    updateCartUI(); // 即使是空的也要執行，以隱藏工具列
}

function saveCart() {
    localStorage.setItem('keicha_cart', JSON.stringify(cart));
    updateCartUI();
}

/**
 * ★ [CORE] 更新 UI 與 產生器邏輯
 */
function updateCartUI() {
    const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // 1. 控制底部工具列顯示
    const myshipBar = document.getElementById('myship-bar');
    if (myshipBar) {
        if (totalCount > 0) {
            myshipBar.classList.add('show');
        } else {
            myshipBar.classList.remove('show');
        }
    }

    // 2. 更新數量顯示
    const barCount = document.getElementById('bar-total-count');
    if (barCount) barCount.textContent = totalCount;

    // 3. [重點] 產生品名組合字串
    // 邏輯：
    // - 分隔符號：' / '
    // - 數量顯示：qty > 1 時顯示 (xN)
    // - 防呆：總件數 > 3 時，最前方加入 (共N件)
    let nameString = cart.map(item => {
        return item.quantity > 1 ? `${item.name} (x${item.quantity})` : item.name;
    }).join(' / ');

    if (totalCount > 3) {
        nameString = `(共${totalCount}件) ${nameString}`;
    }

    // 填入 Input
    const nameInput = document.getElementById('gen-name-input');
    if (nameInput) nameInput.value = nameString;

    // 4. 更新總金額 Input
    const priceInput = document.getElementById('gen-price-input');
    if (priceInput) priceInput.value = totalPrice; // 純數字，不加逗號方便複製

    // 5. 更新購物車詳細清單 (Modal 內)
    const detailList = document.getElementById('cart-detail-list');
    if (detailList) {
        if (cart.length === 0) {
            detailList.innerHTML = '<p class="text-center text-gray-500">尚無商品</p>';
        } else {
            detailList.innerHTML = cart.map((item, index) => `
                <div class="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                    <div class="flex-grow">
                        <p class="font-bold text-sm text-gray-800">${item.name}</p>
                        <p class="text-xs text-gray-500">單價 $${item.price}</p>
                    </div>
                    <div class="flex items-center gap-3">
                        <div class="flex items-center border bg-white rounded">
                            <button onclick="updateQuantity(${index}, -1)" class="px-3 py-1 text-gray-600 hover:bg-gray-100">-</button>
                            <span class="px-2 text-sm font-bold">${item.quantity}</span>
                            <button onclick="updateQuantity(${index}, 1)" class="px-3 py-1 text-gray-600 hover:bg-gray-100">+</button>
                        </div>
                        <button onclick="removeFromCart(${index})" class="text-red-500 text-xl">&times;</button>
                    </div>
                </div>
            `).join('');
        }
    }
}

// --- 使用者互動函式 ---

window.addToCart = function(id, name, price, image) {
    const existingItem = cart.find(item => item.id === id);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({ id, name, price, image, quantity: 1 });
    }
    saveCart();
    // 加入後顯示 Toast 提示
    showToast(`已加入：${name}`);
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

// 切換購物車清單 Modal
window.toggleCartDetail = function() {
    const modal = document.getElementById('cart-detail-modal');
    if (modal) {
        modal.classList.toggle('hidden');
    }
};

// 複製功能
window.copyToClipboard = function(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    
    // 選擇文字
    input.select();
    input.setSelectionRange(0, 99999); // 手機版相容

    // 執行複製
    try {
        navigator.clipboard.writeText(input.value).then(() => {
            showToast('已複製！');
        });
    } catch (err) {
        // 備用方案
        document.execCommand('copy');
        showToast('已複製！');
    }
};

function showToast(message) {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 2000);
    }
}

// --- 2. 資料載入邏輯 (維持不變) ---

window.addEventListener('load', () => {
    
    loadCart();

    const masterSheetUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRg7lbIAXPL0bOABXVzsELSwhhc0UQfZX2JOtxWkHH0wLlZwkWNK-8kNiRGpyvLyfNhAsl0zVaDKpIv/pub?gid=1151248789&single=true&output=csv";
    const BASE_URL = "/keicha";

    function fetchWithCacheBust(url) {
        if (!url || !url.startsWith('http') || url.includes("請貼上")) return Promise.reject(new Error("Invalid URL"));
        return fetch(url, { cache: 'no-store' }).then(res => res.ok ? res.text() : Promise.reject(res.status));
    }

    function cleanHeader(arr) { return arr.map(h => h.trim().replace(/[\uFEFF"']/g, '')); }

    function parseCSV(text, requiredHeaders) {
        const lines = text.split(/\r?\n/);
        if (lines.length < 2) return [];
        let header = cleanHeader(lines[0].split(','));
        const headerMap = {};
        requiredHeaders.forEach(h => headerMap[h] = header.indexOf(h));
        const data = [];
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            const row = lines[i].split(',');
            const item = {};
            for (const key in headerMap) item[key] = row[headerMap[key]] ? row[headerMap[key]].trim() : '';
            if (item[requiredHeaders[0]]) data.push(item);
        }
        return data;
    }

    function renderStatusOverview(brands) {
        const container = document.getElementById('status-grid-container');
        const loader = document.getElementById('status-loader');
        if (!container || !loader) return;
        loader.style.display = 'none';
        container.innerHTML = ''; 

        const statusText = { 'available': '可供訂購', 'out-of-stock': '缺貨中' };
        const statusClass = { 'available': 'bg-brandGreen text-white', 'out-of-stock': 'bg-gray-200 text-gray-700' };

        brands.forEach(brand => {
            const currentStatus = brand.status === 'available' ? 'available' : 'out-of-stock';
            const itemHTML = `
                <a href="#${brand.key}" class="bg-white p-5 md:p-6 rounded-lg shadow-md flex items-center justify-between transition-all duration-300 hover:shadow-lg hover:scale-105">
                    <span class="text-lg md:text-xl font-medium text-gray-800">${brand.name}</span>
                    <span class="whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-bold ${statusClass[currentStatus]}">
                        ${statusText[currentStatus]}
                    </span>
                </a>
            `;
            container.innerHTML += itemHTML;
        });
    }

    function renderProductSections(brands) {
        const container = document.getElementById('product-list-container');
        if (!container) return;
        container.innerHTML = ''; 
        brands.forEach(brand => {
            container.innerHTML += `
                <section id="${brand.key}" class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl scroll-mt-28">
                    <h2 class="text-3xl font-bold text-center mb-10">${brand.name}</h2>
                    <div id="${brand.key}-loader" class="flex justify-center items-center h-32">
                        <div class="loader ease-linear rounded-full border-4 border-t-4 border-gray-200 h-12 w-12"></div>
                    </div>
                    <div id="${brand.key}-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"></div>
                </section>
            `;
        });
    }

    function renderProductCards(brandKey, products) {
        const grid = document.getElementById(`${brandKey}-grid`);
        const loader = document.getElementById(`${brandKey}-loader`);
        if (!grid || !loader) return;
        loader.style.display = 'none';
        grid.innerHTML = '';

        products.forEach(product => {
            const isAvailable = product.status === 'available';
            const statusText = isAvailable ? '可訂購' : '缺貨中';
            const statusClass = isAvailable ? 'status-available' : 'status-out-of-stock';
            
            let specsHTML = product.specs ? `<ul class="text-xs text-gray-500 mt-2 space-y-1">${product.specs.split('|').map(s => `<li>• ${s.trim()}</li>`).join('')}</ul>` : '';
            let notesHTML = product.special_notes ? `<div class="mt-3 pt-3 border-t border-gray-200">${product.special_notes.split('|').map(n => `<p class="text-xs text-brandGreen font-medium">・ ${n.trim()}</p>`).join('')}</div>` : '';

            let imageUrl = product.image_url.startsWith('http') ? product.image_url : BASE_URL + (product.image_url.startsWith('/') ? product.image_url : '/' + product.image_url);
            const price = parseInt(product.price);
            const priceText = isNaN(price) ? "價格請洽詢" : `NT$ ${price.toLocaleString()}`;

            // ★ 按鈕邏輯 (呼叫 addToCart)
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
                        加入
                    </button>
                `;
            } else {
                buttonHTML = `<button disabled class="mt-4 w-full bg-gray-300 text-gray-500 font-bold py-2 px-4 rounded cursor-not-allowed">缺貨</button>`;
            }

            grid.innerHTML += `
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
                        <div class="mt-auto">${notesHTML}${buttonHTML}</div>
                    </div>
                </div>
            `;
        });
    }

    // 主執行流程
    fetchWithCacheBust(masterSheetUrl)
        .then(csvText => {
            const masterBrandList = parseCSV(csvText, ['key', 'name', 'status', 'product_csv_url']);
            renderStatusOverview(masterBrandList);
            renderProductSections(masterBrandList);
            
            masterBrandList.forEach(brand => {
                const productUrl = brand.product_csv_url;
                if (productUrl && productUrl.startsWith('http')) {
                    fetchWithCacheBust(productUrl)
                        .then(productCsvText => {
                            const products = parseCSV(productCsvText, ['product_name', 'price', 'price_multi', 'status']);
                            renderProductCards(brand.key, products);
                        });
                }
            });
        });
});
