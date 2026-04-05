/**
 * =====================================================
 * MÃ KHUYẾN MÃI WIDGET — Multi-step + Firebase Config
 *
 * Firestore — collection "configs":
 *   Document ID = hostname (vd: yoursite.com)
 *   plan: "2step_75"
 *
 * Firestore — collection "claims":
 *   visitor_id, domain, plan, started_at, claimed_at,
 *   duration_sec, steps_completed, code
 * =====================================================
 */
(async () => {

    const FIREBASE_CONFIG = {
        apiKey:            "AIzaSyDeycy4mB_KcBGay9qNtN4oJ8R2ejd2w-Q",
        authDomain:        "traffic1m.firebaseapp.com",
        projectId:         "traffic1m",
        storageBucket:     "traffic1m.firebasestorage.app",
        messagingSenderId: "7324624117",
        appId:             "1:7324624117:web:648907f451d43fc43f51bc",
    };

    // ============================================================
    // STEP CONFIG — map với plan key trên Firestore
    // ============================================================
    const STEP_CONFIG = {
        '1step_60':  { max_steps: 1, countdown_times: [60]            },
        '1step_90':  { max_steps: 1, countdown_times: [90]            },
        '1step_120': { max_steps: 1, countdown_times: [120]           },
        '2step_75':  { max_steps: 2, countdown_times: [60,  15]       },
        '2step_90':  { max_steps: 2, countdown_times: [70,  20]       },
        '2step_120': { max_steps: 2, countdown_times: [90,  30]       },
        '3step_90':  { max_steps: 3, countdown_times: [60,  15, 15]   },
        '3step_120': { max_steps: 3, countdown_times: [90,  15, 15]   },
        '3step_150': { max_steps: 3, countdown_times: [120, 15, 15]   },
    };

    const DEFAULT_PLAN = '1step_60';

    const CONFIG = {
        btnLabel:         "🎁 Lấy mã khuyến mãi",
        btnColor:         "#e53935",
        btnHoverColor:    "#b71c1c",
        codeLength:       8,
        collectionName:   "claims",
        configCollection: "configs",
    };

    // ============================================================
    // LOAD FIREBASE SDK
    // ============================================================
    let db, fsHelpers;
    try {
        const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
        const { getFirestore, collection, addDoc, updateDoc, doc, getDoc, Timestamp } = await import(
            "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"
        );
        db = getFirestore(initializeApp(FIREBASE_CONFIG));
        fsHelpers = { collection, addDoc, updateDoc, doc, getDoc, Timestamp };
    } catch (e) {
        console.error("[MKM] Lỗi load Firebase:", e);
        return;
    }

    const { collection, addDoc, updateDoc, doc, getDoc, Timestamp } = fsHelpers;

    // ============================================================
    // ĐỌC CONFIG THEO DOMAIN TỪ FIRESTORE
    // ============================================================
    const hostname = window.location.hostname;
    let activePlan    = DEFAULT_PLAN;
    let activeStepCfg = STEP_CONFIG[DEFAULT_PLAN];

    try {
        const snap = await getDoc(doc(db, CONFIG.configCollection, hostname));
        if (snap.exists()) {
            const key = snap.data().plan;
            if (STEP_CONFIG[key]) {
                activePlan    = key;
                activeStepCfg = STEP_CONFIG[key];
                console.log(`[MKM] ✅ Plan "${activePlan}" cho "${hostname}"`, activeStepCfg);
            } else {
                console.warn(`[MKM] Plan "${key}" không hợp lệ → dùng mặc định`);
            }
        } else {
            console.warn(`[MKM] Chưa có config cho "${hostname}" → dùng mặc định: ${DEFAULT_PLAN}`);
        }
    } catch (e) {
        console.warn("[MKM] Không đọc được config:", e.message);
    }

    // ============================================================
    // HELPERS
    // ============================================================
    function getVisitorId() {
        let v = localStorage.getItem("_mkm_vid");
        if (!v) { v = "v_" + Math.random().toString(36).slice(2,10) + Date.now().toString(36); localStorage.setItem("_mkm_vid", v); }
        return v;
    }
    function generateCode(n) {
        const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", a = new Uint8Array(n);
        crypto.getRandomValues(a);
        return Array.from(a, b => c[b % c.length]).join("");
    }
    function fmtTime(ts) {
        return (ts.toDate ? ts.toDate() : new Date(ts))
            .toLocaleTimeString("vi-VN", { hour:"2-digit", minute:"2-digit", second:"2-digit" });
    }

    // ============================================================
    // CSS
    // ============================================================
    document.head.insertAdjacentHTML("beforeend", `<style>
        @import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;700;800&display=swap');
        #mkm-widget,#mkm-widget *{box-sizing:border-box;font-family:'Be Vietnam Pro',sans-serif;}
        #mkm-widget{display:inline-block;text-align:center;}
        #mkm-btn{
            display:inline-flex;align-items:center;gap:8px;padding:12px 24px;
            background:${CONFIG.btnColor};color:#fff;border:none;border-radius:10px;
            font-size:15px;font-weight:700;letter-spacing:.4px;cursor:pointer;-webkit-appearance:none;
            transition:background .2s,transform .15s,box-shadow .2s;box-shadow:0 4px 14px rgba(229,57,53,.35);
        }
        #mkm-btn:hover:not(:disabled){background:${CONFIG.btnHoverColor};transform:translateY(-2px);}
        #mkm-btn:disabled{background:#bdbdbd;cursor:not-allowed;box-shadow:none;opacity:.7;}
        #mkm-popup{
            position:fixed;bottom:24px;right:24px;min-width:270px;max-width:min(370px,94vw);
            padding:16px 20px 16px 24px;border-radius:14px;font-size:14px;line-height:1.65;
            z-index:999999;border:1.5px solid transparent;word-break:break-word;
            box-shadow:0 8px 30px rgba(0,0,0,.14);transition:opacity .25s,transform .25s;
        }
        #mkm-popup.mkm-hidden{opacity:0;transform:translateY(12px);pointer-events:none;}
        #mkm-popup::before{content:'';position:absolute;left:0;top:12%;bottom:12%;width:4px;border-radius:0 4px 4px 0;}
        #mkm-popup.mkm-loading{background:#e3f2fd;border-color:#42a5f5;color:#0d47a1;}
        #mkm-popup.mkm-loading::before{background:#42a5f5;}
        #mkm-popup.mkm-countdown{background:#fff8e1;border-color:#ffb300;color:#5d4037;}
        #mkm-popup.mkm-countdown::before{background:#ffb300;}
        #mkm-popup.mkm-success{background:#e8f5e9;border-color:#43a047;color:#1b5e20;}
        #mkm-popup.mkm-success::before{background:#43a047;}
        #mkm-popup.mkm-error{background:#ffebee;border-color:#ef5350;color:#b71c1c;}
        #mkm-popup.mkm-error::before{background:#ef5350;}
        .mkm-step-badge{
            display:inline-block;font-size:11px;font-weight:700;
            background:rgba(255,152,0,.2);color:#e65100;border:1px solid rgba(255,152,0,.4);
            border-radius:20px;padding:2px 10px;margin-bottom:6px;
        }
        .mkm-timer{
            display:inline-block;font-size:22px;font-weight:800;font-family:'Courier New',monospace;
            color:#e65100;background:rgba(255,152,0,.15);padding:2px 10px;
            border-radius:6px;border:1px solid rgba(255,152,0,.35);min-width:52px;text-align:center;
        }
        .mkm-progress{height:6px;background:rgba(0,0,0,.1);border-radius:4px;margin-top:10px;overflow:hidden;}
        .mkm-progress-bar{height:100%;background:linear-gradient(90deg,#ffb300,#ff6f00);border-radius:4px;transition:width .85s linear;}
        .mkm-code-box{
            display:block;margin:10px 0 4px;padding:10px 20px;
            background:linear-gradient(135deg,#d4edda,#b2dfdb);border:2px dashed #43a047;border-radius:10px;
            font-size:26px;font-weight:800;letter-spacing:6px;color:#1b5e20;font-family:'Courier New',monospace;text-align:center;
        }
        .mkm-meta{font-size:11px;color:#388e3c;opacity:.85;margin-top:6px;text-align:center;line-height:1.7;}
        .mkm-copy-btn{
            display:inline-flex;align-items:center;gap:6px;margin-top:10px;
            padding:7px 16px;background:#43a047;color:#fff;border:none;border-radius:8px;
            font-size:12px;font-weight:700;cursor:pointer;transition:background .2s;
        }
        .mkm-copy-btn:hover{background:#2e7d32;}
        .mkm-copy-btn.copied{background:#00796b;}
        .mkm-retry-btn{
            display:inline-flex;align-items:center;gap:6px;margin-top:10px;
            padding:7px 16px;background:#e53935;color:#fff;border:none;border-radius:8px;
            font-size:12px;font-weight:700;cursor:pointer;transition:background .2s;
        }
        .mkm-retry-btn:hover{background:#b71c1c;}
    </style>`);

    // ============================================================
    // HTML
    // ============================================================
    const widget = document.createElement("div");
    widget.id = "mkm-widget";
    widget.innerHTML = `<button id="mkm-btn">${CONFIG.btnLabel}</button>`;
    (document.getElementById("mkm-container") || document.querySelector("footer") || document.body).appendChild(widget);

    const popup = document.createElement("div");
    popup.id = "mkm-popup"; popup.className = "mkm-hidden";
    document.body.appendChild(popup);

    const btn = document.getElementById("mkm-btn");
    const showPopup = (html, cls) => { popup.className = cls; popup.innerHTML = html; };

    function copyText(text, el) {
        const done = () => {
            el.classList.add("copied"); el.textContent = "✓ Đã sao chép!";
            setTimeout(() => { el.classList.remove("copied"); el.textContent = "📋 Sao chép mã"; }, 2500);
        };
        navigator.clipboard?.writeText(text).then(done).catch(() => {
            const ta = Object.assign(document.createElement("textarea"), { value: text, style: "position:fixed;opacity:0" });
            document.body.appendChild(ta); ta.select();
            try { document.execCommand("copy"); done(); } catch(_){}
            document.body.removeChild(ta);
        });
    }

    // ── Đếm ngược 1 bước ──
    function runCountdown(stepIdx, totalSteps, seconds) {
        return new Promise(resolve => {
            let rem = seconds;
            const stepLabel = totalSteps > 1
                ? `<div class="mkm-step-badge">Bước ${stepIdx + 1} / ${totalSteps}</div>` : '';
            const render = r => {
                const pct = Math.round((1 - r / seconds) * 100);
                showPopup(`${stepLabel}🎯 Đang chuẩn bị mã... <span class="mkm-timer">${r}s</span>
                    <div class="mkm-progress"><div class="mkm-progress-bar" style="width:${pct}%"></div></div>`,
                    "mkm-countdown");
            };
            render(rem);
            const iv = setInterval(() => { rem--; if (rem <= 0) { clearInterval(iv); resolve(); } else render(rem); }, 1000);
        });
    }

    // ============================================================
    // MAIN CLAIM FLOW
    // ============================================================
    let busy = false;
    const visitorId = getVisitorId();

    async function runClaim() {
        busy = true; btn.disabled = true;
        const { max_steps, countdown_times } = activeStepCfg;

        // 1. Ghi started_at
        showPopup("⏳ Đang kết nối...", "mkm-loading");
        const startedAt = Timestamp.now();
        let claimRef;
        try {
            claimRef = await addDoc(collection(db, CONFIG.collectionName), {
                visitor_id:      visitorId,
                domain:          window.location.origin,
                plan:            activePlan,
                max_steps,
                countdown_times,
                started_at:      startedAt,
                claimed_at:      null,
                duration_sec:    null,
                steps_completed: 0,
                code:            null,
            });
            console.log("[MKM] ✅ started_at OK — docId:", claimRef.id);
        } catch (e) {
            console.error("[MKM] ❌ Lỗi ghi started_at:", e);
            showPopup(`❌ <strong>Không kết nối được Firebase.</strong><br><small>${e.message}</small>
                <div style="text-align:center"><button class="mkm-retry-btn" id="mkm-retry-btn">🔄 Thử lại</button></div>`,
                "mkm-error");
            document.getElementById("mkm-retry-btn")?.addEventListener("click", () => { busy=false; btn.disabled=false; runClaim(); });
            busy = false; btn.disabled = false; return;
        }

        // 2. Chạy từng bước đếm ngược
        for (let i = 0; i < max_steps; i++) {
            await runCountdown(i, max_steps, countdown_times[i]);
        }

        // 3. Lưu mã lên Firestore TRƯỚC
        showPopup("⏳ Đang lưu mã...", "mkm-loading");
        const code      = generateCode(CONFIG.codeLength);
        const claimedAt = Timestamp.now();
        const durSec    = Math.round((claimedAt.toMillis() - startedAt.toMillis()) / 1000);

        try {
            await updateDoc(doc(db, CONFIG.collectionName, claimRef.id), {
                claimed_at:      claimedAt,
                duration_sec:    durSec,
                steps_completed: max_steps,
                code,
            });
            console.log(`[MKM] ✅ Lưu mã OK: ${code} | plan: ${activePlan} | ${durSec}s`);
        } catch (e) {
            console.error("[MKM] ❌ Lỗi lưu mã:", e);
            showPopup(`❌ <strong>Lưu mã thất bại.</strong><br><small>${e.message}</small>
                <div style="text-align:center"><button class="mkm-retry-btn" id="mkm-retry-btn">🔄 Thử lại</button></div>`,
                "mkm-error");
            document.getElementById("mkm-retry-btn")?.addEventListener("click", () => { busy=false; btn.disabled=false; runClaim(); });
            busy = false; btn.disabled = false; return;
        }

        // 4. Hiện mã
        showPopup(`
            🎉 <strong>Mã khuyến mãi của bạn:</strong>
            <span class="mkm-code-box">${code}</span>
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
    }

    btn.addEventListener("click", () => { if (!busy) runClaim(); });

})();
