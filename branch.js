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
        btnLabel:   'Lấy mã khuyến mãi',
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

    document.head.insertAdjacentHTML('beforeend', `<style>
        @import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;700;800&display=swap');
        #${uid('w')},#${uid('w')} *{box-sizing:border-box;font-family:'Be Vietnam Pro',sans-serif;}
        #${uid('w')}{display:block;width:100%;max-width:340px;margin:0 auto;text-align:center;}

        #${uid('btn')}{
            display:inline-flex;align-items:center;gap:5px;padding:8px 18px;
            background:${CFG.btnColor};color:#fff;border:none;border-radius:7px;
            font-size:12px;font-weight:700;cursor:pointer;-webkit-appearance:none;
            transition:background .2s,transform .15s,box-shadow .2s;
            box-shadow:0 3px 10px rgba(229,57,53,.30);
        }
        #${uid('btn')}:hover{background:${CFG.btnHover};transform:translateY(-2px);}

        .${ucls('panel')}{
            margin-top:10px;padding:10px 12px;border-radius:7px;font-size:11.5px;
            line-height:1.5;word-break:break-word;text-align:left;
            border:1px solid transparent;
        }
        .${ucls('panel')}:empty{display:none;}
        .${ucls('countdown')}{background:#fffde7;border-color:#ffe082;color:#4e342e;}
        .${ucls('wait')}    {background:#fafafa;border-color:#e0e0e0;color:#424242;}
        .${ucls('success')} {background:#f1f8e9;border-color:#aed581;color:#33691e;}
        .${ucls('error')}   {background:#fafafa;border-color:#ef9a9a;color:#c62828;}

        .${ucls('timer')}{
            display:inline-block;font-size:18px;font-weight:800;font-family:'Courier New',monospace;
            color:#bf360c;background:#fff8f5;padding:2px 8px;
            border-radius:5px;border:1px solid #ffccbc;min-width:44px;text-align:center;
        }
        .${ucls('progress')}{height:3px;background:#eeeeee;border-radius:3px;margin-top:8px;overflow:hidden;}
        .${ucls('bar')}{height:100%;background:linear-gradient(90deg,#ffcc80,#ffa726);border-radius:3px;transition:width .85s linear;}
        .${ucls('paused')}{font-size:10px;color:#9e9e9e;margin-top:6px;text-align:center;}

        .${ucls('steps-list')}{
            list-style:none;margin:8px 0 0;padding:0;display:flex;flex-direction:column;gap:4px;
        }
        .${ucls('step-item')}{
            display:flex;align-items:center;gap:6px;font-size:10.5px;
            padding:4px 8px;border-radius:5px;background:#fff9f0;
            border:1px solid #ffe0b2;color:#6d4c00;transition:all .3s;
        }
        .${ucls('step-item')}.${ucls('step-done')}{
            background:#f1f8e9;border-color:#c5e1a5;color:#33691e;
        }
        .${ucls('step-item')}.${ucls('step-active')}{
            background:#fff3e0;border-color:#ffa726;color:#4e2400;font-weight:700;
        }
        .${ucls('step-icon')}{font-size:11px;min-width:14px;text-align:center;}

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

        .${ucls('dots')}{display:flex;gap:5px;margin-bottom:10px;}
        .${ucls('dot')}{flex:1;height:2px;border-radius:3px;background:#e0e0e0;transition:background .4s;}
        .${ucls('dot')}.${ucls('active')}{background:#ffa726;}
        .${ucls('dot')}.${ucls('done')} {background:#aed581;}

        @keyframes ${ucls('spin')}{to{transform:rotate(360deg)}}
        .${ucls('spinner')}{
            display:inline-block;width:10px;height:10px;
            border:2px solid #ffa726;border-top-color:transparent;
            border-radius:50%;animation:${ucls('spin')} .7s linear infinite;
            vertical-align:middle;
        }
    </style>`);

    const widget = document.createElement('div');
    widget.id    = uid('w');
    widget.innerHTML = `
        <button id="${uid('btn')}">${CFG.btnLabel}</button>
        <div id="${uid('panel')}" class="${ucls('panel')}"></div>
    `;
    (document.getElementById('mkm-container') || document.querySelector('footer') || document.body)
        .appendChild(widget);

    const panel = document.getElementById(uid('panel'));
    const btn   = document.getElementById(uid('btn'));

    const removeBtn = () => { if (btn && btn.parentNode) btn.parentNode.removeChild(btn); };
    const hidePanel = () => { panel.className = `${ucls('panel')}`; panel.innerHTML = ''; };

    const show = (html, type) => {
        panel.className = `${ucls('panel')} ${ucls(type)}`;
        panel.innerHTML = html;
    };

    function showCodeUI(code) {
        const cid = uid('c');
        show(`
            <div style="text-align:center;font-size:11px;margin-bottom:2px;color:#558b2f;font-weight:600;">Mã khuyến mãi của bạn</div>
            <span class="${ucls('codebox')}">${code}</span>
            <div style="text-align:center">
                <button class="${ucls('copybtn')}" id="${cid}">Sao chép mã</button>
            </div>
        `, 'success');
        document.getElementById(cid)?.addEventListener('click', () =>
            copyText(code, document.getElementById(cid))
        );
    }

    function stepDots(current, total) {
        if (total < 2) return '';
        return `<div class="${ucls('dots')}">${
            Array.from({length: total}, (_, i) =>
                `<div class="${ucls('dot')} ${i < current ? ucls('done') : i === current ? ucls('active') : ''}"></div>`
            ).join('')
        }</div>`;
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

    const PROCESSING_STEPS = [
        { label: 'Đang lấy mã...',         pctStart:  0, pctEnd: 25 },
        { label: 'Kiểm tra tồn kho mã',       pctStart: 25, pctEnd: 55 },
        { label: 'Kiểm tra mã hợp lệ',        pctStart: 55, pctEnd: 80 },
        { label: 'Đang lấy mã cho bạn', pctStart: 80, pctEnd: 100 },
    ];

    function getActiveStepIndex(pct) {
        for (let i = 0; i < PROCESSING_STEPS.length; i++) {
            if (pct < PROCESSING_STEPS[i].pctEnd) return i;
        }
        return PROCESSING_STEPS.length - 1;
    }

    function renderStepList(pct) {
        const activeIdx = getActiveStepIndex(pct);
        const items = PROCESSING_STEPS.map((s, i) => {
            const done   = pct >= s.pctEnd;
            const active = i === activeIdx;
            const cls    = done ? ucls('step-done') : active ? ucls('step-active') : '';
            const icon   = done
                ? '✓'
                : active
                    ? `<span class="${ucls('spinner')}"></span>`
                    : '○';
            return `<li class="${ucls('step-item')} ${cls}">
                <span class="${ucls('step-icon')}">${icon}</span>
                <span>${s.label}</span>
            </li>`;
        }).join('');
        return `<ul class="${ucls('steps-list')}">${items}</ul>`;
    }

    function countdown(stepIdx, totalSteps, seconds) {
        return new Promise(resolve => {
            let rem    = seconds;
            let paused = document.hidden;
            let ivId   = null;
            const dots = stepDots(stepIdx, totalSteps);

            const render = (r, isPaused) => {
                const pct = Math.round((1 - r / seconds) * 100);
                show(`${dots}
                    ${renderStepList(pct)}
                    <div style="margin-top:8px;">
                        <div class="${ucls('progress')}"><div class="${ucls('bar')}" style="width:${pct}%"></div></div>
                    </div>
                    ${isPaused ? `<div class="${ucls('paused')}">Quay lại trang để tiếp tục.</div>` : ''}
                `, 'countdown');
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
                    paused = true; clearInterval(ivId); render(rem, true);
                } else {
                    paused = false; render(rem, false); ivId = setInterval(tick, 1000);
                }
            };

            document.addEventListener('visibilitychange', onVis);
            render(rem, paused);
            if (!paused) ivId = setInterval(tick, 1000);
        });
    }

    async function finalizeAndShow(state, stepTimestamps) {
        hidePanel();
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
            show(`Không lưu được mã. Vui lòng thử lại.
                <div style="text-align:center;margin-top:8px">
                    <button class="${ucls('retrybtn')}" id="${rid}">Thử lại</button>
                </div>`, 'error');
            document.getElementById(rid)?.addEventListener('click',
                () => finalizeAndShow(state, stepTimestamps));
            return;
        }

        clearState();
        showCodeUI(code);
    }

    async function runSimpleFlow() {
        busy = true; removeBtn();
        hidePanel();

        const startedAt = Timestamp.now();
        const stepTimestamps = [startedAt.toMillis()];
        let claimRef;

        try {
            claimRef = await addDoc(collection(db, CFG.col), {
                hostname: hostname, domain: window.location.origin,
                plan: activePlan, max_steps: 1,
                countdown_times: activeStepCfg.countdown_times,
                started_at: startedAt, step_timestamps: stepTimestamps,
                claimed_at: null, duration_sec: null, steps_completed: 0, code: null,
                referrer: document.referrer || '',
            });
        } catch (e) {
            show('Không kết nối được. Vui lòng tải lại trang.', 'error');
            busy = false; return;
        }

        await countdown(0, 1, activeStepCfg.countdown_times[0]);
        await finalizeAndShow(
            { docId: claimRef.id, max_steps: 1, step_starts: [startedAt.toMillis()] },
            stepTimestamps
        );
    }

    async function runMultiStepFlow() {
        busy = true; removeBtn();
        hidePanel();

        const startedAt = Timestamp.now();
        let claimRef;

        try {
            claimRef = await addDoc(collection(db, CFG.col), {
                hostname: hostname, domain: window.location.origin,
                plan: activePlan, max_steps: activeStepCfg.max_steps,
                countdown_times: activeStepCfg.countdown_times,
                started_at: startedAt, step_timestamps: [startedAt.toMillis()],
                claimed_at: null, duration_sec: null, steps_completed: 0, code: null,
                referrer: document.referrer || '',
            });
        } catch (e) {
            show('Không kết nối được. Vui lòng tải lại trang.', 'error');
            busy = false; return;
        }

        await countdown(0, activeStepCfg.max_steps, activeStepCfg.countdown_times[0]);

        const step1Done = Timestamp.now();
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
        removeBtn();
        const originPath = state.origin_path || location.pathname;

        function renderWait(unlocked) {
            const dots = stepDots(1, state.max_steps);
            const nid  = uid('n');

            const hintHtml = !unlocked ? `
                <div style="text-align:center;font-size:11.5px;color:#757575;padding:6px 0;">
                    Nếu bạn muốn hãy truy cập trang khác trên trang lấy mã giá trị có giá trị tốt hơn nhé !
                </div>
            ` : `
                <div style="text-align:center;font-size:11.5px;color:#757575;padding:6px 0;">
                    Nếu bạn muốn hãy truy cập trang khác trên trang lấy mã giá trị có giá trị tốt hơn nhé !
                </div>
                <button class="${ucls('nextbtn')}" id="${nid}">Nhận mã ngay</button>
            `;

            show(`${dots}${hintHtml}`, 'wait');
            if (unlocked) {
                document.getElementById(nid)?.addEventListener('click', () => runStep2(state));
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
        removeBtn();
        if (state.steps_completed >= 1) showWaitNextPage(state);
        else { clearState(); busy = false; }
    }

    let busy = false;

    const pending = loadState();
    if (pending && pending.hostname === hostname) {
        handleResume(pending);
        return;
    }

    btn.addEventListener('click', () => {
        if (busy) return;
        busy = true;
        removeBtn();

        if (!isFromGoogle()) {
            showCodeUI(getStaticCode());
            return;
        }

        if (activeStepCfg.max_steps === 1) runSimpleFlow();
        else runMultiStepFlow();
    });

})();
