/**
 * KEICHA SHOP CORE - 模組化修復版
 */

// ========================================
// 1. CONFIG & STATE
// ========================================
const GAS_URL = "https://script.google.com/macros/s/AKfycbyUq36i64Z-JGcERE_rZOdphVtVDX8L-lguc7eiUIdoAERqI1ZK8GWAL-HgbC75cuMHFg/exec";
const siteBaseUrl = window.siteBaseUrl || ""; 

window.cart = [];
window.globalProducts = [];
window.shippingRules = [];
window.selectedMethod = ''; 

// ========================================
// 2. API SERVICE (資料請求層)
// ========================================
window.api = {
    init: async () => {
        try {
            const res = await fetch(GAS_URL);
            const data = await res.json();
            if (!data || !data.products) return;
            window.globalProducts = data.products;
            window.shippingRules = (data.shipping_rules || []).map(r => ({
                ...r, method: (r.method && r.method.toString().includes('2025-')) ? '7-11' : r.method
            }));
            
            const localUser = JSON.parse(localStorage.getItem('keicha_v2_user'));
            if (localUser?.phone) window.api.syncUser(localUser.phone);

            window.ui.renderProducts(window.globalProducts);
            document.getElementById('products-loader')?.classList.add('hidden');
            window.ui.refreshAuth();
        } catch (e) { console.error("Init Error:", e); }
    },

    syncUser: async (phone) => {
        try {
            const res = await fetch(GAS_URL, { 
                method: 'POST', 
                body: JSON.stringify({ action: 'login', phone }) 
            });
            const result = await res.json();
            if (result.success) {
                localStorage.setItem('keicha_v2_user', JSON.stringify(result.data));
                window.ui.refreshAuth();
                if (document.getElementById('user-panel')?.classList.contains('open')) window.ui.fillUserFields();
                if (document.getElementById('checkout-panel')?.classList.contains('open')) window.ui.fillCheckoutInfo();
            }
        } catch (e) { }
    },

    submitOrder: async (payload) => {
        const btn = document.getElementById('btn-submit-order');
        btn.disabled = true;
        btn.innerHTML = `<span class="material-symbols-rounded animate-spin-custom">sync</span> 訂單發送中...`;
        
        try {
            const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(payload) });
            const result = await res.json();
            if (result.success) {
                alert("訂單已成功送出！感謝您的購買。");
                window.cart = [];
                window.ui.updateCart();
                window.panel.closeAll();
                location.reload();
            } else { alert("失敗：" + result.msg); }
        } catch (e) { alert("連線異常"); }
        finally { btn.disabled = false; btn.innerHTML = "確認送出訂單"; }
    }
};

// ========================================
// 3. UI RENDERING (介面展示層)
// ========================================
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
                    const isSoldOut = stock <= 0;
                    let img = p.image_url || "";
                    if (img && !img.startsWith('http')) img = siteBaseUrl + (img.startsWith('/') ? img : '/' + img);
                    return window.ITEM_CARD_TEMPLATE(p, img, isSoldOut);
                }).join('')}</div>
            </section>`).join('');
    },

    refreshAuth: () => {
        const u = JSON.parse(localStorage.getItem('keicha_v2_user'));
        const zone = document.getElementById('top-auth-zone');
        if (!zone) return;
        if (u?.name || u?.phone) {
            zone.innerHTML = `<button onclick="window.openUserPanel()" class="flex items-center gap-2 brand-green font-bold text-lg hover:opacity-70 transition"><span class="material-symbols-rounded">account_circle</span> ${u.name || u.phone}</button>`;
        } else {
            zone.innerHTML = `<button onclick="window.panel.openLogin()" class="bg-gray-100 text-gray-600 px-8 py-3 rounded-2xl text-sm font-bold hover:bg-gray-200 transition">登入 / 註冊</button>`;
        }
    },

    fillUserFields: () => {
        const u = JSON.parse(localStorage.getItem('keicha_v2_user') || '{}');
        if (!u.phone) return;
        const fields = { 
            'display-user-phone': u.phone, 
            'text-name': u.name || '未填寫', 
            'display-711': u.store_711 ? `${u.store_711} ${u.store_711_note || ''}`.trim() : '尚未設定', 
            'display-fami': u.store_fami ? `${u.store_fami} ${u.store_fami_note || ''}`.trim() : '尚未設定', 
            'display-addr': u.shipping_address || '尚未設定' 
        };
        Object.keys(fields).forEach(id => { if(document.getElementById(id)) document.getElementById(id).innerText = fields[id]; });
        const inputs = { 'upd-name': u.name, 'upd-email': u.email, 'upd-711': u.store_711, 'upd-711-note': u.store_711_note, 'upd-fami': u.store_fami, 'upd-fami-note': u.store_fami_note, 'upd-addr': u.shipping_address };
        Object.keys(inputs).forEach(id => { if(document.getElementById(id)) document.getElementById(id).value = inputs[id] || ''; });
    },

    fillCheckoutInfo: () => {
        const u = JSON.parse(localStorage.getItem('keicha_v2_user') || '{}');
        document.getElementById('checkout-info-name').innerText = u.name || '未填寫';
        document.getElementById('checkout-info-phone').innerText = u.phone || '-';
        document.getElementById('checkout-display-7-11').innerText = u.store_711 ? `${u.store_711} (${u.store_711_note || ''})` : '尚未設定';
        document.getElementById('checkout-display-fami').innerText = u.store_fami ? `${u.store_fami} (${u.store_fami_note || ''})` : '尚未設定';
        document.getElementById('checkout-display-addr').innerText = u.shipping_address || '尚未設定';
        if(u.name && !document.getElementById('order-line-name').value) document.getElementById('order-line-name').value = u.name;
    },

    updateCart: () => {
        const count = window.cart.reduce((s, i) => s + i.qty, 0);
        const el = document.getElementById('cart-count');
        if (el) { el.innerText = count; el.classList.toggle('hidden', count === 0); }
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
                ${i.img ? `<img src="${i.img}" class="w-16 h-16 object-cover rounded-xl bg-gray-50">` : ''}
                <div class="flex-1 min-w-0"><div class="text-sm font-bold text-gray-800 truncate">${i.name}</div><div class="text-xs brand-green mt-1">NT$ ${i.price.toLocaleString()}</div></div>
                <div class="flex items-center gap-2">
                    <button onclick="window.shop.updateQty(${idx}, -1)" class="material-symbols-rounded text-gray-400">remove_circle</button>
                    <span class="text-xs font-bold w-4 text-center">${i.qty}</span>
                    <button onclick="window.shop.updateQty(${idx}, 1)" class="material-symbols-rounded text-gray-400">add_circle</button>
                </div>
            </div>`;
        }).join('');
        document.getElementById('cart-total-price').innerText = "NT$ " + total.toLocaleString();
    }
};

// ========================================
// 4. SHOPPING LOGIC
// ========================================
window.shop = {
    add: (pid) => {
        const p = window.globalProducts.find(x => x.product_id === pid);
        const qty = parseInt(document.getElementById(`iq-${pid}`).innerText);
        const inCart = window.cart.find(x => x.id === pid);
        if (inCart) inCart.qty += qty; 
        else window.cart.push({ id: pid, name: p.product_name, price: p.price, qty: qty, img: p.image_url, category: p.category });
        window.ui.updateCart(); 
        window.panel.openCart();
    },

    updateQty: (idx, d) => {
        window.cart[idx].qty += d;
        if(window.cart[idx].qty <= 0) window.cart.splice(idx, 1);
        window.ui.updateCart();
    },

    selectShip: (method) => {
        window.selectedMethod = method;
        document.querySelectorAll('.ship-opt-card').forEach(el => el.classList.remove('selected'));
        
        // 修正 ID 選擇：addr 對應 opt-addr, 7-11 對應 opt-7-11
        const targetId = (method === '7-11') ? 'opt-7-11' : `opt-${method}`;
        const targetEl = document.getElementById(targetId);
        if (targetEl) targetEl.classList.add('selected');

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
        document.getElementById('summary-method').innerText = nameMap[method] || '未選';
        document.getElementById('summary-shipping').innerText = `NT$ ${shipping.toLocaleString()}`;
        document.getElementById('summary-total').innerText = `NT$ ${(subtotal + shipping).toLocaleString()}`;
    },

    submit: () => {
        if (!window.selectedMethod) return alert("請選擇收件方式");
        const lineName = document.getElementById('order-line-name').value;
        if (!lineName) return alert("請填寫 LINE 名稱");
        
        const u = JSON.parse(localStorage.getItem('keicha_v2_user') || '{}');
        let pureStore = (window.selectedMethod === '7-11') ? u.store_711 : (window.selectedMethod === 'fami' ? u.store_fami : u.shipping_address);
        if (!pureStore) return alert("資訊不完整，請補全收件資料");

        const payload = {
            action: 'checkout',
            name: u.name || "未提供",
            phone: u.phone,
            store: pureStore,
            temp: "常溫",
            items: window.cart.map(i => `${i.name}x${i.qty}`).join(', '),
            subtotal: window.cart.reduce((s, i) => s + (i.price * i.qty), 0),
            shipping: document.getElementById('summary-shipping').innerText.replace('NT$ ', '').replace(/,/g, ''),
            date: new Date().toLocaleString('zh-TW'),
            note: document.getElementById('order-note').value,
            line_name: lineName,
            logistics: (window.selectedMethod === '7-11') ? '7-11' : (window.selectedMethod === 'fami' ? '全家' : '宅配')
        };
        window.api.submitOrder(payload);
    }
};

// ========================================
// 5. PANEL CONTROL
// ========================================
window.panel = {
    openLogin: () => { 
        document.getElementById('login-panel').classList.add('open'); 
        document.getElementById('global-overlay').classList.add('open'); 
    },
    openUser: () => { 
        window.ui.fillUserFields(); 
        const u = JSON.parse(localStorage.getItem('keicha_v2_user') || '{}');
        if(u.phone) window.api.syncUser(u.phone);
        document.getElementById('user-panel').classList.add('open'); 
        document.getElementById('global-overlay').classList.add('open'); 
    },
    openCart: () => { 
        window.ui.updateCart(); 
        document.getElementById('cart-sidebar').classList.add('open'); 
        document.getElementById('global-overlay').classList.add('open'); 
    },
    openCheckout: () => {
        if(window.cart.length === 0) return alert("購物車空的");
        window.panel.closeAll();
        setTimeout(() => {
            window.ui.fillCheckoutInfo();
            document.getElementById('checkout-panel').classList.add('open');
            document.getElementById('global-overlay').classList.add('open');
        }, 150);
    },
    editFromCheckout: () => {
        // 先關閉結帳面板再開會員面板，確保不會互壓
        document.getElementById('checkout-panel').classList.remove('open');
        setTimeout(() => { window.panel.openUser(); }, 50);
    },
    closeAll: () => document.querySelectorAll('.side-panel, .overlay').forEach(p => p.classList.remove('open'))
};

// ========================================
// ⚡️ 全域快捷調用 (對應 HTML onclick)
// ========================================
window.initShop = window.api.init;
window.addToCart = window.shop.add;
window.openUserPanel = window.panel.openUser;
window.openCart = window.panel.openCart;
window.openCheckout = window.panel.openCheckout;
window.closeAllPanels = window.panel.closeAll;
window.selectShipMethod = window.shop.selectShip;
window.submitOrder = window.shop.submit;
window.editFromCheckout = window.panel.editFromCheckout; // 確保這行存在！

// 初始化
window.onload = window.api.init;
