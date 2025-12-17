/**
 * KEICHA SHOP CORE - 模組化結構化版本
 * ---------------------------------------
 * [Index]
 * 1. CONFIG & STATE: 核心設定與全域狀態
 * 2. API SERVICE: GAS 後端通訊層
 * 3. UI RENDERING: 介面渲染與資料填入
 * 4. SHOPPING LOGIC: 購物車、運費計算、訂單送出
 * 5. PANEL CONTROL: 面板開關與交互
 */

// ========================================
// 1. CONFIG & STATE
// ========================================
const GAS_URL = "https://script.google.com/macros/s/AKfycbyUq36i64Z-JGcERE_rZOdphVtVDX8L-lguc7eiUIdoAERqI1ZK8GWAL-HgbC75cuMHFg/exec";
const siteBaseUrl = window.siteBaseUrl || ""; 

window.cart = [];
window.globalProducts = [];
window.shippingRules = [];
window.selectedMethod = ''; // '7-11', 'fami', 'addr'

// ========================================
// 2. API SERVICE (與 GAS 對接)
// ========================================
window.api = {
    // 商店初始化讀取
    initShop: async () => {
        try {
            const res = await fetch(GAS_URL);
            const data = await res.json();
            if (!data || !data.products) return;
            
            window.globalProducts = data.products;
            window.shippingRules = (data.shipping_rules || []).map(r => ({
                ...r, method: (r.method && r.method.toString().includes('2025-')) ? '7-11' : r.method
            }));

            // 會員自動同步
            const u = JSON.parse(localStorage.getItem('keicha_v2_user'));
            if (u?.phone) window.api.syncUser(u.phone);

            window.ui.renderProducts(window.globalProducts);
            document.getElementById('products-loader')?.classList.add('hidden');
            window.ui.refreshAuth();
        } catch (e) { console.error("API Init Error:", e); }
    },

    // 會員登入/同步
    syncUser: async (phone) => {
        try {
            const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'login', phone }) });
            const result = await res.json();
            if (result.success) {
                localStorage.setItem('keicha_v2_user', JSON.stringify(result.data));
                window.ui.refreshAuth();
                if (document.getElementById('user-panel')?.classList.contains('open')) window.ui.fillUserFields();
                if (document.getElementById('checkout-panel')?.classList.contains('open')) window.ui.fillCheckoutInfo();
            }
        } catch (e) {}
    },

    // 儲存會員資料
    saveUser: async (updatedData) => {
        try {
            const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(updatedData) });
            return await res.json();
        } catch (e) { return { success: false }; }
    }
};

// ========================================
// 3. UI RENDERING (介面展示)
// ========================================
window.ui = {
    // 商品列表渲染
    renderProducts: (prods) => {
        const container = document.getElementById('category-container');
        if (!container) return;
        const grouped = prods.reduce((acc, p) => {
            const cat = p.category || "精選";
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(p);
            return acc;
        }, {});
        container.innerHTML = Object.keys(grouped).map(cat => `
            <section>
                <h3 class="text-xl font-bold border-l-4 border-[#6ea44c] pl-3 mb-8 text-gray-800">${cat}</h3>
                <div class="product-grid">${grouped[cat].map(p => {
                    const stock = parseInt(p.stock) || 0;
                    let img = p.image_url || "";
                    if (img && !img.startsWith('http')) img = siteBaseUrl + (img.startsWith('/') ? img : '/' + img);
                    return window.ITEM_CARD_TEMPLATE(p, img, stock <= 0);
                }).join('')}</div>
            </section>`).join('');
    },

    // 填寫會員中心欄位
    fillUserFields: () => {
        const u = JSON.parse(localStorage.getItem('keicha_v2_user') || '{}');
        const fields = { 'display-user-phone': u.phone, 'text-name': u.name || '未填寫', 'display-711': u.store_711 ? `${u.store_711} ${u.store_711_note || ''}` : '尚未設定', 'display-fami': u.store_fami ? `${u.store_fami} ${u.store_fami_note || ''}` : '尚未設定', 'display-addr': u.shipping_address || '尚未設定' };
        Object.keys(fields).forEach(id => { if(document.getElementById(id)) document.getElementById(id).innerText = fields[id]; });
        const inputs = { 'upd-name': u.name, 'upd-email': u.email, 'upd-711': u.store_711, 'upd-711-note': u.store_711_note, 'upd-fami': u.store_fami, 'upd-fami-note': u.store_fami_note, 'upd-addr': u.shipping_address };
        Object.keys(inputs).forEach(id => { if(document.getElementById(id)) document.getElementById(id).value = inputs[id] || ''; });
    },

    // 填寫結帳區資訊
    fillCheckoutInfo: () => {
        const u = JSON.parse(localStorage.getItem('keicha_v2_user') || '{}');
        document.getElementById('checkout-info-name').innerText = u.name || '未填寫';
        document.getElementById('checkout-info-phone').innerText = u.phone || '-';
        document.getElementById('checkout-display-7-11').innerText = u.store_711 ? `${u.store_711} (${u.store_711_note || ''})` : '尚未設定';
        document.getElementById('checkout-display-fami').innerText = u.store_fami ? `${u.store_fami} (${u.store_fami_note || ''})` : '尚未設定';
        document.getElementById('checkout-display-addr').innerText = u.shipping_address || '尚未設定';
    },

    // 更新購物車摘要
    updateCartUI: () => {
        const count = window.cart.reduce((s, i) => s + i.qty, 0);
        const el = document.getElementById('cart-count');
        if (el) { el.innerText = count; el.classList.toggle('hidden', count === 0); }
        const container = document.getElementById('cart-items-container');
        if (!container) return;
        if (window.cart.length === 0) { container.innerHTML = `<p class="text-center py-10 text-gray-300">購物車空的</p>`; return; }
        container.innerHTML = window.cart.map((i, idx) => `
            <div class="flex justify-between items-center py-4 border-b">
                <div><div class="font-bold text-sm">${i.name}</div><div class="text-xs brand-green">NT$ ${i.price}</div></div>
                <div class="flex items-center gap-2">
                    <button onclick="window.shop.updateQty(${idx}, -1)" class="material-symbols-rounded text-gray-400">remove_circle</button>
                    <span class="text-xs font-bold">${i.qty}</span>
                    <button onclick="window.shop.updateQty(${idx}, 1)" class="material-symbols-rounded text-gray-400">add_circle</button>
                </div>
            </div>`).join('');
        const total = window.cart.reduce((s, i) => s + (i.price * i.qty), 0);
        document.getElementById('cart-total-price').innerText = `NT$ ${total.toLocaleString()}`;
    },

    refreshAuth: () => {
        const u = JSON.parse(localStorage.getItem('keicha_v2_user'));
        const zone = document.getElementById('top-auth-zone');
        if (!zone) return;
        zone.innerHTML = (u?.name || u?.phone) 
            ? `<button onclick="window.panel.openUser()" class="brand-green font-bold text-lg hover:opacity-70 transition">● ${u.name || u.phone}</button>`
            : `<button onclick="window.panel.openLogin()" class="bg-gray-100 text-gray-600 px-8 py-3 rounded-2xl text-sm font-bold">登入 / 註冊</button>`;
    }
};

// ========================================
// 4. SHOPPING LOGIC (核心業務)
// ========================================
window.shop = {
    // 加入購物車
    add: (pid) => {
        const p = window.globalProducts.find(x => x.product_id === pid);
        const qty = parseInt(document.getElementById(`iq-${pid}`).innerText);
        const inCart = window.cart.find(x => x.id === pid);
        if (inCart) inCart.qty += qty; 
        else window.cart.push({ id: pid, name: p.product_name, price: p.price, qty: qty, category: p.category });
        window.ui.updateCartUI(); 
        window.panel.openCart();
    },

    updateQty: (idx, d) => {
        window.cart[idx].qty += d;
        if(window.cart[idx].qty <= 0) window.cart.splice(idx, 1);
        window.ui.updateCartUI();
    },

    // 運費計算邏輯
    selectShip: (method) => {
        window.selectedMethod = method;
        document.querySelectorAll('.ship-opt-card').forEach(el => el.classList.remove('selected'));
        const targetId = (method === '7-11') ? 'opt-7-11' : `opt-${method}`;
        document.getElementById(targetId)?.classList.add('selected');
        
        const subtotal = window.cart.reduce((s, i) => s + (i.price * i.qty), 0);
        let shipping = 0;
        const nameMap = { '7-11': '7-11', 'fami': '全家', 'addr': '宅配' };
        const rule = window.shippingRules.find(r => r.method === nameMap[method] && r.category === (window.cart[0]?.category || ""));
        
        if (rule) {
            const t1 = parseFloat(rule.t1), f1 = parseFloat(rule.f1);
            const t2 = parseFloat(rule.t2), f2 = parseFloat(rule.f2);
            const t3 = parseFloat(rule.t3), f3 = parseFloat(rule.f3);
            if (subtotal < t1) shipping = f1; else if (subtotal < t2) shipping = f2; else if (subtotal < t3) shipping = f3; else shipping = 0;
        }
        document.getElementById('summary-subtotal').innerText = `NT$ ${subtotal.toLocaleString()}`;
        document.getElementById('summary-method').innerText = nameMap[method];
        document.getElementById('summary-shipping').innerText = `NT$ ${shipping.toLocaleString()}`;
        document.getElementById('summary-total').innerText = `NT$ ${(subtotal + shipping).toLocaleString()}`;
    },

    // 送出訂單 (11 欄位對齊)
    submit: async () => {
        const lineName = document.getElementById('order-line-name').value;
        if (!window.selectedMethod || !lineName) return alert("請選擇物流並填寫 LINE 名稱");
        
        const u = JSON.parse(localStorage.getItem('keicha_v2_user') || '{}');
        // 抓取 6 位純數字店號
        let pureStore = (window.selectedMethod === '7-11') ? u.store_711 : (window.selectedMethod === 'fami' ? u.store_fami : u.shipping_address);
        if (!pureStore) return alert("收件資訊不完整");

        const payload = {
            action: 'checkout',
            name: u.name, phone: u.phone,
            store: pureStore, // 第 3 欄 (C) 純數字
            temp: "常溫", 
            items: window.cart.map(i => `${i.name}x${i.qty}`).join(', '),
            subtotal: window.cart.reduce((s, i) => s + (i.price * i.qty), 0),
            shipping: document.getElementById('summary-shipping').innerText.replace('NT$ ', '').replace(/,/g, ''),
            date: new Date().toLocaleString('zh-TW'),
            note: document.getElementById('order-note').value,
            line_name: lineName,
            logistics: (window.selectedMethod === '7-11' ? '7-11' : (window.selectedMethod === 'fami' ? '全家' : '宅配')) // 第 11 欄 (K)
        };

        const btn = document.getElementById('btn-submit-order');
        btn.disabled = true; btn.innerHTML = "處理中...";
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(payload) });
        const result = await res.json();
        if (result.success) { alert("訂單已送出！"); window.cart = []; location.reload(); }
        else { alert("失敗：" + result.msg); btn.disabled = false; btn.innerHTML = "確認送出訂單"; }
    }
};

// ========================================
// 5. PANEL CONTROL (面板控制)
// ========================================
window.panel = {
    openLogin: () => { document.getElementById('login-panel').classList.add('open'); document.getElementById('global-overlay').classList.add('open'); },
    openCart: () => { window.ui.updateCartUI(); document.getElementById('cart-sidebar').classList.add('open'); document.getElementById('global-overlay').classList.add('open'); },
    openUser: () => { window.ui.fillUserFields(); document.getElementById('user-panel').classList.add('open'); document.getElementById('global-overlay').classList.add('open'); },
    closeAll: () => document.querySelectorAll('.side-panel, .overlay').forEach(p => p.classList.remove('open')),
    
    // 修復編輯按鈕：切換面板
    editFromCheckout: () => {
        document.getElementById('checkout-panel').classList.remove('open');
        setTimeout(() => window.panel.openUser(), 100);
    }
};

// --- 全域掛載 (供 HTML onclick 呼叫) ---
window.initShop = window.api.initShop;
window.addToCart = window.shop.add;
window.openCart = window.panel.openCart;
window.openUserPanel = window.panel.openUser;
window.openCheckout = () => { 
    if(window.cart.length === 0) return alert("購物車空的");
    window.panel.closeAll(); 
    window.ui.fillCheckoutInfo();
    setTimeout(() => { document.getElementById('checkout-panel').classList.add('open'); document.getElementById('global-overlay').classList.add('open'); }, 150);
};
window.selectShipMethod = window.shop.selectShip;
window.submitOrder = window.shop.submit;
window.editFromCheckout = window.panel.editFromCheckout;
window.closeAllPanels = window.panel.closeAll;

// 會員存檔邏輯 (獨立處理)
window.saveFullUser = async (section) => {
    const u = JSON.parse(localStorage.getItem('keicha_v2_user') || '{}');
    const updated = { 
        ...u, action: 'save', 
        name: document.getElementById('upd-name').value, 
        store_711: document.getElementById('upd-711').value, 
        store_711_note: document.getElementById('upd-711-note').value,
        store_fami: document.getElementById('upd-fami').value, 
        store_fami_note: document.getElementById('upd-fami-note').value,
        shipping_address: document.getElementById('upd-addr').value 
    };
    const res = await window.api.saveUser(updated);
    if(result.success) { localStorage.setItem('keicha_v2_user', JSON.stringify(updated)); window.ui.fillUserFields(); alert("儲存成功"); }
};

window.onload = window.api.initShop;
