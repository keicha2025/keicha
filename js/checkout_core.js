/**
 * js/checkout_core.js
 * 核心邏輯：會員系統、UI控制、運費計算、表單驗證
 * 修正版：修復語法錯誤與變數定義問題
 */

// 1. 全域變數定義 (確保在最上方)
let globalUser = null;       // 儲存目前登入的會員資料
let shippingRules = [];      // 儲存運費規則 (由 API 載入)
let currentShippingMethod = ''; // 目前選擇的物流方式

// 2. UI 控制 (側邊欄與遮罩)
function openPanel(panelId) {
    closeAllPanels();
    const panel = document.getElementById(panelId);
    const overlay = document.getElementById('global-overlay');
    if (panel) panel.classList.add('open');
    if (overlay) overlay.classList.add('open');
}

function closeAllPanels() {
    const panels = document.querySelectorAll('.side-panel');
    const overlays = document.querySelectorAll('.overlay');
    
    panels.forEach(function(el) {
        el.classList.remove('open');
    });
    
    overlays.forEach(function(el) {
        el.classList.remove('open');
    });
}

// 3. 會員系統邏輯

// 初始化：檢查 LocalStorage 是否有登入
function initAuth() {
    const saved = localStorage.getItem('keicha_v2_user');
    if (saved) {
        try {
            globalUser = JSON.parse(saved);
            updateAuthUI();
        } catch (e) {
            console.error("解析會員資料失敗", e);
            localStorage.removeItem('keicha_v2_user');
        }
    }
}

// 處理登入
async function handleQuickLogin() {
    const phoneInput = document.getElementById('login-phone');
    if (!phoneInput) return;
    
    const phone = phoneInput.value.trim();
    
    if (!/^09\d{8}$/.test(phone)) {
        alert("請輸入正確的 09 開頭 10 碼電話");
        return;
    }

    const btn = document.getElementById('login-submit-btn');
    const originalText = btn ? btn.innerHTML : '下一步';
    if (btn) btn.innerHTML = '<span class="material-symbols-rounded animate-spin-custom">refresh</span> 驗證中...';

    try {
        const res = await API.login(phone);
        if (res.success) {
            globalUser = res.data;
            localStorage.setItem('keicha_v2_user', JSON.stringify(globalUser));
            updateAuthUI();
            closeAllPanels();
            // 如果是在結帳頁面，登入後自動填入資料
            if (typeof fillCheckoutForm === 'function') {
                fillCheckoutForm();
            }
        } else {
            alert(res.msg || "登入失敗");
        }
    } catch (e) {
        alert("系統連線錯誤");
        console.error(e);
    } finally {
        if (btn) btn.innerHTML = originalText;
    }
}

// 登出
function handleLogout() {
    if (confirm("確定要登出嗎？")) {
        localStorage.removeItem('keicha_v2_user');
        location.reload();
    }
}

// 更新畫面上所有跟會員有關的顯示
function updateAuthUI() {
    if (!globalUser) return;

    // 更新頂部按鈕
    const topZone = document.getElementById('top-auth-zone');
    if (topZone) {
        topZone.innerHTML = `<button onclick="openPanel('user-panel')" class="flex items-center gap-1 brand-green font-bold text-sm"><span class="material-symbols-rounded text-lg">account_circle</span> ${globalUser.name || globalUser.phone}</button>`;
    }

    // 更新 User Panel 顯示
    const dispPhone = document.getElementById('display-user-phone');
    if (dispPhone) dispPhone.innerText = globalUser.phone;
    
    // 填寫 input 值 (編輯用) - 使用安全檢查
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
    setText('display-711', globalUser.store_711 ? (globalUser.store_711 + ' ' + (globalUser.store_711_note || '')) : '尚未設定');
    setText('display-fami', globalUser.store_fami ? (globalUser.store_fami + ' ' + (globalUser.store_fami_note || '')) : '尚未設定');
    setText('display-addr', globalUser.shipping_address || '尚未設定');
}

// 4. 資料儲存邏輯 (會員中心 & 結帳頁編輯)

async function saveUserData(section, isCheckoutMode) {
    if (!globalUser) return;

    // 判斷是從哪個輸入框抓值
    const prefix = (isCheckoutMode === true) ? 'chk-input' : 'upd';
    const btnId = (isCheckoutMode === true) ? ('chk-save-' + section) : ('save-btn-' + section);
    
    let updates = {};
    let isValid = true;

    // 根據 section 抓取對應的 input
    if (section === 'info') {
        updates.name = getVal(prefix + '-name');
        updates.email = getVal(prefix + '-email');
    } else if (section === '711') {
        const val = getVal(prefix + '-711');
        if (!/^\d{6}$/.test(val)) { 
            alert('店號必須是 6 位數字'); 
            isValid = false; 
        } else { 
            updates.store_711 = val; 
            updates.store_711_note = getVal(prefix + '-711-note'); 
        }
    } else if (section === 'fami') {
        const val = getVal(prefix + '-fami');
        if (!/^\d{6}$/.test(val)) { 
            alert('店號必須是 6 位數字'); 
            isValid = false; 
        } else { 
            updates.store_fami = val; 
            updates.store_fami_note = getVal(prefix + '-fami-note'); 
        }
    } else if (section === 'addr') {
        updates.shipping_address = getVal(prefix + '-addr');
    }

    // [修正點] 確保這裡不會有語法錯誤
    if (isValid === false) return;

    const btn = document.getElementById(btnId);
    let oldText = '';
    
    if (btn) {
        oldText = btn.innerHTML;
        btn.innerHTML = '...'; 
        btn.disabled = true;
    }

    try {
        // 合併新舊資料
        const newData = Object.assign({}, globalUser, updates);
        const res = await API.saveMember(newData);
        
        if (res.success) {
            globalUser = newData;
            localStorage.setItem('keicha_v2_user', JSON.stringify(globalUser));
            updateAuthUI();
            
            // 如果是結帳模式，更新完後要切換回檢視模式
            if (isCheckoutMode === true) {
                toggleCheckoutEdit(section); 
                // 重新選擇物流以刷新顯示
                if (section === '711') selectShipMethod('7-11');
                if (section === 'fami') selectShipMethod('fami');
                if (section === 'addr') selectShipMethod('addr');
            } else {
                toggleEdit(section); // 會員中心模式
            }
        } else {
            alert("儲存失敗");
        }
    } catch (e) {
        console.error(e);
        alert("系統錯誤");
    } finally {
        if (btn) {
            btn.innerHTML = oldText;
            btn.disabled = false;
        }
    }
}

// 5. 結帳與運費邏輯

// 選擇物流方式 (UI互動)
function selectShipMethod(type) {
    if (!globalUser) { 
        openPanel('login-panel'); 
        return; 
    }

    // 檢查是否有資料，沒資料就打開編輯框
    let hasData = false;
    if (type === '7-11' && globalUser.store_711) hasData = true;
    if (type === 'fami' && globalUser.store_fami) hasData = true;
    if (type === 'addr' && globalUser.shipping_address) hasData = true;

    if (!hasData) {
        let editSection = '';
        if (type === '7-11') editSection = '711';
        else if (type === 'fami') editSection = 'fami';
        else editSection = 'addr';
        
        toggleCheckoutEdit(editSection);
        return;
    }

    if (type === 'fami') currentShippingMethod = '全家';
    else if (type === 'addr') currentShippingMethod = '宅配';
    else currentShippingMethod = '7-11';

    // UI 樣式更新
    const cards = document.querySelectorAll('.ship-opt-card');
    cards.forEach(function(el) {
        el.classList.remove('border-[#6ea44c]', 'bg-[#6ea44c]/5');
        el.classList.add('border-gray-50');
    });
    
    let mapId = '';
    if (type === 'fami') mapId = 'opt-fami';
    else if (type === 'addr') mapId = 'opt-addr';
    else mapId = 'opt-7-11';

    const activeEl = document.getElementById(mapId);
    if (activeEl) {
        activeEl.classList.remove('border-gray-50');
        activeEl.classList.add('border-[#6ea44c]', 'bg-[#6ea44c]/5');
    }

    // 觸發頁面上的金額更新
    if (typeof updatePageSummary === 'function') {
        updatePageSummary();
    }
}

// 6. 工具函式
function getVal(id) { 
    const el = document.getElementById(id); 
    return el ? el.value.trim() : ''; 
}

function setVal(id, val) { 
    const el = document.getElementById(id); 
    if (el) el.value = val || ''; 
}

function setText(id, txt) { 
    const el = document.getElementById(id); 
    if (el) el.innerText = txt || ''; 
}

// 切換編輯/檢視模式 (會員中心)
function toggleEdit(section) {
    const disp = document.getElementById('display-' + section);
    const edit = document.getElementById('edit-' + section);
    if (disp && edit) {
        const isHidden = edit.classList.contains('hidden');
        if (isHidden) { 
            edit.classList.remove('hidden'); 
            disp.classList.add('hidden'); 
        } else { 
            edit.classList.add('hidden'); 
            disp.classList.remove('hidden'); 
        }
    }
}

// 切換結帳頁面的編輯模式
function toggleCheckoutEdit(section) {
    if (section === 'info') {
        const view = document.getElementById('checkout-view-info');
        const edit = document.getElementById('checkout-edit-info');
        if (view && edit) {
            // 切換 hidden class
            if (view.classList.contains('hidden')) {
                view.classList.remove('hidden');
                edit.classList.add('hidden');
            } else {
                view.classList.add('hidden');
                edit.classList.remove('hidden');
            }
        }
    } else {
        const editBlock = document.getElementById('checkout-edit-' + section);
        if (editBlock) {
            if (editBlock.classList.contains('hidden')) {
                editBlock.classList.remove('hidden');
            } else {
                editBlock.classList.add('hidden');
            }
        }
    }
}
