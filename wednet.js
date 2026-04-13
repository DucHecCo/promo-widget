(function() {
    'use strict';

    // ═══════════════════════════════════════════════════════════
    // CẤU HÌNH
    // ═══════════════════════════════════════════════════════════
    const API_ENDPOINT = 'https://trafficvn.com/get-code';
    const LOGO_URL     = 'https://trafficvn.com/uploads/logo_1775881215_9a6524dc.png';

    // Cấu hình cuộn: mỗi 10 giây cần cuộn ít nhất 600px
    const SCROLL_CYCLE_MS = 10000;
    const SCROLL_REQUIRED_PX = 600;

    const STEP_CONFIG = {
        '1step_60':  { max_steps: 1, countdown_times: [60] },
        '1step_90':  { max_steps: 1, countdown_times: [90] },
        '1step_120': { max_steps: 1, countdown_times: [120] },
        '2step_75':  { max_steps: 2, countdown_times: [60, 15] },
        '2step_90':  { max_steps: 2, countdown_times: [70, 20] },
        '2step_120': { max_steps: 2, countdown_times: [90, 30] },
        '3step_90':  { max_steps: 3, countdown_times: [60, 15, 15] },
        '3step_120': { max_steps: 3, countdown_times: [90, 15, 15] },
        '3step_150': { max_steps: 3, countdown_times: [120, 15, 15] },
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
        } catch { return null; }
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
            try { document.execCommand('copy'); done(); } catch {}
            document.body.removeChild(ta);
        });
    }

    // ═══════════════════════════════════════════════════════════
    // TẠO GIAO DIỆN (nút logo + popup)
    // ═══════════════════════════════════════════════════════════
    function createUI() {
        // Container chính (để giữ nút)
        let container = document.getElementById('ma_km_2026_vip');
        if (!container) {
            container = document.createElement('div');
            container.id = 'ma_km_2026_vip';
            const footer = document.querySelector('footer');
            if (footer) footer.parentNode.insertBefore(container, footer);
            else document.body.appendChild(container);
        }
        container.style.cssText = 'display:flex;justify-content:center;margin:10px 0;';

        // Nút logo
        const btn = document.createElement('button');
        btn.id = uid('logo_btn');
        btn.style.cssText = `
            background: white;
            border: none;
            border-radius: 16px;
            padding: 6px;
            width: 80px;
            height: 80px;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0,0,0,.15);
            transition: transform 0.2s, box-shadow 0.2s;
            display: inline-flex;
            align-items: center;
            justify-content: center;
        `;
        btn.innerHTML = `<img src="${LOGO_URL}" alt="Xác minh" style="width:100%;height:100%;object-fit:contain;border-radius:12px;" loading="lazy" onerror="this.style.display='none'">`;
        btn.onmouseenter = () => btn.style.transform = 'scale(1.02)';
        btn.onmouseleave = () => btn.style.transform = 'scale(1)';
        container.appendChild(btn);

        // Tạo popup (fixed bottom-right, ẩn ban đầu)
        const popupId = 'tvn_popup_' + Math.random().toString(36).slice(2);
        const popup = document.createElement('div');
        popup.id = popupId;
        popup.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 2147483647;
            width: 320px;
            max-width: calc(100vw - 40px);
            background: white;
            border-radius: 20px;
            box-shadow: 0 8px 30px rgba(0,0,0,.2);
            padding: 16px 18px;
            font-family: 'Segoe UI', Arial, sans-serif;
            font-size: 14px;
            transition: opacity 0.2s ease;
            display: none;
            opacity: 0;
            border: 1px solid #eee;
        `;
        popup.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                <span style="font-weight:700;color:#333;">⏳ Xác minh</span>
                <button id="${popupId}_close" style="background:none;border:none;font-size:18px;cursor:pointer;color:#888;">✕</button>
            </div>
            <div id="${popupId}_content" style="text-align:center;"></div>
        `;
        document.body.appendChild(popup);

        const closeBtn = document.getElementById(popupId + '_close');
        const contentDiv = document.getElementById(popupId + '_content');

        // Hàm hiển thị popup
        function showPopup() {
            popup.style.display = 'block';
            requestAnimationFrame(() => { popup.style.opacity = '1'; });
        }
        function hidePopup() {
            popup.style.opacity = '0';
            setTimeout(() => { popup.style.display = 'none'; }, 200);
        }

        // Hàm cập nhật nội dung popup
        function setContent(html) {
            contentDiv.innerHTML = html;
        }

        return { btn, popup, showPopup, hidePopup, setContent, closeBtn };
    }

    // ═══════════════════════════════════════════════════════════
    // COUNTDOWN VỚI KIỂM TRA CUỘN (cập nhật popup)
    // ═══════════════════════════════════════════════════════════
    async function countdownWithScroll(totalSeconds, stepIndex, onUpdate, onPauseChange) {
        return new Promise((resolve) => {
            let remaining = totalSeconds;
            let active = true;          // true = timer đang chạy
            let cycleStart = Date.now();
            let accumulatedScroll = 0;
            let lastScrollY = window.scrollY;
            let intervalId = null;
            let scrollListener = null;

            function updateUI() {
                const pct = Math.min(100, Math.round((accumulatedScroll / SCROLL_REQUIRED_PX) * 100));
                onUpdate(remaining, pct, !active);
            }

            function onScroll() {
                const now = Date.now();
                const delta = Math.abs(window.scrollY - lastScrollY);
                lastScrollY = window.scrollY;
                accumulatedScroll += delta;

                if (accumulatedScroll >= SCROLL_REQUIRED_PX) {
                    if (!active) {
                        active = true;
                        if (onPauseChange) onPauseChange(false);
                        updateUI();
                    }
                    cycleStart = now;
                    accumulatedScroll = 0;
                }
                updateUI();
            }

            function checkCycle() {
                const now = Date.now();
                if (now - cycleStart >= SCROLL_CYCLE_MS) {
                    if (accumulatedScroll < SCROLL_REQUIRED_PX) {
                        if (active) {
                            active = false;
                            if (onPauseChange) onPauseChange(true);
                            updateUI();
                        }
                    } else {
                        cycleStart = now;
                        accumulatedScroll = 0;
                        if (!active) {
                            active = true;
                            if (onPauseChange) onPauseChange(false);
                            updateUI();
                        }
                    }
                }
                updateUI();
            }

            function timerLoop() {
                if (!active) return;
                remaining--;
                if (remaining <= 0) {
                    if (intervalId) clearInterval(intervalId);
                    if (scrollListener) window.removeEventListener('scroll', scrollListener);
                    resolve();
                } else {
                    updateUI();
                }
            }

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
    // LUỒNG CHÍNH (1 step và multi step)
    // ═══════════════════════════════════════════════════════════
    let currentFlowAbort = null; // để hủy nếu đóng popup

    async function runSimpleFlow(btn, ui, planConfig, hostname, activeType, activeSocialUrl) {
        // Kiểm tra nguồn (Google / Social)
        if (activeType === 'google-search') {
            const ref = document.referrer || '';
            const isGoogle = ref.includes('google.com') || ref.includes('google.com.vn');
            if (!isGoogle) {
                ui.setContent(`
                    <div style="color:#c62828;margin-bottom:12px;">❌ Vui lòng tìm kiếm qua Google trước khi nhấn nút.</div>
                    <button id="tvn_retry_btn" style="background:#e53935;color:white;border:none;border-radius:8px;padding:8px 16px;cursor:pointer;">Thử lại</button>
                `);
                const retryBtn = document.getElementById('tvn_retry_btn');
                if (retryBtn) retryBtn.onclick = () => { ui.hidePopup(); btn.style.display = 'inline-flex'; };
                return false;
            }
        } else if (activeType === 'social' && activeSocialUrl) {
            const ref = document.referrer || '';
            const socialHost = new URL(activeSocialUrl).hostname.replace(/^www\./, '');
            let refHost = '';
            try { refHost = new URL(ref).hostname.replace(/^www\./, ''); } catch(e) {}
            if (refHost !== socialHost) {
                ui.setContent(`
                    <div style="color:#c62828;margin-bottom:12px;">❌ Vui lòng truy cập từ ${socialHost} để nhận mã.</div>
                    <button id="tvn_retry_btn" style="background:#e53935;color:white;border:none;border-radius:8px;padding:8px 16px;cursor:pointer;">Thử lại</button>
                `);
                const retryBtn = document.getElementById('tvn_retry_btn');
                if (retryBtn) retryBtn.onclick = () => { ui.hidePopup(); btn.style.display = 'inline-flex'; };
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
                    max_steps: 1,
                    referrer: document.referrer || ''
                }
            });
            docId = result.docId;
        } catch(e) {
            ui.setContent(`
                <div style="color:#c62828;margin-bottom:12px;">⚠️ Không thể tạo phiên. Vui lòng thử lại.</div>
                <button id="tvn_retry_btn" style="background:#e53935;color:white;border:none;border-radius:8px;padding:8px 16px;cursor:pointer;">Thử lại</button>
            `);
            const retryBtn = document.getElementById('tvn_retry_btn');
            if (retryBtn) retryBtn.onclick = () => { ui.hidePopup(); btn.style.display = 'inline-flex'; };
            return false;
        }

        // Ẩn nút logo
        btn.style.display = 'none';
        ui.showPopup();

        // Hàm cập nhật nội dung đếm ngược
        const updateCountdown = (rem, pct, paused) => {
            let html = `<div style="font-size:28px;font-weight:800;color:#e53935;margin:10px 0;">${rem}s</div>`;
            if (pct >= 0) {
                html += `<div style="background:#e0e0e0;border-radius:4px;height:6px;margin:8px 0;"><div style="width:${pct}%;height:6px;background:#ffa726;border-radius:4px;"></div></div>`;
            }
            if (paused) {
                html += `<div style="font-size:12px;color:#f39c12;margin-top:6px;">🔁 Hãy cuộn trang để tiếp tục đếm ngược</div>`;
            } else {
                html += `<div style="font-size:11px;color:#888;margin-top:6px;">📜 Cuộn trang liên tục (${SCROLL_REQUIRED_PX}px / 10s)</div>`;
            }
            ui.setContent(html);
        };

        let countdownFinished = false;
        const onPauseChange = (paused) => {
            if (!countdownFinished) updateCountdown(remaining, pct, paused);
        };
        let remaining = planConfig.countdown_times[0];
        let pct = 0;
        await countdownWithScroll(planConfig.countdown_times[0], 1, (rem, p, paused) => {
            remaining = rem; pct = p;
            if (!countdownFinished) updateCountdown(rem, p, paused);
        }, onPauseChange);
        countdownFinished = true;

        // Finalize
        try {
            ui.setContent('<div>⌛ Đang xử lý mã...</div>');
            const finalData = await apiCall('finalize', {
                docId,
                steps_completed: 1,
                duration_sec: planConfig.countdown_times[0]
            });
            clearState();
            ui.setContent(`
                <div style="margin:12px 0;font-size:22px;font-weight:800;letter-spacing:2px;color:#2e7d32;background:#e8f5e9;padding:8px;border-radius:12px;">${finalData.code}</div>
                <button id="tvn_copy_btn" style="background:#2e7d32;color:white;border:none;border-radius:8px;padding:6px 12px;cursor:pointer;">📋 Sao chép mã</button>
                <button id="tvn_close_popup_btn" style="background:#aaa;color:white;border:none;border-radius:8px;padding:6px 12px;margin-left:8px;cursor:pointer;">Đóng</button>
            `);
            const copyBtn = document.getElementById('tvn_copy_btn');
            if (copyBtn) copyBtn.onclick = () => copyText(finalData.code, copyBtn);
            const closePopupBtn = document.getElementById('tvn_close_popup_btn');
            if (closePopupBtn) closePopupBtn.onclick = () => ui.hidePopup();
        } catch(e) {
            ui.setContent(`
                <div style="color:#c62828;margin-bottom:12px;">⚠️ Lỗi khi lấy mã: ${e.message}</div>
                <button id="tvn_retry_btn" style="background:#e53935;color:white;border:none;border-radius:8px;padding:8px 16px;cursor:pointer;">Thử lại</button>
            `);
            const retryBtn = document.getElementById('tvn_retry_btn');
            if (retryBtn) retryBtn.onclick = () => { ui.hidePopup(); btn.style.display = 'inline-flex'; };
        }
        return true;
    }

    async function runMultiStepFlow(btn, ui, planConfig, hostname, activeType, activeSocialUrl) {
        // Tương tự kiểm tra nguồn
        if (activeType === 'google-search') {
            const ref = document.referrer || '';
            const isGoogle = ref.includes('google.com') || ref.includes('google.com.vn');
            if (!isGoogle) {
                ui.setContent(`
                    <div style="color:#c62828;margin-bottom:12px;">❌ Vui lòng tìm kiếm qua Google trước khi nhấn nút.</div>
                    <button id="tvn_retry_btn" style="background:#e53935;color:white;border:none;border-radius:8px;padding:8px 16px;cursor:pointer;">Thử lại</button>
                `);
                const retryBtn = document.getElementById('tvn_retry_btn');
                if (retryBtn) retryBtn.onclick = () => { ui.hidePopup(); btn.style.display = 'inline-flex'; };
                return false;
            }
        } else if (activeType === 'social' && activeSocialUrl) {
            const ref = document.referrer || '';
            const socialHost = new URL(activeSocialUrl).hostname.replace(/^www\./, '');
            let refHost = '';
            try { refHost = new URL(ref).hostname.replace(/^www\./, ''); } catch(e) {}
            if (refHost !== socialHost) {
                ui.setContent(`
                    <div style="color:#c62828;margin-bottom:12px;">❌ Vui lòng truy cập từ ${socialHost} để nhận mã.</div>
                    <button id="tvn_retry_btn" style="background:#e53935;color:white;border:none;border-radius:8px;padding:8px 16px;cursor:pointer;">Thử lại</button>
                `);
                const retryBtn = document.getElementById('tvn_retry_btn');
                if (retryBtn) retryBtn.onclick = () => { ui.hidePopup(); btn.style.display = 'inline-flex'; };
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
            ui.setContent(`
                <div style="color:#c62828;margin-bottom:12px;">⚠️ Không thể tạo phiên. Vui lòng thử lại.</div>
                <button id="tvn_retry_btn" style="background:#e53935;color:white;border:none;border-radius:8px;padding:8px 16px;cursor:pointer;">Thử lại</button>
            `);
            const retryBtn = document.getElementById('tvn_retry_btn');
            if (retryBtn) retryBtn.onclick = () => { ui.hidePopup(); btn.style.display = 'inline-flex'; };
            return false;
        }

        btn.style.display = 'none';
        ui.showPopup();

        const stepTimestamps = [Date.now()];
        const updateCountdown = (stepIdx, rem, pct, paused) => {
            let html = `<div style="font-weight:600;margin-bottom:8px;">Bước ${stepIdx+1}/${planConfig.max_steps}</div>`;
            html += `<div style="font-size:28px;font-weight:800;color:#e53935;margin:10px 0;">${rem}s</div>`;
            if (pct >= 0) {
                html += `<div style="background:#e0e0e0;border-radius:4px;height:6px;margin:8px 0;"><div style="width:${pct}%;height:6px;background:#ffa726;border-radius:4px;"></div></div>`;
            }
            if (paused) {
                html += `<div style="font-size:12px;color:#f39c12;margin-top:6px;">🔁 Hãy cuộn trang để tiếp tục</div>`;
            } else {
                html += `<div style="font-size:11px;color:#888;margin-top:6px;">📜 Cuộn trang liên tục (${SCROLL_REQUIRED_PX}px / 10s)</div>`;
            }
            ui.setContent(html);
        };

        // Bước 1
        await countdownWithScroll(planConfig.countdown_times[0], 1,
            (rem, pct, paused) => updateCountdown(0, rem, pct, paused),
            () => {}
        );
        stepTimestamps.push(Date.now());
        await apiCall('update_step', { docId, steps_completed: 1 }).catch(e => console.warn);

        // Lưu trạng thái và chờ chuyển trang
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
        ui.setContent(`
            <div style="color:#1565c0;margin:12px 0;">✅ Bước 1 hoàn thành!</div>
            <div>👉 Hãy nhấp vào một liên kết bất kỳ trên trang để tiếp tục bước 2.</div>
        `);
        // Không tự động resume ở đây, sẽ do init() kiểm tra pending state và gọi resume
        return true;
    }

    async function resumeMultiStep(state, btn, ui) {
        // Nếu đã rời trang hoặc đánh dấu visited
        if (location.pathname !== state.origin_path || state.page_visited) {
            ui.showPopup();
            const updateCountdown = (stepIdx, rem, pct, paused) => {
                let html = `<div style="font-weight:600;margin-bottom:8px;">Bước ${stepIdx+1}/${state.max_steps}</div>`;
                html += `<div style="font-size:28px;font-weight:800;color:#e53935;margin:10px 0;">${rem}s</div>`;
                if (pct >= 0) html += `<div style="background:#e0e0e0;border-radius:4px;height:6px;margin:8px 0;"><div style="width:${pct}%;height:6px;background:#ffa726;"></div></div>`;
                if (paused) html += `<div style="font-size:12px;color:#f39c12;">🔁 Cuộn trang để tiếp tục</div>`;
                else html += `<div style="font-size:11px;color:#888;">📜 Cuộn trang liên tục (${SCROLL_REQUIRED_PX}px / 10s)</div>`;
                ui.setContent(html);
            };
            for (let i = state.steps_completed; i < state.max_steps; i++) {
                await countdownWithScroll(state.countdown_times[i], i+1,
                    (rem, pct, paused) => updateCountdown(i, rem, pct, paused),
                    () => {}
                );
                await apiCall('update_step', { docId: state.docId, steps_completed: i+1 }).catch(e=>console.warn);
            }
            try {
                ui.setContent('<div>⌛ Đang xử lý mã...</div>');
                const finalData = await apiCall('finalize', {
                    docId: state.docId,
                    steps_completed: state.max_steps,
                    duration_sec: state.countdown_times.reduce((a,b)=>a+b,0)
                });
                clearState();
                ui.setContent(`
                    <div style="margin:12px 0;font-size:22px;font-weight:800;letter-spacing:2px;color:#2e7d32;background:#e8f5e9;padding:8px;border-radius:12px;">${finalData.code}</div>
                    <button id="tvn_copy_btn" style="background:#2e7d32;color:white;border:none;border-radius:8px;padding:6px 12px;cursor:pointer;">📋 Sao chép mã</button>
                    <button id="tvn_close_popup_btn" style="background:#aaa;color:white;border:none;border-radius:8px;padding:6px 12px;margin-left:8px;cursor:pointer;">Đóng</button>
                `);
                const copyBtn = document.getElementById('tvn_copy_btn');
                if (copyBtn) copyBtn.onclick = () => copyText(finalData.code, copyBtn);
                const closeBtn = document.getElementById('tvn_close_popup_btn');
                if (closeBtn) closeBtn.onclick = () => ui.hidePopup();
            } catch(e) {
                ui.setContent(`
                    <div style="color:#c62828;margin-bottom:12px;">⚠️ Lỗi lấy mã: ${e.message}</div>
                    <button id="tvn_retry_btn" style="background:#e53935;color:white;border:none;border-radius:8px;padding:8px 16px;cursor:pointer;">Thử lại</button>
                `);
                const retryBtn = document.getElementById('tvn_retry_btn');
                if (retryBtn) retryBtn.onclick = () => { ui.hidePopup(); btn.style.display = 'inline-flex'; clearState(); };
            }
        } else {
            // Chưa rời trang, hiện thông báo và đợi
            ui.setContent(`
                <div style="color:#1565c0;margin:12px 0;">🔁 Hãy nhấp vào một liên kết khác trên trang để tiếp tục.</div>
            `);
            const markVisited = () => {
                const fresh = loadState();
                if (fresh && !fresh.page_visited) {
                    saveState({ ...fresh, page_visited: true });
                }
            };
            window.addEventListener('beforeunload', markVisited);
            const interval = setInterval(() => {
                if (location.pathname !== state.origin_path) {
                    clearInterval(interval);
                    window.removeEventListener('beforeunload', markVisited);
                    resumeMultiStep(state, btn, ui);
                }
            }, 500);
        }
    }

    // ═══════════════════════════════════════════════════════════
    // KHỞI TẠO
    // ═══════════════════════════════════════════════════════════
    (async function init() {
        const hostname = window.location.hostname;
        let activePlan = DEFAULT_PLAN;
        let planConfig = STEP_CONFIG[DEFAULT_PLAN];
        let activeType = null;
        let activeSocialUrl = null;

        try {
            const cfg = await apiCall('get_config', { hostname });
            if (cfg && cfg.plan && STEP_CONFIG[cfg.plan]) {
                activePlan = cfg.plan;
                planConfig = STEP_CONFIG[cfg.plan];
            }
            activeType = cfg.type || null;
            activeSocialUrl = cfg.url_social || null;
        } catch(e) { console.warn(e); }

        const { btn, popup, showPopup, hidePopup, setContent, closeBtn } = createUI();
        const ui = { showPopup, hidePopup, setContent, closeBtn };

        // Xử lý đóng popup: hủy mọi tiến trình đang chạy? Đơn giản là ẩn popup, không hủy timer (có thể gây rò rỉ) nhưng tạm chấp nhận
        closeBtn.onclick = () => { hidePopup(); };

        let busy = false;
        const pending = loadState();
        if (pending && pending.hostname === hostname && pending.steps_completed >= 1 && pending.steps_completed < pending.max_steps) {
            busy = true;
            btn.style.display = 'none';
            await resumeMultiStep(pending, btn, ui);
        } else {
            btn.onclick = async () => {
                if (busy) return;
                busy = true;
                if (planConfig.max_steps === 1) {
                    await runSimpleFlow(btn, ui, { plan: activePlan, countdown_times: planConfig.countdown_times }, hostname, activeType, activeSocialUrl);
                } else {
                    await runMultiStepFlow(btn, ui, { plan: activePlan, max_steps: planConfig.max_steps, countdown_times: planConfig.countdown_times }, hostname, activeType, activeSocialUrl);
                }
                busy = false;
            };
        }
    })();
})();
