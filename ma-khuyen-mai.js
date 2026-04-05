/**
 * =====================================================
 * MÃ KHUYẾN MÃI WIDGET — Multi-step
 *
 * LUỒNG:
 *  1step_*  → đếm ngược → trả mã
 *  2step_*  → bước 1: đếm ngược số giây [0]
 *              → đánh dấu, user sang trang khác
 *              → quay lại / trang mới: nhấn nút "Tiếp tục"
 *              → bước 2: đếm ngược số giây [1] → trả mã
 *
 * Firestore "claims":
 *   visitor_id, domain, plan, max_steps, countdown_times
 *   started_at, step_timestamps[], claimed_at, duration_sec
 *   steps_completed, code
 *
 * Firestore "configs":
 *   Document ID = hostname → field: plan (string)
 * =====================================================
 */
(async () => {

    // ── Firebase config ──────────────────────────────────────────
    const FIREBASE_CONFIG = {
        apiKey:            "AIzaSyDeycy4mB_KcBGay9qNtN4oJ8R2ejd2w-Q",
        authDomain:        "traffic1m.firebaseapp.com",
        projectId:         "traffic1m",
        storageBucket:     "traffic1m.firebasestorage.app",
        messagingSenderId: "7324624117",
        appId:             "1:7324624117:web:648907f451d43fc43f51bc",
    };

    // ── Step config map ──────────────────────────────────────────
    const STEP_CONFIG = {
        '1step_60':  { max_steps: 1, countdown_times: [60]       },
        '1step_90':  { max_steps: 1, countdown_times: [90]       },
        '1step_120': { max_steps: 1, countdown_times: [120]      },
        '2step_75':  { max_steps: 2, countdown_times: [60,  15]  },
        '2step_90':  { max_steps: 2, countdown_times: [70,  20]  },
        '2step_120': { max_steps: 2, countdown_times: [90,  30]  },
    };

    const DEFAULT_PLAN    = '1step_60';
    const CLAIM_STORE_KEY = '_mkm_claim';

    const CFG = {
        btnLabel:   '🎁 Lấy mã khuyến mãi',
        btnColor:   '#e53935',
        btnHover:   '#b71c1c',
        codeLength: 8,
        col:        'claims',
        configCol:  'configs',
    };

    // ── Load Firebase ────────────────────────────────────────────
    let db, FS;
    try {
        const { initializeApp, getApps, getApp } =
            await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
        const { getFirestore, collection, addDoc, updateDoc, doc, getDoc, Timestamp } =
            await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        // Tránh lỗi duplicate-app nếu script load nhiều lần
        const app = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);
        db = getFirestore(app);
        FS = { collection, addDoc, updateDoc, doc, getDoc, Timestamp };
    } catch (e) { console.error('[MKM] Firebase load fail:', e); return; }

    const { collection, addDoc, updateDoc, doc, getDoc, Timestamp } = FS;

    // ── Đọc plan từ Firestore theo domain ────────────────────────
    const hostname = window.location.hostname;
    let activePlan    = DEFAULT_PLAN;
    let activeStepCfg = STEP_CONFIG[DEFAULT_PLAN];
    try {
        const snap = await getDoc(doc(db, CFG.configCol, hostname));
        console.log(`[MKM] Config lookup → hostname: "${hostname}" | exists: ${snap.exists()}`);
        if (snap.exists()) {
            const key = snap.data().plan;
            console.log(`[MKM] Plan from Firestore: "${key}" | known: ${!!STEP_CONFIG[key]}`);
            if (STEP_CONFIG[key]) {
                activePlan    = key;
                activeStepCfg = STEP_CONFIG[key];
            } else {
                console.warn(`[MKM] ⚠️ Plan "${key}" không có trong STEP_CONFIG → dùng default`);
            }
        } else {
            console.warn(`[MKM] ⚠️ Không tìm thấy doc configs/"${hostname}" → dùng default`);
        }
        console.log(`[MKM] ✅ activePlan: "${activePlan}" | max_steps: ${activeStepCfg.max_steps}`);
    } catch (e) { console.warn('[MKM] Không đọc config:', e.message); }

    // ── Helpers ──────────────────────────────────────────────────
    function getVisitorId() {
        let v = localStorage.getItem('_mkm_vid');
        if (!v) {
            v = 'v_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
            localStorage.setItem('_mkm_vid', v);
        }
        return v;
    }
    function genCode(n) {
        const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', a = new Uint8Array(n);
        crypto.getRandomValues(a);
        return Array.from(a, b => c[b % c.length]).join('');
    }
    function fmtTime(ts) {
        return (ts && ts.toDate ? ts.toDate() : new Date(ts))
            .toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    function fmtMs(ms) {
        const s = Math.round(ms / 1000);
        return s >= 60 ? `${Math.floor(s / 60)}p ${s % 60}s` : `${s}s`;
    }
    const saveState  = v  => localStorage.setItem(CLAIM_STORE_KEY, JSON.stringify(v));
    const loadState  = () => { try { return JSON.parse(localStorage.getItem(CLAIM_STORE_KEY)); } catch { return null; } };
    const clearState = () => localStorage.removeItem(CLAIM_STORE_KEY);

    // ── CSS ──────────────────────────────────────────────────────
    document.head.insertAdjacentHTML('beforeend', `<style>
        @import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;700;800&display=swap');
        #mkm-widget,#mkm-widget *{box-sizing:border-box;font-family:'Be Vietnam Pro',sans-serif;}
        #mkm-widget{display:inline-block;text-align:center;}
        #mkm-btn{
            display:inline-flex;align-items:center;gap:8px;padding:12px 24px;
            background:${CFG.btnColor};color:#fff;border:none;border-radius:10px;
            font-size:15px;font-weight:700;cursor:pointer;-webkit-appearance:none;
            transition:background .2s,transform .15s,box-shadow .2s;
            box-shadow:0 4px 14px rgba(229,57,53,.35);
        }
        #mkm-btn:hover:not(:disabled){background:${CFG.btnHover};transform:translateY(-2px);}
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
        #mkm-popup.mkm-wait{background:#f3e5f5;border-color:#ab47bc;color:#4a148c;}
        #mkm-popup.mkm-wait::before{background:#ab47bc;}
        #mkm-popup.mkm-success{background:#e8f5e9;border-color:#43a047;color:#1b5e20;}
        #mkm-popup.mkm-success::before{background:#43a047;}
        #mkm-popup.mkm-error{background:#ffebee;border-color:#ef5350;color:#b71c1c;}
        #mkm-popup.mkm-error::before{background:#ef5350;}

        .mkm-step-badge{
            display:inline-block;font-size:11px;font-weight:700;
            background:rgba(171,71,188,.15);color:#7b1fa2;
            border:1px solid rgba(171,71,188,.35);border-radius:20px;padding:2px 10px;margin-bottom:6px;
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
            font-size:26px;font-weight:800;letter-spacing:6px;color:#1b5e20;
            font-family:'Courier New',monospace;text-align:center;
        }
        .mkm-meta{font-size:11px;color:#388e3c;opacity:.85;margin-top:6px;text-align:center;line-height:1.8;}
        .mkm-meta table{width:100%;border-collapse:collapse;}
        .mkm-meta td{padding:1px 4px;}
        .mkm-meta td:first-child{text-align:right;opacity:.7;}
        .mkm-meta td:last-child{text-align:left;font-weight:700;}

        .mkm-copy-btn{
            display:inline-flex;align-items:center;gap:6px;margin-top:10px;
            padding:7px 16px;background:#43a047;color:#fff;border:none;border-radius:8px;
            font-size:12px;font-weight:700;cursor:pointer;transition:background .2s;
        }
        .mkm-copy-btn:hover{background:#2e7d32;}
        .mkm-copy-btn.copied{background:#00796b;}

        .mkm-next-btn{
            display:inline-flex;align-items:center;justify-content:center;gap:6px;
            margin-top:12px;width:100%;padding:10px 16px;
            background:#7b1fa2;color:#fff;border:none;border-radius:10px;
            font-size:14px;font-weight:700;cursor:pointer;transition:background .2s,transform .15s;
            box-shadow:0 4px 12px rgba(123,31,162,.35);
        }
        .mkm-next-btn:hover{background:#4a148c;transform:translateY(-1px);}
        .mkm-next-btn:disabled{background:#bdbdbd;cursor:not-allowed;box-shadow:none;}

        .mkm-retry-btn{
            display:inline-flex;align-items:center;gap:6px;margin-top:10px;
            padding:7px 16px;background:#e53935;color:#fff;border:none;border-radius:8px;
            font-size:12px;font-weight:700;cursor:pointer;
        }
        .mkm-retry-btn:hover{background:#b71c1c;}

        .mkm-checklist{list-style:none;padding:0;margin:8px 0 0;text-align:left;}
        .mkm-checklist li{padding:3px 0;font-size:13px;}
        .mkm-checklist li.done{color:#2e7d32;font-weight:600;}
        .mkm-checklist li.pending{color:#7b1fa2;font-weight:600;}
        .mkm-checklist li.waiting{color:#9e9e9e;}
    </style>`);

    // ── Widget HTML ──────────────────────────────────────────────
    const widget = document.createElement('div');
    widget.id = 'mkm-widget';
    widget.innerHTML = `<button id="mkm-btn">${CFG.btnLabel}</button>`;
    (document.getElementById('mkm-container') || document.querySelector('footer') || document.body)
        .appendChild(widget);

    const popup = document.createElement('div');
    popup.id = 'mkm-popup'; popup.className = 'mkm-hidden';
    document.body.appendChild(popup);

    const btn  = document.getElementById('mkm-btn');
    const show = (html, cls) => { popup.className = cls; popup.innerHTML = html; };

    function copyText(text, el) {
        const done = () => {
            el.classList.add('copied'); el.textContent = '✓ Đã sao chép!';
            setTimeout(() => { el.classList.remove('copied'); el.textContent = '📋 Sao chép mã'; }, 2500);
        };
        navigator.clipboard?.writeText(text).then(done).catch(() => {
            const ta = Object.assign(document.createElement('textarea'),
                { value: text, style: 'position:fixed;opacity:0' });
            document.body.appendChild(ta); ta.select();
            try { document.execCommand('copy'); done(); } catch (_) {}
            document.body.removeChild(ta);
        });
    }

    // ── Đếm ngược (trả về Promise khi xong) ──────────────────────
    function countdown(stepIdx, totalSteps, seconds) {
        return new Promise(resolve => {
            let rem = seconds;
            const badge = totalSteps > 1
                ? `<div class="mkm-step-badge">Bước ${stepIdx + 1} / ${totalSteps}</div>` : '';
            const render = r => {
                const pct = Math.round((1 - r / seconds) * 100);
                show(`${badge}🎯 Đang chuẩn bị mã... <span class="mkm-timer">${r}s</span>
                    <div class="mkm-progress"><div class="mkm-progress-bar" style="width:${pct}%"></div></div>`,
                    'mkm-countdown');
            };
            render(rem);
            const iv = setInterval(() => {
                rem--;
                if (rem <= 0) { clearInterval(iv); resolve(); } else render(rem);
            }, 1000);
        });
    }

    // ── Lưu mã và hiện kết quả ───────────────────────────────────
    async function finalizeAndShow(state, stepTimestamps) {
        show('⏳ Đang lưu mã...', 'mkm-loading');
        const code      = genCode(CFG.codeLength);
        const claimedAt = Timestamp.now();
        const startedMs = state.step_starts[0];
        const durSec    = Math.round((claimedAt.toMillis() - startedMs) / 1000);

        // stepTimestamps = [start, step1Done, step2Done(=claimed)]
        // Chỉ hiện các mốc giữa (bỏ index 0=start, bỏ index cuối=claimed)
        const midSteps = stepTimestamps.slice(1, -1); // [] với 1step, [step1Done] với 2step
        const stepRows = midSteps.map((ts, i) => {
            const nextTs = stepTimestamps[i + 2] || claimedAt.toMillis();
            const diff   = fmtMs(nextTs - ts);
            return `<tr><td>Bước ${i + 1} xong:</td><td>${fmtTime(ts)} <span style="opacity:.6">(+${diff})</span></td></tr>`;
        }).join('');

        try {
            await updateDoc(doc(db, CFG.col, state.docId), {
                claimed_at:      claimedAt,
                duration_sec:    durSec,
                steps_completed: state.max_steps,
                step_timestamps: stepTimestamps,
                code,
            });
            console.log(`[MKM] ✅ Mã OK: ${code} | ${activePlan} | ${durSec}s`);
        } catch (e) {
            show(`❌ <strong>Lưu mã thất bại.</strong><br><small>${e.message}</small>
                <div style="text-align:center">
                    <button class="mkm-retry-btn" id="mkm-retry-btn">🔄 Thử lại</button>
                </div>`, 'mkm-error');
            document.getElementById('mkm-retry-btn')?.addEventListener('click',
                () => finalizeAndShow(state, stepTimestamps));
            return;
        }

        clearState();
        show(`
            🎉 <strong>Mã khuyến mãi của bạn:</strong>
            <span class="mkm-code-box">${code}</span>
            <div class="mkm-meta">
                <table>
                    <tr><td>🕐 Bắt đầu:</td><td>${fmtTime(startedMs)}</td></tr>
                    ${stepRows}
                    <tr><td>🕑 Nhận mã:</td><td>${fmtTime(claimedAt.toMillis())}</td></tr>
                    <tr><td>⏱ Tổng:</td><td>${durSec} giây</td></tr>
                </table>
            </div>
            <div style="text-align:center">
                <button class="mkm-copy-btn" id="mkm-copy-btn">📋 Sao chép mã</button>
            </div>
        `, 'mkm-success');
        document.getElementById('mkm-copy-btn')?.addEventListener('click', () => {
            copyText(code, document.getElementById('mkm-copy-btn'));
        });
    }

    // ════════════════════════════════════════════════════════════
    // LUỒNG 1STEP — chỉ đếm ngược → trả mã
    // ════════════════════════════════════════════════════════════
    async function runSimpleFlow() {
        busy = true; btn.disabled = true;
        show('⏳ Đang kết nối...', 'mkm-loading');

        const startedAt      = Timestamp.now();
        const stepTimestamps = [startedAt.toMillis()];
        let claimRef;

        try {
            claimRef = await addDoc(collection(db, CFG.col), {
                visitor_id:      visitorId,
                domain:          window.location.origin,
                plan:            activePlan,
                max_steps:       1,
                countdown_times: activeStepCfg.countdown_times,
                started_at:      startedAt,
                step_timestamps: stepTimestamps,
                claimed_at:      null, duration_sec: null,
                steps_completed: 0,   code: null,
            });
        } catch (e) {
            show(`❌ <strong>Không kết nối được Firebase.</strong><br><small>${e.message}</small>
                <div style="text-align:center">
                    <button class="mkm-retry-btn" id="r">🔄 Thử lại</button>
                </div>`, 'mkm-error');
            document.getElementById('r')?.addEventListener('click',
                () => { busy = false; btn.disabled = false; runSimpleFlow(); });
            busy = false; btn.disabled = false; return;
        }

        // Đếm ngược bước duy nhất
        await countdown(0, 1, activeStepCfg.countdown_times[0]);

        await finalizeAndShow(
            { docId: claimRef.id, max_steps: 1, step_starts: [startedAt.toMillis()] },
            stepTimestamps
        );
    }

    // ════════════════════════════════════════════════════════════
    // LUỒNG 2STEP
    //  Bước 1: đếm ngược countdown_times[0] giây
    //          → lưu state → hiện nút "Tiếp tục" (user cần sang trang khác)
    //  Bước 2: user nhấn nút → đếm ngược countdown_times[1] giây → trả mã
    // ════════════════════════════════════════════════════════════
    async function runMultiStepFlow() {
        busy = true; btn.disabled = true;
        show('⏳ Đang kết nối...', 'mkm-loading');

        const startedAt = Timestamp.now();
        let claimRef;

        try {
            claimRef = await addDoc(collection(db, CFG.col), {
                visitor_id:      visitorId,
                domain:          window.location.origin,
                plan:            activePlan,
                max_steps:       activeStepCfg.max_steps,
                countdown_times: activeStepCfg.countdown_times,
                started_at:      startedAt,
                step_timestamps: [startedAt.toMillis()],
                claimed_at:      null, duration_sec: null,
                steps_completed: 0,   code: null,
            });
            console.log('[MKM] ✅ Doc tạo OK:', claimRef.id);
        } catch (e) {
            show(`❌ <strong>Không kết nối được Firebase.</strong><br><small>${e.message}</small>
                <div style="text-align:center">
                    <button class="mkm-retry-btn" id="r">🔄 Thử lại</button>
                </div>`, 'mkm-error');
            document.getElementById('r')?.addEventListener('click',
                () => { busy = false; btn.disabled = false; runMultiStepFlow(); });
            busy = false; btn.disabled = false; return;
        }

        // ── BƯỚC 1: đếm ngược ────────────────────────────────────
        await countdown(0, activeStepCfg.max_steps, activeStepCfg.countdown_times[0]);

        // Ghi Firestore bước 1 xong
        const step1Done      = Timestamp.now();
        const stepTimestamps = [startedAt.toMillis(), step1Done.toMillis()];
        try {
            await updateDoc(doc(db, CFG.col, claimRef.id), {
                steps_completed:    1,
                step_timestamps:    stepTimestamps,
                step1_completed_at: step1Done,
            });
        } catch (e) { console.warn('[MKM] Không update step1:', e.message); }

        // Lưu state để resume nếu cần
        const state = {
            docId:           claimRef.id,
            plan:            activePlan,
            max_steps:       activeStepCfg.max_steps,
            countdown_times: activeStepCfg.countdown_times,
            step_starts:     stepTimestamps,   // [start, step1Done]
            steps_completed: 1,
            hostname,
            origin_path:     location.pathname, // đánh dấu path trang bắt đầu
            visitorId,
        };
        saveState(state);

        // ── Hiện màn hình chờ user sang trang khác ────────────────
        showWaitNextPage(state);
    }

    // ── Hiện UI chờ "sang trang khác" + nút Tiếp tục ─────────────
    function showWaitNextPage(state) {
        const totalSteps  = state.max_steps;
        const originPath  = state.origin_path || '/';
        const visitedNew  = (location.pathname !== originPath);

        if (visitedNew) {
            // Đã ở trang khác → cho phép nhấn Tiếp tục ngay
            show(`
                <div class="mkm-step-badge">Bước 1 / ${totalSteps} ✅ hoàn thành</div>
                <ul class="mkm-checklist">
                    <li class="done">✅ Bước 1: Đã hoàn thành</li>
                    <li class="done">✅ Đã truy cập trang mới</li>
                </ul>
                <div style="margin-top:10px;font-size:13px;color:#2e7d32">
                    🎯 Nhấn <strong>"Tiếp tục"</strong> để nhận mã khuyến mãi!
                </div>
                <button class="mkm-next-btn" id="mkm-next-btn">▶ Tiếp tục nhận mã</button>
            `, 'mkm-wait');
        } else {
            // Vẫn trên trang gốc → hiện hướng dẫn, nút bị disabled
            show(`
                <div class="mkm-step-badge">Bước 1 / ${totalSteps} ✅ hoàn thành</div>
                <ul class="mkm-checklist">
                    <li class="done">✅ Bước 1: Đã hoàn thành</li>
                    <li class="pending">⏳ Bước 2: Vui lòng truy cập trang khác trước</li>
                </ul>
                <div style="margin-top:10px;font-size:13px;color:#6a1b9a">
                    📌 Vui lòng <strong>truy cập bất kỳ trang nào khác</strong> trên website
                    (cùng tên miền, khác đường dẫn), sau đó quay lại đây nhấn <strong>"Tiếp tục"</strong>.
                </div>
                <button class="mkm-next-btn" id="mkm-next-btn" disabled style="opacity:.5;cursor:not-allowed">
                    🔒 Cần truy cập trang khác trước
                </button>
            `, 'mkm-wait');
        }

        document.getElementById('mkm-next-btn')?.addEventListener('click', () => {
            if (location.pathname === originPath) return; // double-check
            runStep2(state);
        });
    }

    // ── Chạy bước 2 (+ bước 3 nếu có) sau khi user nhấn nút ─────
    async function runStep2(state) {
        // Tắt nút để tránh bấm 2 lần
        const nextBtn = document.getElementById('mkm-next-btn');
        if (nextBtn) nextBtn.disabled = true;

        const stepTimestamps = [...state.step_starts]; // đã có [start, step1Done]

        // Chạy các bước countdown còn lại (từ index 1 trở đi)
        for (let i = 1; i < state.max_steps; i++) {
            await countdown(i, state.max_steps, state.countdown_times[i]);

            const stepDone = Timestamp.now();
            stepTimestamps.push(stepDone.toMillis());

            try {
                await updateDoc(doc(db, CFG.col, state.docId), {
                    steps_completed:          i + 1,
                    step_timestamps:          stepTimestamps,
                    [`step${i + 1}_completed_at`]: stepDone,
                });
            } catch (e) { console.warn(`[MKM] Không update step${i + 1}:`, e.message); }
        }

        await finalizeAndShow(
            { docId: state.docId, max_steps: state.max_steps, step_starts: [state.step_starts[0]] },
            stepTimestamps
        );
    }

    // ── RESUME khi user load lại trang (có pending state) ────────
    function handleResume(state) {
        busy = true; btn.style.display = 'none';
        console.log('[MKM] Resume state, steps_completed:', state.steps_completed);

        if (state.steps_completed >= 1) {
            // Bước 1 đã xong → hiện lại màn hình chờ sang trang khác
            showWaitNextPage(state);
        } else {
            // Bước 1 chưa xong (ít gặp) → reset
            clearState();
            btn.style.display = '';
            busy = false;
        }
    }

    // ── MAIN ─────────────────────────────────────────────────────
    let busy      = false;
    const visitorId = getVisitorId();

    // Kiểm tra pending claim
    const pending = loadState();
    if (pending && pending.hostname === hostname && pending.visitorId === getVisitorId()) {
        handleResume(pending);
    }

    btn.addEventListener('click', () => {
        if (busy) return;
        if (activeStepCfg.max_steps === 1) runSimpleFlow();
        else runMultiStepFlow();
    });

})();
