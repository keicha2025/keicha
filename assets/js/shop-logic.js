/**
 * KEICHA 網路商店 - 核心邏輯中控台 (分區儲存與動畫強化版)
 */

// 1. 基礎設定
const GAS_URL = "https://script.google.com/macros/s/AKfycbyUq36i64Z-JGcERE_rZOdphVtVDX8L-lguc7eiUIdoAERqI1ZK8GWAL-HgbC75cuMHFg/exec";
const siteBaseUrl = window.siteBaseUrl || ""; 

window.cart = [];
window.globalProducts = [];
window.shippingRules = [];
window.selectedMethod = '';

// --- 商店初始化與背景同步 ---
window.initShop = async function() {
    try {
        const res = await fetch(GAS_URL);
        const data = await res.json();
        if (!data || !data.products) return;
        window.globalProducts = data.products;
        
        // 修正物流規則名稱可能產生的日期格式錯誤
        window.shippingRules = (data.shipping_rules || []).map(r => ({
            ...r,
            method: (r.method && r.method.toString().includes('2025-')) ? '7-11' : r.method
        }));

        const localUser = JSON.parse(localStorage.getItem('keicha_v2_user'));
        // 進場時強制背景同步一次，解決跨裝置資料落差
        if (localUser && localUser.phone) window.syncUserData(localUser.phone);

        window.renderProducts(window.globalProducts);
        document.getElementById('products-loader').classList.add('hidden');
        window.renderTopAuth();
    } catch (e) { console.error("Init Error:", e); }
};

/**
 * 強制同步雲端資料：覆蓋本地 localStorage
 */
window.syncUserData = async function(phone) {
    try {
        const res = await fetch(GAS_URL, { 
            method: 'POST', 
            body: JSON.stringify({ action: 'login', phone }) 
        });
        const result = await res.json();
        if (result.success) {
            localStorage.setItem('keicha_v2_user', JSON.stringify(result.data));
            window.renderTopAuth();
            // 如果會員面板正開著，立即刷新顯示內容
            const panel = document.getElementById('user-panel');
            if (panel && panel.classList.contains('open')) {
                window.renderUserFields();
            }
        }
    } catch (e) { console.warn("背景同步暫時無法連線"); }
};

// --- 商品渲染邏輯 ---
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
            <div class="product-grid">
                ${grouped[cat].map(p => {
                    const stock = parseInt(p.stock) || 0;
                    const isSoldOut = stock <= 0;
                    let img = p.image_url || "";
                    if (img && !img.startsWith('http')) img = siteBaseUrl + (img.startsWith('/') ? img : '/' + img);
                    return window.ITEM_CARD_TEMPLATE(p, img, isSoldOut);
                }).join('')}
            </div>
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

// --- 會員面板管理邏輯 (分區獨立儲存版) ---
window.renderUserFields = function() {
    const u = JSON.parse(localStorage.getItem('keicha_v2_user') || '{}');
    if (!u.phone) return;
    
    // 文字顯示更新
    if (document.getElementById('display-user-phone')) document.getElementById('display-user-phone').innerText = u.phone;
    if (document.getElementById('text-name')) document.getElementById('text-name').innerText = u.name || '未填寫';
    if (document.getElementById('text-email')) document.getElementById('text-email').innerText = u.email || '未填寫';
    if (document.getElementById('display-711')) document.getElementById('display-711').innerText = u.store_711 ? `${u.store_711} ${u.store_711_note || ''}`.trim() : '尚未設定';
    if (document.getElementById('display-fami')) document.getElementById('display-fami').innerText = u.store_fami ? `${u.store_fami} ${u.store_fami_note || ''}`.trim() : '尚未設定';
    if (document.getElementById('display-addr')) document.getElementById('display-addr').innerText = u.shipping_address || '尚未設定';

    // 輸入欄位同步更新
    const fieldMapping = {
        'upd-name': u.name, 'upd-email': u.email,
        'upd-711': u.store_711, 'upd-711-note': u.store_711_note,
        'upd-fami': u.store_fami, 'upd-fami-note': u.store_fami_note,
        'upd-addr': u.shipping_address
    };
    Object.keys(fieldMapping).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = fieldMapping[id] || '';
    });
};

window.toggleEdit = function(type) {
    if (type === 'info') {
        const targets = ['upd-name', 'upd-email', 'text-name', 'text-email', 'info-edit-actions'];
        targets.forEach(id => document.getElementById(id)?.classList.toggle('hidden'));
    } else {
        document.getElementById(`display-${type}`)?.classList.toggle('hidden');
        document.getElementById(`edit-${type}`)?.classList.toggle('hidden');
        const qBtn = document.getElementById(`btn-${type}-query`);
        if (qBtn) qBtn.style.display = (qBtn.style.display === 'block') ? 'none' : 'block';
    }
};

/**
 * 儲存資料：支援個別按鈕動畫與鎖定功能
 */
window.saveFullUser = async function(section) {
    const btn = document.getElementById(`save-btn-${section}`);
    let originalHtml = "";
    
    if (btn) {
        originalHtml = btn.innerHTML;
        // 1. 視覺回饋：鎖定按鈕、顯示旋轉圖示
        btn.disabled = true;
        btn.innerHTML = `<span class="material-symbols-rounded text-sm animate-spin-custom">sync</span>儲存中`;
    }

    // 抓取當前所有欄位資料
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

    try {
        const res = await fetch(GAS_URL, { 
            method: 'POST', 
            body: JSON.stringify(updated) 
        });
        const result = await res.json();
        
        if (result.success) {
            localStorage.setItem('keicha_v2_user', JSON.stringify(updated));
            window.renderUserFields();
            
            // 2. 成功回饋
            if (btn) btn.innerHTML = `<span class="material-symbols-rounded text-sm">check_circle</span>完成`;
            
            setTimeout(() => {
                window.toggleEdit(section); // 儲存後自動關閉編輯模式
            }, 800);
        } else {
            throw new Error("儲存失敗");
        }
    } catch (e) { 
        alert("同步至雲端失敗，請檢查網路狀態"); 
        if (btn) btn.innerHTML = originalHtml; 
    } finally {
        if (btn) btn.disabled = false;
    }
};

// --- 購物車核心邏輯 ---
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
        const imgHTML = i.img ? `<img src="${i.img}" class="w-16 h-16 object-cover rounded-xl bg-gray-50">` : '';
        return `
        <div class="flex items-center gap-4 border-b border-gray-50 pb-4">
            ${imgHTML}
            <div class="flex-1 min-w-0">
                <div class="text-sm font-bold text-gray-800 truncate">${i.name}</div>
                <div class="text-xs brand-green font-mono mt-1">NT$ ${i.price.toLocaleString()}</div>
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

// --- 面板控制 ---
window.openLoginPanel = () => { 
    document.getElementById('login-panel').classList.add('open'); 
    document.getElementById('global-overlay').classList.add('open'); 
};

window.openUserPanel = () => { 
    window.renderUserFields(); 
    // 每次開啟面板自動背景同步
    const u = JSON.parse(localStorage.getItem('keicha_v2_user') || '{}');
    if(u.phone) window.syncUserData(u.phone);
    
    document.getElementById('user-panel').classList.add('open'); 
    document.getElementById('global-overlay').classList.add('open'); 
};

window.openCart = () => { 
    window.updateCartUI(); 
    document.getElementById('cart-sidebar').classList.add('open'); 
    document.getElementById('global-overlay').classList.add('open'); 
};

window.closeAllPanels = () => document.querySelectorAll('.side-panel, .overlay').forEach(p => p.classList.remove('open'));

// --- 其他操作 ---
window.adjQty = (pid, d) => { const el = document.getElementById(`iq-${pid}`); let v = parseInt(el.innerText) + d; if(v >= 1) el.innerText = v; };
window.updateCartQty = (idx, d) => { window.cart[idx].qty += d; if(window.cart[idx].qty <= 0) window.cart.splice(idx, 1); window.updateCartUI(); };
window.removeFromCart = (idx) => { window.cart.splice(idx, 1); window.updateCartUI(); };
window.addToCart = (pid) => {
    const p = window.globalProducts.find(x => x.product_id === pid);
    const qty = parseInt(document.getElementById(`iq-${pid}`).innerText);
    const inCart = window.cart.find(x => x.id === pid);
    if (inCart) inCart.qty += qty;
    else window.cart.push({ id: pid, name: p.product_name, price: p.price, qty: qty, img: p.image_url, category: p.category });
    window.updateCartUI(); window.openCart();
};

window.handleQuickLogin = async function() {
    const phone = document.getElementById('login-phone').value;
    if(!/^09\d{8}$/.test(phone)) return alert("電話格式不正確");
    const icon = document.getElementById('login-icon');
    icon.innerText = "sync"; icon.classList.add('animate-spin-custom');
    try {
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'login', phone }) });
        const data = await res.json();
        if(data.success) { 
            localStorage.setItem('keicha_v2_user', JSON.stringify(data.data)); 
            window.renderTopAuth(); 
            window.closeAllPanels(); 
        }
    } catch(e) {
        alert("連線失敗");
    } finally { 
        icon.innerText = "arrow_forward"; 
        icon.classList.remove('animate-spin-custom'); 
    }
};

window.openCheckout = function() {
    if(window.cart.length === 0) return alert("購物車目前是空的");
    window.closeAllPanels();
    setTimeout(() => {
        document.getElementById('checkout-panel').classList.add('open');
        document.getElementById('global-overlay').classList.add('open');
    }, 150);
};

window.handleLogout = () => { if (confirm("確定要登出帳號嗎？")) { localStorage.removeItem('keicha_v2_user'); location.reload(); }};
