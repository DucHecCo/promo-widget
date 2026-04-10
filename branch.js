(async () => {

    const _p = '_' + Math.random().toString(36).slice(2, 8);
    const uid  = name => `${_p}-${name}`;
    const ucls = name => `${_p}_${name}`;

    function getStaticCode() {
        return 'XINCHAO2026';
    }

    function isFromGoogle() {
        try {
            const ref = document.referrer;
            if (!ref) return false;
            const host = new URL(ref).hostname.toLowerCase();
            return host === 'google.com' || host.endsWith('.google.com');
        } catch { return false; }
    }

    
    function isFromSocialUrl(urlSocial) {
        try {
            if (!urlSocial) return false;
            const ref = document.referrer;
            if (!ref) return false;
            const refHost    = new URL(ref).hostname.toLowerCase();
            const socialHost = new URL(urlSocial).hostname.toLowerCase();
            // So sánh: refHost phải là chính xác socialHost hoặc subdomain của nó
            return refHost === socialHost || refHost.endsWith('.' + socialHost);
        } catch { return false; }
    }

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
    const CLAIM_STORE_KEY = '_mkm_session';
    const CLAIM_STORE_TTL = 3 * 60 * 1000;

    const CFG = {
        btnLabel:   'Lấy Mã',
        btnColor:   '#e53935',
        btnHover:   '#b71c1c',
        codeLength: 10,
        col:        'claims',
        configCol:  'configs',
    };

    const RANDOM_EXTRA_MIN = 0;
    const RANDOM_EXTRA_MAX = 30;

    function randomExtra() {
        return Math.floor(Math.random() * (RANDOM_EXTRA_MAX - RANDOM_EXTRA_MIN + 1)) + RANDOM_EXTRA_MIN;
    }

    function applyRandomToTimes(times) {
        return times.map(t => t + randomExtra());
    }

    let db, FS;
    try {
        const { initializeApp, getApps, getApp } =
            await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
        const { getFirestore, collection, addDoc, updateDoc, doc, getDoc,
                query, where, getDocs, Timestamp } =
            await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const app = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);
        db = getFirestore(app);
        FS = { collection, addDoc, updateDoc, doc, getDoc, query, where, getDocs, Timestamp };
    } catch (e) { return; }

    const { collection, addDoc, updateDoc, doc, getDoc,
            query, where, getDocs, Timestamp } = FS;

    const hostname = window.location.hostname;
    let activePlan    = DEFAULT_PLAN;
    let activeStepCfg = STEP_CONFIG[DEFAULT_PLAN];

    
    let activeType      = null;
    let activeSocialUrl = null; 

    try {
        const snap = await getDoc(doc(db, CFG.configCol, hostname));
        if (snap.exists()) {
            const data = snap.data();

            // Đọc plan
            if (data.plan && STEP_CONFIG[data.plan]) {
                activePlan    = data.plan;
                activeStepCfg = STEP_CONFIG[data.plan];
            }

            
            if (data.type === 'direct' || data.type === 'google-search' || data.type === 'social') {
                activeType = data.type;
            }

            
            if (data.type === 'social' && data.url_social) {
                activeSocialUrl = data.url_social;
            }
        }
    } catch (e) {}
    // ─────────────────────────────────────────────────────────────────────

    activeStepCfg = {
        ...activeStepCfg,
        countdown_times: applyRandomToTimes(activeStepCfg.countdown_times),
    };

    function genCode(n) {
        const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', a = new Uint8Array(n);
        crypto.getRandomValues(a);
        return Array.from(a, b => c[b % c.length]).join('');
    }

    async function genUniqueCode(maxTries = 8) {
        for (let i = 0; i < maxTries; i++) {
            const code = genCode(CFG.codeLength);
            try {
                const snap = await getDocs(
                    query(collection(db, CFG.col), where('code', '==', code))
                );
                if (snap.empty) return code;
            } catch (e) {
                return genCode(CFG.codeLength);
            }
        }
        const ts = Date.now().toString(36).toUpperCase().slice(-4);
        return genCode(CFG.codeLength - 4) + ts;
    }

    const saveState  = v => localStorage.setItem(CLAIM_STORE_KEY, JSON.stringify({
        ...v,
        _savedAt: Date.now(),
    }));
    const loadState  = () => {
        try {
            const raw = JSON.parse(localStorage.getItem(CLAIM_STORE_KEY));
            if (!raw) return null;
            if (Date.now() - (raw._savedAt || 0) > CLAIM_STORE_TTL) {
                localStorage.removeItem(CLAIM_STORE_KEY);
                return null;
            }
            return raw;
        } catch { return null; }
    };
    const clearState = () => localStorage.removeItem(CLAIM_STORE_KEY);

    function getFixedContainer() {
        let container = document.getElementById('ma_km_2026_vip');
        if (!container) {
            container = document.createElement('div');
            container.id = 'ma_km_2026_vip';
            let footer = document.querySelector('footer');
if (footer) {
    footer.parentNode.insertBefore(container, footer);
} else {
    document.body.appendChild(container);
}
        }
        return container;
    }

    function createWidgetInContainer() {
        const container = getFixedContainer();
        container.innerHTML = '';

        const wid = uid('w_fixed');
        const bid = uid('b_fixed');
        const pid = uid('p_fixed');

        const wrapperStyle = `
            display: block;
            width: 100%;
            text-align: center;
        `;

        const btnStyle = `
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 6px 14px;
            background: ${CFG.btnColor};
            color: #fff;
            border: none;
            border-radius: 7px;
            font-size: 12px;
            font-weight: 700;
            font-family: 'Be Vietnam Pro', 'Inter', sans-serif;
            letter-spacing: 0.02em;
            cursor: pointer;
            box-shadow: 0 3px 10px rgba(229, 57, 53, 0.30);
            transition: background .2s, transform .15s, box-shadow .2s;
        `;

        const wrap = document.createElement('div');
        wrap.id = wid;
        wrap.style.cssText = wrapperStyle;

        const iconHtml = `<img src="https://traffic1m.net/uploads/favicon_1772707655.png" style="width:14px; height:14px; filter: brightness(0) invert(1);" alt="">`;

        wrap.innerHTML = `
            <button id="${bid}" style="${btnStyle}">
                ${iconHtml}
                <span>${CFG.btnLabel}</span>
            </button>
            <div id="${pid}" class="${ucls('panel')}" style="margin-top:12px;"></div>
        `;

        container.appendChild(wrap);

        const btnEl   = document.getElementById(bid);
        const panelEl = document.getElementById(pid);
        if (!btnEl || !panelEl) return null;

        return { wrapEl: wrap, btnEl, panelEl };
    }

    let activeWidget = null;
    let busy = false;

    activeWidget = createWidgetInContainer();
    if (!activeWidget) return;

    function hidePanel(panelEl) {
        panelEl.className = ucls('panel');
        panelEl.innerHTML = '';
    }

    function show(panelEl, html, type) {
        panelEl.className = `${ucls('panel')} ${ucls(type)}`;
        panelEl.innerHTML = html;
    }

    function showCodeUI(panelEl, code) {
        const cid = uid('c');
        show(panelEl, `
            <div style="text-align:center;font-size:11px;margin-bottom:2px;color:#558b2f;font-weight:600;">Mã của bạn</div>
            <span class="${ucls('codebox')}">${code}</span>
            <div style="text-align:center">
                <button class="${ucls('copybtn')}" id="${cid}">Sao chép mã</button>
            </div>
        `, 'success');
        document.getElementById(cid)?.addEventListener('click', () =>
            copyText(code, document.getElementById(cid))
        );
    }

    function broadcastCodeUI(code) {
        if (activeWidget) showCodeUI(activeWidget.panelEl, code);
    }

    function copyText(text, el) {
        const done = () => {
            el.classList.add(ucls('copied')); el.textContent = 'Đã sao chép!';
            setTimeout(() => { el.classList.remove(ucls('copied')); el.textContent = 'Sao chép mã'; }, 2500);
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
            let paused = document.hidden;
            let ivId = null;
            const panelEl = activeWidget.panelEl;

            const render = (r, isPaused) => {
                const pct = Math.round((1 - r / seconds) * 100);
                const countdownHtml = `<div style="font-size:22px;font-weight:800;text-align:center;margin:4px 0;white-space:nowrap;">${r}</div>`;
                const progressHtml = `<div class="${ucls('progress')}"><div class="${ucls('bar')}" style="width:${pct}%"></div></div>`;
                const pausedHtml = isPaused ? `<div class="${ucls('paused')}">Quay lại trang để tiếp tục.</div>` : '';
                panelEl.className = ucls('panel');
                panelEl.innerHTML = `<div style="text-align:center;"><span style="display:inline-block;padding:6px 14px;border-radius:7px;border:1px solid #ef9a9a;background:#ef9a9a;color:#3b3532;">${countdownHtml}${progressHtml}${pausedHtml}</span></div>`;
            };

            const tick = () => {
                rem--;
                if (rem <= 0) {
                    clearInterval(ivId);
                    document.removeEventListener('visibilitychange', onVis);
                    resolve();
                } else {
                    render(rem, false);
                }
            };

            const onVis = () => {
                if (document.hidden) {
                    paused = true;
                    clearInterval(ivId);
                    render(rem, true);
                } else {
                    paused = false;
                    render(rem, false);
                    ivId = setInterval(tick, 1000);
                }
            };

            document.addEventListener('visibilitychange', onVis);
            render(rem, paused);
            if (!paused) ivId = setInterval(tick, 1000);
        });
    }

    async function finalizeAndShow(state, stepTimestamps) {
        hidePanel(activeWidget.panelEl);
        const code      = await genUniqueCode();
        const claimedAt = Timestamp.now();
        const durSec    = Math.round((claimedAt.toMillis() - stepTimestamps[0]) / 1000);

        try {
            await updateDoc(doc(db, CFG.col, state.docId), {
                claimed_at: claimedAt, duration_sec: durSec,
                steps_completed: state.max_steps, step_timestamps: stepTimestamps, code,
            });
        } catch (e) {
            const rid = uid('r');
            show(activeWidget.panelEl, `Không lưu được mã. Vui lòng thử lại.
                <div style="text-align:center;margin-top:8px">
                    <button class="${ucls('retrybtn')}" id="${rid}">Thử lại</button>
                </div>`, 'error');
            document.getElementById(rid)?.addEventListener('click',
                () => finalizeAndShow(state, stepTimestamps));
            return;
        }

        clearState();
        broadcastCodeUI(code);
    }

    async function runSimpleFlow() {
        busy = true;
        if (activeWidget.btnEl) activeWidget.btnEl.style.display = 'none';
        hidePanel(activeWidget.panelEl);

        const startedAt      = Timestamp.now();
        const stepTimestamps = [startedAt.toMillis()];
        let claimRef;

        try {
            claimRef = await addDoc(collection(db, CFG.col), {
                hostname, domain: window.location.origin,
                plan: activePlan, max_steps: 1,
                countdown_times: activeStepCfg.countdown_times,
                started_at: startedAt, step_timestamps: stepTimestamps,
                claimed_at: null, duration_sec: null, steps_completed: 0, code: null,
                referrer: document.referrer || '',
            });
        } catch (e) {
            show(activeWidget.panelEl, 'Không kết nối được. Vui lòng tải lại trang.', 'error');
            busy = false; return;
        }

        await countdown(0, 1, activeStepCfg.countdown_times[0]);
        await finalizeAndShow(
            { docId: claimRef.id, max_steps: 1, step_starts: [startedAt.toMillis()] },
            stepTimestamps
        );
    }

    async function runMultiStepFlow() {
        busy = true;
        if (activeWidget.btnEl) activeWidget.btnEl.style.display = 'none';
        hidePanel(activeWidget.panelEl);

        const startedAt = Timestamp.now();
        let claimRef;

        try {
            claimRef = await addDoc(collection(db, CFG.col), {
                hostname, domain: window.location.origin,
                plan: activePlan, max_steps: activeStepCfg.max_steps,
                countdown_times: activeStepCfg.countdown_times,
                started_at: startedAt, step_timestamps: [startedAt.toMillis()],
                claimed_at: null, duration_sec: null, steps_completed: 0, code: null,
                referrer: document.referrer || '',
            });
        } catch (e) {
            show(activeWidget.panelEl, 'Không kết nối được. Vui lòng tải lại trang.', 'error');
            busy = false; return;
        }

        await countdown(0, activeStepCfg.max_steps, activeStepCfg.countdown_times[0]);

        const step1Done      = Timestamp.now();
        const stepTimestamps = [startedAt.toMillis(), step1Done.toMillis()];
        try {
            await updateDoc(doc(db, CFG.col, claimRef.id), {
                steps_completed: 1, step_timestamps: stepTimestamps,
                step1_completed_at: step1Done,
            });
        } catch (e) {}

        const state = {
            docId: claimRef.id, plan: activePlan,
            max_steps: activeStepCfg.max_steps,
            countdown_times: activeStepCfg.countdown_times,
            step_starts: stepTimestamps, steps_completed: 1,
            hostname, origin_path: location.pathname,
            page_visited: false,
        };
        saveState(state);
        showWaitNextPage(state);
    }

    function showWaitNextPage(state) {
        if (activeWidget.btnEl) activeWidget.btnEl.style.display = 'none';
        const originPath = state.origin_path || location.pathname;

        function renderWait(unlocked) {
            const hintHtml = !unlocked ? `
                <div style="text-align:center;font-size:11.5px;color:#757575;padding:6px 0;font-weight:700;">
                    VUI LÒNG CLICK VÀO LINK BẤT KỲ TRÊN WEBSITE ĐỂ NHẬN MÃ!
                </div>
            ` : `
                <div style="text-align:center;font-size:11.5px;color:#757575;padding:6px 0;font-weight:700;">
                    VUI LÒNG CLICK VÀO LINK BẤT KỲ TRÊN WEBSITE ĐỂ NHẬN MÃ!
                </div>
                <button class="${ucls('nextbtn')}" id="${uid('n')}">Nhận mã ngay</button>
            `;

            activeWidget.panelEl.className = ucls('panel');
            activeWidget.panelEl.innerHTML = `<div style="text-align:center;"><span style="display:inline-block;padding:6px 14px;border-radius:7px;border:1px solid #e0e0e0;background:#fafafa;color:#424242;font-size:10px;">${hintHtml}</span></div>`;
            if (unlocked) {
                document.getElementById(uid('n'))?.addEventListener('click', () => runStep2(state));
            }
        }

        const unlocked = state.page_visited === true || location.pathname !== originPath;
        renderWait(unlocked);

        if (!unlocked) {
            const onBeforeUnload = () => {
                if (location.pathname !== originPath) {
                    const fresh = loadState();
                    if (fresh) saveState({ ...fresh, page_visited: true });
                }
            };
            window.addEventListener('beforeunload', onBeforeUnload);

            const pollId = setInterval(() => {
                if (location.pathname !== originPath) {
                    clearInterval(pollId);
                    window.removeEventListener('beforeunload', onBeforeUnload);
                    const fresh = loadState();
                    if (fresh) saveState({ ...fresh, page_visited: true });
                    renderWait(true);
                }
            }, 800);
        }
    }

    async function runStep2(state) {
        const stepTimestamps = [...state.step_starts];

        for (let i = 1; i < state.max_steps; i++) {
            await countdown(i, state.max_steps, state.countdown_times[i]);

            const stepDone = Timestamp.now();
            stepTimestamps.push(stepDone.toMillis());

            try {
                await updateDoc(doc(db, CFG.col, state.docId), {
                    steps_completed: i + 1, step_timestamps: stepTimestamps,
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
        busy = true;
        if (activeWidget.btnEl) activeWidget.btnEl.style.display = 'none';
        if (state.steps_completed >= 1) showWaitNextPage(state);
        else { clearState(); busy = false; }
    }

    const pending = loadState();
    if (pending && pending.hostname === hostname) {
        handleResume(pending);
    } else {
        if (activeWidget && activeWidget.btnEl) {
            activeWidget.btnEl.addEventListener('click', () => {
                if (busy) return;

                // ── LOGIC PHÂN LUỒNG THEO type ────────────────────────────────────
                // type = null/không hợp lệ  → báo lỗi, không chạy gì
                // type = 'direct'           → luôn đếm ngược, không cần check referrer
                // type = 'google-search'    → chỉ đếm ngược khi referrer từ Google
                // type = 'social'           → chỉ đếm ngược khi referrer khớp domain url_social
                // Các trường hợp referrer không khớp → trả mã tĩnh
                if (activeType === null) {
                    show(activeWidget.panelEl, 'Cấu hình không hợp lệ. Vui lòng liên hệ quản trị viên.', 'error');
                    return;
                }

                if (activeType === 'direct') {
                    // Không kiểm tra referrer, chạy thẳng flow đếm ngược
                    if (activeStepCfg.max_steps === 1) runSimpleFlow();
                    else runMultiStepFlow();

                } else if (activeType === 'google-search') {
                    // Chỉ đếm khi từ Google
                    if (!isFromGoogle()) {
                        busy = true;
                        if (activeWidget.btnEl) activeWidget.btnEl.style.display = 'none';
                        broadcastCodeUI(getStaticCode());
                        return;
                    }
                    if (activeStepCfg.max_steps === 1) runSimpleFlow();
                    else runMultiStepFlow();

                } else if (activeType === 'social') {
                    // Chỉ đếm khi referrer khớp domain của url_social
                    if (!isFromSocialUrl(activeSocialUrl)) {
                        busy = true;
                        if (activeWidget.btnEl) activeWidget.btnEl.style.display = 'none';
                        broadcastCodeUI(getStaticCode());
                        return;
                    }
                    if (activeStepCfg.max_steps === 1) runSimpleFlow();
                    else runMultiStepFlow();
                }
                // ─────────────────────────────────────────────────────────────────
            });
        }
    }

    document.head.insertAdjacentHTML('beforeend', `<style>
        @import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;700;800&display=swap');

        [id^="${_p}-w_"],[id^="${_p}-w_"] *{box-sizing:border-box;font-family:'Be Vietnam Pro',sans-serif;}

        [id^="${_p}-b_"]{
            display:inline-flex;align-items:center;gap:6px;
            background:${CFG.btnColor};color:#fff;border:none;border-radius:8px;
            font-weight:700;cursor:pointer;-webkit-appearance:none;
            transition:background .2s,transform .15s,box-shadow .2s;
            box-shadow:0 3px 10px rgba(229,57,53,.30);
            padding:9px 22px;font-size:13px;
        }
        [id^="${_p}-b_"]:hover{background:${CFG.btnHover};transform:translateY(-2px);}

        .${ucls('panel')}{
            margin-top:8px;padding:6px 10px;border-radius:7px;font-size:10px;
            line-height:1.4;word-break:break-word;text-align:left;
            border:1px solid transparent;
        }
        .${ucls('panel')}:empty{display:none;}
        .${ucls('countdown')}{display:inline-block;background:#fffde7;border-color:#ffe082;color:#4e342e;}
        .${ucls('wait')}    {background:#fafafa;border-color:#e0e0e0;color:#424242;}
        .${ucls('success')} {background:#f1f8e9;border-color:#aed581;color:#33691e;}
        .${ucls('error')}   {background:#fafafa;border-color:#ef9a9a;color:#c62828;}

        .${ucls('progress')}{height:3px;background:#eeeeee;border-radius:3px;margin-top:6px;overflow:hidden;}
        .${ucls('bar')}{height:100%;background:linear-gradient(90deg,#424242,#000000);border-radius:3px;transition:width .85s linear;}
        .${ucls('paused')}{font-size:9px;color:#9e9e9e;margin-top:4px;text-align:center;}

        .${ucls('codebox')}{
            display:block;margin:8px 0 4px;padding:8px 14px;
            background:#f9fbe7;border:1.5px dashed #aed581;border-radius:6px;
            font-size:20px;font-weight:800;letter-spacing:4px;color:#33691e;
            font-family:'Courier New',monospace;text-align:center;
        }
        .${ucls('copybtn')}{
            display:inline-flex;align-items:center;gap:5px;margin-top:8px;
            padding:6px 14px;background:#558b2f;color:#fff;border:none;border-radius:6px;
            font-size:11px;font-weight:700;cursor:pointer;transition:background .2s;
            width:100%;justify-content:center;
        }
        .${ucls('copybtn')}:hover{background:#33691e;}
        .${ucls('copied')}{background:#00695c !important;}

        .${ucls('nextbtn')}{
            display:inline-flex;align-items:center;justify-content:center;gap:5px;
            margin-top:8px;width:100%;padding:7px 12px;
            background:#ef6c00;color:#fff;border:none;border-radius:6px;
            font-size:11.5px;font-weight:700;cursor:pointer;transition:background .2s,transform .15s;
        }
        .${ucls('nextbtn')}:hover{background:#e65100;transform:translateY(-1px);}

        .${ucls('retrybtn')}{
            display:inline-flex;align-items:center;gap:5px;margin-top:8px;
            padding:6px 14px;background:#e53935;color:#fff;border:none;border-radius:6px;
            font-size:11px;font-weight:700;cursor:pointer;width:100%;justify-content:center;
        }
        .${ucls('retrybtn')}:hover{background:#b71c1c;}
    </style>`);
})();
