/**
 * KEICHA SHOP CORE - 全域掛載修復版
 * 解決 ReferenceError 與 TypeError 問題
 */

// ========================================
// 1. 全域變數與設定
// ========================================
const GAS_URL = "https://script.google.com/macros/s/AKfycbyUq36i64Z-JGcERE_rZOdphVtVDX8L-lguc7eiUIdoAERqI1ZK8GWAL-HgbC75cuMHFg/exec";
const siteBaseUrl = window.siteBaseUrl || "";

// 初始化全域狀態
window.cart = [];
window.globalProducts = [];
window.shippingRules = [];
window.selectedMethod = '';

// ========================================
// 2. 核心互動函式 (直接掛載 window，解決 HTML 找不到的問題)
// ========================================

/**
 * 加入購物車
 */
window.addToCart = function(pid) {
    const p = window.globalProducts.find(x => x.product_id === pid);
    if (!p) return console.error("找不到商品:", pid);

    // 嘗試抓取數量，若無則預設 1
    const qtyEl = document.getElementById(`iq-${pid}`);
    const qty = qtyEl ? parseInt(qtyEl.innerText) : 1;

    // 檢查庫存
    const stock = parseInt(p.stock) || 0;
    const inCart = window.cart.find(x => x.id === pid);
    const currentQty = inCart ? inCart.qty : 0;

    if ((currentQty + qty) > stock) {
        return alert(`庫存不足！僅剩 ${stock} 件`);
    }

    // 處理圖片路徑
    let img = p.image_url || "";
    if (img && !img.startsWith('http')) img = siteBaseUrl + (img.startsWith('/') ? img : '/' + img);

    if (inCart) {
        inCart.qty += qty;
    } else {
        window.cart.push({
            id: pid,
            name: p.product_name,
            price: p.price,
            qty: qty,
            img: img,
            category: p.category
        });
    }

    window.updateCartUI();
    window.openCart(); // 自動打開購物車
};

/**
 * 調整商品數量 (卡片上)
 */
window.adjQty = function(pid, delta) {
    const el = document.getElementById(`iq-${pid}`);
    if (!el) return;
    let v = parseInt(el.innerText) + delta;
    if (v < 1) v = 1;
    el.innerText = v;
};

/**
 * 更新購物車內數量
 */
window.updateCartQty = function(idx, delta) {
    window.cart[idx].qty += delta;
    if (window.cart[idx].qty <= 0) {
        window.cart.splice(idx, 1);
    }
    window.updateCartUI();
};

/**
 * 移除購物車項目
 */
window.removeFromCart = function(idx) {
    window.cart.splice(idx, 1);
    window.updateCartUI();
};

/**
 * 打開購物車面板
 */
window.openCart = function() {
    window.updateCartUI();
    document.getElementById('cart-sidebar')?.classList.add('open');
    document.getElementById('global-overlay')?.classList.add('open');
};

/**
 * 關閉所有面板
 */
window.closeAllPanels = function() {
    document.querySelectorAll('.side-panel, .overlay').forEach(p => p.classList.remove('open'));
};

// ========================================
// 3. 會員與編輯功能 (補齊 toggleEdit 與 saveFullUser)
// ========================================

/**
 * 切換編輯模式
 * @param {string} type - 'info', '711', 'fami', 'addr'
 */
window.toggleEdit = function(type) {
    if (type === 'info') {
        const els = ['upd-name', 'upd-email', 'text-name', 'text-email', 'info-edit-actions'];
        els.forEach(id => document.getElementById(id)?.classList.toggle('hidden'));
    } else {
        // 物流區塊切換
        document.getElementById(`display-${type}`)?.classList.toggle('hidden');
        document.getElementById(`edit-${type}`)?.classList.toggle('hidden');
        
        // 切換查詢按鈕顯示
        const qBtn = document.getElementById(`btn-${type}-query`);
        if (qBtn) {
            // 如果編輯框顯示中，就顯示查詢按鈕
            const isEditing = !document.getElementById(`edit-${type}`).classList.contains('hidden');
            qBtn.style.display = isEditing ? 'block' : 'none';
        }
    }
};

/**
 * 儲存會員資料 (含動畫與驗證)
 */
window.saveFullUser = async function(section) {
    const btn = document.getElementById(`save-btn-${section}`);
    let oldHtml = "";

    // 1. 驗證店號格式
    const storeReg = /^\d{6}$/;
    if (section === '711' && !storeReg.test(document.getElementById('upd-711').value)) {
        return alert("請輸入 6 位數字 7-11 店舖號");
    }
    if (section === 'fami' && !storeReg.test(document.getElementById('upd-fami').value)) {
        return alert("請輸入 6 位數字全家店舖號");
    }

    // 2. 按鈕載入動畫
    if (btn) {
        oldHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<span class="material-symbols-rounded text-sm animate-spin-custom">sync</span>儲存中`;
    }

    // 3. 準備資料
    const u = JSON.parse(localStorage.getItem('keicha_v2_user') || '{}');
    const updated = {
        ...u,
        action: 'save',
        name: document.getElementById('upd-name').value,
        email: document.getElementById('upd-email').value,
        store_711: document.getElementById('upd-711').value,
        store_711_note: document.getElementById('upd-711-note').value,
        store_fami: document.getElementById('upd-fami').value,
        store_fami_note: document.getElementById('upd-fami-note').value,
        shipping_address: document.getElementById('upd-addr').value
    };

    // 4. 發送請求
    try {
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(updated) });
        const result = await res.json();
        
        if (result.success) {
            localStorage.setItem('keicha_v2_user', JSON.stringify(updated));
            window.renderUserFields(); // 刷新介面
            
            if (btn) btn.innerHTML = `<span class="material-symbols-rounded text-sm">check_circle</span>完成`;
            
            // 延遲後自動收合
            setTimeout(() => {
                window.toggleEdit(section);
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = oldHtml; // 恢復按鈕文字
                }
            }, 800);
        } else {
            throw new Error(result.msg);
        }
    } catch (e) {
        alert("儲存失敗: " + e.message);
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = oldHtml;
        }
    }
};

// ========================================
// 4. 介面渲染與初始化
// ========================================

window.updateCartUI = function() {
    const count = window.cart.reduce((s, i) => s + i.qty, 0);
    const countEl = document.getElementById('cart-count');
    if (countEl) {
        countEl.innerText = count;
        countEl.classList.toggle('hidden', count === 0);
    }

    const container = document.getElementById('cart-items-container');
    if (!container) return;

    if (window.cart.length === 0) {
        container.innerHTML = `<div class="text-center py-20 text-gray-300 font-bold"><p>購物車是空的</p></div>`;
        document.getElementById('cart-total-price').innerText = "NT$ 0";
        return;
    }

    let total = 0;
    container.innerHTML = window.cart.map((i, idx) => {
        total += i.price * i.qty;
        return `
        <div class="flex items-center gap-4 border-b border-gray-50 pb-4">
            <div class="flex-1 min-w-0">
                <div class="text-sm font-bold text-gray-800 truncate">${i.name}</div>
                <div class="text-xs brand-green mt-1">NT$ ${i.price.toLocaleString()}</div>
            </div>
            <div class="flex items-center gap-2">
                <div class="qty-control scale-75 origin-right">
                    <button class="qty-btn" onclick="window.updateCartQty(${idx}, -1)">-</button>
                    <span class="text-xs font-bold w-4 text-center">${i.qty}</span>
                    <button class="qty-btn" onclick="window.updateCartQty(${idx}, 1)">+</button>
                </div>
                <button onclick="window.removeFromCart(${idx})" class="material-symbols-rounded text-gray-300 hover:text-red-500 transition p-1">close</button>
            </div>
        </div>`;
    }).join('');
    document.getElementById('cart-total-price').innerText = "NT$ " + total.toLocaleString();
};

window.renderUserFields = function() {
    const u = JSON.parse(localStorage.getItem('keicha_v2_user') || '{}');
    if (!u.phone) return;

    // 顯示區
    if (document.getElementById('display-user-phone')) document.getElementById('display-user-phone').innerText = u.phone;
    if (document.getElementById('text-name')) document.getElementById('text-name').innerText = u.name || '未填寫';
    if (document.getElementById('text-email')) document.getElementById('text-email').innerText = u.email || '未填寫';
    
    // 物流區 (店號 + 備註)
    const store711 = u.store_711 ? `${u.store_711} (${u.store_711_note || '無備註'})` : '尚未設定';
    const storeFami = u.store_fami ? `${u.store_fami} (${u.store_fami_note || '無備註'})` : '尚未設定';
    
    if (document.getElementById('display-711')) document.getElementById('display-711').innerText = store711;
    if (document.getElementById('display-fami')) document.getElementById('display-fami').innerText = storeFami;
    if (document.getElementById('display-addr')) document.getElementById('display-addr').innerText = u.shipping_address || '尚未設定';

    // 編輯區 (填入 Input)
    const inputs = {
        'upd-name': u.name, 'upd-email': u.email,
        'upd-711': u.store_711, 'upd-711-note': u.store_711_note,
        'upd-fami': u.store_fami, 'upd-fami-note': u.store_fami_note,
        'upd-addr': u.shipping_address
    };
    Object.keys(inputs).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = inputs[id] || '';
    });
};

window.initShop = async function() {
    try {
        const res = await fetch(GAS_URL);
        const data = await res.json();
        if (!data) return;
        window.globalProducts = data.products || [];
        
        // 渲染商品
        const container = document.getElementById('category-container');
        if (container) {
            const grouped = window.globalProducts.reduce((acc, p) => {
                const cat = p.category || "精選";
                if (!acc[cat]) acc[cat] = [];
                acc[cat].push(p);
                return acc;
            }, {});
            
            container.innerHTML = Object.keys(grouped).map(cat => `
                <section>
                    <h3 class="text-xl font-bold border-l-4 border-[#6ea44c] pl-3 mb-8 text-gray-800">${cat}</h3>
                    <div class="product-grid">
                        ${grouped[cat].map(p => {
                            const stock = parseInt(p.stock) || 0;
                            const isSoldOut = stock <= 0;
                            let img = p.image_url || "";
                            if (img && !img.startsWith('http')) img = siteBaseUrl + (img.startsWith('/') ? img : '/' + img);
                            // 呼叫 shop.html 定義的模板
                            return window.ITEM_CARD_TEMPLATE(p, img, isSoldOut);
                        }).join('')}
                    </div>
                </section>`).join('');
        }
        
        document.getElementById('products-loader')?.classList.add('hidden');
        
        // 同步登入狀態
        const u = JSON.parse(localStorage.getItem('keicha_v2_user'));
        const zone = document.getElementById('top-auth-zone');
        if (zone) {
            zone.innerHTML = (u?.name || u?.phone) 
                ? `<button onclick="window.openUserPanel()" class="flex items-center gap-2 brand-green font-bold text-lg hover:opacity-70 transition"><span class="material-symbols-rounded">account_circle</span> ${u.name || u.phone}</button>`
                : `<button onclick="window.openLoginPanel()" class="bg-gray-100 text-gray-600 px-8 py-3 rounded-2xl text-sm font-bold hover:bg-gray-200 transition">登入 / 註冊</button>`;
        }

    } catch (e) { console.error("Init Error:", e); }
};

// 確保面板函式全域可用
window.openLoginPanel = () => { document.getElementById('login-panel').classList.add('open'); document.getElementById('global-overlay').classList.add('open'); };
window.openUserPanel = () => { window.renderUserFields(); document.getElementById('user-panel').classList.add('open'); document.getElementById('global-overlay').classList.add('open'); };

// 啟動
window.onload = window.initShop;
