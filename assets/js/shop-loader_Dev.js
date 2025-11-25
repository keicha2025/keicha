/**
 * KEICHA 7-11 賣貨便小幫手 - 全自動載入引擎 (Dev)
 * 功能：讀取 GSheet (總表+分頁)、購物車計算、產生賣貨便字串
 * 修正：購物車改為抽屜式 (Drawer)
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
        // 清空時自動關閉抽屜
        const drawer = document.getElementById('cart-drawer');
        if (drawer) drawer.classList.remove('open');
        updateToggleIcon(false);
    }
}

// ★ [核心] 更新 UI 與 字串產生器
function updateCartUI() {
    const bar = document.getElementById('myship-bar');
    const totalQty = cart.reduce((acc, item) => acc + item.qty, 0);
    
    // 計算總金額 (考慮 price_multi 兩罐優惠)
    // 1. 統計各品牌件數
    const brandCounts = {};
    cart.forEach(item => {
        const brand = item.brand || 'other';
        brandCounts[brand] = (brandCounts[brand] || 0) + item.qty;
    });

    let grandTotal = 0;
    cart.forEach(item => {
        const itemBrand = item.brand || 'other';
        const isDiscountApplied = (brandCounts[itemBrand] >= 2 && item.price_multi > 0);
        const unitPrice = isDiscountApplied ? item.price_multi : item.price;
        grandTotal += unitPrice * item.qty;
        
        item.finalPrice = unitPrice; 
        item.isDiscounted = isDiscountApplied;
    });

    // 顯示/隱藏底部工具列
    if (bar) {
        if (totalQty > 0) bar.classList.add('show');
        else {
            bar.classList.remove('show');
            // 沒商品時也關閉抽屜
            const drawer = document.getElementById('cart-drawer');
            if (drawer) drawer.classList.remove('open');
            updateToggleIcon(false);
        }
    }

    // 更新數量顯示
    const qtyEl = document.getElementById('bar-total-qty');
    if(qtyEl) qtyEl.textContent = totalQty;

    // 賣貨便品名產生邏輯
    let nameStrParts = cart.map(item => {
        return item.qty > 1 ? `${item.name} (x${item.qty})` : item.name;
    });
    
    let finalNameStr = nameStrParts.join(' / ');
    
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
        const unitPrice = item.finalPrice || item.price; 
        const isDiscounted = item.isDiscounted; 
        
        return `
            <div class="flex justify-between items-center bg-gray-50 p-3 rounded">
                <div class="flex-grow pr-2">
                    <div class="font-bold text-gray-800">${item.name}</div>
                    <div class="text-xs text-gray-500 flex gap-2 items-center">
                        ${isDiscounted 
                            ? `<span class="text-brandGreen font-bold">優惠價 $${unitPrice}</span>` 
                            : `單價 $${unitPrice}`
                        }
                        <span>x ${item.qty}</span>
                        ${item.brand ? `<span class="text-gray-300">| ${item.brand}</span>` : ''}
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

// ★ [UPDATED] 切換抽屜開關
window.toggleCartModal = function() {
    window.toggleCartDetail(); // Alias for backward compatibility if needed
}

window.toggleCartDetail = function() {
    const drawer = document.getElementById('cart-drawer');
    if (drawer) {
        drawer.classList.toggle('open');
        const isOpen = drawer.classList.contains('open');
        updateToggleIcon(isOpen);
    }
};

function updateToggleIcon(isOpen) {
    const icon = document.getElementById('toggle-icon');
    const btnText = document.querySelector('#toggle-cart-btn span');
    if (icon) {
        icon.style.transform = isOpen ? 'rotate(180deg)' : 'rotate(0deg)';
    }
    if (btnText) {
        btnText.textContent = isOpen ? '隱藏明細' : '查看明細';
    }
}

window.addToCart = function(name, price, priceMulti, maxLimit, brand) {
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
            max_limit: limit,
            brand: brand || '' 
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
        
        if(reqHeaders && !reqHeaders.every(h => headers.includes(h))) {
            console.error("CSV 欄位缺失:", headers, "需要:", reqHeaders);
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

    function renderStatusOverview(brands) {
        const container = document.getElementById('status-grid-container');
        const loader = document.getElementById('status-loader');
        if(loader) loader.style.display = 'none';
        if(!container) return;
        
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
                    const requiredColumns = [
                        'product_name', 'price', 'price_multi', 'status', 
                        'hidden', 'max_limit', 'availability_note', 'subcategory'
                    ];

                    const products = parseCSV(text, requiredColumns); 
                    const grid = document.getElementById(`${brand.key}-grid`);
                    
                    const validProducts = products.filter(p => 
                        p.status !== 'hidden' && 
                        p.hidden !== 'TRUE'
                    );
                    
                    validProducts.forEach(p => p.brand_ref = brand.name);

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

    function createProductCard(p) {
        const isAvailable = p.status === 'available';
        const price = parseInt(p.price) || 0;
        const priceMulti = parseInt(p.price_multi) || 0;
        const imgUrl = (p.image_url && p.image_url.trim()) ? p.image_url : '';
        
        const productBrand = p.subcategory || 'other';
        
        let finalImg = '';
        if (imgUrl) {
            finalImg = imgUrl.startsWith('http') ? imgUrl : `/keicha${imgUrl.startsWith('/')?'':'/'}${imgUrl}`;
        }

        const btnHtml = isAvailable 
            ? `<button onclick="addToCart('${p.product_name.replace(/'/g, "\\'")}', ${price}, ${priceMulti}, '${p.max_limit}', '${p.brand_ref}')" class="w-full bg-brandGreen text-white font-bold py-2 rounded hover:opacity-90 transition flex justify-center items-center gap-1">
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

        const imgHtml = finalImg 
            ? `<div class="product-img-box"><img src="${finalImg}" loading="lazy" alt="${p.product_name}"></div>`
            : `<div class="h-4 bg-brandGreen/10"></div>`; 

        let noteHtml = '';
        if (p.availability_note) {
            const isStock = p.availability_note.includes('現貨');
            const noteColor = isStock ? 'text-brandGreen' : 'text-orange-500';
            noteHtml = `<div class="text-xs font-bold ${noteColor} mb-1">${p.availability_note}</div>`;
        }

        return `
            <div class="product-card bg-white rounded-lg shadow-sm hover:shadow-md overflow-hidden flex flex-col border border-gray-100 p-4">
                ${imgHtml}
                <div class="p-4 flex flex-col flex-grow">
                    ${noteHtml}
                    <h3 class="font-bold text-gray-800 mb-2 text-lg leading-tight">${p.product_name}</h3>
                    
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

    fetchCSV(MASTER_SHEET_URL)
        .then(text => {
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
