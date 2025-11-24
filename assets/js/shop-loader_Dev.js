/**
 * KEICHA 7-11 賣貨便小幫手 - 全自動載入引擎 (Dev)
 * 功能：讀取 GSheet (總表+分頁)、購物車計算、產生賣貨便字串
 */

// --- 全域變數與設定 ---
let cart = []; // 購物車內容

// ★ 後台設定：只需修改這裡的「總表」網址
// 總表必須包含欄位: key, name, status, product_csv_url
const MASTER_SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRg7lbIAXPL0bOABXVzsELSwhhc0UQfZX2JOtxWkHH0wLlZwkWNK-8kNiRGpyvLyfNhAsl0zVaDKpIv/pub?gid=1151248789&single=true&output=csv";

// --- 1. 購物車核心邏輯 ---

function loadCart() {
    const saved = localStorage.getItem('keicha_cart_dev');
    if (saved) cart = JSON.parse(saved);
    updateCartUI();
}

function saveCart() {
    localStorage.setItem('keicha_cart_dev', JSON.stringify(cart));
    updateCartUI();
}

function clearCart() {
    if(confirm('確定要清空清單嗎？')) {
        cart = [];
        saveCart();
    }
}

// ★ [核心] 更新 UI 與 字串產生器
function updateCartUI() {
    const bar = document.getElementById('myship-bar');
    const totalQty = cart.reduce((acc, item) => acc + item.qty, 0);
    
    // 計算總金額 (考慮 price_multi 兩罐優惠)
    let grandTotal = 0;
    cart.forEach(item => {
        // 判斷是否符合多件優惠
        // 如果單一品項數量 >= 2 且設定了 price_multi，則用優惠價
        const unitPrice = (item.qty >= 2 && item.price_multi > 0) ? item.price_multi : item.price;
        grandTotal += unitPrice * item.qty;
    });

    // 顯示/隱藏底部工具列
    if (bar) {
        if (totalQty > 0) bar.classList.add('show');
        else bar.classList.remove('show');
    }

    // 更新數量顯示
    const qtyEl = document.getElementById('bar-total-qty');
    if(qtyEl) qtyEl.textContent = totalQty;

    // ★ [重點] 賣貨便品名產生邏輯
    // 格式：(共N件) 品名A (x2) / 品名B / 品名C
    let nameStrParts = cart.map(item => {
        return item.qty > 1 ? `${item.name} (x${item.qty})` : item.name;
    });
    
    let finalNameStr = nameStrParts.join(' / ');
    
    // 長度防呆：如果超過 3 種不同品項，或是總件數 > 3，加註總件數
    if (cart.length > 3 || totalQty > 3) {
        finalNameStr = `(共${totalQty}件) ${finalNameStr}`;
    }

    // 填入 Input
    const nameInput = document.getElementById('gen-name-input');
    if(nameInput) nameInput.value = finalNameStr;

    const priceInput = document.getElementById('gen-price-input');
    if(priceInput) priceInput.value = grandTotal; // 純數字

    // 更新明細列表 (Modal)
    renderCartDetailList();
}

function renderCartDetailList() {
    const container = document.getElementById('cart-list-content');
    if(!container) return;

    if(cart.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 py-4">清單是空的</p>';
        return;
    }

    container.innerHTML = cart.map((item, idx) => {
        const unitPrice = (item.qty >= 2 && item.price_multi > 0) ? item.price_multi : item.price;
        const isDiscounted = unitPrice < item.price;
        
        return `
            <div class="flex justify-between items-center bg-gray-50 p-3 rounded">
                <div class="flex-grow pr-2">
                    <div class="font-bold text-gray-800">${item.name}</div>
                    <div class="text-xs text-gray-500">
                        ${isDiscounted ? `<span class="text-brandGreen">優惠價 $${unitPrice}</span>` : `單價 $${unitPrice}`} 
                        x ${item.qty}
                    </div>
                </div>
                <div class="flex items-center gap-2 bg-white border rounded px-1">
                    <button onclick="updateItemQty(${idx}, -1)" class="px-2 py-1 text-gray-600 hover:bg-gray-100">-</button>
                    <span class="text-sm font-mono w-4 text-center">${item.qty}</span>
                    <button onclick="updateItemQty(${idx}, 1)" class="px-2 py-1 text-gray-600 hover:bg-gray-100">+</button>
                </div>
            </div>
        `;
    }).join('');
}

// --- 互動函式 ---

window.addToCart = function(name, price, priceMulti, maxLimit) {
    const existing = cart.find(i => i.name === name);
    const limit = maxLimit ? parseInt(maxLimit) : 99;
    
    if (existing) {
        if (existing.qty >= limit) {
            showToast(`已達限購上限 (${limit})`);
            return;
        }
        existing.qty++;
    } else {
        cart.push({
            name: name,
            price: parseInt(price) || 0,
            price_multi: parseInt(priceMulti) || 0,
            qty: 1,
            max_limit: limit
        });
    }
    saveCart();
    showToast('已加入清單');
};

window.updateItemQty = function(idx, delta) {
    const item = cart[idx];
    if (!item) return;
    
    const newQty = item.qty + delta;
    const limit = item.max_limit || 99;

    if (newQty > limit) {
        showToast(`已達限購上限 (${limit})`);
        return;
    }

    if (newQty <= 0) {
        if(confirm(`確定要移除 ${item.name} 嗎？`)) {
            cart.splice(idx, 1);
        }
    } else {
        item.qty = newQty;
    }
    saveCart();
};

window.toggleCartModal = function() {
    const modal = document.getElementById('cart-modal');
    if(modal) modal.classList.toggle('hidden');
};

window.copyToClipboard = function(id) {
    const el = document.getElementById(id);
    if(!el) return;
    el.select();
    el.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(el.value).then(() => showToast('複製成功！'))
        .catch(() => { document.execCommand('copy'); showToast('複製成功！'); });
};

function showToast(msg) {
    const toast = document.getElementById('toast');
    if(toast) {
        toast.textContent = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2000);
    }
}


// --- 2. 資料抓取邏輯 ---

window.addEventListener('load', () => {
    loadCart();
    
    // 簡單的 CSV 解析
    function parseCSV(text, reqHeaders) {
        const lines = text.split(/\r?\n/);
        if (lines.length < 2) return [];
        const headers = lines[0].split(',').map(h => h.trim().replace(/[\uFEFF"']/g, ''));
        
        // 檢查必要欄位
        if(reqHeaders && !reqHeaders.every(h => headers.includes(h))) {
            console.error("CSV 欄位缺失:", headers);
            return [];
        }
        
        const map = {};
        headers.forEach((h, i) => map[h] = i);
        
        const data = [];
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            const row = lines[i].split(',');
            const obj = {};
            for (const key in map) obj[key] = row[map[key]] ? row[map[key]].trim() : '';
            data.push(obj);
        }
        return data;
    }

    function fetchCSV(url) {
        if(!url || !url.startsWith('http')) return Promise.reject('Invalid URL');
        return fetch(url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now())
            .then(res => res.ok ? res.text() : Promise.reject(res.status));
    }

    // 渲染品牌狀態總覽
    function renderStatusOverview(brands) {
        const container = document.getElementById('status-grid-container');
        const loader = document.getElementById('status-loader');
        if(loader) loader.style.display = 'none';
        if(!container) return;
        
        container.innerHTML = brands.map(b => {
            const isOk = b.status === 'available';
            return `
                <a href="#${b.key}" class="block bg-white p-4 rounded-lg shadow hover:shadow-md transition border border-gray-100 flex justify-between items-center">
                    <span class="font-bold text-gray-700">${b.name}</span>
                    <span class="text-xs px-2 py-1 rounded-full ${isOk ? 'bg-brandGreen text-white' : 'bg-gray-200 text-gray-500'}">
                        ${isOk ? '可訂購' : '缺貨中'}
                    </span>
                </a>
            `;
        }).join('');
    }

    // 渲染品牌區塊與商品
    async function renderProducts(brands) {
        const container = document.getElementById('product-list-container');
        if(!container) return;
        container.innerHTML = '';

        for (const brand of brands) {
            // 建立品牌區塊骨架
            const section = document.createElement('section');
            section.id = brand.key;
            section.className = "container mx-auto px-4 max-w-6xl scroll-mt-24";
            section.innerHTML = `
                <h2 class="text-2xl font-bold text-center mb-8 text-gray-800 border-b pb-4">${brand.name}</h2>
                <div id="${brand.key}-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 min-h-[100px]">
                    <div class="col-span-full text-center text-gray-400 text-sm py-10">載入中...</div>
                </div>
            `;
            container.appendChild(section);

            // 抓取該品牌商品
            if (brand.product_csv_url) {
                fetchCSV(brand.product_csv_url).then(text => {
                    // ★ [重要] 這裡定義我們要抓的欄位
                    const products = parseCSV(text, ['product_name', 'price']); 
                    const grid = document.getElementById(`${brand.key}-grid`);
                    if(grid) {
                        if(products.length === 0) {
                            grid.innerHTML = '<div class="col-span-full text-center text-gray-400">目前無商品</div>';
                        } else {
                            grid.innerHTML = products.map(p => createProductCard(p)).join('');
                        }
                    }
                }).catch(err => {
                    console.error(brand.name, err);
                    const grid = document.getElementById(`${brand.key}-grid`);
                    if(grid) grid.innerHTML = '<div class="col-span-full text-center text-red-400">載入失敗</div>';
                });
            }
        }
    }

    // 建立單一商品卡片 HTML
    function createProductCard(p) {
        // 處理隱藏
        if (p.hidden === 'TRUE' || p.status === 'hidden') return '';

        const isAvailable = p.status === 'available';
        const price = parseInt(p.price) || 0;
        const priceMulti = parseInt(p.price_multi) || 0;
        const imgUrl = (p.image_url && p.image_url.trim()) ? p.image_url : '';
        
        // 處理圖片路徑 (如果是相對路徑，加上 baseurl)
        let finalImg = '';
        if (imgUrl) {
            finalImg = imgUrl.startsWith('http') ? imgUrl : `/keicha${imgUrl.startsWith('/')?'':'/'}${imgUrl}`;
        }

        // 按鈕狀態
        const btnHtml = isAvailable 
            ? `<button onclick="addToCart('${p.product_name}', ${price}, ${priceMulti}, '${p.max_limit}')" class="w-full bg-brandGreen text-white font-bold py-2 rounded hover:opacity-90 transition flex justify-center items-center gap-1">
                <span>+</span> 加入清單
               </button>`
            : `<button disabled class="w-full bg-gray-200 text-gray-400 font-bold py-2 rounded cursor-not-allowed">缺貨中</button>`;

        // 價格顯示
        let priceHtml = `<span class="text-lg font-bold text-brandGreen">$${price}</span>`;
        if (priceMulti > 0 && priceMulti < price) {
            priceHtml = `
                <div class="flex flex-col items-start">
                    <span class="text-xs text-gray-400 line-through">$${price}</span>
                    <span class="text-lg font-bold text-brandGreen">2件起 $${priceMulti}</span>
                </div>
            `;
        }

        // 圖片區塊 (無圖則只顯示文字)
        const imgHtml = finalImg 
            ? `<div class="product-img-box"><img src="${finalImg}" loading="lazy" alt="${p.product_name}"></div>`
            : `<div class="h-4 bg-brandGreen/10"></div>`; // 裝飾條

        // 備註 (availability_note)
        const noteHtml = p.availability_note 
            ? `<div class="text-xs font-bold text-orange-500 mb-1">${p.availability_note}</div>` 
            : '';

        return `
            <div class="product-card bg-white rounded-lg shadow overflow-hidden flex flex-col ${!isAvailable ? 'opacity-60 grayscale' : ''}">
                ${imgHtml}
                <div class="p-4 flex flex-col flex-grow">
                    ${noteHtml}
                    <h3 class="font-bold text-gray-800 mb-2 text-lg leading-tight">${p.product_name}</h3>
                    
                    <!-- 規格列表 -->
                    ${p.specs ? `<ul class="text-xs text-gray-500 mb-3 space-y-1 list-disc list-inside">${p.specs.split('|').map(s=>`<li>${s}</li>`).join('')}</ul>` : ''}
                    
                    <div class="mt-auto pt-3 border-t border-gray-100">
                        <div class="flex justify-between items-end mb-3">
                            ${priceHtml}
                        </div>
                        ${btnHtml}
                    </div>
                </div>
            </div>
        `;
    }

    // --- 啟動 ---
    fetchCSV(MASTER_SHEET_URL)
        .then(text => {
            const brands = parseCSV(text, ['key', 'name', 'product_csv_url']);
            renderStatusOverview(brands);
            renderProducts(brands);
        })
        .catch(err => {
            console.error('總表載入失敗', err);
            document.getElementById('status-error').textContent = '系統維護中，暫時無法載入資料';
            document.getElementById('status-error').classList.remove('hidden');
        });

});
