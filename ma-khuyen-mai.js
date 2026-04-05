(async () => {

    const FIREBASE_CONFIG = {
        apiKey:            "AIzaSyDeycy4mB_KcBGay9qNtN4oJ8R2ejd2w-Q",
        authDomain:        "traffic1m.firebaseapp.com",
        projectId:         "traffic1m",
        storageBucket:     "traffic1m.firebasestorage.app",
        messagingSenderId: "7324624117",
        appId:             "1:7324624117:web:648907f451d43fc43f51bc",
    };

    const STEP_CONFIG = {
        '1step_60':  { max_steps: 1, countdown_times: [60]      },
        '1step_90':  { max_steps: 1, countdown_times: [90]      },
        '1step_120': { max_steps: 1, countdown_times: [120]     },
        '2step_75':  { max_steps: 2, countdown_times: [60,  15] },
        '2step_90':  { max_steps: 2, countdown_times: [70,  20] },
        '2step_120': { max_steps: 2, countdown_times: [90,  30] },
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

    let db, FS;
    try {
        const { initializeApp, getApps, getApp } =
            await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
        const { getFirestore, collection, addDoc, updateDoc, doc, getDoc, Timestamp } =
            await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const app = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);
        db = getFirestore(app);
        FS = { collection, addDoc, updateDoc, doc, getDoc, Timestamp };
    } catch (e) { return; }

    const { collection, addDoc, updateDoc, doc, getDoc, Timestamp } = FS;

    const hostname = window.location.hostname;
    let activePlan    = DEFAULT_PLAN;
    let activeStepCfg = STEP_CONFIG[DEFAULT_PLAN];
    try {
        const snap = await getDoc(doc(db, CFG.configCol, hostname));
        if (snap.exists()) {
            const key = snap.data().plan;
            if (STEP_CONFIG[key]) {
                activePlan    = key;
                activeStepCfg = STEP_CONFIG[key];
            }
        }
    } catch (e) {}

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
    const saveState  = v  => localStorage.setItem(CLAIM_STORE_KEY, JSON.stringify(v));
    const loadState  = () => { try { return JSON.parse(localStorage.getItem(CLAIM_STORE_KEY)); } catch { return null; } };
    const clearState = () => localStorage.removeItem(CLAIM_STORE_KEY);

    document.head.insertAdjacentHTML('beforeend', `<style>
        @import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;700;800&display=swap');
        #mkm-widget,#mkm-widget *{box-sizing:border-box;font-family:'Be Vietnam Pro',sans-serif;}
        #mkm-widget{display:block;width:100%;max-width:420px;margin:0 auto;text-align:center;}

        #mkm-btn{
            display:inline-flex;align-items:center;gap:8px;padding:12px 28px;
            background:${CFG.btnColor};color:#fff;border:none;border-radius:10px;
            font-size:15px;font-weight:700;cursor:pointer;-webkit-appearance:none;
            transition:background .2s,transform .15s,box-shadow .2s;
            box-shadow:0 4px 14px rgba(229,57,53,.35);
        }
        #mkm-btn:hover:not(:disabled){background:${CFG.btnHover};transform:translateY(-2px);}
        #mkm-btn:disabled{background:#bdbdbd;cursor:not-allowed;box-shadow:none;opacity:.7;}

        #mkm-panel{
            margin-top:16px;padding:18px 20px;border-radius:14px;font-size:14px;
            line-height:1.65;word-break:break-word;text-align:left;
            border:1.5px solid transparent;
        }
        #mkm-panel:empty{display:none;}
        #mkm-panel.mkm-loading{background:#e3f2fd;border-color:#42a5f5;color:#0d47a1;}
        #mkm-panel.mkm-countdown{background:#fff8e1;border-color:#ffb300;color:#5d4037;}
        #mkm-panel.mkm-wait{background:#fafafa;border-color:#e0e0e0;color:#424242;}
        #mkm-panel.mkm-success{background:#e8f5e9;border-color:#43a047;color:#1b5e20;}
        #mkm-panel.mkm-error{background:#ffebee;border-color:#ef5350;color:#b71c1c;}

        .mkm-timer{
            display:inline-block;font-size:22px;font-weight:800;font-family:'Courier New',monospace;
            color:#e65100;background:rgba(255,152,0,.15);padding:2px 10px;
            border-radius:6px;border:1px solid rgba(255,152,0,.35);min-width:52px;text-align:center;
        }
        .mkm-progress{height:6px;background:rgba(0,0,0,.1);border-radius:4px;margin-top:10px;overflow:hidden;}
        .mkm-progress-bar{height:100%;background:linear-gradient(90deg,#ffb300,#ff6f00);border-radius:4px;transition:width .85s linear;}

        .mkm-code-box{
            display:block;margin:12px 0 6px;padding:12px 20px;
            background:linear-gradient(135deg,#d4edda,#b2dfdb);border:2px dashed #43a047;border-radius:10px;
            font-size:28px;font-weight:800;letter-spacing:6px;color:#1b5e20;
            font-family:'Courier New',monospace;text-align:center;
        }

        .mkm-copy-btn{
            display:inline-flex;align-items:center;gap:6px;margin-top:10px;
            padding:8px 20px;background:#43a047;color:#fff;border:none;border-radius:8px;
            font-size:13px;font-weight:700;cursor:pointer;transition:background .2s;
            width:100%;justify-content:center;
        }
        .mkm-copy-btn:hover{background:#2e7d32;}
        .mkm-copy-btn.copied{background:#00796b;}

        .mkm-next-btn{
            display:inline-flex;align-items:center;justify-content:center;gap:6px;
            margin-top:12px;width:100%;padding:10px 16px;
            background:#7b1fa2;color:#fff;border:none;border-radius:10px;
            font-size:14px;font-weight:700;cursor:pointer;transition:background .2s,transform .15s;
            box-shadow:0 4px 12px rgba(123,31,162,.25);
        }
        .mkm-next-btn:hover{background:#4a148c;transform:translateY(-1px);}
        .mkm-next-btn:disabled{background:#bdbdbd;cursor:not-allowed;box-shadow:none;transform:none;}

        .mkm-retry-btn{
            display:inline-flex;align-items:center;gap:6px;margin-top:10px;
            padding:8px 18px;background:#e53935;color:#fff;border:none;border-radius:8px;
            font-size:13px;font-weight:700;cursor:pointer;width:100%;justify-content:center;
        }
        .mkm-retry-btn:hover{background:#b71c1c;}

        .mkm-steps{display:flex;gap:6px;margin-bottom:14px;}
        .mkm-step-dot{
            flex:1;height:4px;border-radius:4px;background:#e0e0e0;transition:background .4s;
        }
        .mkm-step-dot.active{background:#ffb300;}
        .mkm-step-dot.done{background:#43a047;}

        .mkm-wait-desc{
            font-size:13px;color:#616161;margin:10px 0 14px;line-height:1.7;
        }
        .mkm-wait-hint{
            display:inline-block;font-size:12px;color:#9e9e9e;
            background:#f5f5f5;border-radius:6px;padding:4px 10px;margin-bottom:12px;
        }
    </style>`);

    // Widget gắn vào footer hoặc body
    const widget = document.createElement('div');
    widget.id = 'mkm-widget';
    widget.innerHTML = `<button id="mkm-btn">${CFG.btnLabel}</button><div id="mkm-panel"></div>`;
    (document.getElementById('mkm-container') || document.querySelector('footer') || document.body)
        .appendChild(widget);

    const panel  = document.getElementById('mkm-panel');
    const btn    = document.getElementById('mkm-btn');
    const show   = (html, cls) => { panel.className = cls; panel.innerHTML = html; };

    function stepDots(current, total) {
        if (total < 2) return '';
        return `<div class="mkm-steps">${Array.from({length: total}, (_, i) =>
            `<div class="mkm-step-dot ${i < current ? 'done' : i === current ? 'active' : ''}"></div>`
        ).join('')}</div>`;
    }

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

    function countdown(stepIdx, totalSteps, seconds) {
        return new Promise(resolve => {
            let rem = seconds;
            const dots = stepDots(stepIdx, totalSteps);
            const render = r => {
                const pct = Math.round((1 - r / seconds) * 100);
                show(`${dots}
                    <div style="font-size:13px;margin-bottom:6px;color:#795548;">Đang chuẩn bị mã khuyến mãi...</div>
                    <span class="mkm-timer">${r}s</span>
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

    async function finalizeAndShow(state, stepTimestamps) {
        show('⏳ Đang tạo mã...', 'mkm-loading');
        const code      = genCode(CFG.codeLength);
        const claimedAt = Timestamp.now();
        const durSec    = Math.round((claimedAt.toMillis() - stepTimestamps[0]) / 1000);

        try {
            await updateDoc(doc(db, CFG.col, state.docId), {
                claimed_at:      claimedAt,
                duration_sec:    durSec,
                steps_completed: state.max_steps,
                step_timestamps: stepTimestamps,
                code,
            });
        } catch (e) {
            show(`<strong>Không lưu được mã.</strong> Vui lòng thử lại.
                <div style="text-align:center;margin-top:10px">
                    <button class="mkm-retry-btn" id="mkm-retry-btn">🔄 Thử lại</button>
                </div>`, 'mkm-error');
            document.getElementById('mkm-retry-btn')?.addEventListener('click',
                () => finalizeAndShow(state, stepTimestamps));
            return;
        }

        clearState();
        show(`
            <div style="text-align:center;font-size:13px;margin-bottom:2px;color:#2e7d32;font-weight:600;">Mã khuyến mãi của bạn</div>
            <span class="mkm-code-box">${code}</span>
            <div style="text-align:center">
                <button class="mkm-copy-btn" id="mkm-copy-btn">📋 Sao chép mã</button>
            </div>
        `, 'mkm-success');
        document.getElementById('mkm-copy-btn')?.addEventListener('click', () => {
            copyText(code, document.getElementById('mkm-copy-btn'));
        });
    }

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
            show(`Không kết nối được. Vui lòng thử lại.
                <div style="text-align:center;margin-top:10px">
                    <button class="mkm-retry-btn" id="r">🔄 Thử lại</button>
                </div>`, 'mkm-error');
            document.getElementById('r')?.addEventListener('click',
                () => { busy = false; btn.disabled = false; runSimpleFlow(); });
            busy = false; btn.disabled = false; return;
        }

        await countdown(0, 1, activeStepCfg.countdown_times[0]);

        await finalizeAndShow(
            { docId: claimRef.id, max_steps: 1, step_starts: [startedAt.toMillis()] },
            stepTimestamps
        );
    }

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
        } catch (e) {
            show(`Không kết nối được. Vui lòng thử lại.
                <div style="text-align:center;margin-top:10px">
                    <button class="mkm-retry-btn" id="r">🔄 Thử lại</button>
                </div>`, 'mkm-error');
            document.getElementById('r')?.addEventListener('click',
                () => { busy = false; btn.disabled = false; runMultiStepFlow(); });
            busy = false; btn.disabled = false; return;
        }

        await countdown(0, activeStepCfg.max_steps, activeStepCfg.countdown_times[0]);

        const step1Done      = Timestamp.now();
        const stepTimestamps = [startedAt.toMillis(), step1Done.toMillis()];
        try {
            await updateDoc(doc(db, CFG.col, claimRef.id), {
                steps_completed:    1,
                step_timestamps:    stepTimestamps,
                step1_completed_at: step1Done,
            });
        } catch (e) {}

        const state = {
            docId:           claimRef.id,
            plan:            activePlan,
            max_steps:       activeStepCfg.max_steps,
            countdown_times: activeStepCfg.countdown_times,
            step_starts:     stepTimestamps,
            steps_completed: 1,
            hostname,
            origin_path:     location.pathname,
            visitorId,
        };
        saveState(state);

        showWaitNextPage(state);
    }

    function showWaitNextPage(state) {
        const originPath = state.origin_path || location.pathname;

        function renderWait(unlocked) {
            const dots = stepDots(1, state.max_steps);
            show(`
                ${dots}
                <div style="font-size:14px;font-weight:700;color:#424242;margin-bottom:4px;">Bước 1 hoàn thành 🎉</div>
                <div class="mkm-wait-desc">
                    Để nhận mã, bạn hãy ghé xem thêm một trang khác trên website,<br>
                    sau đó quay lại đây và nhấn <strong>Tiếp tục</strong>.
                </div>
                ${!unlocked ? `<div class="mkm-wait-hint">Bạn đang ở: ${originPath}</div>` : ''}
                <button class="mkm-next-btn" id="mkm-next-btn" ${unlocked ? '' : 'disabled'}>
                    ${unlocked ? '▶ Tiếp tục nhận mã' : '⏳ Chờ bạn xem thêm trang khác...'}
                </button>
                ${unlocked ? '<div style="font-size:12px;color:#43a047;text-align:center;margin-top:6px;">✓ Sẵn sàng rồi!</div>' : ''}
            `, 'mkm-wait');

            if (unlocked) {
                document.getElementById('mkm-next-btn')?.addEventListener('click', () => {
                    if (location.pathname === originPath) return;
                    runStep2(state);
                });
            }
        }

        const alreadyNew = (location.pathname !== originPath);
        renderWait(alreadyNew);

        if (!alreadyNew) {
            const pollId = setInterval(() => {
                if (location.pathname !== originPath) {
                    clearInterval(pollId);
                    renderWait(true);
                }
            }, 800);
        }
    }

    async function runStep2(state) {
        const nextBtn = document.getElementById('mkm-next-btn');
        if (nextBtn) nextBtn.disabled = true;

        const stepTimestamps = [...state.step_starts];

        for (let i = 1; i < state.max_steps; i++) {
            await countdown(i, state.max_steps, state.countdown_times[i]);

            const stepDone = Timestamp.now();
            stepTimestamps.push(stepDone.toMillis());

            try {
                await updateDoc(doc(db, CFG.col, state.docId), {
                    steps_completed:              i + 1,
                    step_timestamps:              stepTimestamps,
                    [`step${i + 1}_completed_at`]: stepDone,
                });
            } catch (e) {}
        }

        await finalizeAndShow(
            { docId: state.docId, max_steps: state.max_steps, step_starts: [state.step_starts[0]] },
            stepTimestamps
        );
    }

    function handleResume(state) {
        busy = true; btn.style.display = 'none';
        if (state.steps_completed >= 1) {
            showWaitNextPage(state);
        } else {
            clearState();
            btn.style.display = '';
            busy = false;
        }
    }

    let busy      = false;
    const visitorId = getVisitorId();

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
