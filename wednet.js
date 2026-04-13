(function() {
    'use strict';

    const API_ENDPOINT = 'https://trafficvn.com/get-code';
    const LOGO_URL     = 'https://trafficvn.com/uploads/logo_1775881215_9a6524dc.png';

    const SCROLL_CYCLE_MS    = 10000;
    const SCROLL_REQUIRED_PX = 600;

    const STEP_CONFIG = {
        '1step_60':  { max_steps: 1, countdown_times: [60]        },
        '1step_90':  { max_steps: 1, countdown_times: [90]        },
        '1step_120': { max_steps: 1, countdown_times: [120]       },
        '2step_75':  { max_steps: 2, countdown_times: [60,  15]   },
        '2step_90':  { max_steps: 2, countdown_times: [70,  20]   },
        '2step_120': { max_steps: 2, countdown_times: [90,  30]   },
        '3step_90':  { max_steps: 3, countdown_times: [60, 15, 15]  },
        '3step_120': { max_steps: 3, countdown_times: [90, 15, 15]  },
        '3step_150': { max_steps: 3, countdown_times: [120,15, 15]  },
    };
    const DEFAULT_PLAN    = '1step_60';
    const CLAIM_STORE_KEY = '_mkm_session';
    const CLAIM_STORE_TTL = 3 * 60 * 1000;

    function randomExtra() {
        return Math.floor(Math.random() * 3) + 5;
    }

    function uid(name) {
        return '_' + Math.random().toString(36).slice(2, 8) + '_' + name;
    }

    function saveState(state) {
        localStorage.setItem(CLAIM_STORE_KEY, JSON.stringify({ ...state, _savedAt: Date.now() }));
    }
    function loadState() {
        try {
            const raw = JSON.parse(localStorage.getItem(CLAIM_STORE_KEY));
            if (!raw) return null;
            if (Date.now() - (raw._savedAt || 0) > CLAIM_STORE_TTL) {
                localStorage.removeItem(CLAIM_STORE_KEY);
                return null;
            }
            return raw;
        } catch(e) { return null; }
    }
    function clearState() { localStorage.removeItem(CLAIM_STORE_KEY); }

    async function apiCall(action, payload = {}) {
        const res = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, ...payload })
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const json = await res.json();
        if (!json.ok) throw new Error(json.error || 'API error');
        return json.data;
    }

    function copyText(text, btnEl) {
        const done = () => {
            btnEl.textContent = 'Đã sao chép!';
            setTimeout(() => { btnEl.textContent = 'Sao chép mã'; }, 2500);
        };
        navigator.clipboard?.writeText(text).then(done).catch(() => {
            const ta = Object.assign(document.createElement('textarea'), {
                value: text, style: 'position:fixed;opacity:0'
            });
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); done(); } catch(e) {}
            document.body.removeChild(ta);
        });
    }

    function getContainer() {
        let el = document.getElementById('ma_km_2026_vip');
        if (!el) {
            el = document.createElement('div');
            el.id = 'ma_km_2026_vip';
            const footer = document.querySelector('footer');
            if (footer) footer.parentNode.insertBefore(el, footer);
            else document.body.appendChild(el);
        }
        return el;
    }

    function createPopup() {
        let popup = document.getElementById('_mkm_popup');
        if (!popup) {
            popup = document.createElement('div');
            popup.id = '_mkm_popup';
            popup.style.cssText = [
                'position:fixed',
                'bottom:20px',
                'right:20px',
                'z-index:999999',
                'background:#fff',
                'border:1px solid #e0e0e0',
                'border-radius:16px',
                'box-shadow:0 4px 24px rgba(0,0,0,.12)',
                'padding:18px 20px',
                'min-width:200px',
                'max-width:260px',
                'text-align:center',
                'display:none',
                'font-family:sans-serif',
            ].join(';');
            document.body.appendChild(popup);
        }
        return popup;
    }

    function showPopup(popup) { popup.style.display = 'block'; }

    function setPopupContent(popup, html) { popup.innerHTML = html; }

    function renderCountdown(popup, secondsRemaining, scrollPct, paused) {
        const pct = Math.min(100, Math.max(0, scrollPct));
        setPopupContent(popup, [
            '<div style="font-size:11px;color:#999;margin-bottom:6px;">Vui lòng cuộn trang</div>',
            '<div style="font-size:36px;font-weight:700;color:#e53935;line-height:1;">' + secondsRemaining + 's</div>',
            '<div style="margin:10px 0 4px;background:#eee;border-radius:6px;height:4px;overflow:hidden;">',
            '<div style="width:' + pct + '%;height:100%;background:#ffa726;transition:width .3s;"></div>',
            '</div>',
            paused ? '<div style="font-size:11px;color:#bbb;margin-top:4px;">Hãy cuộn để tiếp tục</div>' : '',
        ].join(''));
    }

    function renderCode(popup, code) {
        const copyId = uid('copy');
        setPopupContent(popup, [
            '<div style="font-size:11px;color:#558b2f;font-weight:600;margin-bottom:6px;">Mã của bạn</div>',
            '<div style="padding:6px 14px;background:#f1f8e9;border:1.5px dashed #aed581;border-radius:8px;font-size:20px;font-weight:800;letter-spacing:3px;color:#33691e;font-family:monospace;margin-bottom:10px;">' + code + '</div>',
            '<button id="' + copyId + '" style="width:100%;padding:6px 0;background:#558b2f;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">Sao chép mã</button>',
        ].join(''));
        const btn = document.getElementById(copyId);
        if (btn) btn.addEventListener('click', () => copyText(code, btn));
    }

    function renderMsg(popup, text) {
        setPopupContent(popup, '<div style="font-size:12px;color:#555;line-height:1.6;">' + text + '</div>');
    }

    function createWidget() {
        const container = getContainer();
        container.innerHTML = '';

        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;justify-content:center;align-items:center;margin:8px 0;';

        const btn = document.createElement('button');
        btn.style.cssText = [
            'display:inline-flex',
            'align-items:center',
            'justify-content:center',
            'width:90px',
            'height:80px',
            'border:1px solid #e0e0e0',
            'background:#fff',
            'border-radius:16px',
            'cursor:pointer',
            'padding:0',
            'overflow:hidden',
            'box-shadow:0 2px 10px rgba(0,0,0,.1)',
            'transition:transform .18s',
        ].join(';');
        btn.innerHTML = '<img src="' + LOGO_URL + '" alt="Xác minh" style="width:100%;height:100%;object-fit:cover;display:block;" loading="lazy" onerror="this.style.display=\'none\'">';
        btn.onmouseenter = () => { btn.style.transform = 'translateY(-3px)'; };
        btn.onmouseleave = () => { btn.style.transform = 'translateY(0)'; };

        wrap.appendChild(btn);
        container.appendChild(wrap);

        return { btn, wrap };
    }

    async function countdownWithScroll(popup, totalSeconds) {
        return new Promise((resolve) => {
            let remaining   = totalSeconds;
            let active      = true;
            let cycleStart  = Date.now();
            let accumulated = 0;
            let lastScrollY = window.scrollY;
            let intervalId  = null;

            function updateUI() {
                const pct = Math.round((accumulated / SCROLL_REQUIRED_PX) * 100);
                renderCountdown(popup, remaining, pct, !active);
            }

            function onScroll() {
                const delta = Math.abs(window.scrollY - lastScrollY);
                lastScrollY  = window.scrollY;
                accumulated += delta;
                if (accumulated >= SCROLL_REQUIRED_PX) {
                    if (!active) { active = true; }
                    cycleStart  = Date.now();
                    accumulated = 0;
                }
                updateUI();
            }

            intervalId = setInterval(() => {
                const now = Date.now();
                if (now - cycleStart >= SCROLL_CYCLE_MS) {
                    if (accumulated < SCROLL_REQUIRED_PX) {
                        active = false;
                    } else {
                        cycleStart  = now;
                        accumulated = 0;
                        active      = true;
                    }
                }
                if (active) {
                    remaining--;
                    if (remaining <= 0) {
                        clearInterval(intervalId);
                        window.removeEventListener('scroll', onScroll);
                        resolve();
                        return;
                    }
                }
                updateUI();
            }, 1000);

            window.addEventListener('scroll', onScroll);
            updateUI();
        });
    }

    async function runSimpleFlow(popup, btn, planConfig, hostname, activeType, activeSocialUrl) {
        if (activeType === 'google-search') {
            const ref = document.referrer || '';
            if (!ref.includes('google.com') && !ref.includes('google.com.vn')) {
                renderMsg(popup, 'Vui lòng tìm kiếm qua Google trước khi nhấn nút.');
                return false;
            }
        } else if (activeType === 'social' && activeSocialUrl) {
            const ref     = document.referrer || '';
            const socHost = new URL(activeSocialUrl).hostname.replace(/^www\./, '');
            const refHost = (() => { try { return new URL(ref).hostname.replace(/^www\./, ''); } catch(e) { return ''; } })();
            if (refHost !== socHost) {
                renderMsg(popup, 'Vui lòng truy cập từ ' + socHost + ' để nhận mã.');
                return false;
            }
        }

        let docId;
        try {
            const result = await apiCall('create', {
                data: {
                    hostname,
                    domain:    window.location.origin,
                    plan:      planConfig.plan,
                    max_steps: 1,
                    referrer:  document.referrer || ''
                }
            });
            docId = result.docId;
        } catch(e) {
            renderMsg(popup, 'Không thể tạo phiên. Vui lòng thử lại.');
            return false;
        }

        const step1Time = planConfig.countdown_times[0] + randomExtra();
        await countdownWithScroll(popup, step1Time);

        try {
            const finalData = await apiCall('finalize', {
                docId,
                steps_completed: 1,
                duration_sec:    step1Time
            });
            clearState();
            renderCode(popup, finalData.code);
        } catch(e) {
            renderMsg(popup, 'Lỗi khi lấy mã. Vui lòng thử lại.');
        }
        return true;
    }

    async function runMultiStepFlow(popup, btn, planConfig, hostname, activeType, activeSocialUrl) {
        if (activeType === 'google-search') {
            const ref = document.referrer || '';
            if (!ref.includes('google.com') && !ref.includes('google.com.vn')) {
                renderMsg(popup, 'Vui lòng tìm kiếm qua Google trước khi nhấn nút.');
                return false;
            }
        } else if (activeType === 'social' && activeSocialUrl) {
            const ref     = document.referrer || '';
            const socHost = new URL(activeSocialUrl).hostname.replace(/^www\./, '');
            const refHost = (() => { try { return new URL(ref).hostname.replace(/^www\./, ''); } catch(e) { return ''; } })();
            if (refHost !== socHost) {
                renderMsg(popup, 'Vui lòng truy cập từ ' + socHost + ' để nhận mã.');
                return false;
            }
        }

        const paddedTimes = planConfig.countdown_times.map(t => t + randomExtra());

        let docId;
        try {
            const result = await apiCall('create', {
                data: {
                    hostname,
                    domain:    window.location.origin,
                    plan:      planConfig.plan,
                    max_steps: planConfig.max_steps,
                    referrer:  document.referrer || ''
                }
            });
            docId = result.docId;
        } catch(e) {
            renderMsg(popup, 'Không thể tạo phiên. Vui lòng thử lại.');
            return false;
        }

        await countdownWithScroll(popup, paddedTimes[0]);

        try { await apiCall('update_step', { docId, steps_completed: 1 }); } catch(e) {}

        const state = {
            docId,
            plan:            planConfig.plan,
            max_steps:       planConfig.max_steps,
            countdown_times: paddedTimes,
            steps_completed: 1,
            hostname,
            origin_path:     location.pathname,
            page_visited:    false
        };
        saveState(state);
        renderMsg(popup, 'Bước 1 hoàn thành! Hãy nhấp vào một liên kết bất kỳ trên trang để tiếp tục.');
        return true;
    }

    async function resumeMultiStep(state, popup) {
        if (location.pathname !== state.origin_path || state.page_visited) {
            const stepIndex = state.steps_completed;
            for (let i = stepIndex; i < state.max_steps; i++) {
                await countdownWithScroll(popup, state.countdown_times[i]);
                try { await apiCall('update_step', { docId: state.docId, steps_completed: i + 1 }); } catch(e) {}
            }
            try {
                const finalData = await apiCall('finalize', {
                    docId:           state.docId,
                    steps_completed: state.max_steps,
                    duration_sec:    state.countdown_times.reduce((a, b) => a + b, 0)
                });
                clearState();
                renderCode(popup, finalData.code);
            } catch(e) {
                renderMsg(popup, 'Lỗi khi lấy mã. Vui lòng thử lại.');
            }
        } else {
            renderMsg(popup, 'Hãy nhấp vào một liên kết khác trên trang để tiếp tục.');
            const markVisited = () => {
                const fresh = loadState();
                if (fresh && !fresh.page_visited) saveState({ ...fresh, page_visited: true });
            };
            window.addEventListener('beforeunload', markVisited);
            const interval = setInterval(() => {
                if (location.pathname !== state.origin_path) {
                    clearInterval(interval);
                    window.removeEventListener('beforeunload', markVisited);
                    resumeMultiStep(state, popup);
                }
            }, 500);
        }
    }

    (async function init() {
        const hostname = window.location.hostname;
        let activePlan      = DEFAULT_PLAN;
        let planConfig      = STEP_CONFIG[DEFAULT_PLAN];
        let activeType      = null;
        let activeSocialUrl = null;

        try {
            const cfg = await apiCall('get_config', { hostname });
            if (cfg && cfg.plan && STEP_CONFIG[cfg.plan]) {
                activePlan = cfg.plan;
                planConfig = STEP_CONFIG[cfg.plan];
            }
            activeType      = cfg.type      || null;
            activeSocialUrl = cfg.url_social || null;
        } catch(e) {}

        const popup = createPopup();
        const { btn } = createWidget();
        let busy = false;

        const pending = loadState();
        if (pending && pending.hostname === hostname && pending.steps_completed >= 1 && pending.steps_completed < pending.max_steps) {
            busy = true;
            btn.style.display = 'none';
            showPopup(popup);
            resumeMultiStep(pending, popup);
        } else {
            btn.addEventListener('click', async () => {
                if (busy) return;
                busy = true;
                btn.style.display = 'none';
                showPopup(popup);

                if (planConfig.max_steps === 1) {
                    await runSimpleFlow(popup, btn, { plan: activePlan, countdown_times: planConfig.countdown_times }, hostname, activeType, activeSocialUrl);
                } else {
                    await runMultiStepFlow(popup, btn, { plan: activePlan, max_steps: planConfig.max_steps, countdown_times: planConfig.countdown_times }, hostname, activeType, activeSocialUrl);
                }
                busy = false;
            });
        }
    })();
})();
