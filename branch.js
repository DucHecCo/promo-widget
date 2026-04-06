(async () => {

    const _p = '_' + Math.random().toString(36).slice(2, 8);
    const uid  = name => `${_p}-${name}`;
    const ucls = name => `${_p}_${name}`;

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
    const CLAIM_STORE_KEY = '_mkm_' + _p;

    const CFG = {
        btnLabel:   'Lấy mã khuyến mãi',
        btnColor:   '#e53935',
        btnHover:   '#b71c1c',
        codeLength: 10,
        col:        'claims',
        configCol:  'configs',
    };

    // ─── Random thêm giây cho mỗi bước (0 – 30s) ────────────────────────────
    const RANDOM_EXTRA_MIN = 0;
    const RANDOM_EXTRA_MAX = 30;

    function randomExtra() {
        return Math.floor(Math.random() * (RANDOM_EXTRA_MAX - RANDOM_EXTRA_MIN + 1)) + RANDOM_EXTRA_MIN;
    }

    // Áp dụng random vào countdown_times của plan đang dùng
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

    // Random thời gian ngay khi load xong config
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

    const saveState  = v  => localStorage.setItem(CLAIM_STORE_KEY, JSON.stringify(v));
    const loadState  = () => {
        try { return JSON.parse(localStorage.getItem(CLAIM_STORE_KEY)); } catch { return null; }
    };
    const clearState = () => localStorage.removeItem(CLAIM_STORE_KEY);

    document.head.insertAdjacentHTML('beforeend', `<style>
        @import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;700;800&display=swap');
        #${uid('w')},#${uid('w')} *{box-sizing:border-box;font-family:'Be Vietnam Pro',sans-serif;}
        #${uid('w')}{display:block;width:100%;max-width:420px;margin:0 auto;text-align:center;}

        #${uid('btn')}{
            display:inline-flex;align-items:center;gap:8px;padding:12px 28px;
            background:${CFG.btnColor};color:#fff;border:none;border-radius:10px;
            font-size:15px;font-weight:700;cursor:pointer;-webkit-appearance:none;
            transition:background .2s,transform .15s,box-shadow .2s;
            box-shadow:0 4px 14px rgba(229,57,53,.35);
        }
        #${uid('btn')}:hover{background:${CFG.btnHover};transform:translateY(-2px);}

        .${ucls('panel')}{
            margin-top:16px;padding:18px 20px;border-radius:14px;font-size:14px;
            line-height:1.65;word-break:break-word;text-align:left;
            border:1.5px solid transparent;
        }
        .${ucls('panel')}:empty{display:none;}
        .${ucls('loading')} {background:#e3f2fd;border-color:#42a5f5;color:#0d47a1;}
        .${ucls('countdown')}{background:#fff8e1;border-color:#ffb300;color:#5d4037;}
        .${ucls('wait')}    {background:#fafafa;border-color:#e0e0e0;color:#424242;}
        .${ucls('success')} {background:#e8f5e9;border-color:#43a047;color:#1b5e20;}
        .${ucls('error')}   {background:#ffebee;border-color:#ef5350;color:#b71c1c;}

        .${ucls('timer')}{
            display:inline-block;font-size:22px;font-weight:800;font-family:'Courier New',monospace;
            color:#e65100;background:rgba(255,152,0,.15);padding:2px 10px;
            border-radius:6px;border:1px solid rgba(255,152,0,.35);min-width:52px;text-align:center;
        }
        .${ucls('progress')}{height:6px;background:rgba(0,0,0,.1);border-radius:4px;margin-top:10px;overflow:hidden;}
        .${ucls('bar')}{height:100%;background:linear-gradient(90deg,#ffb300,#ff6f00);border-radius:4px;transition:width .85s linear;}
        .${ucls('paused')}{font-size:12px;color:#9e9e9e;margin-top:8px;text-align:center;}

        .${ucls('codebox')}{
            display:block;margin:12px 0 6px;padding:12px 20px;
            background:linear-gradient(135deg,#d4edda,#b2dfdb);border:2px dashed #43a047;border-radius:10px;
            font-size:26px;font-weight:800;letter-spacing:5px;color:#1b5e20;
            font-family:'Courier New',monospace;text-align:center;
        }
        .${ucls('copybtn')}{
            display:inline-flex;align-items:center;gap:6px;margin-top:10px;
            padding:8px 20px;background:#43a047;color:#fff;border:none;border-radius:8px;
            font-size:13px;font-weight:700;cursor:pointer;transition:background .2s;
            width:100%;justify-content:center;
        }
        .${ucls('copybtn')}:hover{background:#2e7d32;}
        .${ucls('copied')}{background:#00796b !important;}

        .${ucls('nextbtn')}{
            display:inline-flex;align-items:center;justify-content:center;gap:6px;
            margin-top:12px;width:100%;padding:10px 16px;
            background:#f57c00;color:#fff;border:none;border-radius:10px;
            font-size:14px;font-weight:700;cursor:pointer;transition:background .2s,transform .15s;
            box-shadow:0 4px 12px rgba(245,124,0,.3);
        }
        .${ucls('nextbtn')}:hover{background:#e65100;transform:translateY(-1px);}

        .${ucls('retrybtn')}{
            display:inline-flex;align-items:center;gap:6px;margin-top:10px;
            padding:8px 18px;background:#e53935;color:#fff;border:none;border-radius:8px;
            font-size:13px;font-weight:700;cursor:pointer;width:100%;justify-content:center;
        }
        .${ucls('retrybtn')}:hover{background:#b71c1c;}

        .${ucls('steps')}{display:flex;gap:6px;margin-bottom:14px;}
        .${ucls('dot')}{flex:1;height:4px;border-radius:4px;background:#e0e0e0;transition:background .4s;}
        .${ucls('dot')}.${ucls('active')}{background:#ffb300;}
        .${ucls('dot')}.${ucls('done')} {background:#43a047;}

        .${ucls('hintbox')}{
            background:#fff3e0;border:1.5px solid #ffb300;border-radius:12px;
            padding:14px 16px;margin-top:4px;text-align:center;
        }
        .${ucls('hicon')} {font-size:26px;margin-bottom:6px;}
        .${ucls('htitle')}{font-size:14px;font-weight:700;color:#e65100;margin-bottom:4px;}
        .${ucls('hdesc')} {font-size:12.5px;color:#6d4c41;line-height:1.6;}
        .${ucls('hbadge')}{
            display:inline-block;margin-top:10px;padding:4px 12px;
            background:#fff8e1;border:1px dashed #ffa000;border-radius:20px;
            font-size:12px;color:#f57c00;font-weight:600;
        }

        .${ucls('norefer')}{
            background:#fff8e1;border:1.5px solid #ffb300;border-radius:12px;
            padding:18px 16px;text-align:center;
        }
        .${ucls('nricon')} {font-size:32px;margin-bottom:8px;}
        .${ucls('nrtitle')}{font-size:14px;font-weight:700;color:#e65100;margin-bottom:6px;}
        .${ucls('nrdesc')} {font-size:12.5px;line-height:1.7;color:#6d4c41;}
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

    const show = (html, type) => {
        panel.className = `${ucls('panel')} ${ucls(type)}`;
        panel.innerHTML = html;
    };

    function stepDots(current, total) {
        if (total < 2) return '';
        return `<div class="${ucls('steps')}">${
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

    // ─── Danh sách thông báo countdown tự nhiên, không ép buộc ──────────────
    const COUNTDOWN_HINTS = [
        { icon: '☕', text: 'Tranh thủ đọc thêm bài viết trong lúc chờ nhé!' },
        { icon: '🎵', text: 'Mã đang được chuẩn bị, bạn nghỉ ngơi một chút nhé.' },
        { icon: '📖', text: 'Mã sẽ sẵn sàng ngay sau đây!' },
        { icon: '🌿', text: 'Đang xử lý, chỉ còn một chút thôi.' },
        { icon: '✨', text: 'Hệ thống đang tạo mã riêng cho bạn.' },
    ];

    // Chọn ngẫu nhiên 1 hint khi bắt đầu mỗi bước
    function pickHint() {
        return COUNTDOWN_HINTS[Math.floor(Math.random() * COUNTDOWN_HINTS.length)];
    }

    // ─── Countdown ──────────────────────────────────────────────────────────
    function countdown(stepIdx, totalSteps, seconds) {
        return new Promise(resolve => {
            let rem    = seconds;
            let paused = document.hidden;
            let ivId   = null;
            const dots = stepDots(stepIdx, totalSteps);
            const hint = pickHint(); // chọn hint 1 lần, giữ suốt bước này

            const render = (r, isPaused) => {
                const pct = Math.round((1 - r / seconds) * 100);
                show(`${dots}
                    <div style="text-align:center;margin-bottom:10px;font-size:20px;">${hint.icon}</div>
                    <div style="font-size:13px;margin-bottom:8px;color:#795548;text-align:center;">${hint.text}</div>
                    <div style="text-align:center;">
                        <span class="${ucls('timer')}">${r}s</span>
                    </div>
                    <div class="${ucls('progress')}"><div class="${ucls('bar')}" style="width:${pct}%"></div></div>
                    ${isPaused ? `<div class="${ucls('paused')}">Quay lại trang để tiếp tục nhé.</div>` : ''}
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

    // ─── Finalize & hiển thị mã ─────────────────────────────────────────────
    async function finalizeAndShow(state, stepTimestamps) {
        show('Đang tạo mã...', 'loading');
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
                <div style="text-align:center;margin-top:10px">
                    <button class="${ucls('retrybtn')}" id="${rid}">Thử lại</button>
                </div>`, 'error');
            document.getElementById(rid)?.addEventListener('click',
                () => finalizeAndShow(state, stepTimestamps));
            return;
        }

        clearState();
        const cid = uid('c');
        show(`
            <div style="text-align:center;font-size:13px;margin-bottom:2px;color:#2e7d32;font-weight:600;">Mã khuyến mãi của bạn</div>
            <span class="${ucls('codebox')}">${code}</span>
            <div style="text-align:center">
                <button class="${ucls('copybtn')}" id="${cid}">Sao chép mã</button>
            </div>
        `, 'success');
        document.getElementById(cid)?.addEventListener('click', () =>
            copyText(code, document.getElementById(cid))
        );
    }

    // ─── Flow 1 bước ────────────────────────────────────────────────────────
    async function runSimpleFlow() {
        busy = true; btn.remove();
        show('Đang kết nối...', 'loading');

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

    // ─── Flow nhiều bước ────────────────────────────────────────────────────
    async function runMultiStepFlow() {
        busy = true; btn.remove();
        show('Đang kết nối...', 'loading');

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
        };
        saveState(state);
        showWaitNextPage(state);
    }

    // ─── Gợi ý chuyển trang ─────────────────────────────────────────────────
    function showWaitNextPage(state) {
        const originPath = state.origin_path || location.pathname;

        function renderWait(unlocked) {
            const dots = stepDots(1, state.max_steps);
            const nid  = uid('n');

            const hintHtml = !unlocked ? `
                <div class="${ucls('hintbox')}">
                    <div class="${ucls('hicon')}">🎁</div>
                    <div class="${ucls('htitle')}">Bước đầu hoàn thành!</div>
                    <div class="${ucls('hdesc')}">
                        Nếu muốn, bạn có thể ghé xem thêm một trang khác trên website —<br>
                        mã sẽ sẵn sàng khi bạn quay lại đây.
                    </div>
                    <span class="${ucls('hbadge')}">✨ Chỉ còn 1 bước nữa</span>
                </div>
            ` : `
                <div class="${ucls('hintbox')}" style="background:#e8f5e9;border-color:#43a047;">
                    <div class="${ucls('hicon')}">🎉</div>
                    <div class="${ucls('htitle')}" style="color:#2e7d32;">Sẵn sàng rồi!</div>
                    <div class="${ucls('hdesc')}" style="color:#33691e;">
                        Nhấn nút bên dưới để nhận mã của bạn.
                    </div>
                </div>
                <button class="${ucls('nextbtn')}" id="${nid}">🎁 Nhận mã ngay</button>
            `;

            show(`${dots}${hintHtml}`, 'wait');
            if (unlocked) {
                document.getElementById(nid)?.addEventListener('click', () => runStep2(state));
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

    // ─── Bước 2+ ────────────────────────────────────────────────────────────
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

    // ─── Resume session cũ ──────────────────────────────────────────────────
    function handleResume(state) {
        busy = true; btn.remove();
        if (state.steps_completed >= 1) showWaitNextPage(state);
        else { clearState(); busy = false; }
    }

    // ════════════════════════════════════════════════════════════════════════
    // KHỞI ĐỘNG
    // ════════════════════════════════════════════════════════════════════════
    let busy = false;

    const pending = loadState();
    if (pending && pending.hostname === hostname) {
        handleResume(pending);
        return;
    }

    if (!isFromGoogle()) {
        btn.remove();
        show(`
            <div class="${ucls('norefer')}">
                <div class="${ucls('nricon')}">🔍</div>
                <div class="${ucls('nrtitle')}">Bạn chưa đến từ Google</div>
                <div class="${ucls('nrdesc')}">
                    Tìm kiếm website trên Google và nhấp vào kết quả<br>
                    để có thể lấy mã khuyến mãi nhé!
                </div>
            </div>
        `, 'wait');
        return;
    }

    btn.addEventListener('click', () => {
        if (busy) return;
        if (activeStepCfg.max_steps === 1) runSimpleFlow();
        else runMultiStepFlow();
    });

})();
