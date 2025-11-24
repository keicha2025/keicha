/**
 * KEICHA 7-11 賣貨便小幫手 - 全自動載入引擎 (Dev)
 * 功能：讀取 GSheet (總表+分頁)、購物車計算、產生賣貨便字串
 * 修正：配合抹茶代購頁面的特定欄位 (7欄)
 */

// --- 全域變數與設定 ---
let cart = []; // 購物車內容

// ★ 後台設定：您的總表網址 (CSV)
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
    let nameStrParts = cart.map(item => {
        return item.qty > 1 ? `${item.name} (x${item.qty})` : item.name;
    });
    
    let finalNameStr = nameStrParts.join(' / ');
    
    // 長度防呆
    if (cart.length > 3 || totalQty > 3) {
        finalNameStr = `(共${totalQty}件) ${finalNameStr}`;
    }

    const nameInput = document.getElementById('gen-name-input');
    if(nameInput) nameInput.value = finalNameStr;

    const priceInput = document.getElementById('gen-price-input');
    if(priceInput) priceInput.value = grandTotal;

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
    
    // 簡單的 CSV 解析 (含 Regex 處理逗號)
    function parseCSV(text, reqHeaders) {
        const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
        if (lines.length < 2) return [];
        
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').replace(/^\ufeff/, ''));
        
        // 檢查必要欄位
        if(reqHeaders && !reqHeaders.every(h => headers.includes(h))) {
            console.error("CSV 欄位缺失:", headers, "需要:", reqHeaders);
            // 如果缺失，回傳空陣列，避免當機，並在 Console 報錯
            return [];
        }
        
        const map = {};
        headers.forEach((h, i) => map[h] = i);
        
        const data = [];
        const regex = /("((?:[^"]|"")*)"|[^,]*)(,|$)/g;

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const row = [];
            let match;
            regex.lastIndex = 0;
            while ((match = regex.exec(line)) !== null) {
                if (match.index === regex.lastIndex) { regex.lastIndex++; }
                if (match[0] === '' && row.length >= headers.length) break;
                let val = match[1];
                if (val.startsWith('"') && val.endsWith('"')) {
                    val = val.slice(1, -1).replace(/""/g, '"');
                }
                row.push(val);
                if (match[2] === '') break;
            }

            const obj = {};
            for (const key in map) {
                const index = map[key];
                let val = (index < row.length) ? row[index].trim() : '';
                // 處理金額逗號
                if (key === 'price' || key === 'price_multi') {
                     val = val.replace(/,/g, '');
                }
                obj[key] = val;
            }
            if (Object.keys(obj).length > 0) data.push(obj);
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
        
        // 過濾：只顯示 available
        const activeBrands = brands.filter(b => b.status === 'available');

        if (activeBrands.length === 0) {
            container.innerHTML = '<p class="col-span-full text-center text-gray-500">目前暫無可訂購品牌</p>';
            return;
        }
        
        container.innerHTML = activeBrands.map(b => {
            return `
                <a href="#${b.key}" class="block bg-white p-4 rounded-lg shadow hover:shadow-md transition border border-gray-100 flex justify-between items-center">
                    <span class="font-bold text-gray-700">${b.name}</span>
                    <span class="text-xs px-2 py-1 rounded-full bg-brandGreen text-white">
                        可訂購
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

        const activeBrands = brands.filter(b => b.status === 'available');

        for (const brand of activeBrands) {
            const section = document.createElement('section');
            section.id = brand.key;
            section.className = "container mx-auto px-4 max-w-6xl scroll-mt-24 hidden";
            section.innerHTML = `
                <h2 class="text-2xl font-bold text-center mb-8 text-gray-800 border-b pb-4">${brand.name}</h2>
                <div id="${brand.key}-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 min-h-[100px]">
                    <div class="col-span-full text-center text-gray-400 text-sm py-10">載入中...</div>
                </div>
            `;
            container.appendChild(section);

            if (brand.product_csv_url) {
                fetchCSV(brand.product_csv_url).then(text => {
                    
                    // ★ [UPDATED] 這裡改為您指定的 7 個欄位
                    const requiredColumns = [
                        'product_name', 'price', 'price_multi', 'status', 
                        'hidden', 'max_limit', 'availability_note'
                    ];

                    const products = parseCSV(text, requiredColumns); 
                    const grid = document.getElementById(`${brand.key}-grid`);
                    
                    // 過濾有效商品 (status 不為 hidden 且 hidden 欄位不為 TRUE)
                    const validProducts = products.filter(p => 
                        p.status !== 'hidden' && 
                        p.hidden !== 'TRUE'
                    );

                    if(grid && validProducts.length > 0) {
                        section.classList.remove('hidden');
                        grid.innerHTML = validProducts.map(p => createProductCard(p)).join('');
                    } else {
                        section.remove();
                    }
                }).catch(err => {
                    console.error(brand.name, err);
                    section.remove();
                });
            }
        }
    }

    // 建立單一商品卡片 HTML (★ 純白卡片)
    function createProductCard(p) {
        const isAvailable = p.status === 'available';
        const price = parseInt(p.price) || 0;
        const priceMulti = parseInt(p.price_multi) || 0;
        
        // 您現在沒有 image_url 欄位，所以不處理圖片
        // let imgUrl = ...; 

        const btnHtml = isAvailable 
            ? `<button onclick="addToCart('${p.product_name.replace(/'/g, "\\'")}', ${price}, ${priceMulti}, '${p.max_limit}')" class="w-full bg-brandGreen text-white font-bold py-2 rounded hover:opacity-90 transition flex justify-center items-center gap-1">
                <span>+</span> 加入清單
               </button>`
            : '';

        let priceHtml = `<span class="text-lg font-bold text-brandGreen">$${price.toLocaleString()}</span>`;
        if (priceMulti > 0 && priceMulti < price) {
            priceHtml = `
                <div class="flex flex-col items-start">
                    <span class="text-xs text-gray-400 line-through">$${price.toLocaleString()}</span>
                    <span class="text-lg font-bold text-brandGreen">2件起 $${priceMulti.toLocaleString()}</span>
                </div>
            `;
        }

        // 備註 (現貨=綠色)
        let noteHtml = '';
        if (p.availability_note) {
            const isStock = p.availability_note.includes('現貨');
            const noteColor = isStock ? 'text-brandGreen' : 'text-orange-500';
            noteHtml = `<div class="text-xs font-bold ${noteColor} mb-1">${p.availability_note}</div>`;
        }

        return `
            <div class="product-card bg-white rounded-lg shadow-sm hover:shadow-md overflow-hidden flex flex-col border border-gray-100 p-4">
                <!-- 因為沒有圖片，直接顯示內容 -->
                <div class="flex flex-col flex-grow">
                    ${noteHtml}
                    <h3 class="font-bold text-gray-800 mb-2 text-lg leading-tight">${p.product_name}</h3>
                    
                    <!-- 因為沒有 specs 欄位，移除 specs 顯示 -->
                    
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
            // 總表有 4 個欄位
            const brands = parseCSV(text, ['key', 'name', 'status', 'product_csv_url']);
            renderStatusOverview(brands);
            renderProducts(brands);
        })
        .catch(err => {
            console.error('總表載入失敗', err);
            document.getElementById('status-error').textContent = '系統維護中，暫時無法載入資料';
            document.getElementById('status-error').classList.remove('hidden');
        });

});
