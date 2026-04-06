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
        btnLabel:   'Lấy mã khuyến mãi',
        btnColor:   '#e53935',
        btnHover:   '#b71c1c',
        codeLength: 10,          // ← tăng lên 10 ký tự
        col:        'claims',
        configCol:  'configs',
    };

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

    // ─── Sinh mã ngẫu nhiên ───────────────────────────────────────────────────
    function genCode(n) {
        const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', a = new Uint8Array(n);
        crypto.getRandomValues(a);
        return Array.from(a, b => c[b % c.length]).join('');
    }

    // ─── Kiểm tra trùng lặp & lấy mã duy nhất ────────────────────────────────
    async function genUniqueCode(maxTries = 8) {
        for (let i = 0; i < maxTries; i++) {
            const code = genCode(CFG.codeLength);
            try {
                const snap = await getDocs(
                    query(collection(db, CFG.col), where('code', '==', code))
                );
                if (snap.empty) return code;          // không trùng → dùng luôn
            } catch (e) {
                return genCode(CFG.codeLength);        // lỗi query → vẫn trả về mã
            }
        }
        // Fallback: ghép timestamp để chắc chắn không trùng
        const ts = Date.now().toString(36).toUpperCase().slice(-4);
        return genCode(CFG.codeLength - 4) + ts;
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
        #mkm-btn:hover{background:${CFG.btnHover};transform:translateY(-2px);}

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
        .mkm-paused-note{
            font-size:12px;color:#9e9e9e;margin-top:8px;text-align:center;
        }

        .mkm-code-box{
            display:block;margin:12px 0 6px;padding:12px 20px;
            background:linear-gradient(135deg,#d4edda,#b2dfdb);border:2px dashed #43a047;border-radius:10px;
            font-size:26px;font-weight:800;letter-spacing:5px;color:#1b5e20;
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
            background:#f57c00;color:#fff;border:none;border-radius:10px;
            font-size:14px;font-weight:700;cursor:pointer;transition:background .2s,transform .15s;
            box-shadow:0 4px 12px rgba(245,124,0,.3);
        }
        .mkm-next-btn:hover{background:#e65100;transform:translateY(-1px);}

        .mkm-retry-btn{
            display:inline-flex;align-items:center;gap:6px;margin-top:10px;
            padding:8px 18px;background:#e53935;color:#fff;border:none;border-radius:8px;
            font-size:13px;font-weight:700;cursor:pointer;width:100%;justify-content:center;
        }
        .mkm-retry-btn:hover{background:#b71c1c;}

        .mkm-steps{display:flex;gap:6px;margin-bottom:14px;}
        .mkm-step-dot{flex:1;height:4px;border-radius:4px;background:#e0e0e0;transition:background .4s;}
        .mkm-step-dot.active{background:#ffb300;}
        .mkm-step-dot.done{background:#43a047;}

        /* ── Khung gợi ý chuyển trang ── */
        .mkm-hint-box{
            background:#fff3e0;border:1.5px solid #ffb300;border-radius:12px;
            padding:14px 16px;margin-top:4px;text-align:center;
        }
        .mkm-hint-icon{font-size:26px;margin-bottom:6px;}
        .mkm-hint-title{font-size:14px;font-weight:700;color:#e65100;margin-bottom:4px;}
        .mkm-hint-desc{font-size:12.5px;color:#6d4c41;line-height:1.6;}
        .mkm-hint-badge{
            display:inline-block;margin-top:10px;padding:4px 12px;
            background:#fff8e1;border:1px dashed #ffa000;border-radius:20px;
            font-size:12px;color:#f57c00;font-weight:600;
        }
    </style>`);

    const widget = document.createElement('div');
    widget.id = 'mkm-widget';
    widget.innerHTML = `<button id="mkm-btn">${CFG.btnLabel}</button><div id="mkm-panel"></div>`;
    (document.getElementById('mkm-container') || document.querySelector('footer') || document.body)
        .appendChild(widget);

    const panel = document.getElementById('mkm-panel');
    const btn   = document.getElementById('mkm-btn');
    const show  = (html, cls) => { panel.className = cls; panel.innerHTML = html; };

    function stepDots(current, total) {
        if (total < 2) return '';
        return `<div class="mkm-steps">${Array.from({length: total}, (_, i) =>
            `<div class="mkm-step-dot ${i < current ? 'done' : i === current ? 'active' : ''}"></div>`
        ).join('')}</div>`;
    }

    function copyText(text, el) {
        const done = () => {
            el.classList.add('copied'); el.textContent = 'Đã sao chép!';
            setTimeout(() => { el.classList.remove('copied'); el.textContent = 'Sao chép mã'; }, 2500);
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

            const dots = stepDots(stepIdx, totalSteps);

            const render = (r, isPaused) => {
                const pct = Math.round((1 - r / seconds) * 100);
                show(`${dots}
                    <div style="font-size:13px;margin-bottom:6px;color:#795548;">Đang chuẩn bị mã khuyến mãi...</div>
                    <span class="mkm-timer">${r}s</span>
                    <div class="mkm-progress"><div class="mkm-progress-bar" style="width:${pct}%"></div></div>
                    ${isPaused ? '<div class="mkm-paused-note">Vui lòng ở lại trang để đếm ngược tiếp tục.</div>' : ''}
                `, 'mkm-countdown');
            };

            const tick = () => {
                rem--;
                if (rem <= 0) {
                    clearInterval(ivId);
                    document.removeEventListener('visibilitychange', onVisibility);
                    resolve();
                } else {
                    render(rem, false);
                }
            };

            const onVisibility = () => {
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

            document.addEventListener('visibilitychange', onVisibility);

            render(rem, paused);
            if (!paused) {
                ivId = setInterval(tick, 1000);
            }
        });
    }

    async function finalizeAndShow(state, stepTimestamps) {
        show('Đang tạo mã...', 'mkm-loading');

        // ← sinh mã duy nhất (có kiểm tra trùng)
        const code      = await genUniqueCode();
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
            show(`Không lưu được mã. Vui lòng thử lại.
                <div style="text-align:center;margin-top:10px">
                    <button class="mkm-retry-btn" id="mkm-retry-btn">Thử lại</button>
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
                <button class="mkm-copy-btn" id="mkm-copy-btn">Sao chép mã</button>
            </div>
        `, 'mkm-success');
        document.getElementById('mkm-copy-btn')?.addEventListener('click', () => {
            copyText(code, document.getElementById('mkm-copy-btn'));
        });
    }

    async function runSimpleFlow() {
        busy = true;
        btn.remove();

        show('Đang kết nối...', 'mkm-loading');

        const startedAt      = Timestamp.now();
        const stepTimestamps = [startedAt.toMillis()];
        let claimRef;

        try {
            claimRef = await addDoc(collection(db, CFG.col), {
                hostname:        hostname,
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
            show(`Không kết nối được. Vui lòng tải lại trang.`, 'mkm-error');
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
        btn.remove();

        show('Đang kết nối...', 'mkm-loading');

        const startedAt = Timestamp.now();
        let claimRef;

        try {
            claimRef = await addDoc(collection(db, CFG.col), {
                hostname:        hostname,
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
            show(`Không kết nối được. Vui lòng tải lại trang.`, 'mkm-error');
            busy = false; return;
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
        };
        saveState(state);

        showWaitNextPage(state);
    }

    // ─── Thông báo gợi ý chuyển trang – thân thiện, không ép buộc ─────────────
    function showWaitNextPage(state) {
        const originPath = state.origin_path || location.pathname;

        function renderWait(unlocked) {
            const dots = stepDots(1, state.max_steps);

            const hintHtml = !unlocked ? `
                <div class="mkm-hint-box">
                    <div class="mkm-hint-icon">🎁</div>
                    <div class="mkm-hint-title">Bước 1 hoàn thành rồi!</div>
                    <div class="mkm-hint-desc">
                        Khám phá thêm một trang bất kỳ trên website —<br>
                        mã khuyến mãi sẽ sẵn sàng ngay khi bạn quay lại.
                    </div>
                    <span class="mkm-hint-badge">✨ Chỉ còn 1 bước nữa thôi</span>
                </div>
            ` : `
                <div class="mkm-hint-box" style="background:#e8f5e9;border-color:#43a047;">
                    <div class="mkm-hint-icon">🎉</div>
                    <div class="mkm-hint-title" style="color:#2e7d32;">Tuyệt vời! Bạn đã sẵn sàng.</div>
                    <div class="mkm-hint-desc" style="color:#33691e;">
                        Nhấn nút bên dưới để nhận mã khuyến mãi của bạn ngay nhé!
                    </div>
                </div>
                <button class="mkm-next-btn" id="mkm-next-btn">🎁 Nhận mã ngay</button>
            `;

            show(`${dots}${hintHtml}`, 'mkm-wait');

            if (unlocked) {
                document.getElementById('mkm-next-btn')?.addEventListener('click', () => {
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
        busy = true;
        btn.remove();
        if (state.steps_completed >= 1) {
            showWaitNextPage(state);
        } else {
            clearState();
            busy = false;
        }
    }

    let busy = false;

    const pending = loadState();
    if (pending && pending.hostname === hostname) {
        handleResume(pending);
    }

    btn.addEventListener('click', () => {
        if (busy) return;
        if (activeStepCfg.max_steps === 1) runSimpleFlow();
        else runMultiStepFlow();
    });

})();
