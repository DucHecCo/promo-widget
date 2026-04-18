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

  const API_ENDPOINT = 'https://trafficvn.com/get-code';
  const LOGO_URL = 'https://trafficvn.com/uploads/logo_1775881215_9a6524dc.png';
  const SCROLL_CYCLE_MS = 10000;
  const SCROLL_REQ_PX = 600;
  const CLAIM_STORE_KEY = '_mkm_session';
  const CLAIM_STORE_TTL = 3 * 60 * 1000;

  const FALLBACK_PLAN = {
    plan: '1step_60',
    max_steps: 1,
    countdown_times: [60],
    type: null,
    url_social: null,
  };

  const noop = () => {};
  function randomExtra() { return Math.floor(Math.random() * 3) + 5; }

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
        var blob = new Blob([_workerCode], { type: 'text/javascript' });
        var blobUrl = URL.createObjectURL(blob);
        var w = new Worker(blobUrl);
        var done = false;
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
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
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

  function getOrCreateShadowHost(id) {
    let host = document.getElementById(id);
    if (!host) {
      host = document.createElement('div');
      host.id = id;
      host.setAttribute('style', 'all:initial;display:block;width:100%;box-sizing:border-box!important');
      const footer = document.querySelector('footer');
      if (footer) footer.parentNode.insertBefore(host, footer);
      else document.body.appendChild(host);
    }
    if (!host._shadow) {
      host._shadow = host.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = `
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :host { all: initial; display: block; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .wrap { display: flex; justify-content: center; align-items: center; margin: 8px 0; }
        .btn {
          display: inline-flex !important; align-items: center !important; justify-content: center !important;
          width: 90px !important; height: 80px !important;
          border: 1px solid #e0e0e0 !important; background: #fff !important;
          border-radius: 16px !important; cursor: pointer !important; padding: 0 !important;
          overflow: hidden !important; box-shadow: 0 2px 10px rgba(0,0,0,.1) !important;
          transition: transform .18s !important;
        }
        .btn:hover { transform: translateY(-3px) !important; }
        .btn img { width: 100% !important; height: 100% !important; object-fit: cover !important; }
      `;
      host._shadow.appendChild(style);
    }
    return host._shadow;
  }

  function createPopup() {
    let host = document.getElementById('_mkm_popup_host');
    if (!host) {
      host = document.createElement('div');
      host.id = '_mkm_popup_host';
      host.setAttribute('style', 'all:initial;position:fixed;bottom:20px;right:20px;z-index:2147483647;display:none!important');
      document.body.appendChild(host);
    }
    if (!host._shadow) {
      host._shadow = host.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = `
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :host { all: initial; display: block; }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }

        .popup {
          background: #fff;
          border: 1px solid #e8e8e8;
          border-radius: 22px;
          box-shadow: 0 4px 6px rgba(0,0,0,.04), 0 20px 50px rgba(0,0,0,.12);
          padding: 26px 24px 22px;
          min-width: 270px;
          max-width: 300px;
          text-align: center;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          animation: slideUp .35s cubic-bezier(0.34,1.56,0.64,1) both;
        }

        /* Square Countdown - Sửa lỗi viền trắng lúc bắt đầu */
        .cd-label {
          font-size: 10.5px;
          font-weight: 700;
          letter-spacing: .12em;
          text-transform: uppercase;
          color: #aaa;
          margin-bottom: 14px;
        }

        .square-wrap {
          position: relative;
          width: 82px;
          height: 82px;
          margin: 0 auto 16px;
        }

        .square-progress {
          position: absolute;
          inset: 0;
          border: 4px solid #10b981;           /* ← Luôn xanh lá từ đầu */
          border-radius: 18px;
          background: conic-gradient(#10b981 0% 0%, #e5e7eb 0% 100%);
          transition: background 0.45s linear, border-color 0.4s;
          box-shadow: 0 3px 10px rgba(0,0,0,0.08);
        }

        .square-progress.warn {
          border-color: #f59e0b;
          background: conic-gradient(#f59e0b 0% 0%, #e5e7eb 0% 100%);
        }

        .square-progress.urgent {
          border-color: #ef4444;
          background: conic-gradient(#ef4444 0% 0%, #e5e7eb 0% 100%);
        }

        .square-inner {
          position: absolute;
          inset: 4px;
          background: #ffffff;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: inset 0 2px 6px rgba(0,0,0,0.06),
                      0 2px 8px rgba(0,0,0,0.08);
          z-index: 2;
        }

        .ring-num {
          font-size: 33px;
          font-weight: 900;
          color: #1a1a1a;
          letter-spacing: -0.03em;
          line-height: 1;
        }

        .ring-num.warn { color: #d97706; }
        .ring-num.urgent { color: #dc2626; }

        .scroll-hint {
          font-size: 12px;
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 12px;
          line-height: 1.5;
        }
        .scroll-hint.paused {
          color: #f59e0b;
          animation: blink 1.5s ease-in-out infinite;
        }

        .prog-track {
          height: 4px;
          background: #f3f3f3;
          border-radius: 99px;
          overflow: hidden;
        }
        .prog-fill {
          height: 100%;
          background: #10b981;
          border-radius: 99px;
          transition: width .4s ease, background .4s;
        }
        .prog-fill.warn { background: #f59e0b; }
        .prog-fill.urgent { background: #ef4444; }

        .code-label {
          font-size: 10.5px;
          font-weight: 700;
          letter-spacing: .1em;
          text-transform: uppercase;
          color: #bbb;
          margin-bottom: 12px;
        }
        .code-box {
          padding: 14px 18px;
          background: #f8f8f8;
          border: 1.5px dashed #ddd;
          border-radius: 16px;
          font-size: 26px;
          font-weight: 900;
          letter-spacing: 6px;
          color: #111;
          font-family: 'SF Mono', monospace;
          margin-bottom: 16px;
        }

        .copy-btn {
          width: 100%;
          padding: 13px 0;
          background: #10b981;
          color: #fff;
          border: none;
          border-radius: 14px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: all .2s;
          box-shadow: 0 3px 8px rgba(16, 185, 129, 0.3);
        }
        .copy-btn:hover { background: #059669; transform: translateY(-1px); }
        .copy-btn:active { transform: scale(0.97); }
        .copy-btn.done { background: #16a34a; }

        .msg-box, .err-box {
          font-size: 13px;
          line-height: 1.65;
          text-align: left;
          padding: 14px 16px;
          border-radius: 16px;
        }
        .msg-box { background: #fafafa; border: 1px solid #eee; color: #555; }
        .msg-box strong { color: #111; font-weight: 800; }
        .err-box { background: #fff5f5; border: 1px solid #fecaca; color: #dc2626; }
      `;

      host._shadow.appendChild(style);

      const popupEl = document.createElement('div');
      popupEl.className = 'popup';
      host._shadow.appendChild(popupEl);
    }
    return host;
  }

  function showPopup(host) { 
    host.style.setProperty('display', 'block', 'important'); 
  }

  function getPopupEl(host) { 
    return host._shadow.querySelector('.popup'); 
  }

  function copyText(text, btnEl) {
    const done = () => {
      btnEl.classList.add('done');
      btnEl.textContent = 'Đã sao chép!';
      setTimeout(() => { 
        btnEl.classList.remove('done'); 
        btnEl.textContent = 'Sao chép mã'; 
      }, 2500);
    };
    try {
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(done);
      else {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.cssText = 'position:fixed;opacity:0;';
        document.body.appendChild(ta); ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        done();
      }
    } catch (_) {}
  }

  function renderCountdown(popupHost, secs, totalSecs, scrollPct, paused) {
    const p = getPopupEl(popupHost);
    const ratio = Math.max(0, Math.min(1, secs / totalSecs));
    const percent = (ratio * 100).toFixed(1) + '%';
    
    const cls = secs <= 10 ? 'urgent' : secs <= 30 ? 'warn' : '';
    const pct = Math.min(100, Math.max(0, scrollPct));
    
    const mainColor = cls === 'urgent' ? '#ef4444' : cls === 'warn' ? '#f59e0b' : '#10b981';

    p.innerHTML = `
      <div class="cd-label">ĐANG XÁC MINH</div>
      <div class="square-wrap">
        <div class="square-progress ${cls}" style="background: conic-gradient(${mainColor} 0% ${percent}, #e5e7eb ${percent} 100%);"></div>
        <div class="square-inner">
          <span class="ring-num ${cls}">${secs}</span>
        </div>
      </div>
      <div class="scroll-hint ${paused ? 'paused' : ''}">
        ${paused ? 'Cuộn trang để tiếp tục đếm' : 'Vui lòng cuộn trang để tiếp tục'}
      </div>
      <div class="prog-track">
        <div class="prog-fill ${cls}" style="width:${pct}%"></div>
      </div>
    `;
  }

  function renderCode(popupHost, code) {
    const p = getPopupEl(popupHost);
    p.innerHTML = `
      <div class="code-label">MÃ XÁC NHẬN CỦA BẠN</div>
      <div class="code-box">${code}</div>
      <button class="copy-btn">Sao chép mã</button>
    `;
    const btn = p.querySelector('.copy-btn');
    if (btn) btn.addEventListener('click', () => copyText(code, btn));
  }

  function renderMsg(popupHost, text) {
    const p = getPopupEl(popupHost);
    const fmt = text.replace(/(Bước\s+\d+)/g, '<strong>$1</strong>')
                     .replace(/(hoàn thành!)/g, '<strong>$1</strong>')
                     .replace(/(nhấp vào nút)/g, '<strong>$1</strong>');
    p.innerHTML = `<div class="msg-box">${fmt}</div>`;
  }

  function renderError(popupHost, text) {
    const p = getPopupEl(popupHost);
    p.innerHTML = `<div class="err-box">${text}</div>`;
  }

  function createWidget() {
    const shadow = getOrCreateShadowHost('ma_km_2026_vip');
    Array.from(shadow.children).forEach(el => { if (el.tagName !== 'STYLE') el.remove(); });
    const wrap = document.createElement('div');
    wrap.className = 'wrap';
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'btn';
    btn.setAttribute('aria-label', 'Nhấn để nhận mã');
    const img = document.createElement('img');
    img.src = LOGO_URL; img.alt = ''; img.loading = 'lazy';
    btn.appendChild(img); wrap.appendChild(btn); shadow.appendChild(wrap);
    return { btn, shadow };
  }

  async function countdownWithScroll(popupHost, totalSeconds) {
    return new Promise((resolve) => {
      let remaining = totalSeconds;
      let active = true;
      let cycleStart = Date.now();
      let accumulated = 0;
      let lastScrollY = window.scrollY;
      let timerId = null;

      function updateUI() {
        const pct = Math.round((accumulated / SCROLL_REQ_PX) * 100);
        renderCountdown(popupHost, remaining, totalSeconds, pct, !active);
      }

      function onScroll() {
        const delta = Math.abs(window.scrollY - lastScrollY);
        lastScrollY = window.scrollY;
        accumulated += delta;
        if (accumulated >= SCROLL_REQ_PX) {
          active = true;
          cycleStart = Date.now();
          accumulated = 0;
        }
        updateUI();
      }

      timerId = setInterval(() => {
        const now = Date.now();
        if (now - cycleStart >= SCROLL_CYCLE_MS) {
          active = accumulated >= SCROLL_REQ_PX;
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

  function showBtnAgain(shadow, btn, delayMs = 0) {
    if (delayMs > 0) setTimeout(() => { btn.style.display = ''; }, delayMs);
    else btn.style.display = '';
  }

  async function runSimpleFlow(popupHost, cfg, hostname, shadow, btn) {
    const step1Time = cfg.countdown_times[0] + randomExtra();
    const createPromise = apiCall('create', {
      data: { hostname, domain: window.location.origin, plan: cfg.plan, max_steps: 1, referrer: document.referrer || '' }
    });

    await countdownWithScroll(popupHost, step1Time);
    if (!checkReferrer(popupHost, cfg.type, cfg.url_social)) {
      showBtnAgain(shadow, btn);
      return;
    }

    const result = await createPromise;
    const finalData = result ? await apiCall('finalize', { docId: result.docId, steps_completed: 1, duration_sec: step1Time }) : null;

    clearState();
    if (finalData && finalData.code) renderCode(popupHost, finalData.code);
    else renderError(popupHost, 'Không lấy được mã. Vui lòng thử lại.');

    showBtnAgain(shadow, btn);
  }

  async function runMultiStepFlow(popupHost, cfg, hostname, shadow, btn) {
    const paddedTimes = cfg.countdown_times.map(t => t + randomExtra());
    const createPromise = apiCall('create', {
      data: { hostname, domain: window.location.origin, plan: cfg.plan, max_steps: cfg.max_steps, referrer: document.referrer || '' }
    });

    await countdownWithScroll(popupHost, paddedTimes[0]);
    if (!checkReferrer(popupHost, cfg.type, cfg.url_social)) {
      showBtnAgain(shadow, btn);
      return;
    }

    const result = await createPromise;
    if (!result) {
      renderError(popupHost, 'Không thể tạo phiên. Vui lòng thử lại.');
      showBtnAgain(shadow, btn);
      return;
    }

    await apiCall('update_step', { docId: result.docId, steps_completed: 1 });
    saveState({ docId: result.docId, plan: cfg.plan, max_steps: cfg.max_steps, countdown_times: paddedTimes, steps_completed: 1, hostname });

    renderMsg(popupHost, 'Bước 1 hoàn thành! Hãy nhấp vào nút ở trang khác để tiếp tục Bước 2.');
    showBtnAgain(shadow, btn, 1500);
  }

  async function resumeFromStep(state, popupHost, shadow, btn) {
    if (!state) {
      renderError(popupHost, 'Phiên đã hết hạn. Vui lòng thử lại.');
      showBtnAgain(shadow, btn);
      return;
    }

    for (let i = state.steps_completed; i < state.max_steps; i++) {
      await countdownWithScroll(popupHost, state.countdown_times[i]);
      if (i < state.max_steps - 1) {
        await apiCall('update_step', { docId: state.docId, steps_completed: i + 1 });
        renderMsg(popupHost, `Bước ${i+1} hoàn thành! Hãy nhấp vào nút ở trang khác để tiếp tục Bước ${i+2}.`);
        showBtnAgain(shadow, btn, 1500);
        return;
      }
    }

    const totalDuration = state.countdown_times.reduce((a, b) => a + b, 0);
    const finalData = await apiCall('finalize', {
      docId: state.docId,
      steps_completed: state.max_steps,
      duration_sec: totalDuration,
    });

    clearState();
    if (finalData && finalData.code) renderCode(popupHost, finalData.code);
    else renderError(popupHost, 'Lỗi khi lấy mã. Vui lòng thử lại.');

    showBtnAgain(shadow, btn);
  }

  async function boot() {
    const hostname = window.location.hostname;
    const popupHost = createPopup();
    const { btn, shadow } = createWidget();
    let busy = false;

    async function handleClick() {
      if (busy) return;
      busy = true;
      btn.style.display = 'none';
      showPopup(popupHost);

      const pending = loadState();
      if (pending && pending.hostname === hostname && pending.steps_completed >= 1 && pending.steps_completed < pending.max_steps) {
        await resumeFromStep(pending, popupHost, shadow, btn);
        busy = false;
        return;
      }

      let cfg = null;
      try { cfg = await apiCall('get_config', { hostname }); } catch (_) { cfg = null; }

      const activeCfg = (cfg && cfg.plan) ? {
        plan: cfg.plan,
        max_steps: cfg.max_steps || 1,
        countdown_times: cfg.countdown_times || [60],
        type: cfg.type || null,
        url_social: cfg.url_social || null,
      } : { ...FALLBACK_PLAN };

      if (activeCfg.max_steps === 1) {
        await runSimpleFlow(popupHost, activeCfg, hostname, shadow, btn);
      } else {
        await runMultiStepFlow(popupHost, activeCfg, hostname, shadow, btn);
      }
      busy = false;
    }

    btn.addEventListener('click', handleClick);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
