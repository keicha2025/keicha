/**
 * js/checkout_core.js
 * 僅保留共用的 UI 控制與 API 登入輔助
 */

// UI 控制 (側邊欄)
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

// 側邊欄的登入按鈕邏輯 (Login Panel 用)
async function handleQuickLogin() {
    const phoneInput = document.getElementById('login-phone');
    if (!phoneInput) return;
    const phone = phoneInput.value.trim();
    if (!/^09\d{8}$/.test(phone)) return alert("請輸入正確的 09 開頭 10 碼電話");

    const btn = document.getElementById('login-submit-btn');
    const oldHtml = btn.innerHTML;
    btn.innerHTML = '驗證中...';

    try {
        const res = await API.login(phone);
        if (res.success) {
            // 登入成功，儲存到 LocalStorage
            localStorage.setItem('keicha_v2_user', JSON.stringify(res.data));
            closeAllPanels();
            
            // 如果是在 DIY 頁面，嘗試自動帶入
            const inputPhone = document.getElementById('input-phone');
            if (inputPhone) {
                inputPhone.value = res.data.phone;
                // 呼叫 DIY 頁面的填表函式 (如果存在)
                if (typeof fillFormWithData === 'function') {
                    fillFormWithData(res.data);
                }
            }
            alert("登入成功！");
        } else {
            alert("登入失敗：" + (res.msg || "未知錯誤"));
        }
    } catch (e) {
        alert("系統錯誤");
    } finally {
        btn.innerHTML = oldHtml;
    }
}
