/**
 * KEICHA SHOP CORE - 最終防錯宣告版
 */

// --- A. 全域函式搶先宣告 (防止 HTML 報錯) ---
window.editFromCheckout = function() {
    console.log("觸發結帳區編輯...");
    if(document.getElementById('checkout-panel')) {
        document.getElementById('checkout-panel').classList.remove('open');
    }
    setTimeout(() => { window.openUserPanel(); }, 50);
};

window.openUserPanel = function() {
    window.ui?.fillUserFields();
    const u = JSON.parse(localStorage.getItem('keicha_v2_user') || '{}');
    if(u.phone) window.api?.syncUser(u.phone);
    document.getElementById('user-panel')?.classList.add('open');
    document.getElementById('global-overlay')?.classList.add('open');
};

window.selectShipMethod = function(method) { window.shop?.selectShip(method); };
window.submitOrder = function() { window.shop?.submit(); };
window.closeAllPanels = function() { document.querySelectorAll('.side-panel, .overlay').forEach(p => p.classList.remove('open')); };

// --- B. 配置與狀態 ---
const GAS_URL = "https://script.google.com/macros/s/AKfycbyUq36i64Z-JGcERE_rZOdphVtVDX8L-lguc7eiUIdoAERqI1ZK8GWAL-HgbC75cuMHFg/exec";
const siteBaseUrl = window.siteBaseUrl || ""; 
window.cart = [];
window.globalProducts = [];
window.shippingRules = [];
window.selectedMethod = '';

// --- C. 模組化邏輯 ---
window.api = {
    init: async () => {
        try {
            const res = await fetch(GAS_URL);
            const data = await res.json();
            window.globalProducts = data.products || [];
            window.shippingRules = (data.shipping_rules || []).map(r => ({
                ...r, method: (r.method && r.method.toString().includes('2025-')) ? '7-11' : r.method
            }));
            const localUser = JSON.parse(localStorage.getItem('keicha_v2_user'));
            if (localUser?.phone) window.api.syncUser(localUser.phone);
            window.ui.renderProducts(window.globalProducts);
            document.getElementById('products-loader')?.classList.add('hidden');
            window.ui.refreshAuth();
        } catch (e) { console.error("Init Error", e); }
    },
    syncUser: async (phone) => {
        try {
            const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'login', phone }) });
            const result = await res.json();
            if (result.success) {
                localStorage.setItem('keicha_v2_user', JSON.stringify(result.data));
                window.ui.refreshAuth();
                window.ui.fillUserFields();
                if (document.getElementById('checkout-panel')?.classList.contains('open')) window.ui.fillCheckoutInfo();
            }
        } catch (e) {}
    },
    submitOrder: async (payload) => {
        const btn = document.getElementById('btn-submit-order');
        btn.disabled = true;
        btn.innerHTML = `<span class="material-symbols-rounded animate-spin-custom">sync</span> 發送中...`;
        try {
            const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(payload) });
            const result = await res.json();
            if (result.success) {
                alert("訂單已送出！");
                window.cart = [];
                window.ui.updateCart();
                window.closeAllPanels();
                location.reload();
            }
        } catch (e) { alert("連線異常"); }
        finally { btn.disabled = false; btn.innerHTML = "確認送出訂單"; }
    }
};

window.ui = {
    renderProducts: (prods) => {
        const container = document.getElementById('category-container');
        if (!container) return;
        const grouped = prods.reduce((acc, p) => {
            const cat = p.category || "精選選物";
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
    refreshAuth: () => {
        const u = JSON.parse(localStorage.getItem('keicha_v2_user'));
        const zone = document.getElementById('top-auth-zone');
        if (zone) {
            zone.innerHTML = (u?.name || u?.phone) 
                ? `<button onclick="window.openUserPanel()" class="flex items-center gap-2 brand-green font-bold text-lg hover:opacity-70 transition"><span class="material-symbols-rounded">account_circle</span> ${u.name || u.phone}</button>`
                : `<button onclick="document.getElementById('login-panel').classList.add('open'); document.getElementById('global-overlay').classList.add('open');" class="bg-gray-100 text-gray-600 px-8 py-3 rounded-2xl text-sm font-bold hover:bg-gray-200 transition">登入 / 註冊</button>`;
        }
    },
    fillUserFields: () => {
        const u = JSON.parse(localStorage.getItem('keicha_v2_user') || '{}');
        const fields = { 'display-user-phone': u.phone, 'text-name': u.name || '未填寫', 'display-711': u.store_711 ? `${u.store_711} ${u.store_711_note || ''}`.trim() : '尚未設定', 'display-fami': u.store_fami ? `${u.store_fami} ${u.store_fami_note || ''}`.trim() : '尚未設定', 'display-addr': u.shipping_address || '尚未設定' };
        Object.keys(fields).forEach(id => { if(document.getElementById(id)) document.getElementById(id).innerText = fields[id]; });
        const inputs = { 'upd-name': u.name, 'upd-email': u.email, 'upd-711': u.store_711, 'upd-711-note': u.store_711_note, 'upd-fami': u.store_fami, 'upd-fami-note': u.store_fami_note, 'upd-addr': u.shipping_address };
        Object.keys(inputs).forEach(id => { if(document.getElementById(id)) document.getElementById(id).value = inputs[id] || ''; });
    },
    fillCheckoutInfo: () => {
        const u = JSON.parse(localStorage.getItem('keicha_v2_user') || '{}');
        if(document.getElementById('checkout-info-name')) document.getElementById('checkout-info-name').innerText = u.name || '未填寫';
        if(document.getElementById('checkout-info-phone')) document.getElementById('checkout-info-phone').innerText = u.phone || '-';
        if(document.getElementById('checkout-display-7-11')) document.getElementById('checkout-display-7-11').innerText = u.store_711 ? `${u.store_711} (${u.store_711_note || ''})` : '尚未設定';
        if(document.getElementById('checkout-display-fami')) document.getElementById('checkout-display-fami').innerText = u.store_fami ? `${u.store_fami} (${u.store_fami_note || ''})` : '尚未設定';
        if(document.getElementById('checkout-display-addr')) document.getElementById('checkout-display-addr').innerText = u.shipping_address || '尚未設定';
    },
    updateCart: () => {
        const count = window.cart.reduce((s, i) => s + i.qty, 0);
        if (document.getElementById('cart-count')) document.getElementById('cart-count').innerText = count;
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
            return `<div class="flex items-center gap-4 border-b border-gray-50 pb-4">
                <div class="flex-1"><div class="text-sm font-bold text-gray-800">${i.name}</div><div class="text-xs brand-green">NT$ ${i.price.toLocaleString()}</div></div>
                <div class="flex items-center gap-2">
                    <button onclick="window.updateCartQty(${idx}, -1)" class="material-symbols-rounded text-gray-400">remove_circle</button>
                    <span class="text-xs font-bold">${i.qty}</span>
                    <button onclick="window.updateCartQty(${idx}, 1)" class="material-symbols-rounded text-gray-400">add_circle</button>
                </div>
            </div>`;
        }).join('');
        document.getElementById('cart-total-price').innerText = "NT$ " + total.toLocaleString();
    }
};

window.shop = {
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
    submit: () => {
        if (!window.selectedMethod) return alert("請選擇收件方式");
        const lineName = document.getElementById('order-line-name')?.value;
        if (!lineName) return alert("請填寫 LINE 名稱");
        const u = JSON.parse(localStorage.getItem('keicha_v2_user') || '{}');
        let pureStore = (window.selectedMethod === '7-11') ? u.store_711 : (window.selectedMethod === 'fami' ? u.store_fami : u.shipping_address);
        if (!pureStore) return alert("請先補全收件資料");
        window.api.submitOrder({
            action: 'checkout', name: u.name, phone: u.phone, store: pureStore, temp: "常溫",
            items: window.cart.map(i => `${i.name}x${i.qty}`).join(', '),
            subtotal: window.cart.reduce((s, i) => s + (i.price * i.qty), 0),
            shipping: document.getElementById('summary-shipping').innerText.replace('NT$ ', '').replace(/,/g, ''),
            date: new Date().toLocaleString('zh-TW'),
            note: document.getElementById('order-note')?.value || "",
            line_name: lineName, logistics: (window.selectedMethod === '7-11' ? '7-11' : (window.selectedMethod === 'fami' ? '全家' : '宅配'))
        });
    }
};

window.updateCartQty = (idx, d) => {
    window.cart[idx].qty += d;
    if(window.cart[idx].qty <= 0) window.cart.splice(idx, 1);
    window.ui.updateCart();
};

window.initShop = window.api.init;
window.onload = window.api.init;
