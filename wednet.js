(function () {
  'use strict';

  const _scriptSrc = (document.currentScript && document.currentScript.src) || '';
  window.addEventListener('unhandledrejection', function (e) {
    try {
      const stack = (e.reason && e.reason.stack) || '';
      if (stack.includes('wednet') || (_scriptSrc && stack.includes(_scriptSrc))) {
        e.preventDefault();
      }
    } catch (_) {}
  });

  const API_ENDPOINT    = 'https://trafficvn.com/get-code';
  const LOGO_URL        = 'https://trafficvn.com/uploads/logo_1775881215_9a6524dc.png';
  const SCROLL_CYCLE_MS = 10000;
  const SCROLL_REQ_PX   = 600;
  const CLAIM_STORE_KEY = '_mkm_session';
  const CLAIM_STORE_TTL = 3 * 60 * 1000;

  const noop = () => {};

  function randomExtra() { return Math.floor(Math.random() * 3) + 5; }
  function uid(name)     { return '_' + Math.random().toString(36).slice(2, 8) + '_' + name; }

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

  // ─── Shadow DOM helpers ──────────────────────────────────────────────────────

  /** Tạo hoặc lấy host element + shadow root để cô lập hoàn toàn khỏi CSS trang */
  function getOrCreateShadowHost(id) {
    let host = document.getElementById(id);
    if (!host) {
      host = document.createElement('div');
      host.id = id;
      // Reset toàn bộ style kế thừa từ trang ngoài
      host.setAttribute('style', [
        'all:initial',
        'display:block',
        'width:100%',
        'box-sizing:border-box',
      ].join('!important;') + '!important');
      const footer = document.querySelector('footer');
      if (footer) footer.parentNode.insertBefore(host, footer);
      else document.body.appendChild(host);
    }
    if (!host._shadow) {
      host._shadow = host.attachShadow({ mode: 'open' });
      // Inject base CSS vào shadow root — hoàn toàn độc lập với trang ngoài
      const style = document.createElement('style');
      style.textContent = `
        *, *::before, *::after {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        :host {
          all: initial;
          display: block;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .wrap {
          display: flex;
          justify-content: center;
          align-items: center;
          margin: 8px 0;
        }
        .btn {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          width: 90px !important;
          height: 80px !important;
          border: 1px solid #e0e0e0 !important;
          background: #fff !important;
          border-radius: 16px !important;
          cursor: pointer !important;
          padding: 0 !important;
          overflow: hidden !important;
          box-shadow: 0 2px 10px rgba(0,0,0,.1) !important;
          transition: transform .18s !important;
          outline: none !important;
          -webkit-appearance: none !important;
          appearance: none !important;
        }
        .btn:hover { transform: translateY(-3px) !important; }
        .btn:active { transform: translateY(0) !important; }
        .btn img {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          display: block !important;
          pointer-events: none !important;
        }
      `;
      host._shadow.appendChild(style);
    }
    return host._shadow;
  }

  /** Tạo popup cố định góc phải — cũng dùng Shadow DOM riêng */
  function createPopup() {
    let host = document.getElementById('_mkm_popup_host');
    if (!host) {
      host = document.createElement('div');
      host.id = '_mkm_popup_host';
      host.setAttribute('style', [
        'all:initial',
        'position:fixed',
        'bottom:20px',
        'right:20px',
        'z-index:2147483647',
        'display:none',
      ].join('!important;') + '!important');
      document.body.appendChild(host);
    }
    if (!host._shadow) {
      host._shadow = host.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = `
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :host { all: initial; display: block; }
        .popup {
          background: #fff;
          border: 1px solid #e0e0e0;
          border-radius: 16px;
          box-shadow: 0 4px 24px rgba(0,0,0,.12);
          padding: 18px 20px;
          min-width: 200px;
          max-width: 260px;
          text-align: center;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 14px;
          color: #333;
          line-height: 1.5;
        }
        .countdown-label {
          font-size: 11px;
          color: #999;
          margin-bottom: 6px;
        }
        .countdown-num {
          font-size: 36px;
          font-weight: 700;
          color: #e53935;
          line-height: 1;
        }
        .progress-bar-wrap {
          margin: 10px 0 4px;
          background: #eee;
          border-radius: 6px;
          height: 4px;
          overflow: hidden;
        }
        .progress-bar-fill {
          height: 100%;
          background: #ffa726;
          transition: width .3s;
        }
        .paused-label {
          font-size: 11px;
          color: #bbb;
          margin-top: 4px;
        }
        .code-label {
          font-size: 11px;
          color: #558b2f;
          font-weight: 600;
          margin-bottom: 6px;
        }
        .code-box {
          padding: 6px 14px;
          background: #f1f8e9;
          border: 1.5px dashed #aed581;
          border-radius: 8px;
          font-size: 20px;
          font-weight: 800;
          letter-spacing: 3px;
          color: #33691e;
          font-family: monospace, monospace;
          margin-bottom: 10px;
          word-break: break-all;
        }
        .copy-btn {
          width: 100%;
          padding: 6px 0;
          background: #558b2f;
          color: #fff;
          border: none;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          -webkit-appearance: none;
          appearance: none;
          outline: none;
        }
        .copy-btn:hover { background: #4a7a28; }
        .msg-text {
          font-size: 12px;
          color: #555;
          line-height: 1.6;
        }
        .error-text {
          font-size: 13px;
          color: #c62828;
          margin-bottom: 10px;
        }
        .retry-btn {
          width: 100%;
          padding: 6px 0;
          background: #e53935;
          color: #fff;
          border: none;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          -webkit-appearance: none;
          appearance: none;
          outline: none;
        }
        .retry-btn:hover { background: #c62828; }
      `;
      host._shadow.appendChild(style);
      const popupEl = document.createElement('div');
      popupEl.className = 'popup';
      popupEl.setAttribute('role', 'status');
      popupEl.setAttribute('aria-live', 'polite');
      popupEl.setAttribute('aria-label', 'Thông tin mã khuyến mãi');
      host._shadow.appendChild(popupEl);
    }
    return host;
  }

  function showPopup(host) { host.style.setProperty('display', 'block', 'important'); }
  function hidePopup(host) { host.style.setProperty('display', 'none', 'important'); }

  function getPopupEl(host) {
    return host._shadow.querySelector('.popup');
  }

  function copyText(text, btnEl) {
    const done = () => {
      btnEl.textContent = 'Đã sao chép!';
      setTimeout(() => { btnEl.textContent = 'Sao chép mã'; }, 2500);
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(noop);
        return;
      }
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0;';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try { document.execCommand('copy'); done(); } catch (_) {}
      document.body.removeChild(ta);
    } catch (_) {}
  }

  // ─── Render helpers (viết thẳng vào shadow DOM) ─────────────────────────────

  function renderCountdown(popupHost, secs, scrollPct, paused) {
    const p = getPopupEl(popupHost);
    const pct = Math.min(100, Math.max(0, scrollPct));
    p.innerHTML = `
      <div class="countdown-label">Vui lòng cuộn trang</div>
      <div class="countdown-num" aria-live="assertive">${secs}s</div>
      <div class="progress-bar-wrap" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
        <div class="progress-bar-fill" style="width:${pct}%"></div>
      </div>
      ${paused ? '<div class="paused-label">Hãy cuộn để tiếp tục</div>' : ''}
    `;
  }

  function renderCode(popupHost, code) {
    const p = getPopupEl(popupHost);
    p.innerHTML = `
      <div class="code-label">Mã của bạn</div>
      <div class="code-box">${code}</div>
      <button class="copy-btn" aria-label="Sao chép mã khuyến mãi">Sao chép mã</button>
    `;
    const btn = p.querySelector('.copy-btn');
    if (btn) btn.addEventListener('click', () => copyText(code, btn));
  }

  function renderMsg(popupHost, text) {
    const p = getPopupEl(popupHost);
    p.innerHTML = `<div class="msg-text">${text}</div>`;
  }

  function renderError(popupHost, text, onRetry) {
    const p = getPopupEl(popupHost);
    p.innerHTML = `
      <div class="error-text">⚠️ ${text}</div>
      <button class="retry-btn">Thử lại</button>
    `;
    const btn = p.querySelector('.retry-btn');
    if (btn) btn.addEventListener('click', onRetry);
  }

  // ─── Widget button (trong shadow DOM) ────────────────────────────────────────

  function createWidget() {
    const shadow = getOrCreateShadowHost('ma_km_2026_vip');

    // Xoá nội dung cũ (nếu có) nhưng giữ lại <style>
    Array.from(shadow.children).forEach(el => {
      if (el.tagName !== 'STYLE') el.remove();
    });

    const wrap = document.createElement('div');
    wrap.className = 'wrap';
    wrap.setAttribute('aria-label', 'Xác minh nhận mã khuyến mãi');

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn';
    btn.setAttribute('aria-label', 'Nhấn để nhận mã khuyến mãi');

    const img = document.createElement('img');
    img.src     = LOGO_URL;
    img.alt     = 'Xác minh nhận mã';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.width   = 90;
    img.height  = 80;
    img.onerror = () => { img.style.display = 'none'; };

    btn.appendChild(img);
    wrap.appendChild(btn);
    shadow.appendChild(wrap);

    return { btn };
  }

  // ─── Countdown + scroll ───────────────────────────────────────────────────────

  async function countdownWithScroll(popupHost, totalSeconds) {
    return new Promise((resolve) => {
      let remaining   = totalSeconds;
      let active      = true;
      let cycleStart  = Date.now();
      let accumulated = 0;
      let lastScrollY = window.scrollY;
      let timerId     = null;

      function updateUI() {
        renderCountdown(popupHost, remaining, Math.round((accumulated / SCROLL_REQ_PX) * 100), !active);
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

  // ─── Referrer check ──────────────────────────────────────────────────────────

  function checkReferrer(popupHost, activeType, activeSocialUrl) {
    const ref = document.referrer || '';
    if (activeType === 'google-search') {
      if (!ref.includes('google.com') && !ref.includes('google.com.vn')) {
        renderMsg(popupHost, 'Vui lòng tìm kiếm qua Google trước khi nhấn nút.');
        return false;
      }
    } else if (activeType === 'social' && activeSocialUrl) {
      try {
        const socHost = new URL(activeSocialUrl).hostname.replace(/^www\./, '');
        const refHost = new URL(ref).hostname.replace(/^www\./, '');
        if (refHost !== socHost) {
          renderMsg(popupHost, 'Vui lòng truy cập từ ' + socHost + ' để nhận mã.');
          return false;
        }
      } catch (_) {
        renderMsg(popupHost, 'Nguồn truy cập không hợp lệ.');
        return false;
      }
    }
    return true;
  }

  // ─── Flow logic ───────────────────────────────────────────────────────────────

  async function runSimpleFlow(popupHost, planConfig, hostname, activeType, activeSocialUrl) {
    if (!checkReferrer(popupHost, activeType, activeSocialUrl)) return;

    const result = await apiCall('create', {
      data: { hostname, domain: window.location.origin, plan: planConfig.plan, max_steps: 1, referrer: document.referrer || '' },
    });
    if (!result) { renderMsg(popupHost, 'Không thể tạo phiên. Vui lòng thử lại.'); return; }

    const step1Time = planConfig.countdown_times[0] + randomExtra();
    await countdownWithScroll(popupHost, step1Time);

    const finalData = await apiCall('finalize', { docId: result.docId, steps_completed: 1, duration_sec: step1Time });
    clearState();
    if (finalData && finalData.code) renderCode(popupHost, finalData.code);
    else renderMsg(popupHost, 'Lỗi khi lấy mã. Vui lòng thử lại.');
  }

  async function runMultiStepFlow(popupHost, planConfig, hostname, activeType, activeSocialUrl) {
    if (!checkReferrer(popupHost, activeType, activeSocialUrl)) return;

    const paddedTimes = planConfig.countdown_times.map(t => t + randomExtra());

    const result = await apiCall('create', {
      data: { hostname, domain: window.location.origin, plan: planConfig.plan, max_steps: planConfig.max_steps, referrer: document.referrer || '' },
    });
    if (!result) { renderMsg(popupHost, 'Không thể tạo phiên. Vui lòng thử lại.'); return; }

    await countdownWithScroll(popupHost, paddedTimes[0]);
    await apiCall('update_step', { docId: result.docId, steps_completed: 1 });

    saveState({
      docId: result.docId, plan: planConfig.plan, max_steps: planConfig.max_steps,
      countdown_times: paddedTimes, steps_completed: 1,
      hostname, origin_path: location.pathname, page_visited: false,
    });
    renderMsg(popupHost, 'Bước 1 hoàn thành! Hãy nhấp vào một liên kết bất kỳ trên trang để tiếp tục.');
  }

  async function resumeMultiStep(state, popupHost) {
    if (location.pathname !== state.origin_path || state.page_visited) {
      for (let i = state.steps_completed; i < state.max_steps; i++) {
        await countdownWithScroll(popupHost, state.countdown_times[i]);
        await apiCall('update_step', { docId: state.docId, steps_completed: i + 1 });
      }
      const finalData = await apiCall('finalize', {
        docId:           state.docId,
        steps_completed: state.max_steps,
        duration_sec:    state.countdown_times.reduce((a, b) => a + b, 0),
      });
      clearState();
      if (finalData && finalData.code) renderCode(popupHost, finalData.code);
      else renderMsg(popupHost, 'Lỗi khi lấy mã. Vui lòng thử lại.');
    } else {
      renderMsg(popupHost, 'Hãy nhấp vào một liên kết khác trên trang để tiếp tục.');
      const markVisited = () => {
        const fresh = loadState();
        if (fresh && !fresh.page_visited) saveState({ ...fresh, page_visited: true });
      };
      window.addEventListener('beforeunload', markVisited);
      const timer = setInterval(() => {
        if (location.pathname !== state.origin_path) {
          clearInterval(timer);
          window.removeEventListener('beforeunload', markVisited);
          resumeMultiStep(state, popupHost);
        }
      }, 500);
    }
  }

  // ─── Boot ─────────────────────────────────────────────────────────────────────

  async function boot() {
    const hostname  = window.location.hostname;
    const popupHost = createPopup();
    const { btn }   = createWidget();
    let busy        = false;

    const pending = loadState();
    if (pending && pending.hostname === hostname && pending.steps_completed >= 1 && pending.steps_completed < pending.max_steps) {
      busy = true;
      // Ẩn button trong shadow DOM
      const shadow = document.getElementById('ma_km_2026_vip')._shadow;
      const btnEl  = shadow.querySelector('.btn');
      if (btnEl) btnEl.style.display = 'none';
      showPopup(popupHost);
      resumeMultiStep(pending, popupHost);
      return;
    }

    async function handleClick() {
      if (busy) return;
      busy = true;

      showPopup(popupHost);
      renderMsg(popupHost, 'Đang tải cấu hình...');

      const cfg = await apiCall('get_config', { hostname });

      if (!cfg) {
        renderError(popupHost, 'Không thể tải cấu hình. Kiểm tra kết nối và thử lại.', () => {
          hidePopup(popupHost);
          busy = false;
        });
        return;
      }

      // Ẩn button trong shadow DOM
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
        await runSimpleFlow(popupHost, planConfig, hostname, activeType, activeSocial);
      } else {
        await runMultiStepFlow(popupHost, planConfig, hostname, activeType, activeSocial);
      }

      busy = false;
    }

    btn.addEventListener('click', handleClick);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
