(function() {
    'use strict';

    // ═══════════════════════════════════════════════════════════
    // CẤU HÌNH
    // ═══════════════════════════════════════════════════════════
    const API_ENDPOINT = 'https://trafficvn.com/get-code';
    const LOGO_URL     = 'https://trafficvn.com/uploads/logo_1775881215_9a6524dc.png';

    // Cấu hình cuộn: mỗi 10 giây cần cuộn ít nhất 600px
    const SCROLL_CYCLE_MS = 10000;   // 10 giây
    const SCROLL_REQUIRED_PX = 600;  // pixel cần cuộn trong mỗi chu kỳ

    // Các step config mặc định (backend sẽ ghi đè theo campaign)
    const STEP_CONFIG = {
        '1step_60':  { max_steps: 1, countdown_times: [60]      },
        '1step_90':  { max_steps: 1, countdown_times: [90]      },
        '1step_120': { max_steps: 1, countdown_times: [120]     },
        '2step_75':  { max_steps: 2, countdown_times: [60,  15] },
        '2step_90':  { max_steps: 2, countdown_times: [70,  20] },
        '2step_120': { max_steps: 2, countdown_times: [90,  30] },
        '3step_90':  { max_steps: 3, countdown_times: [60, 15, 15] },
        '3step_120': { max_steps: 3, countdown_times: [90, 15, 15] },
        '3step_150': { max_steps: 3, countdown_times: [120,15, 15] },
    };
    const DEFAULT_PLAN = '1step_60';
    const CLAIM_STORE_KEY = '_mkm_session';
    const CLAIM_STORE_TTL = 3 * 60 * 1000;

    // ═══════════════════════════════════════════════════════════
    // HÀM TIỆN ÍCH
    // ═══════════════════════════════════════════════════════════
    function uid(name) {
        return '_' + Math.random().toString(36).slice(2, 8) + '_' + name;
    }

    function saveState(state) {
        localStorage.setItem(CLAIM_STORE_KEY, JSON.stringify({
            ...state,
            _savedAt: Date.now()
        }));
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
    function clearState() {
        localStorage.removeItem(CLAIM_STORE_KEY);
    }

    async function apiCall(action, payload = {}) {
        const res = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, ...payload })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!json.ok) throw new Error(json.error || 'API error');
        return json.data;
    }

    function copyText(text, btnEl) {
        const done = () => {
            btnEl.classList.add('copied');
            btnEl.textContent = 'Đã sao chép!';
            setTimeout(() => {
                btnEl.classList.remove('copied');
                btnEl.textContent = 'Sao chép mã';
            }, 2500);
        };
        navigator.clipboard?.writeText(text).then(done).catch(() => {
            const ta = Object.assign(document.createElement('textarea'), {
                value: text,
                style: 'position:fixed;opacity:0'
            });
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); done(); } catch(e) {}
            document.body.removeChild(ta);
        });
    }

    // ═══════════════════════════════════════════════════════════
    // TẠO GIAO DIỆN (chỉ logo, không text)
    // ═══════════════════════════════════════════════════════════
    function getContainer() {
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

    function createWidget() {
        const container = getContainer();
        container.innerHTML = '';

        const wrapId = uid('wrap');
        const btnId  = uid('btn');
        const panelId = uid('panel');

        const wrap = document.createElement('div');
        wrap.id = wrapId;
        wrap.style.cssText = 'display:flex;justify-content:center;align-items:center;margin:8px 0;';

        // Nút chỉ hiển thị ảnh logo, không có text
        const btn = document.createElement('button');
        btn.id = btnId;
        btn.style.cssText = `
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 90px;
            height: 80px;
            border: none;
            background: transparent;
            border-radius: 16px;
            cursor: pointer;
            padding: 0;
            overflow: hidden;
            box-shadow: 0 4px 18px rgba(0,0,0,.14), 0 1px 4px rgba(0,0,0,.08);
            transition: box-shadow .2s, transform .18s;
        `;
        btn.innerHTML = `<img src="${LOGO_URL}" alt="Xác minh" style="width:100%;height:100%;object-fit:cover;display:block;" loading="lazy" onerror="this.style.display='none'">`;
        btn.onmouseenter = () => btn.style.transform = 'translateY(-3px)';
        btn.onmouseleave = () => btn.style.transform = 'translateY(0)';

        const panel = document.createElement('div');
        panel.id = panelId;
        panel.style.cssText = 'margin-top:10px;text-align:center;';

        wrap.appendChild(btn);
        wrap.appendChild(panel);
        container.appendChild(wrap);

        return { btn, panel, wrap };
    }

    // ═══════════════════════════════════════════════════════════
    // HIỂN THỊ CÁC TRẠNG THÁI
    // ═══════════════════════════════════════════════════════════
    function showCodeUI(panel, code) {
        const copyId = uid('copy');
        panel.innerHTML = `
            <div style="display:inline-flex;flex-direction:column;align-items:center;gap:6px;padding:10px 16px;border-radius:10px;background:#fafafa;border:1px solid #eee;max-width:260px;">
                <div style="font-size:10px;font-weight:600;color:#558b2f;">Mã của bạn</div>
                <div style="padding:5px 12px;background:#f1f8e9;border:1.5px dashed #aed581;border-radius:6px;font-size:18px;font-weight:800;letter-spacing:3px;color:#33691e;font-family:'Courier New',monospace;">${code}</div>
                <button id="${copyId}" style="display:inline-flex;width:100%;padding:5px 10px;background:#558b2f;color:#fff;border:none;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;">Sao chép mã</button>
            </div>
        `;
        const copyBtn = document.getElementById(copyId);
        if (copyBtn) copyBtn.addEventListener('click', () => copyText(code, copyBtn));
    }

    function showMsg(panel, text, isError = false) {
        panel.innerHTML = `
            <div style="display:inline-flex;flex-direction:column;align-items:center;gap:4px;padding:8px 12px;border-radius:8px;background:#fff5f5;border:1px solid #ffcdd2;">
                <div style="font-size:11px;font-weight:600;color:${isError ? '#c62828' : '#1565c0'};">${text}</div>
            </div>
        `;
    }

    function showCountdownUI(panel, secondsRemaining, requiredScrollPct = -1, paused = false) {
        const pct = requiredScrollPct >= 0 ? Math.min(100, requiredScrollPct) : 0;
        panel.innerHTML = `
            <div style="display:inline-flex;flex-direction:column;align-items:center;gap:4px;padding:8px 12px;border-radius:12px;background:#fff;border:1px solid #e0e0e0;min-width:130px;">
                <div style="font-size:20px;font-weight:800;color:#e53935;">${secondsRemaining}s</div>
                ${requiredScrollPct >= 0 ? `
                    <div style="width:100%;height:3px;background:#e0e0e0;border-radius:3px;overflow:hidden;">
                        <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,#ffcc80,#ffa726);transition:width .3s;"></div>
                    </div>
                ` : ''}
                ${paused ? '<div style="font-size:9px;color:#9e9e9e;">⚠️ Hãy cuộn trang để tiếp tục</div>' : ''}
                ${requiredScrollPct < 0 ? '<div style="font-size:9px;color:#888;">Vui lòng cuộn trang liên tục</div>' : ''}
            </div>
        `;
    }

    // ═══════════════════════════════════════════════════════════
    // COUNTDOWN VỚI KIỂM TRA CUỘN MỖI 10 GIÂY
    // ═══════════════════════════════════════════════════════════
    async function countdownWithScroll(panel, totalSeconds, stepIndex) {
        return new Promise(async (resolve) => {
            let remaining = totalSeconds;
            let active = true;          // true = timer đang chạy, false = tạm dừng do không cuộn
            let cycleStart = Date.now();
            let accumulatedScroll = 0;
            let lastScrollY = window.scrollY;
            let lastRemaining = remaining;
            let intervalId = null;
            let scrollListener = null;

            // Hàm cập nhật giao diện
            function updateUI() {
                const pct = Math.min(100, Math.round((accumulatedScroll / SCROLL_REQUIRED_PX) * 100));
                showCountdownUI(panel, remaining, pct, !active);
            }

            // Kiểm tra scroll
            function onScroll() {
                const now = Date.now();
                const delta = Math.abs(window.scrollY - lastScrollY);
                lastScrollY = window.scrollY;
                accumulatedScroll += delta;

                // Nếu đã đủ scroll trong chu kỳ hiện tại
                if (accumulatedScroll >= SCROLL_REQUIRED_PX) {
                    if (!active) {
                        // Nếu đang tạm dừng do thiếu scroll, cho chạy lại
                        active = true;
                        updateUI();
                    }
                    // Reset chu kỳ mới
                    cycleStart = now;
                    accumulatedScroll = 0;
                }
                updateUI();
            }

            // Kiểm tra chu kỳ mỗi 0.5 giây
            function checkCycle() {
                const now = Date.now();
                if (now - cycleStart >= SCROLL_CYCLE_MS) {
                    // Hết 10s mà chưa đủ scroll => tạm dừng đếm ngược
                    if (accumulatedScroll < SCROLL_REQUIRED_PX) {
                        if (active) {
                            active = false;
                            updateUI();
                        }
                    } else {
                        // Đủ scroll, reset chu kỳ
                        cycleStart = now;
                        accumulatedScroll = 0;
                        if (!active) {
                            active = true;
                            updateUI();
                        }
                    }
                }
                updateUI();
            }

            // Bộ đếm thời gian chính
            function timerLoop() {
                if (!active) return;
                remaining--;
                if (remaining <= 0) {
                    // Kết thúc
                    if (intervalId) clearInterval(intervalId);
                    if (scrollListener) window.removeEventListener('scroll', scrollListener);
                    resolve();
                } else {
                    updateUI();
                }
            }

            // Khởi tạo
            window.addEventListener('scroll', onScroll);
            scrollListener = onScroll;
            intervalId = setInterval(() => {
                checkCycle();
                timerLoop();
            }, 1000);
            updateUI();
        });
    }

    // ═══════════════════════════════════════════════════════════
    // LUỒNG CHÍNH
    // ═══════════════════════════════════════════════════════════
    async function runSimpleFlow(panel, btn, planConfig, hostname, activeType, activeSocialUrl) {
        // Kiểm tra nguồn truy cập nếu cần (giữ nguyên logic cũ)
        if (activeType === 'google-search') {
            const ref = document.referrer || '';
            const isGoogle = ref.includes('google.com') || ref.includes('google.com.vn');
            if (!isGoogle) {
                showMsg(panel, 'Vui lòng tìm kiếm qua Google trước khi nhấn nút.', true);
                return false;
            }
        } else if (activeType === 'social' && activeSocialUrl) {
            const ref = document.referrer || '';
            const socialHost = new URL(activeSocialUrl).hostname.replace(/^www\./, '');
            const refHost = (() => { try { return new URL(ref).hostname.replace(/^www\./, ''); } catch(e) { return ''; } })();
            if (refHost !== socialHost) {
                showMsg(panel, `Vui lòng truy cập từ ${socialHost} để nhận mã.`, true);
                return false;
            }
        }

        // Tạo phiên
        let docId;
        try {
            const result = await apiCall('create', {
                data: {
                    hostname,
                    domain: window.location.origin,
                    plan: planConfig.plan,
                    max_steps: 1,
                    referrer: document.referrer || ''
                }
            });
            docId = result.docId;
        } catch(e) {
            showMsg(panel, 'Không thể tạo phiên. Vui lòng thử lại.', true);
            return false;
        }

        // Ẩn nút, bắt đầu đếm ngược có cuộn
        btn.style.display = 'none';
        await countdownWithScroll(panel, planConfig.countdown_times[0], 1);

        // Finalize
        try {
            const finalData = await apiCall('finalize', {
                docId,
                steps_completed: 1,
                duration_sec: planConfig.countdown_times[0]
            });
            clearState();
            showCodeUI(panel, finalData.code);
        } catch(e) {
            showMsg(panel, 'Lỗi khi lấy mã: ' + e.message, true);
        }
        return true;
    }

    async function runMultiStepFlow(panel, btn, planConfig, hostname, activeType, activeSocialUrl) {
        // Tương tự như trên nhưng có update_step
        if (activeType === 'google-search') {
            const ref = document.referrer || '';
            const isGoogle = ref.includes('google.com') || ref.includes('google.com.vn');
            if (!isGoogle) {
                showMsg(panel, 'Vui lòng tìm kiếm qua Google trước khi nhấn nút.', true);
                return false;
            }
        } else if (activeType === 'social' && activeSocialUrl) {
            const ref = document.referrer || '';
            const socialHost = new URL(activeSocialUrl).hostname.replace(/^www\./, '');
            const refHost = (() => { try { return new URL(ref).hostname.replace(/^www\./, ''); } catch(e) { return ''; } })();
            if (refHost !== socialHost) {
                showMsg(panel, `Vui lòng truy cập từ ${socialHost} để nhận mã.`, true);
                return false;
            }
        }

        let docId;
        try {
            const result = await apiCall('create', {
                data: {
                    hostname,
                    domain: window.location.origin,
                    plan: planConfig.plan,
                    max_steps: planConfig.max_steps,
                    referrer: document.referrer || ''
                }
            });
            docId = result.docId;
        } catch(e) {
            showMsg(panel, 'Không thể tạo phiên. Vui lòng thử lại.', true);
            return false;
        }

        btn.style.display = 'none';
        const stepTimestamps = [Date.now()];

        // Bước 1
        await countdownWithScroll(panel, planConfig.countdown_times[0], 1);
        stepTimestamps.push(Date.now());
        try {
            await apiCall('update_step', { docId, steps_completed: 1 });
        } catch(e) { /* ignore */ }

        // Lưu trạng thái và chờ user chuyển trang
        const state = {
            docId,
            plan: planConfig.plan,
            max_steps: planConfig.max_steps,
            countdown_times: planConfig.countdown_times,
            step_starts: stepTimestamps,
            steps_completed: 1,
            hostname,
            origin_path: location.pathname,
            page_visited: false
        };
        saveState(state);
        showMsg(panel, '✅ Bước 1 hoàn thành! Hãy nhấp vào một liên kết bất kỳ trên trang để tiếp tục bước 2.', false);
        // Lắng nghe chuyển trang (thực tế sẽ reload, widget sẽ resume)
        return true;
    }

    async function resumeMultiStep(state, panel, btn) {
        // Nếu đã sang trang khác, cho phép chạy tiếp bước 2
        if (location.pathname !== state.origin_path || state.page_visited) {
            // Bước 2 trở đi
            const stepIndex = state.steps_completed; // đã hoàn thành step 1
            for (let i = stepIndex; i < state.max_steps; i++) {
                await countdownWithScroll(panel, state.countdown_times[i], i+1);
                try {
                    await apiCall('update_step', { docId: state.docId, steps_completed: i+1 });
                } catch(e) {}
            }
            // Finalize
            try {
                const finalData = await apiCall('finalize', {
                    docId: state.docId,
                    steps_completed: state.max_steps,
                    duration_sec: state.countdown_times.reduce((a,b) => a+b, 0)
                });
                clearState();
                showCodeUI(panel, finalData.code);
            } catch(e) {
                showMsg(panel, 'Lỗi khi lấy mã: ' + e.message, true);
            }
        } else {
            // Chưa rời trang, hiện thông báo và đợi
            showMsg(panel, '🔁 Hãy nhấp vào một liên kết khác trên trang để tiếp tục.', false);
            // Đăng ký sự kiện beforeunload để đánh dấu đã rời trang
            const markVisited = () => {
                const fresh = loadState();
                if (fresh && !fresh.page_visited) {
                    saveState({ ...fresh, page_visited: true });
                }
            };
            window.addEventListener('beforeunload', markVisited);
            // Polling kiểm tra nếu pathname thay đổi
            const interval = setInterval(() => {
                if (location.pathname !== state.origin_path) {
                    clearInterval(interval);
                    window.removeEventListener('beforeunload', markVisited);
                    resumeMultiStep(state, panel, btn);
                }
            }, 500);
        }
    }

    // ═══════════════════════════════════════════════════════════
    // KHỞI TẠO WIDGET
    // ═══════════════════════════════════════════════════════════
    (async function init() {
        const hostname = window.location.hostname;
        let activePlan = DEFAULT_PLAN;
        let planConfig = STEP_CONFIG[DEFAULT_PLAN];
        let activeType = null;
        let activeSocialUrl = null;

        // Lấy cấu hình từ backend
        try {
            const cfg = await apiCall('get_config', { hostname });
            if (cfg && cfg.plan && STEP_CONFIG[cfg.plan]) {
                activePlan = cfg.plan;
                planConfig = STEP_CONFIG[cfg.plan];
            }
            activeType = cfg.type || null;
            activeSocialUrl = cfg.url_social || null;
        } catch(e) {
            console.warn('Không lấy được config, dùng mặc định');
        }

        const { btn, panel, wrap } = createWidget();
        let busy = false;

        // Kiểm tra session đang dang dở
        const pending = loadState();
        if (pending && pending.hostname === hostname && pending.steps_completed >= 1 && pending.steps_completed < pending.max_steps) {
            busy = true;
            btn.style.display = 'none';
            resumeMultiStep(pending, panel, btn);
        } else {
            btn.addEventListener('click', async () => {
                if (busy) return;
                busy = true;

                if (planConfig.max_steps === 1) {
                    await runSimpleFlow(panel, btn, { plan: activePlan, countdown_times: planConfig.countdown_times }, hostname, activeType, activeSocialUrl);
                } else {
                    await runMultiStepFlow(panel, btn, { plan: activePlan, max_steps: planConfig.max_steps, countdown_times: planConfig.countdown_times }, hostname, activeType, activeSocialUrl);
                }
                busy = false;
            });
        }
    })();
})();
