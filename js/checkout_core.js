/**
 * js/checkout_core.js
 * 核心邏輯：會員系統、UI控制、運費計算、表單驗證
 * 適用於：Shop, DIY, Fast Checkout 所有頁面
 */

// 全域變數
let globalUser = null;       // 儲存目前登入的會員資料
let shippingRules = [];      // 儲存運費規則 (由 API 載入)
let currentShippingMethod = ''; // 目前選擇的物流方式

// --- 1. UI 控制 (側邊欄與遮罩) ---
function openPanel(panelId) {
    closeAllPanels();
    const panel = document.getElementById(panelId);
    const overlay = document.getElementById('global-overlay');
    if (panel) panel.classList.add('open');
    if (overlay) overlay.classList.add('open');
}

function closeAllPanels() {
    document.querySelectorAll('.side-panel, .overlay').forEach(el => el.classList.remove('open'));
}

// --- 2. 會員系統邏輯 ---

// 初始化：檢查 LocalStorage 是否有登入
function initAuth() {
    const saved = localStorage.getItem('keicha_v2_user');
    if (saved) {
        globalUser = JSON.parse(saved);
        updateAuthUI();
    }
}

// 處理登入
async function handleQuickLogin() {
    const phoneInput = document.getElementById('login-phone');
    const phone = phoneInput.value.trim();
    
    if (!/^09\d{8}$/.test(phone)) {
        alert("請輸入正確的 09 開頭 10 碼電話");
        return;
    }

    const btn = document.getElementById('login-submit-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = `<span class="material-symbols-rounded animate-spin-custom">refresh</span> 驗證中...`;

    try {
        const res = await API.login(phone);
        if (res.success) {
            globalUser = res.data;
            localStorage.setItem('keicha_v2_user', JSON.stringify(globalUser));
            updateAuthUI();
            closeAllPanels();
            // 如果是在結帳頁面，登入後自動填入資料
            if (typeof fillCheckoutForm === 'function') fillCheckoutForm();
        } else {
            alert(res.msg || "登入失敗");
        }
    } catch (e) {
        alert("系統連線錯誤");
    } finally {
        btn.innerHTML = originalText;
    }
}

// 登出
function handleLogout() {
    if (confirm("確定要登出嗎？")) {
        localStorage.removeItem('keicha_v2_user');
        location.reload();
    }
}

// 更新畫面上所有跟會員有關的顯示 (右上角按鈕、側邊欄資料)
function updateAuthUI() {
    if (!globalUser) return;

    // 更新頂部按鈕 (如果頁面上有 top-auth-zone)
    const topZone = document.getElementById('top-auth-zone');
    if (topZone) {
        topZone.innerHTML = `<button onclick="openPanel('user-panel')" class="flex items-center gap-1 brand-green font-bold text-sm"><span class="material-symbols-rounded text-lg">account_circle</span> ${globalUser.name || globalUser.phone}</button>`;
    }

    // 更新會員中心 (User Panel) 的顯示欄位
    // 使用 optional chaining (?.) 避免頁面上沒有該 ID 時報錯
    document.getElementById('display-user-phone')?.innerText = globalUser.phone;
    
    // 填寫 input 值 (編輯用)
    setVal('upd-name', globalUser.name);
    setVal('upd-email', globalUser.email);
    setVal('upd-711', globalUser.store_711);
    setVal('upd-711-note', globalUser.store_711_note);
    setVal('upd-fami', globalUser.store_fami);
    setVal('upd-fami-note', globalUser.store_fami_note);
    setVal('upd-addr', globalUser.shipping_address);

    // 更新顯示文字 (檢視用)
    setText('text-name', globalUser.name || '未填寫');
    setText('text-email', globalUser.email || '未填寫');
    setText('display-711', globalUser.store_711 ? `${globalUser.store_711} ${globalUser.store_711_note||''}` : '尚未設定');
    setText('display-fami', globalUser.store_fami ? `${globalUser.store_fami} ${globalUser.store_fami_note||''}` : '尚未設定');
    setText('display-addr', globalUser.shipping_address || '尚未設定');
}

// --- 3. 資料儲存邏輯 (會員中心 & 結帳頁編輯) ---

async function saveUserData(section, isCheckoutMode = false) {
    if (!globalUser) return;

    // 根據 section 抓取對應的 input ID
    // isCheckoutMode = true 代表是從結帳頁(chk-input-*) 抓值，否則從會員中心(upd-*) 抓值
    const prefix = isCheckoutMode ? 'chk-input' : 'upd';
    const btnId = isCheckoutMode ? `chk-save-${section}` : `save-btn-${section}`;
    
    let updates = {};
    let isValid = true;

    if (section === 'info') {
        updates.name = getVal(`${prefix}-name`);
        updates.email = getVal(`${prefix}-email`);
    } else if (section === '711') {
        const val = getVal(`${prefix}-711`);
        if (!/^\d{6}$/.test(val)) { alert('店號必須是 6 位數字'); isValid = false; }
        else { updates.store_711 = val; updates.store_711_note = getVal(`${prefix}-711-note`); }
    } else if (section === 'fami') {
        const val = getVal(`${prefix}-fami`);
        if (!/^\d{6}$/.test(val)) { alert('店號必須是 6 位數字'); isValid = false; }
        else { updates.store_fami = val; updates.store_fami_note = getVal(`${prefix}-fami-note`); }
    } else if (section === 'addr') {
        updates.shipping_address = getVal(`${prefix}-addr`);
    }

    if (!isValid) return;

    const btn = document.getElementById(btnId);
    if(btn) {
        const oldText = btn.innerHTML;
        btn.innerHTML = `...`; 
        btn.disabled = true;

        try {
            // 合併新舊資料
            const newData = { ...globalUser, ...updates };
            const res = await API.saveMember(newData);
            
            if (res.success) {
                globalUser = newData;
                localStorage.setItem('keicha_v2_user', JSON.stringify(globalUser));
                updateAuthUI();
                
                // 如果是結帳模式，更新完後要切換回檢視模式
                if (isCheckoutMode) {
                    toggleCheckoutEdit(section); 
                    // 如果改的是物流資訊，要觸發重新選擇以更新畫面
                    if(section === '711') selectShipMethod('7-11');
                    if(section === 'fami') selectShipMethod('fami');
                    if(section === 'addr') selectShipMethod('addr');
                } else {
                    toggleEdit(section); // 會員中心模式
                }
            } else {
                alert("儲存失敗");
            }
        } catch (e) {
            alert("系統錯誤");
        } finally {
            btn.innerHTML = oldText;
            btn.disabled = false;
        }
    }
}


// --- 4. 結帳與運費邏輯 ---

// 計算運費 (嚴格取最貴規則)
function calculateShippingFee(methodName, cartSubtotal) {
    if (!methodName || !shippingRules || shippingRules.length === 0) return 0;

    // 這裡簡化邏輯：假設自填單/快速結帳的商品類別都是 'default'
    // 如果需要支援多類別，之後需要在各自頁面傳入商品類別列表
    const activeRule = shippingRules.find(r => 
        r.method === methodName && (r.category === 'default' || r.category === '一般')
    );

    if (!activeRule) return 0;

    let fee = parseFloat(activeRule.base) || 0;
    const s = parseFloat(cartSubtotal);

    if (activeRule.t3 && s >= parseFloat(activeRule.t3)) fee = parseFloat(activeRule.f3);
    else if (activeRule.t2 && s >= parseFloat(activeRule.t2)) fee = parseFloat(activeRule.f2);
    else if (activeRule.t1 && s >= parseFloat(activeRule.t1)) fee = parseFloat(activeRule.f1);

    return fee;
}

// 選擇物流方式 (UI互動)
function selectShipMethod(type) {
    if (!globalUser) { openPanel('login-panel'); return; }

    // 檢查是否有資料，沒資料就打開編輯框
    const checkData = (type === '7-11') ? globalUser.store_711 : 
                      (type === 'fami') ? globalUser.store_fami : globalUser.shipping_address;

    if (!checkData) {
        toggleCheckoutEdit(type === '7-11' ? '711' : (type === 'fami' ? 'fami' : 'addr'));
        return;
    }

    currentShippingMethod = (type === 'fami') ? '全家' : (type === 'addr' ? '宅配' : '7-11');

    // UI 樣式更新
    document.querySelectorAll('.ship-opt-card').forEach(el => {
        el.classList.remove('border-[#6ea44c]', 'bg-[#6ea44c]/5');
        el.classList.add('border-gray-50');
    });
    
    const mapId = (type === 'fami') ? 'opt-fami' : (type === 'addr' ? 'opt-addr' : 'opt-7-11');
    const activeEl = document.getElementById(mapId);
    if(activeEl) {
        activeEl.classList.remove('border-gray-50');
        activeEl.classList.add('border-[#6ea44c]', 'bg-[#6ea44c]/5');
    }

    // 觸發頁面上的金額更新 (因為不同頁面計算總額方式不同，這裡呼叫一個約定好的函數名稱)
    if (typeof updatePageSummary === 'function') {
        updatePageSummary();
    }
}

// --- 5. 工具函式 ---
function getVal(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; }
function setVal(id, val) { const el = document.getElementById(id); if (el) el.value = val || ''; }
function setText(id, txt) { const el = document.getElementById(id); if (el) el.innerText = txt || ''; }

// 切換編輯/檢視模式 (共用)
function toggleEdit(section) {
    // 實作與 shop.html 類似的 classList.toggle('hidden') 邏輯
    // 這裡為了節省篇幅，假設 HTML 結構都遵循 display-ID / edit-ID 的命名規則
    const disp = document.getElementById(`display-${section}`);
    const edit = document.getElementById(`edit-${section}`);
    if(disp && edit) {
        const isHidden = edit.classList.contains('hidden');
        if(isHidden) { edit.classList.remove('hidden'); disp.classList.add('hidden'); }
        else { edit.classList.add('hidden'); disp.classList.remove('hidden'); }
    }
}

// 切換結帳頁面的編輯模式
function toggleCheckoutEdit(section) {
    if(section === 'info') {
        const view = document.getElementById('checkout-view-info');
        const edit = document.getElementById('checkout-edit-info');
        if(view && edit) {
            view.classList.toggle('hidden');
            edit.classList.toggle('hidden');
        }
    } else {
        const editBlock = document.getElementById(`checkout-edit-${section}`);
        if(editBlock) editBlock.classList.toggle('hidden');
    }
}
