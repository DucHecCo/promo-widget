/**
 * =====================================================
 * MÃ KHUYẾN MÃI WIDGET — Firebase Firestore Edition
 * Nhúng vào web: <script type="module" src="...ma-khuyen-mai.js"></script>
 *
 * FIRESTORE — collection "claims":
 *   visitor_id   : ID thiết bị (lưu localStorage)
 *   domain       : domain web khách hàng
 *   started_at   : timestamp lúc nhấn nút
 *   claimed_at   : timestamp lúc nhận mã
 *   duration_sec : số giây từ bấm → nhận mã
 *   code         : mã khuyến mãi random
 * =====================================================
 */
(async () => {

    // ============================================================
    // FIREBASE CONFIG (traffic1m project)
    // ============================================================
    const FIREBASE_CONFIG = {
        apiKey:            "AIzaSyDeycy4mB_KcBGay9qNtN4oJ8R2ejd2w-Q",
        authDomain:        "traffic1m.firebaseapp.com",
        projectId:         "traffic1m",
        storageBucket:     "traffic1m.firebasestorage.app",
        messagingSenderId: "7324624117",
        appId:             "1:7324624117:web:648907f451d43fc43f51bc",
    };

    // ============================================================
    // CÀI ĐẶT WIDGET — tuỳ chỉnh tại đây
    // ============================================================
    const CONFIG = {
        btnLabel:       "🎁 Lấy mã khuyến mãi",
        btnColor:       "#e53935",
        btnHoverColor:  "#b71c1c",
        countdownSec:   10,        // Giây đếm ngược
        codeLength:     8,         // Độ dài mã random
        collectionName: "claims",  // Tên collection Firestore
    };

    // ============================================================
    // LOAD FIREBASE SDK (Firestore)
    // ============================================================
    let db, fsHelpers;
    try {
        const { initializeApp } = await import(
            "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"
        );
        const { getFirestore, collection, addDoc, updateDoc, doc, Timestamp } = await import(
            "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"
        );
        const app = initializeApp(FIREBASE_CONFIG);
        db = getFirestore(app);
        fsHelpers = { collection, addDoc, updateDoc, doc, Timestamp };
    } catch (e) {
        console.error("[MKM] Lỗi load Firebase:", e);
        return;
    }

    const { collection, addDoc, updateDoc, doc, Timestamp } = fsHelpers;

    // ============================================================
    // VISITOR ID — nhận diện thiết bị
    // ============================================================
    function getVisitorId() {
        let vid = localStorage.getItem("_mkm_vid");
        if (!vid) {
            vid = "v_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
            localStorage.setItem("_mkm_vid", vid);
        }
        return vid;
    }

    // ============================================================
    // TẠO MÃ RANDOM (chữ hoa + số, loại ký tự dễ nhầm)
    // ============================================================
    function generateCode(length) {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        const arr = new Uint8Array(length);
        crypto.getRandomValues(arr);
        return Array.from(arr, b => chars[b % chars.length]).join("");
    }

    // ============================================================
    // FORMAT GIỜ PHÚT GIÂY (vi-VN)
    // ============================================================
    function fmtTime(ts) {
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    }

    // ============================================================
    // INJECT CSS
    // ============================================================
    document.head.insertAdjacentHTML("beforeend", `<style>
        @import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;700;800&display=swap');
        #mkm-widget,#mkm-widget *{box-sizing:border-box;font-family:'Be Vietnam Pro',sans-serif;}
        #mkm-widget{display:inline-block;text-align:center;}

        #mkm-btn{
            display:inline-flex;align-items:center;gap:8px;
            padding:12px 24px;background:${CONFIG.btnColor};color:#fff;
            border:none;border-radius:10px;font-size:15px;font-weight:700;
            letter-spacing:.4px;cursor:pointer;-webkit-appearance:none;
            transition:background .2s,transform .15s,box-shadow .2s;
            box-shadow:0 4px 14px rgba(229,57,53,.35);
        }
        #mkm-btn:hover:not(:disabled){background:${CONFIG.btnHoverColor};transform:translateY(-2px);box-shadow:0 7px 20px rgba(229,57,53,.40);}
        #mkm-btn:active:not(:disabled){transform:translateY(0);}
        #mkm-btn:disabled{background:#bdbdbd;cursor:not-allowed;box-shadow:none;opacity:.7;}

        #mkm-popup{
            position:fixed;bottom:24px;right:24px;
            min-width:270px;max-width:min(370px,94vw);
            padding:16px 20px 16px 24px;border-radius:14px;
            font-size:14px;line-height:1.65;z-index:999999;
            border:1.5px solid transparent;word-break:break-word;
            box-shadow:0 8px 30px rgba(0,0,0,.14);
            transition:opacity .25s ease,transform .25s ease;
        }
        #mkm-popup.mkm-hidden{opacity:0;transform:translateY(12px);pointer-events:none;}
        #mkm-popup::before{content:'';position:absolute;left:0;top:12%;bottom:12%;width:4px;border-radius:0 4px 4px 0;}

        #mkm-popup.mkm-loading  {background:#e3f2fd;border-color:#42a5f5;color:#0d47a1;}
        #mkm-popup.mkm-loading::before  {background:#42a5f5;}
        #mkm-popup.mkm-countdown{background:#fff8e1;border-color:#ffb300;color:#5d4037;}
        #mkm-popup.mkm-countdown::before{background:#ffb300;}
        #mkm-popup.mkm-success  {background:#e8f5e9;border-color:#43a047;color:#1b5e20;}
        #mkm-popup.mkm-success::before  {background:#43a047;}
        #mkm-popup.mkm-error    {background:#ffebee;border-color:#ef5350;color:#b71c1c;}
        #mkm-popup.mkm-error::before    {background:#ef5350;}

        .mkm-code-box{
            display:block;margin:10px 0 4px;padding:10px 20px;
            background:linear-gradient(135deg,#d4edda,#b2dfdb);
            border:2px dashed #43a047;border-radius:10px;
            font-size:26px;font-weight:800;letter-spacing:6px;
            color:#1b5e20;font-family:'Courier New',monospace;text-align:center;
        }
        .mkm-meta{font-size:11px;color:#388e3c;opacity:.85;margin-top:6px;text-align:center;line-height:1.7;}

        .mkm-copy-btn{
            display:inline-flex;align-items:center;gap:6px;
            margin-top:10px;padding:7px 16px;background:#43a047;color:#fff;
            border:none;border-radius:8px;font-size:12px;font-weight:700;
            cursor:pointer;transition:background .2s,transform .15s;letter-spacing:.3px;
        }
        .mkm-copy-btn:hover{background:#2e7d32;transform:translateY(-1px);}
        .mkm-copy-btn.copied{background:#00796b;cursor:default;}

        .mkm-timer{
            display:inline-block;font-size:22px;font-weight:800;
            font-family:'Courier New',monospace;color:#e65100;
            background:rgba(255,152,0,.15);padding:2px 10px;
            border-radius:6px;border:1px solid rgba(255,152,0,.35);
            vertical-align:middle;min-width:52px;text-align:center;
        }
        .mkm-progress{height:6px;background:rgba(0,0,0,.1);border-radius:4px;margin-top:10px;overflow:hidden;}
        .mkm-progress-bar{height:100%;background:linear-gradient(90deg,#ffb300,#ff6f00);border-radius:4px;transition:width .85s linear;}
    </style>`);

    // ============================================================
    // TẠO WIDGET HTML
    // ============================================================
    const widget = document.createElement("div");
    widget.id = "mkm-widget";
    widget.innerHTML = `<button id="mkm-btn">${CONFIG.btnLabel}</button>`;

    const anchor = document.getElementById("mkm-container")
                || document.querySelector("footer")
                || document.body;
    anchor.appendChild(widget);

    const popup = document.createElement("div");
    popup.id = "mkm-popup";
    popup.className = "mkm-hidden";
    document.body.appendChild(popup);

    const btn = document.getElementById("mkm-btn");
    const showPopup = (html, cls) => { popup.className = cls; popup.innerHTML = html; };

    // ============================================================
    // SAO CHÉP CLIPBOARD
    // ============================================================
    function copyText(text, el) {
        const done = () => {
            el.classList.add("copied");
            el.textContent = "✓ Đã sao chép!";
            setTimeout(() => { el.classList.remove("copied"); el.textContent = "📋 Sao chép mã"; }, 2500);
        };
        navigator.clipboard?.writeText(text).then(done).catch(() => {
            const ta = Object.assign(document.createElement("textarea"), { value: text, style: "position:fixed;opacity:0" });
            document.body.appendChild(ta); ta.select();
            try { document.execCommand("copy"); done(); } catch(_) {}
            document.body.removeChild(ta);
        });
    }

    // ============================================================
    // CLICK HANDLER
    // ============================================================
    let busy = false;
    const visitorId = getVisitorId();

    btn.addEventListener("click", async () => {
        if (busy) return;
        busy = true;
        btn.disabled = true;

        // ── 1. Ghi started_at vào Firestore ──
        showPopup("⏳ Đang khởi tạo...", "mkm-loading");
        const startedAt = Timestamp.now();
        let claimRef = null;

        try {
            claimRef = await addDoc(collection(db, CONFIG.collectionName), {
                visitor_id:   visitorId,
                domain:       window.location.origin,
                started_at:   startedAt,
                claimed_at:   null,
                duration_sec: null,
                code:         null,
            });
        } catch (e) {
            showPopup("❌ Không kết nối được Firebase.<br><small>Vui lòng kiểm tra lại cấu hình.</small>", "mkm-error");
            btn.disabled = false;
            busy = false;
            return;
        }

        // ── 2. Đếm ngược ──
        await new Promise(resolve => {
            let rem = CONFIG.countdownSec;
            const total = rem;
            const render = r => {
                const pct = Math.round((1 - r / total) * 100);
                showPopup(`🎯 Đang chuẩn bị mã... <span class="mkm-timer">${r}s</span>
                    <div class="mkm-progress"><div class="mkm-progress-bar" style="width:${pct}%"></div></div>`,
                    "mkm-countdown");
            };
            render(rem);
            const iv = setInterval(() => { rem--; if (rem <= 0) { clearInterval(iv); resolve(); } else render(rem); }, 1000);
        });

        // ── 3. Tạo mã + ghi claimed_at ──
        const code      = generateCode(CONFIG.codeLength);
        const claimedAt = Timestamp.now();
        const durSec    = Math.round((claimedAt.toMillis() - startedAt.toMillis()) / 1000);

        try {
            await updateDoc(doc(db, CONFIG.collectionName, claimRef.id), {
                claimed_at:   claimedAt,
                duration_sec: durSec,
                code:         code,
            });
        } catch (e) {
            console.warn("[MKM] Không cập nhật được claimed_at:", e);
        }

        // ── 4. Hiện mã ──
        showPopup(`
            🎉 <strong>Mã khuyến mãi của bạn:</strong>
            <span class="mkm-code-box" id="mkm-code-val">${code}</span>
            <div class="mkm-meta">
                🕐 Bắt đầu: <strong>${fmtTime(startedAt)}</strong><br>
                🕑 Nhận mã: <strong>${fmtTime(claimedAt)}</strong><br>
                ⏱ Thời gian xử lý: <strong>${durSec} giây</strong>
            </div>
            <div style="text-align:center">
                <button class="mkm-copy-btn" id="mkm-copy-btn">📋 Sao chép mã</button>
            </div>
        `, "mkm-success");

        document.getElementById("mkm-copy-btn")?.addEventListener("click", () => {
            copyText(code, document.getElementById("mkm-copy-btn"));
        });
    });

})();
