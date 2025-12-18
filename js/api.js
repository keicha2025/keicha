/**
 * js/api.js
 * 負責處理所有與 Google Apps Script (GAS) 的連線請求
 */

// 設定你的 GAS 部署網址
const GAS_URL = "https://script.google.com/macros/s/AKfycbyUq36i64Z-JGcERE_rZOdphVtVDX8L-lguc7eiUIdoAERqI1ZK8GWAL-HgbC75cuMHFg/exec"; 

const API = {
    // 1. 取得所有初始資料 (GET)
    // 回傳：商品列表、運費規則、全域設定、(未來還有快速結帳設定)
    async fetchSystemData() {
        try {
            const res = await fetch(GAS_URL);
            return await res.json();
        } catch (e) {
            console.error("API Error (fetchSystemData):", e);
            throw new Error("無法連線至伺服器");
        }
    },

    // 2. 會員登入 (查詢)
    async login(phone) {
        return await this._post({ action: 'login', phone });
    },

    // 3. 儲存會員資料 (更新)
    async saveMember(data) {
        // data 應包含 phone, name, email, store_711... 等
        return await this._post({ action: 'save', ...data });
    },

    // 4. 送出訂單 (結帳)
    async checkout(orderData) {
        // orderData 應包含 name, phone, items, subtotal, shipping, logistics...
        return await this._post({ action: 'checkout', ...orderData });
    },

    // --- 內部共用 POST 方法 ---
    async _post(payload) {
        try {
            // 使用 text/plain 避免 Google 的 CORS 選項請求問題
            const res = await fetch(GAS_URL, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            return await res.json();
        } catch (e) {
            console.error("API Error:", e);
            throw e;
        }
    }
};

// 讓全域都可以使用 API 物件
window.API = API;
