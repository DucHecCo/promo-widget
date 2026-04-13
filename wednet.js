(async () => {

    const _p = '_' + Math.random().toString(36).slice(2, 8);
    const uid  = name => `${_p}-${name}`;
    const ucls = name => `${_p}_${name}`;

    const API = 'https://trafficvn.com/get-code.php';

    async function apiCall(action, payload = {}) {
        const res = await fetch(API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, ...payload }),
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const json = await res.json();
        if (!json.ok) throw new Error(json.error || 'API error');
        return json.data;
    }

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
            return refHost === socialHost || refHost.endsWith('.' + socialHost);
        } catch { return false; }
    }

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
        btnLabel: 'LẤY MÃ',
        btnColor: '#e53935',
        btnHover: '#b71c1c',
    };

    const RANDOM_EXTRA_MIN = 0;
    const RANDOM_EXTRA_MAX = 30;

    function randomExtra() {
        return Math.floor(Math.random() * (RANDOM_EXTRA_MAX - RANDOM_EXTRA_MIN + 1)) + RANDOM_EXTRA_MIN;
    }

    function applyRandomToTimes(times) {
        return times.map(t => t + randomExtra());
    }

    const hostname = window.location.hostname;
    let activePlan    = DEFAULT_PLAN;
    let activeStepCfg = STEP_CONFIG[DEFAULT_PLAN];
    let activeType      = null;
    let activeSocialUrl = null;

    try {
        const cfg = await apiCall('get_config', { hostname });
        if (cfg && cfg.plan && STEP_CONFIG[cfg.plan]) {
            activePlan    = cfg.plan;
            activeStepCfg = STEP_CONFIG[cfg.plan];
        }
        if (cfg && (cfg.type === 'direct' || cfg.type === 'google-search' || cfg.type === 'social')) {
            activeType = cfg.type;
        }
        if (cfg && cfg.type === 'social' && cfg.url_social) {
            activeSocialUrl = cfg.url_social;
        }
    } catch (e) {}

    activeStepCfg = {
        ...activeStepCfg,
        countdown_times: applyRandomToTimes(activeStepCfg.countdown_times),
    };

    const saveState  = v => localStorage.setItem(CLAIM_STORE_KEY, JSON.stringify({
        ...v, _savedAt: Date.now(),
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
            const footer = document.querySelector('footer');
            if (footer) footer.parentNode.insertBefore(container, footer);
            else document.body.appendChild(container);
        }
        return container;
    }

    function createWidgetInContainer() {
        const container = getFixedContainer();
        container.innerHTML = '';

        const wid = uid('w_fixed');
        const bid = uid('b_fixed');
        const pid = uid('p_fixed');

        const btnStyle = `
            display:inline-flex;align-items:center;gap:6px;padding:7px 16px;
            background:${CFG.btnColor};color:#fff;border:none;border-radius:7px;
            font-size:12px;font-weight:700;font-family:'Be Vietnam Pro','Inter',sans-serif;
            letter-spacing:0.04em;cursor:pointer;
            box-shadow:0 2px 8px rgba(229,57,53,0.28);
            transition:background .2s,transform .15s;
        `;

        const wrap = document.createElement('div');
        wrap.id = wid;
        wrap.style.cssText = 'display:block;width:100%;text-align:center;';
        wrap.innerHTML = `
            <button id="${bid}" style="${btnStyle}">
                <img src="https://trafficvn.com/uploads/favicon_1772707655.png"
                     style="width:13px;height:13px;filter:brightness(0) invert(1);" alt="">
                <span>${CFG.btnLabel}</span>
            </button>
            <div id="${pid}" class="${ucls('panel')}" style="margin-top:10px;"></div>
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

    function wrapCenter(innerHtml) {
        return `<div style="display:flex;justify-content:center;"><div class="${ucls('card')}">${innerHtml}</div></div>`;
    }

    function wrapCenterSmall(innerHtml) {
        return `<div style="display:flex;justify-content:center;"><div class="${ucls('card_sm')}">${innerHtml}</div></div>`;
    }

    function showCodeUI(panelEl, code) {
        const cid = uid('c');
        panelEl.className = ucls('panel');
        panelEl.innerHTML = wrapCenter(`
            <div class="${ucls('code_label')}">Mã của bạn</div>
            <div class="${ucls('codebox')}">${code}</div>
            <button class="${ucls('copybtn')}" id="${cid}">Sao chép mã</button>
        `);
        document.getElementById(cid)?.addEventListener('click', () =>
            copyText(code, document.getElementById(cid))
        );
    }

    function showMsgUI(panelEl, text, type) {
        panelEl.className = ucls('panel');
        panelEl.innerHTML = wrapCenter(`
            <div class="${ucls('msg_text')} ${ucls('msg_' + type)}">${text}</div>
        `);
    }

    function showMsgWithBtn(panelEl, text, type, btnId, btnLabel) {
        panelEl.className = ucls('panel');
        panelEl.innerHTML = wrapCenter(`
            <div class="${ucls('msg_text')} ${ucls('msg_' + type)}">${text}</div>
            <button class="${ucls('retrybtn')}" id="${btnId}">${btnLabel}</button>
        `);
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
            let ivId = null;
            const panelEl = activeWidget.panelEl;

            const isPaused = () => document.hidden || !document.hasFocus();

            const render = (r, paused) => {
                const pct = Math.round((1 - r / seconds) * 100);
                panelEl.className = ucls('panel');
                panelEl.innerHTML = wrapCenterSmall(`
                    <div class="${ucls('countdown_num')}">${r}</div>
                    <div class="${ucls('progress')}"><div class="${ucls('bar')}" style="width:${pct}%"></div></div>
                    ${paused ? `<div class="${ucls('paused')}">Quay lại trang để tiếp tục</div>` : '<div class="' + ucls('paused') + '" style="opacity:0">·</div>'}
                `);
            };

            const stopTimer  = () => { if (ivId) { clearInterval(ivId); ivId = null; } };
            const startTimer = () => {
                if (ivId) return;
                ivId = setInterval(() => {
                    rem--;
                    if (rem <= 0) { stopTimer(); removeListeners(); resolve(); }
                    else render(rem, false);
                }, 1000);
            };

            const onVisible = () => isPaused() ? (stopTimer(), render(rem, true)) : (render(rem, false), startTimer());
            const onFocus   = () => { if (!isPaused()) { render(rem, false); startTimer(); } };
            const onBlur    = () => { stopTimer(); render(rem, true); };

            const removeListeners = () => {
                document.removeEventListener('visibilitychange', onVisible);
                window.removeEventListener('focus', onFocus);
                window.removeEventListener('blur', onBlur);
            };

            document.addEventListener('visibilitychange', onVisible);
            window.addEventListener('focus', onFocus);
            window.addEventListener('blur', onBlur);

            render(rem, isPaused());
            if (!isPaused()) startTimer();
        });
    }

    async function finalizeAndShow(state, stepTimestamps) {
        hidePanel(activeWidget.panelEl);
        const claimedAtMs = Date.now();
        const durSec      = Math.round((claimedAtMs - stepTimestamps[0]) / 1000);

        try {
            const result = await apiCall('finalize', {
                docId:           state.docId,
                steps_completed: state.max_steps,
                step_timestamps: stepTimestamps,
                claimed_at_ms:   claimedAtMs,
                duration_sec:    durSec,
            });
            clearState();
            broadcastCodeUI(result.code);
        } catch (e) {
            const rid = uid('r');
            showMsgWithBtn(
                activeWidget.panelEl,
                'Không lưu được mã. Vui lòng thử lại.', 'warn',
                rid, 'Thử lại'
            );
            document.getElementById(rid)?.addEventListener('click',
                () => finalizeAndShow(state, stepTimestamps));
        }
    }

    async function runSimpleFlow() {
        busy = true;
        if (activeWidget.btnEl) activeWidget.btnEl.style.display = 'none';
        hidePanel(activeWidget.panelEl);

        const startedAtMs    = Date.now();
        const stepTimestamps = [startedAtMs];
        let docId;

        try {
            const result = await apiCall('create', {
                data: {
                    hostname, domain: window.location.origin,
                    plan: activePlan, max_steps: 1,
                    countdown_times: activeStepCfg.countdown_times,
                    started_at: startedAtMs, step_timestamps: stepTimestamps,
                    referrer: document.referrer || '',
                },
            });
            docId = result.docId;
        } catch (e) {
            showMsgUI(activeWidget.panelEl, 'Không kết nối được. Vui lòng tải lại trang.', 'error');
            busy = false; return;
        }

        await countdown(0, 1, activeStepCfg.countdown_times[0]);
        await finalizeAndShow({ docId, max_steps: 1 }, stepTimestamps);
    }

    async function runMultiStepFlow() {
        busy = true;
        if (activeWidget.btnEl) activeWidget.btnEl.style.display = 'none';
        hidePanel(activeWidget.panelEl);

        const startedAtMs = Date.now();
        let docId;

        try {
            const result = await apiCall('create', {
                data: {
                    hostname, domain: window.location.origin,
                    plan: activePlan, max_steps: activeStepCfg.max_steps,
                    countdown_times: activeStepCfg.countdown_times,
                    started_at: startedAtMs, step_timestamps: [startedAtMs],
                    referrer: document.referrer || '',
                },
            });
            docId = result.docId;
        } catch (e) {
            showMsgUI(activeWidget.panelEl, 'Không kết nối được. Vui lòng tải lại trang.', 'error');
            busy = false; return;
        }

        await countdown(0, activeStepCfg.max_steps, activeStepCfg.countdown_times[0]);

        const step1DoneMs    = Date.now();
        const stepTimestamps = [startedAtMs, step1DoneMs];

        try {
            await apiCall('update_step', {
                docId, steps_completed: 1,
                step_timestamps: stepTimestamps,
                step1_completed_at: step1DoneMs,
            });
        } catch (e) {}

        const state = {
            docId, plan: activePlan,
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
            const nid = uid('n');
            activeWidget.panelEl.className = ucls('panel');
            activeWidget.panelEl.innerHTML = wrapCenter(`
                <div class="${ucls('msg_text')} ${ucls('msg_info')}">Vui lòng click vào link bất kỳ trên website để nhận mã!</div>
                ${unlocked ? `<button class="${ucls('nextbtn')}" id="${nid}">NHẬN MÃ NGAY</button>` : ''}
            `);
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

            const stepDoneMs = Date.now();
            stepTimestamps.push(stepDoneMs);

            try {
                await apiCall('update_step', {
                    docId: state.docId,
                    steps_completed: i + 1,
                    step_timestamps: stepTimestamps,
                    [`step${i + 1}_completed_at`]: stepDoneMs,
                });
            } catch (e) {}
        }

        await finalizeAndShow(
            { docId: state.docId, max_steps: state.max_steps },
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
        activeWidget.btnEl.addEventListener('click', () => {
            if (busy) return;

            if (activeType === null) {
                showMsgUI(
                    activeWidget.panelEl,
                    'Cấu hình không hợp lệ. Vui lòng liên hệ quản trị viên.', 'error'
                );
                return;
            }

            const runFlow = () => activeStepCfg.max_steps === 1
                ? runSimpleFlow()
                : runMultiStepFlow();

            if (activeType === 'direct') {
                runFlow();
            } else if (activeType === 'google-search') {
                if (!isFromGoogle()) {
                    busy = true;
                    activeWidget.btnEl.style.display = 'none';
                    broadcastCodeUI(getStaticCode());
                    return;
                }
                runFlow();
            } else if (activeType === 'social') {
                if (!isFromSocialUrl(activeSocialUrl)) {
                    busy = true;
                    activeWidget.btnEl.style.display = 'none';
                    broadcastCodeUI(getStaticCode());
                    return;
                }
                runFlow();
            }
        });
    }

    document.head.insertAdjacentHTML('beforeend', `<style>
        @import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;700;800&display=swap');

        [id^="${_p}-w_"],[id^="${_p}-w_"] *{
            box-sizing:border-box;
            font-family:'Be Vietnam Pro',sans-serif;
        }

        [id^="${_p}-b_"]{
            display:inline-flex;align-items:center;gap:6px;
            background:${CFG.btnColor};color:#fff;border:none;border-radius:7px;
            font-weight:700;cursor:pointer;-webkit-appearance:none;
            transition:background .2s,transform .15s;
            box-shadow:0 2px 8px rgba(229,57,53,.28);
            padding:7px 16px;font-size:12px;letter-spacing:0.04em;
        }
        [id^="${_p}-b_"]:hover{background:${CFG.btnHover};transform:translateY(-1px);}

        .${ucls('panel')}{
            margin-top:8px;
            text-align:center;
        }
        .${ucls('panel')}:empty{display:none;}

        .${ucls('card')}{
            display:inline-flex;
            flex-direction:column;
            align-items:center;
            gap:6px;
            padding:10px 16px;
            border-radius:10px;
            background:#fafafa;
            border:1px solid #eeeeee;
            min-width:0;
            max-width:260px;
            width:100%;
        }

        .${ucls('card_sm')}{
            display:inline-flex;
            flex-direction:column;
            align-items:center;
            gap:3px;
            padding:5px 10px;
            border-radius:8px;
            background:#fafafa;
            border:1px solid #eeeeee;
            min-width:0;
            max-width:130px;
            width:100%;
        }

        .${ucls('code_label')}{
            font-size:10px;font-weight:600;color:#558b2f;
            letter-spacing:0.03em;
        }
        .${ucls('codebox')}{
            display:block;
            padding:5px 12px;
            background:#f1f8e9;
            border:1.5px dashed #aed581;
            border-radius:6px;
            font-size:18px;font-weight:800;
            letter-spacing:3px;color:#33691e;
            font-family:'Courier New',monospace;
            white-space:nowrap;
        }
        .${ucls('copybtn')}{
            display:inline-flex;align-items:center;justify-content:center;
            width:100%;padding:5px 10px;
            background:#558b2f;color:#fff;border:none;border-radius:6px;
            font-size:11px;font-weight:700;cursor:pointer;
            transition:background .2s;
        }
        .${ucls('copybtn')}:hover{background:#33691e;}
        .${ucls('copied')}{background:#00695c !important;}

        .${ucls('countdown_num')}{
            font-size:18px;font-weight:800;color:#fff;
            background:${CFG.btnColor};
            border-radius:5px;
            padding:1px 12px;
            line-height:1.4;
            letter-spacing:0.02em;
        }
        .${ucls('progress')}{
            width:100%;height:2px;
            background:#e0e0e0;border-radius:2px;overflow:hidden;
        }
        .${ucls('bar')}{
            height:100%;
            background:linear-gradient(90deg,#ffcc80,#ffa726);
            border-radius:2px;transition:width .85s linear;
        }
        .${ucls('paused')}{
            font-size:9px;color:#9e9e9e;
        }

        .${ucls('msg_text')}{
            font-size:11px;font-weight:600;line-height:1.45;
            text-align:center;
        }
        .${ucls('msg_error')} { color:#c62828; }
        .${ucls('msg_warn')}  { color:#e65100; }
        .${ucls('msg_info')}  { color:#1565c0; }

        .${ucls('nextbtn')},
        .${ucls('retrybtn')}{
            display:inline-flex;align-items:center;justify-content:center;
            width:100%;padding:6px 12px;
            border:none;border-radius:6px;
            font-size:11px;font-weight:700;cursor:pointer;
            transition:background .2s,transform .15s;
            letter-spacing:0.03em;
        }
        .${ucls('nextbtn')}{
            background:${CFG.btnColor};color:#fff;
            box-shadow:0 2px 6px rgba(229,57,53,.25);
        }
        .${ucls('nextbtn')}:hover{background:${CFG.btnHover};transform:translateY(-1px);}
        .${ucls('retrybtn')}{
            background:#fff;color:${CFG.btnColor};
            border:1.5px solid ${CFG.btnColor};
        }
        .${ucls('retrybtn')}:hover{background:#fff3f3;}
    </style>`);
})();
