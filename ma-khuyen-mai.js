/**
 * =====================================================
 * MÃ KHUYẾN MÃI WIDGET — Multi-step + Browse Detection
 *
 * LUỒNG:
 *  1step_*  → chỉ đếm ngược, trả mã
 *  2step_*  → bước 1: browse trang khác + chờ đủ giây
 *              bước 2: đếm ngược → trả mã
 *  3step_*  → bước 1: browse + chờ
 *              bước 2,3: đếm ngược → trả mã
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

    const DEFAULT_PLAN    = '1step_60';
    const CLAIM_STORE_KEY = '_mkm_claim'; // localStorage key

    const CFG = {
        btnLabel:         '🎁 Lấy mã khuyến mãi',
        btnColor:         '#e53935',
        btnHoverColor:    '#b71c1c',
        codeLength:       8,
        col:              'claims',
        configCol:        'configs',
    };

    // ── Load Firebase ────────────────────────────────────────────
    let db, FS;
    try {
        const { initializeApp }                                           = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
        const { getFirestore, collection, addDoc, updateDoc, doc, getDoc, Timestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        db = getFirestore(initializeApp(FIREBASE_CONFIG));
        FS = { collection, addDoc, updateDoc, doc, getDoc, Timestamp };
    } catch (e) { console.error('[MKM] Firebase load fail:', e); return; }

    const { collection, addDoc, updateDoc, doc, getDoc, Timestamp } = FS;

    // ── Đọc plan từ Firestore theo domain ────────────────────────
    const hostname = window.location.hostname;
    let activePlan    = DEFAULT_PLAN;
    let activeStepCfg = STEP_CONFIG[DEFAULT_PLAN];
    try {
        const snap = await getDoc(doc(db, CFG.configCol, hostname));
        if (snap.exists()) {
            const key = snap.data().plan;
            if (STEP_CONFIG[key]) { activePlan = key; activeStepCfg = STEP_CONFIG[key]; }
        }
        console.log(`[MKM] Plan: ${activePlan}`, activeStepCfg);
    } catch (e) { console.warn('[MKM] Không đọc config:', e.message); }

    // ── Helpers ──────────────────────────────────────────────────
    function getVisitorId() {
        let v = localStorage.getItem('_mkm_vid');
        if (!v) { v = 'v_' + Math.random().toString(36).slice(2,10) + Date.now().toString(36); localStorage.setItem('_mkm_vid', v); }
        return v;
    }
    function genCode(n) {
        const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', a = new Uint8Array(n);
        crypto.getRandomValues(a);
        return Array.from(a, b => c[b % c.length]).join('');
    }
    function fmtTime(ts) {
        return (ts && ts.toDate ? ts.toDate() : new Date(ts))
            .toLocaleTimeString('vi-VN', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
    }
    function fmtMs(ms) {
        const s = Math.round(ms / 1000);
        return s >= 60 ? `${Math.floor(s/60)}p ${s%60}s` : `${s}s`;
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
        #mkm-btn:hover:not(:disabled){background:${CFG.btnHoverColor};transform:translateY(-2px);}
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
        #mkm-popup.mkm-browse{background:#f3e5f5;border-color:#ab47bc;color:#4a148c;}
        #mkm-popup.mkm-browse::before{background:#ab47bc;}
        #mkm-popup.mkm-countdown{background:#fff8e1;border-color:#ffb300;color:#5d4037;}
        #mkm-popup.mkm-countdown::before{background:#ffb300;}
        #mkm-popup.mkm-success{background:#e8f5e9;border-color:#43a047;color:#1b5e20;}
        #mkm-popup.mkm-success::before{background:#43a047;}
        #mkm-popup.mkm-error{background:#ffebee;border-color:#ef5350;color:#b71c1c;}
        #mkm-popup.mkm-error::before{background:#ef5350;}
        .mkm-step-badge{
            display:inline-block;font-size:11px;font-weight:700;
            background:rgba(171,71,188,.15);color:#7b1fa2;
            border:1px solid rgba(171,71,188,.35);border-radius:20px;padding:2px 10px;margin-bottom:6px;
        }
        .mkm-browse-icon{font-size:28px;display:block;margin-bottom:6px;}
        .mkm-browse-hint{
            display:inline-block;margin-top:8px;padding:6px 14px;
            background:rgba(171,71,188,.12);border-radius:8px;font-size:12px;font-weight:600;
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
        .mkm-retry-btn{
            display:inline-flex;align-items:center;gap:6px;margin-top:10px;
            padding:7px 16px;background:#e53935;color:#fff;border:none;border-radius:8px;
            font-size:12px;font-weight:700;cursor:pointer;
        }
        .mkm-retry-btn:hover{background:#b71c1c;}
    </style>`);

    // ── Widget HTML ──────────────────────────────────────────────
    const widget = document.createElement('div');
    widget.id = 'mkm-widget';
    widget.innerHTML = `<button id="mkm-btn">${CFG.btnLabel}</button>`;
    (document.getElementById('mkm-container') || document.querySelector('footer') || document.body).appendChild(widget);

    const popup = document.createElement('div');
    popup.id = 'mkm-popup'; popup.className = 'mkm-hidden';
    document.body.appendChild(popup);

    const btn = document.getElementById('mkm-btn');
    const show = (html, cls) => { popup.className = cls; popup.innerHTML = html; };

    function copyText(text, el) {
        const done = () => {
            el.classList.add('copied'); el.textContent = '✓ Đã sao chép!';
            setTimeout(() => { el.classList.remove('copied'); el.textContent = '📋 Sao chép mã'; }, 2500);
        };
        navigator.clipboard?.writeText(text).then(done).catch(() => {
            const ta = Object.assign(document.createElement('textarea'), { value: text, style: 'position:fixed;opacity:0' });
            document.body.appendChild(ta); ta.select();
            try { document.execCommand('copy'); done(); } catch(_){}
            document.body.removeChild(ta);
        });
    }

    // ── Đếm ngược 1 bước (đơn giản) ─────────────────────────────
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
            const iv = setInterval(() => { rem--; if (rem <= 0) { clearInterval(iv); resolve(); } else render(rem); }, 1000);
        });
    }

    // ── Hiện hướng dẫn browse (bước 1 của multi-step) ───────────
    function showBrowseUI(totalSeconds, elapsedMs, totalSteps, navigated) {
        const remSec = Math.max(0, Math.ceil((totalSeconds * 1000 - elapsedMs) / 1000));
        const pct    = Math.round(Math.min(100, (elapsedMs / (totalSeconds * 1000)) * 100));
        const navMsg = navigated
            ? `<div class="mkm-browse-hint">✅ Đã truy cập trang mới · Đang đợi đủ thời gian...</div>`
            : `<div class="mkm-browse-hint">👆 Hãy click vào bất kỳ liên kết nào trên trang</div>`;
        show(`
            <div class="mkm-step-badge">Bước 1 / ${totalSteps}</div>
            <span class="mkm-browse-icon">🔍</span>
            <strong>Yêu cầu truy cập trang</strong><br>
            Vui lòng truy cập <strong>bất kỳ trang nào</strong> trên website này để tiếp tục nhận mã.
            ${navMsg}
            <div style="margin-top:8px">Còn <span class="mkm-timer">${remSec}s</span></div>
            <div class="mkm-progress"><div class="mkm-progress-bar" style="width:${pct}%"></div></div>
        `, 'mkm-browse');
    }

    // ── Lưu mã và hiện kết quả ───────────────────────────────────
    async function finalizeAndShow(state, stepTimestamps) {
        show('⏳ Đang lưu mã...', 'mkm-loading');
        const code      = genCode(CFG.codeLength);
        const claimedAt = Timestamp.now();
        const startedMs = state.step_starts[0];
        const durSec    = Math.round((claimedAt.toMillis() - startedMs) / 1000);

        // Build step timing rows for display
        const stepRows = stepTimestamps.map((ts, i) => {
            const nextTs = stepTimestamps[i + 1] || claimedAt.toMillis();
            const diff = fmtMs(nextTs - ts);
            return `<tr><td>Bước ${i+1}:</td><td>${fmtTime(ts)} <span style="opacity:.6">(${diff})</span></td></tr>`;
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
            console.error('[MKM] ❌ Lưu mã thất bại:', e);
            show(`❌ <strong>Lưu mã thất bại.</strong><br><small>${e.message}</small>
                <div style="text-align:center"><button class="mkm-retry-btn" id="mkm-retry-btn">🔄 Thử lại</button></div>`,
                'mkm-error');
            document.getElementById('mkm-retry-btn')?.addEventListener('click', () => finalizeAndShow(state, stepTimestamps));
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
                    <tr><td>⏱ Tổng thời gian:</td><td>${durSec} giây</td></tr>
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

    // ── LUỒNG 1: 1step — chỉ đếm ngược ─────────────────────────
    async function runSimpleFlow() {
        busy = true; btn.disabled = true;
        show('⏳ Đang kết nối...', 'mkm-loading');

        const startedAt = Timestamp.now();
        const stepTimestamps = [startedAt.toMillis()];
        let claimRef;

        try {
            claimRef = await addDoc(collection(db, CFG.col), {
                visitor_id:      visitorId,
                domain:          window.location.origin,
                plan:            activePlan,
                max_steps:       activeStepCfg.max_steps,
                countdown_times: activeStepCfg.countdown_times,
                started_at:      startedAt,
                step_timestamps: stepTimestamps,
                claimed_at:      null, duration_sec: null,
                steps_completed: 0,   code: null,
            });
        } catch (e) {
            show(`❌ <strong>Không kết nối được Firebase.</strong><br><small>${e.message}</small>
                <div style="text-align:center"><button class="mkm-retry-btn" id="r">🔄 Thử lại</button></div>`, 'mkm-error');
            document.getElementById('r')?.addEventListener('click', () => { busy=false; btn.disabled=false; runSimpleFlow(); });
            busy=false; btn.disabled=false; return;
        }

        await countdown(0, 1, activeStepCfg.countdown_times[0]);

        await finalizeAndShow(
            { docId: claimRef.id, max_steps: 1, step_starts: [startedAt.toMillis()] },
            stepTimestamps
        );
    }

    // ── LUỒNG 2: multi-step — bước 1 yêu cầu browse ─────────────
    async function startBrowseFlow() {
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
                <div style="text-align:center"><button class="mkm-retry-btn" id="r">🔄 Thử lại</button></div>`, 'mkm-error');
            document.getElementById('r')?.addEventListener('click', () => { busy=false; btn.disabled=false; startBrowseFlow(); });
            busy=false; btn.disabled=false; return;
        }

        // Lưu state vào localStorage
        saveState({
            docId:          claimRef.id,
            plan:           activePlan,
            max_steps:      activeStepCfg.max_steps,
            countdown_times: activeStepCfg.countdown_times,
            step_starts:    [startedAt.toMillis()],
            origin_url:     location.href,
            hostname,
            visitorId,
        });

        // Hiện hướng dẫn browse với countdown
        showBrowseWithLiveCountdown(activeStepCfg.countdown_times[0], activeStepCfg.max_steps, false);
    }

    // Countdown hiển thị trên trang gốc (chỉ visual, chờ user navigate)
    function showBrowseWithLiveCountdown(totalSec, totalSteps, navigated) {
        let elapsed = 0;
        showBrowseUI(totalSec, 0, totalSteps, navigated);
        const iv = setInterval(() => {
            elapsed += 1000;
            showBrowseUI(totalSec, elapsed, totalSteps, navigated);
            if (elapsed >= totalSec * 1000) clearInterval(iv);
        }, 1000);
    }

    // ── RESUME: tiếp tục khi user quay lại trang khác ────────────
    async function handleResume(state) {
        busy = true; btn.style.display = 'none';

        const elapsed     = Date.now() - state.step_starts[0];
        const required    = state.countdown_times[0] * 1000;
        const visitedNew  = (location.href !== state.origin_url);
        const stepTimestamps = [...state.step_starts];

        console.log(`[MKM] Resume | navigated: ${visitedNew} | elapsed: ${Math.round(elapsed/1000)}s / ${state.countdown_times[0]}s`);

        if (!visitedNew) {
            // Vẫn trên trang gốc → chỉ hiện lại hướng dẫn
            showBrowseWithLiveCountdown(
                Math.max(0, Math.ceil((required - elapsed) / 1000)),
                state.max_steps, false
            );
            return;
        }

        // Đã navigate sang trang mới ✅
        // Cần chờ đủ thời gian step 1 không?
        const remaining = required - elapsed;
        if (remaining > 0) {
            // Còn thiếu thời gian → đếm ngược nốt
            showBrowseUI(state.countdown_times[0], elapsed, state.max_steps, true);
            await new Promise(resolve => {
                let rem = Math.ceil(remaining / 1000);
                const iv = setInterval(() => {
                    rem--;
                    showBrowseUI(state.countdown_times[0], state.countdown_times[0]*1000 - rem*1000, state.max_steps, true);
                    if (rem <= 0) { clearInterval(iv); resolve(); }
                }, 1000);
            });
        }

        // Bước 1 hoàn thành → ghi Firestore
        const step1Done = Timestamp.now();
        stepTimestamps.push(step1Done.toMillis());

        try {
            await updateDoc(doc(db, CFG.col, state.docId), {
                steps_completed: 1,
                step_timestamps: stepTimestamps,
                step1_completed_at: step1Done,
            });
            console.log('[MKM] ✅ Step 1 hoàn thành');
        } catch (e) { console.warn('[MKM] Không update step1:', e.message); }

        // Cập nhật localStorage
        state.step_starts = stepTimestamps;
        saveState(state);

        // Chạy các bước countdown còn lại (bước 2, 3)
        for (let i = 1; i < state.max_steps; i++) {
            await countdown(i, state.max_steps, state.countdown_times[i]);

            // Ghi timestamp từng bước vào Firestore
            const stepDone = Timestamp.now();
            stepTimestamps.push(stepDone.toMillis());
            try {
                await updateDoc(doc(db, CFG.col, state.docId), {
                    steps_completed: i + 1,
                    step_timestamps: stepTimestamps,
                    [`step${i+1}_completed_at`]: stepDone,
                });
            } catch (e) { console.warn(`[MKM] Không update step${i+1}:`, e.message); }
        }

        // Lưu mã
        await finalizeAndShow(
            { docId: state.docId, max_steps: state.max_steps, step_starts: [state.step_starts[0]] },
            stepTimestamps
        );
    }

    // ── MAIN ─────────────────────────────────────────────────────
    let busy = false;
    const visitorId = getVisitorId();

    // Kiểm tra pending claim khi trang load
    const pending = loadState();
    if (pending && pending.hostname === hostname && pending.visitorId === getVisitorId()) {
        // Có claim đang dở → resume
        handleResume(pending);
    }

    btn.addEventListener('click', () => {
        if (busy) return;
        if (activeStepCfg.max_steps === 1) runSimpleFlow();
        else startBrowseFlow();
    });

})();
