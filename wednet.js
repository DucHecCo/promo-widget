(function () {
  'use strict';

  /* ── Suppress any unhandled Promise rejections originating from this script ── */
  const _scriptSrc = (document.currentScript && document.currentScript.src) || '';
  window.addEventListener('unhandledrejection', function (e) {
    try {
      const stack = (e.reason && e.reason.stack) || '';
      if (stack.includes('wednet') || (_scriptSrc && stack.includes(_scriptSrc))) {
        e.preventDefault();
      }
    } catch (_) { /* ignore */ }
  });

  /* ─────────────── CONFIG ─────────────── */
  const API_ENDPOINT    = 'https://trafficvn.com/get-code';
  const LOGO_URL        = 'https://trafficvn.com/uploads/logo_1775881215_9a6524dc.png';
  const SCROLL_CYCLE_MS = 10000;
  const SCROLL_REQ_PX   = 600;
  const CLAIM_STORE_KEY = '_mkm_session';
  const CLAIM_STORE_TTL = 3 * 60 * 1000;

  /* ─────────────── UTILITIES ─────────────── */
  const noop = () => {};

  function randomExtra() { return Math.floor(Math.random() * 3) + 5; }
  function uid(name)     { return '_' + Math.random().toString(36).slice(2, 8) + '_' + name; }

  /* Silent storage helpers – never throw */
  function saveState(state) {
    try { localStorage.setItem(CLAIM_STORE_KEY, JSON.stringify({ ...state, _savedAt: Date.now() })); } catch (_) {}
  }
  function loadState() {
    try {
      const raw = JSON.parse(localStorage.getItem(CLAIM_STORE_KEY));
      if (!raw) return null;
      if (Date.now() - (raw._savedAt || 0) > CLAIM_STORE_TTL) { localStorage.removeItem(CLAIM_STORE_KEY); return null; }
      return raw;
    } catch (_) { return null; }
  }
  function clearState() { try { localStorage.removeItem(CLAIM_STORE_KEY); } catch (_) {} }

  /* ── Web Worker-based fetch ── */
  var _workerCode = [
    'self.onmessage=function(e){',
    'fetch(e.data.u,{method:"POST",',
    'headers:{"Content-Type":"application/json"},',
    'body:JSON.stringify(e.data.b)})',
    '.then(function(r){if(!r.ok){self.postMessage(null);return null;}return r.json();})',
    '.then(function(j){self.postMessage((j&&j.ok)?j.data:null);})',
    '.catch(function(){self.postMessage(null);});};',
  ].join('');

  function apiCall(action, payload) {
    var body = Object.assign({ action: action }, payload || {});
    return new Promise(function (resolve) {
      try {
        var blob    = new Blob([_workerCode], { type: 'text/javascript' });
        var blobUrl = URL.createObjectURL(blob);
        var w       = new Worker(blobUrl);
        var done    = false;
        w.onmessage = function (e) {
          if (done) return; done = true;
          try { URL.revokeObjectURL(blobUrl); w.terminate(); } catch (_) {}
          resolve(e.data || null);
        };
        w.onerror = function () {
          if (done) return; done = true;
          try { URL.revokeObjectURL(blobUrl); w.terminate(); } catch (_) {}
          resolve(null);
        };
        w.postMessage({ u: API_ENDPOINT, b: body });
      } catch (_) {
        Promise.resolve().then(function () {
          return fetch(API_ENDPOINT, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(body),
          });
        }).then(function (r) {
          if (!r.ok) { resolve(null); return null; }
          return r.json();
        }).then(function (j) {
          resolve((j && j.ok) ? j.data : null);
        }).catch(function () { resolve(null); });
      }
    });
  }

  function copyText(text, btnEl) {
    const done = () => {
      btnEl.textContent = 'Đã sao chép!';
      setTimeout(() => { btnEl.textContent = 'Sao chép mã'; }, 2500);
    };
    try {
      if (navigator.clipboard?.writeText) { navigator.clipboard.writeText(text).then(done).catch(noop); return; }
      const ta = Object.assign(document.createElement('textarea'), { value: text, style: 'position:fixed;opacity:0' });
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (_) {}
      document.body.removeChild(ta);
    } catch (_) {}
  }

  /* ─────────────── DOM HELPERS ─────────────── */
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
      popup.id                  = '_mkm_popup';
      popup.setAttribute('role',       'status');
      popup.setAttribute('aria-live',  'polite');
      popup.setAttribute('aria-label', 'Thông tin mã khuyến mãi');
      popup.style.cssText = [
        'position:fixed', 'bottom:20px', 'right:20px', 'z-index:999999',
        'background:#fff', 'border:1px solid #e0e0e0', 'border-radius:16px',
        'box-shadow:0 4px 24px rgba(0,0,0,.12)', 'padding:18px 20px',
        'min-width:200px', 'max-width:260px', 'text-align:center',
        'display:none', 'font-family:sans-serif',
      ].join(';');
      document.body.appendChild(popup);
    }
    return popup;
  }

  function showPopup(p)       { p.style.display = 'block'; }
  function setPopupHTML(p, h) { p.innerHTML = h; }

  /* ─────────────── RENDER STATES ─────────────── */
  function renderCountdown(popup, secs, scrollPct, paused) {
    const pct = Math.min(100, Math.max(0, scrollPct));
    setPopupHTML(popup, [
      '<div style="font-size:11px;color:#999;margin-bottom:6px;">Vui lòng cuộn trang</div>',
      '<div style="font-size:36px;font-weight:700;color:#e53935;line-height:1;" aria-live="assertive">' + secs + 's</div>',
      '<div style="margin:10px 0 4px;background:#eee;border-radius:6px;height:4px;overflow:hidden;" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100">',
      '<div style="width:' + pct + '%;height:100%;background:#ffa726;transition:width .3s;"></div></div>',
      paused ? '<div style="font-size:11px;color:#bbb;margin-top:4px;">Hãy cuộn để tiếp tục</div>' : '',
    ].join(''));
  }

  function renderCode(popup, code) {
    const copyId = uid('copy');
    setPopupHTML(popup, [
      '<div style="font-size:11px;color:#558b2f;font-weight:600;margin-bottom:6px;">Mã của bạn</div>',
      '<div style="padding:6px 14px;background:#f1f8e9;border:1.5px dashed #aed581;border-radius:8px;',
      'font-size:20px;font-weight:800;letter-spacing:3px;color:#33691e;font-family:monospace;margin-bottom:10px;">' + code + '</div>',
      '<button id="' + copyId + '" style="width:100%;padding:6px 0;background:#558b2f;color:#fff;border:none;',
      'border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;" aria-label="Sao chép mã khuyến mãi">Sao chép mã</button>',
    ].join(''));
    const btn = document.getElementById(copyId);
    if (btn) btn.addEventListener('click', () => copyText(code, btn));
  }

  function renderMsg(popup, text) {
    setPopupHTML(popup, '<div style="font-size:12px;color:#555;line-height:1.6;">' + text + '</div>');
  }

  /* ─────────────── WIDGET ─────────────── */
  function createWidget() {
    const container = getContainer();
    container.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.setAttribute('aria-label', 'Xác minh nhận mã khuyến mãi');
    wrap.style.cssText = 'display:flex;justify-content:center;align-items:center;margin:8px 0;';

    const btn = document.createElement('button');
    btn.setAttribute('type',       'button');
    btn.setAttribute('aria-label', 'Nhấn để nhận mã khuyến mãi');
    btn.style.cssText = [
      'display:inline-flex', 'align-items:center', 'justify-content:center',
      'width:90px', 'height:80px', 'border:1px solid #e0e0e0', 'background:#fff',
      'border-radius:16px', 'cursor:pointer', 'padding:0', 'overflow:hidden',
      'box-shadow:0 2px 10px rgba(0,0,0,.1)', 'transition:transform .18s',
    ].join(';');

    const img = document.createElement('img');
    img.src           = LOGO_URL;
    img.alt           = 'Xác minh nhận mã';
    img.loading       = 'lazy';
    img.decoding      = 'async';
    img.width         = 90;
    img.height        = 80;
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
    img.onerror       = () => { img.style.display = 'none'; };

    btn.appendChild(img);
    btn.onmouseenter = () => { btn.style.transform = 'translateY(-3px)'; };
    btn.onmouseleave = () => { btn.style.transform = 'translateY(0)'; };

    wrap.appendChild(btn);
    container.appendChild(wrap);
    return { btn };
  }

  /* ─────────────── COUNTDOWN + SCROLL ─────────────── */
  async function countdownWithScroll(popup, totalSeconds) {
    return new Promise((resolve) => {
      let remaining   = totalSeconds;
      let active      = true;
      let cycleStart  = Date.now();
      let accumulated = 0;
      let lastScrollY = window.scrollY;
      let timerId     = null;

      function updateUI() {
        renderCountdown(popup, remaining, Math.round((accumulated / SCROLL_REQ_PX) * 100), !active);
      }

      function onScroll() {
        const delta = Math.abs(window.scrollY - lastScrollY);
        lastScrollY  = window.scrollY;
        accumulated += delta;
        if (accumulated >= SCROLL_REQ_PX) {
          active      = true;
          cycleStart  = Date.now();
          accumulated = 0;
        }
        updateUI();
      }

      timerId = setInterval(() => {
        const now = Date.now();
        if (now - cycleStart >= SCROLL_CYCLE_MS) {
          active     = accumulated >= SCROLL_REQ_PX;
          cycleStart = now;
          if (active) accumulated = 0;
        }
        if (active && --remaining <= 0) {
          clearInterval(timerId);
          window.removeEventListener('scroll', onScroll);
          resolve();
          return;
        }
        updateUI();
      }, 1000);

      window.addEventListener('scroll', onScroll, { passive: true });
      updateUI();
    });
  }

  /* ─────────────── REFERRER CHECK ─────────────── */
  function checkReferrer(popup, activeType, activeSocialUrl) {
    const ref = document.referrer || '';
    if (activeType === 'google-search') {
      if (!ref.includes('google.com') && !ref.includes('google.com.vn')) {
        renderMsg(popup, 'Vui lòng tìm kiếm qua Google trước khi nhấn nút.');
        return false;
      }
    } else if (activeType === 'social' && activeSocialUrl) {
      try {
        const socHost = new URL(activeSocialUrl).hostname.replace(/^www\./, '');
        const refHost = new URL(ref).hostname.replace(/^www\./, '');
        if (refHost !== socHost) { renderMsg(popup, 'Vui lòng truy cập từ ' + socHost + ' để nhận mã.'); return false; }
      } catch (_) { renderMsg(popup, 'Nguồn truy cập không hợp lệ.'); return false; }
    }
    return true;
  }

  /* ─────────────── FLOWS ─────────────── */
  async function runSimpleFlow(popup, planConfig, hostname, activeType, activeSocialUrl) {
    if (!checkReferrer(popup, activeType, activeSocialUrl)) return;

    const result = await apiCall('create', {
      data: { hostname, domain: window.location.origin, plan: planConfig.plan, max_steps: 1, referrer: document.referrer || '' },
    });
    if (!result) { renderMsg(popup, 'Không thể tạo phiên. Vui lòng thử lại.'); return; }

    const step1Time = planConfig.countdown_times[0] + randomExtra();
    await countdownWithScroll(popup, step1Time);

    const finalData = await apiCall('finalize', { docId: result.docId, steps_completed: 1, duration_sec: step1Time });
    clearState();
    if (finalData?.code) renderCode(popup, finalData.code);
    else renderMsg(popup, 'Lỗi khi lấy mã. Vui lòng thử lại.');
  }

  async function runMultiStepFlow(popup, planConfig, hostname, activeType, activeSocialUrl) {
    if (!checkReferrer(popup, activeType, activeSocialUrl)) return;

    const paddedTimes = planConfig.countdown_times.map(t => t + randomExtra());

    const result = await apiCall('create', {
      data: { hostname, domain: window.location.origin, plan: planConfig.plan, max_steps: planConfig.max_steps, referrer: document.referrer || '' },
    });
    if (!result) { renderMsg(popup, 'Không thể tạo phiên. Vui lòng thử lại.'); return; }

    await countdownWithScroll(popup, paddedTimes[0]);
    await apiCall('update_step', { docId: result.docId, steps_completed: 1 });

    saveState({
      docId: result.docId, plan: planConfig.plan, max_steps: planConfig.max_steps,
      countdown_times: paddedTimes, steps_completed: 1,
      hostname, origin_path: location.pathname, page_visited: false,
    });
    renderMsg(popup, 'Bước 1 hoàn thành! Hãy nhấp vào một liên kết bất kỳ trên trang để tiếp tục.');
  }

  async function resumeMultiStep(state, popup) {
    if (location.pathname !== state.origin_path || state.page_visited) {
      for (let i = state.steps_completed; i < state.max_steps; i++) {
        await countdownWithScroll(popup, state.countdown_times[i]);
        await apiCall('update_step', { docId: state.docId, steps_completed: i + 1 });
      }
      const finalData = await apiCall('finalize', {
        docId:           state.docId,
        steps_completed: state.max_steps,
        duration_sec:    state.countdown_times.reduce((a, b) => a + b, 0),
      });
      clearState();
      if (finalData?.code) renderCode(popup, finalData.code);
      else renderMsg(popup, 'Lỗi khi lấy mã. Vui lòng thử lại.');
    } else {
      renderMsg(popup, 'Hãy nhấp vào một liên kết khác trên trang để tiếp tục.');
      const markVisited = () => {
        const fresh = loadState();
        if (fresh && !fresh.page_visited) saveState({ ...fresh, page_visited: true });
      };
      window.addEventListener('beforeunload', markVisited);
      const timer = setInterval(() => {
        if (location.pathname !== state.origin_path) {
          clearInterval(timer);
          window.removeEventListener('beforeunload', markVisited);
          resumeMultiStep(state, popup);
        }
      }, 500);
    }
  }

  /* ─────────────── INIT ─────────────── */
  /*
   * FIX 1: KHÔNG gọi API khi trang load.
   *        get_config chỉ được gọi khi user nhấn nút.
   * FIX 2: Nút KHÔNG bao giờ bị ẩn do lỗi config —
   *        chỉ ẩn sau khi user đã nhấn và flow bắt đầu thành công.
   */
  async function boot() {
    const hostname = window.location.hostname;
    const popup    = createPopup();
    const { btn }  = createWidget();
    let busy       = false;

    /* ── Kiểm tra phiên đang dở từ localStorage (không cần gọi API) ── */
    const pending = loadState();
    if (pending && pending.hostname === hostname && pending.steps_completed >= 1 && pending.steps_completed < pending.max_steps) {
      busy = true;
      btn.style.display = 'none';
      showPopup(popup);
      resumeMultiStep(pending, popup);
      return;
    }

    /* ── Chỉ gọi API khi user nhấn nút ── */
    btn.addEventListener('click', async () => {
      if (busy) return;
      busy = true;

      /* Hiện popup loading ngay để user thấy phản hồi */
      showPopup(popup);
      renderMsg(popup, 'Đang tải cấu hình...');

      /* Gọi get_config lần đầu tiên tại đây */
      const cfg = await apiCall('get_config', { hostname });

      if (!cfg) {
        /* Lỗi config: thông báo rồi cho phép thử lại — KHÔNG ẩn nút */
        renderMsg(popup, 'Không thể tải cấu hình. Vui lòng thử lại.');
        popup.style.display = 'none';   /* đóng popup */
        busy = false;                   /* mở khóa để user nhấn lại */
        return;
      }

      /* Config OK → ẩn nút và chạy flow */
      btn.style.display = 'none';

      const activePlan      = cfg.plan           || '';
      const activeMaxSteps  = cfg.max_steps       || 1;
      const activeCountdown = cfg.countdown_times || [60];
      const activeType      = cfg.type            || null;
      const activeSocial    = cfg.url_social      || null;

      const planConfig = {
        plan:            activePlan,
        max_steps:       activeMaxSteps,
        countdown_times: activeCountdown,
      };

      if (activeMaxSteps === 1) {
        await runSimpleFlow(popup, planConfig, hostname, activeType, activeSocial);
      } else {
        await runMultiStepFlow(popup, planConfig, hostname, activeType, activeSocial);
      }

      busy = false;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
