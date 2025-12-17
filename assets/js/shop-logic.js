/**
 * KEICHA 網路商店 - 核心邏輯中控台
 */

// 1. 基礎設定
const GAS_URL = "https://script.google.com/macros/s/AKfycbyUq36i64Z-JGcERE_rZOdphVtVDX8L-lguc7eiUIdoAERqI1ZK8GWAL-HgbC75cuMHFg/exec";
const siteBaseUrl = window.siteBaseUrl || ""; 

window.cart = [];
window.globalProducts = [];
window.shippingRules = [];
window.selectedMethod = ''; 

// --- 商店初始化 ---
window.initShop = async function() {
    try {
        const res = await fetch(GAS_URL);
        const data = await res.json();
        if (!data || !data.products) return;
        window.globalProducts = data.products;
        window.shippingRules = (data.shipping_rules || []).map(r => ({
            ...r,
            method: (r.method && r.method.toString().includes('2025-')) ? '7-11' : r.method
        }));
        const localUser = JSON.parse(localStorage.getItem('keicha_v2_user'));
        if (localUser && localUser.phone) window.syncUserData(localUser.phone);
        window.renderProducts(window.globalProducts);
        document.getElementById('products-loader')?.classList.add('hidden');
        window.renderTopAuth();
    } catch (e) { console.error("Init Error:", e); }
};

window.syncUserData = async function(phone) {
    try {
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'login', phone }) });
        const result = await res.json();
        if (result.success) {
            localStorage.setItem('keicha_v2_user', JSON.stringify(result.data));
            window.renderTopAuth();
            if (document.getElementById('user-panel')?.classList.contains('open')) window.renderUserFields();
            if (document.getElementById('checkout-panel')?.classList.contains('open')) window.renderCheckoutInfo();
        }
    } catch (e) { }
};

// --- 商品渲染 ---
window.renderProducts = function(prods) {
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
};

window.renderTopAuth = function() {
    const u = JSON.parse(localStorage.getItem('keicha_v2_user'));
    const zone = document.getElementById('top-auth-zone');
    if (!zone) return;
    if (u && (u.name || u.phone)) {
        zone.innerHTML = `<button onclick="window.openUserPanel()" class="flex items-center gap-2 brand-green font-bold text-lg hover:opacity-70 transition"><span class="material-symbols-rounded">account_circle</span> ${u.name || u.phone}</button>`;
    } else {
        zone.innerHTML = `<button onclick="window.openLoginPanel()" class="bg-gray-100 text-gray-600 px-8 py-3 rounded-2xl text-sm font-bold hover:bg-gray-200 transition">登入 / 註冊</button>`;
    }
};

// --- 會員資料管理 (分區儲存) ---
window.renderUserFields = function() {
    const u = JSON.parse(localStorage.getItem('keicha_v2_user') || '{}');
    if (!u.phone) return;
    const fields = { 'display-user-phone': u.phone, 'text-name': u.name || '未填寫', 'text-email': u.email || '未填寫', 'display-711': u.store_711 ? `${u.store_711} ${u.store_711_note || ''}`.trim() : '尚未設定', 'display-fami': u.store_fami ? `${u.store_fami} ${u.store_fami_note || ''}`.trim() : '尚未設定', 'display-addr': u.shipping_address || '尚未設定' };
    Object.keys(fields).forEach(id => { if(document.getElementById(id)) document.getElementById(id).innerText = fields[id]; });
    const inputs = { 'upd-name': u.name, 'upd-email': u.email, 'upd-711': u.store_711, 'upd-711-note': u.store_711_note, 'upd-fami': u.store_fami, 'upd-fami-note': u.store_fami_note, 'upd-addr': u.shipping_address };
    Object.keys(inputs).forEach(id => { if(document.getElementById(id)) document.getElementById(id).value = inputs[id] || ''; });
};

window.toggleEdit = function(type) {
    if (type === 'info') {
        ['upd-name', 'upd-email', 'text-name', 'text-email', 'info-edit-actions'].forEach(id => document.getElementById(id)?.classList.toggle('hidden'));
    } else {
        document.getElementById(`display-${type}`)?.classList.toggle('hidden');
        document.getElementById(`edit-${type}`)?.classList.toggle('hidden');
        const qBtn = document.getElementById(`btn-${type}-query`);
        if (qBtn) qBtn.style.display = (qBtn.style.display === 'block') ? 'none' : 'block';
    }
};

window.saveFullUser = async function(section) {
    const btn = document.getElementById(`save-btn-${section}`);
    const storeReg = /^\d{6}$/;
    if ((section === '711' && !storeReg.test(document.getElementById('upd-711').value)) || (section === 'fami' && !storeReg.test(document.getElementById('upd-fami').value))) return alert("請輸入 6 位數字店舖號");
    let oldHtml = btn?.innerHTML;
    if(btn) { btn.disabled = true; btn.innerHTML = `<span class="material-symbols-rounded text-sm animate-spin-custom">sync</span>儲存中`; }
    const u = JSON.parse(localStorage.getItem('keicha_v2_user') || '{}');
    const updated = { ...u, action: 'save', name: document.getElementById('upd-name').value, email: document.getElementById('upd-email').value, store_711: document.getElementById('upd-711').value, store_711_note: document.getElementById('upd-711-note').value, store_fami: document.getElementById('upd-fami').value, store_fami_note: document.getElementById('upd-fami-note').value, shipping_address: document.getElementById('upd-addr').value };
    try {
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(updated) });
        const result = await res.json();
        if (result.success) {
            localStorage.setItem('keicha_v2_user', JSON.stringify(updated));
            window.renderUserFields();
            if(btn) btn.innerHTML = `<span class="material-symbols-rounded text-sm">check_circle</span>完成`;
            setTimeout(() => window.toggleEdit(section), 800);
        }
    } catch (e) { alert("同步失敗"); if(btn) btn.innerHTML = oldHtml; }
    finally { if(btn) btn.disabled = false; }
};

// --- 購物車 ---
window.updateCartUI = function() {
    const count = window.cart.reduce((s, i) => s + i.qty, 0);
    const el = document.getElementById('cart-count');
    if (el) { el.innerText = count; el.classList.toggle('hidden', count === 0); }
    const container = document.getElementById('cart-items-container');
    if (!container) return;
    if (window.cart.length === 0) { container.innerHTML = `<div class="text-center py-20 text-gray-300 font-bold"><p>購物車是空的</p></div>`; document.getElementById('cart-total-price').innerText = "NT$ 0"; return; }
    let total = 0;
    container.innerHTML = window.cart.map((i, idx) => {
        total += i.price * i.qty;
        return `<div class="flex items-center gap-4 border-b border-gray-50 pb-4">
            ${i.img ? `<img src="${i.img}" class="w-16 h-16 object-cover rounded-xl bg-gray-50">` : ''}
            <div class="flex-1 min-w-0"><div class="text-sm font-bold text-gray-800 truncate">${i.name}</div><div class="text-xs brand-green mt-1">NT$ ${i.price.toLocaleString()}</div></div>
            <div class="flex items-center gap-2"><div class="qty-control scale-75 origin-right"><button class="qty-btn" onclick="window.updateCartQty(${idx}, -1)">-</button><span class="text-xs font-bold w-4 text-center">${i.qty}</span><button class="qty-btn" onclick="window.updateCartQty(${idx}, 1)">+</button></div><button onclick="window.removeFromCart(${idx})" class="material-symbols-rounded text-gray-300 p-1">close</button></div>
        </div>`;
    }).join('');
    document.getElementById('cart-total-price').innerText = "NT$ " + total.toLocaleString();
};

// --- 結帳與送出訂單 (對接 Orders 系統) ---
window.renderCheckoutInfo = function() {
    const u = JSON.parse(localStorage.getItem('keicha_v2_user') || '{}');
    document.getElementById('checkout-info-name').innerText = u.name || '未填寫';
    document.getElementById('checkout-info-phone').innerText = u.phone || '-';
    document.getElementById('checkout-display-7-11').innerText = u.store_711 ? `${u.store_711} (${u.store_711_note || ''})` : '尚未設定';
    document.getElementById('checkout-display-fami').innerText = u.store_fami ? `${u.store_fami} (${u.store_fami_note || ''})` : '尚未設定';
    document.getElementById('checkout-display-addr').innerText = u.shipping_address || '尚未設定';
    if(u.name && !document.getElementById('order-line-name').value) document.getElementById('order-line-name').value = u.name;
};

window.selectShipMethod = function(method) {
    window.selectedMethod = method;
    document.querySelectorAll('.ship-opt-card').forEach(el => el.classList.remove('selected'));
    const targetId = method === '7-11' ? 'opt-7-11' : `opt-${method}`;
    document.getElementById(targetId)?.classList.add('selected');
    window.updateSummary();
};

window.updateSummary = function() {
    const subtotal = window.cart.reduce((s, i) => s + (i.price * i.qty), 0);
    let shipping = 0;
    const nameMap = { '7-11': '7-11', 'fami': '全家', 'addr': '宅配' };
    const rule = window.shippingRules.find(r => r.method === nameMap[window.selectedMethod]);
    if (rule) shipping = subtotal >= (parseInt(rule.free_limit) || 99999) ? 0 : (parseInt(rule.fee) || 0);
    document.getElementById('summary-subtotal').innerText = `NT$ ${subtotal.toLocaleString()}`;
    document.getElementById('summary-method').innerText = nameMap[window.selectedMethod] || '未選';
    document.getElementById('summary-shipping').innerText = `NT$ ${shipping.toLocaleString()}`;
    document.getElementById('summary-total').innerText = `NT$ ${(subtotal + shipping).toLocaleString()}`;
};

/**
 * 送出訂單：將資料推送到 GAS 的 Orders 系統
 */
window.submitOrder = async function() {
    if (!window.selectedMethod) return alert("請選擇收件方式");
    const lineName = document.getElementById('order-line-name').value;
    if (!lineName) return alert("請填寫 LINE 名稱以便核對");

    const u = JSON.parse(localStorage.getItem('keicha_v2_user') || '{}');
    const btn = document.getElementById('btn-submit-order');
    const oldHtml = btn.innerHTML;

    // 準備訂單物件
    const orderData = {
        action: 'order',
        phone: u.phone,
        line_name: lineName,
        recipient_name: u.name,
        ship_method: window.selectedMethod,
        ship_info: "", // 根據選擇填入
        items: JSON.stringify(window.cart),
        total_amount: document.getElementById('summary-total').innerText.replace('NT$ ', '').replace(/,/g, '')
    };

    // 根據物流方式決定收件資訊
    if (window.selectedMethod === '7-11') orderData.ship_info = `7-11: ${u.store_711} (${u.store_711_note})`;
    else if (window.selectedMethod === 'fami') orderData.ship_info = `全家: ${u.store_fami} (${u.store_fami_note})`;
    else orderData.ship_info = `宅配: ${u.shipping_address}`;

    if (!orderData.ship_info || orderData.ship_info.includes('尚未設定')) return alert("收件資訊不完整，請先編輯資料");

    btn.disabled = true;
    btn.innerHTML = `<span class="material-symbols-rounded animate-spin-custom">sync</span> 訂單處理中...`;

    try {
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(orderData) });
        const result = await res.json();
        if (result.success) {
            alert("訂單已成功送出！感謝您的購買。");
            window.cart = []; // 清空購物車
            window.updateCartUI();
            window.closeAllPanels();
            // 可選：跳轉至成功頁面或重新整理
            location.reload();
        } else {
            alert("送出失敗：" + result.message);
        }
    } catch (e) { alert("連線失敗，請稍後再試"); }
    finally { btn.disabled = false; btn.innerHTML = oldHtml; }
};

// --- 面板控制與其餘功能 ---
window.openLoginPanel = () => { document.getElementById('login-panel').classList.add('open'); document.getElementById('global-overlay').classList.add('open'); };
window.openUserPanel = () => { window.renderUserFields(); const u = JSON.parse(localStorage.getItem('keicha_v2_user') || '{}'); if(u.phone) window.syncUserData(u.phone); document.getElementById('user-panel').classList.add('open'); document.getElementById('global-overlay').classList.add('open'); };
window.openCart = () => { window.updateCartUI(); document.getElementById('cart-sidebar').classList.add('open'); document.getElementById('global-overlay').classList.add('open'); };
window.closeAllPanels = () => document.querySelectorAll('.side-panel, .overlay').forEach(p => p.classList.remove('open'));
window.updateCartQty = (idx, d) => { window.cart[idx].qty += d; if(window.cart[idx].qty <= 0) window.cart.splice(idx, 1); window.updateCartUI(); };
window.removeFromCart = (idx) => { window.cart.splice(idx, 1); window.updateCartUI(); };
window.addToCart = (pid) => {
    const p = window.globalProducts.find(x => x.product_id === pid);
    const qty = parseInt(document.getElementById(`iq-${pid}`).innerText);
    const inCart = window.cart.find(x => x.id === pid);
    if (inCart) inCart.qty += qty; else window.cart.push({ id: pid, name: p.product_name, price: p.price, qty: qty, img: p.image_url, category: p.category });
    window.updateCartUI(); window.openCart();
};
window.handleQuickLogin = async function() {
    const phone = document.getElementById('login-phone').value;
    if(!/^09\d{8}$/.test(phone)) return alert("格式錯誤");
    const icon = document.getElementById('login-icon'); icon.innerText = "sync"; icon.classList.add('animate-spin-custom');
    try {
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'login', phone }) });
        const data = await res.json();
        if(data.success) { localStorage.setItem('keicha_v2_user', JSON.stringify(data.data)); window.renderTopAuth(); window.closeAllPanels(); }
    } finally { icon.innerText = "arrow_forward"; icon.classList.remove('animate-spin-custom'); }
};
window.openCheckout = function() {
    if(window.cart.length === 0) return alert("購物車空的");
    window.closeAllPanels();
    setTimeout(() => { window.renderCheckoutInfo(); window.updateSummary(); document.getElementById('checkout-panel').classList.add('open'); document.getElementById('global-overlay').classList.add('open'); }, 150);
};
window.handleLogout = () => { if (confirm("確定登出？")) { localStorage.removeItem('keicha_v2_user'); location.reload(); }};
window.onload = initShop;
