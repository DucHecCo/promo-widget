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

  const WIDGET_HOST_ID = 'ma_km_2026_vip';
  const SENTINEL_ID    = '_mkm_sentinel';

  const FALLBACK_PLAN = {
    plan: '1step_60',
    max_steps: 1,
    countdown_times: [60],
    type: null,
    url_social: null,
  };

  const noop = () => {};
  function randomExtra() { return Math.floor(Math.random() * 3) + 5; }

  // ─── LocalStorage helpers ────────────────────────────────────────────────────
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

  // ─── API via Worker ──────────────────────────────────────────────────────────
  var _workerCode = [
    'self.onmessage=function(e){',
    'fetch(e.data.u,{method:"POST",',
    'headers:{"Content-Type":"application/json"},',
    'body:JSON.stringify(e.data.b)})',
    '.then(function(r){if(!r.ok){self.postMessage({ok:false,error:"HTTP "+r.status});return null;}return r.json();})',
    '.then(function(j){if(j===null)return;self.postMessage(j&&j.ok?{ok:true,data:j.data}:{ok:false,error:(j&&j.error)||"Lỗi không xác định"});})',
    '.catch(function(err){self.postMessage({ok:false,error:"Lỗi kết nối: "+(err&&err.message||"unknown")});});};',
  ].join('');

  function apiCall(action, payload) {
    var body = Object.assign({ action: action }, payload || {});
    return new Promise(function (resolve) {
      try {
        var blob   = new Blob([_workerCode], { type: 'text/javascript' });
        var blobUrl = URL.createObjectURL(blob);
        var w      = new Worker(blobUrl);
        var done   = false;
        w.onmessage = function (e) {
          if (done) return; done = true;
          try { URL.revokeObjectURL(blobUrl); w.terminate(); } catch (_) {}
          resolve(e.data || { ok: false, error: 'Không nhận được phản hồi từ máy chủ.' });
        };
        w.onerror = function () {
          if (done) return; done = true;
          try { URL.revokeObjectURL(blobUrl); w.terminate(); } catch (_) {}
          resolve({ ok: false, error: 'Web Worker gặp lỗi. Vui lòng thử lại.' });
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
          if (!r.ok) { resolve({ ok: false, error: 'Lỗi máy chủ HTTP ' + r.status + '.' }); return null; }
          return r.json();
        }).then(function (j) {
          if (j === null) return;
          resolve(j && j.ok ? { ok: true, data: j.data } : { ok: false, error: (j && j.error) || 'Lỗi không xác định.' });
        }).catch(function (err) {
          resolve({ ok: false, error: 'Lỗi kết nối: ' + ((err && err.message) || 'unknown') });
        });
      }
    });
  }

  // ─── Shadow host cho widget nút ─────────────────────────────────────────────
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
          position: relative;
        }
        .btn:hover { transform: translateY(-3px) !important; }
        .btn::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
          background-size: 200% 100%;
          animation: shimmer 1.4s infinite;
          border-radius: 16px;
          z-index: 0;
        }
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .btn img {
          width: 100% !important; height: 100% !important; object-fit: cover !important;
          position: relative; z-index: 1;
          opacity: 0;
          transition: opacity .3s ease;
        }
        .btn img.loaded { opacity: 1; }
        .btn img.loaded + *,
        .btn:has(img.loaded)::before { animation: none; background: transparent; }
      `;
      host._shadow.appendChild(style);
    }
    return host._shadow;
  }

  // ─── Popup ───────────────────────────────────────────────────────────────────
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
          from { opacity: 0; transform: translateY(16px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.45; }
        }

        .popup {
          background: #fff;
          border: 1px solid #e8e8e8;
          border-radius: 16px;
          box-shadow: 0 4px 6px rgba(0,0,0,.04), 0 16px 40px rgba(0,0,0,.12);
          padding: 18px 16px 16px;
          min-width: 210px; max-width: 230px;
          text-align: center;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          animation: slideUp .3s cubic-bezier(0.34,1.56,0.64,1) both;
        }

        .cd-label {
          font-size: 9px; font-weight: 700; letter-spacing: .12em;
          text-transform: uppercase; color: #aaa; margin-bottom: 10px;
        }

        .square-wrap  { position: relative; width: 62px; height: 62px; margin: 0 auto 12px; }
        .square-progress {
          position: absolute; inset: 0;
          border: 3px solid #10b981; border-radius: 13px;
          background: conic-gradient(#10b981 0% 0%, #e5e7eb 0% 100%);
          transition: background .45s linear, border-color .4s;
          box-shadow: 0 2px 8px rgba(0,0,0,.06);
        }
        .square-progress.warn   { border-color: #f59e0b; background: conic-gradient(#f59e0b 0% 0%, #e5e7eb 0% 100%); }
        .square-progress.urgent { border-color: #ef4444; background: conic-gradient(#ef4444 0% 0%, #e5e7eb 0% 100%); }
        .square-inner {
          position: absolute; inset: 3px; background: #fff; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          box-shadow: inset 0 1px 4px rgba(0,0,0,.05), 0 1px 6px rgba(0,0,0,.06); z-index: 2;
        }
        .ring-num         { font-size: 26px; font-weight: 900; color: #1a1a1a; letter-spacing: -.03em; line-height: 1; }
        .ring-num.warn    { color: #d97706; }
        .ring-num.urgent  { color: #dc2626; }

        .scroll-hint        { font-size: 10px; font-weight: 600; color: #1f2937; margin-bottom: 10px; line-height: 1.5; }
        .scroll-hint.paused { color: #f59e0b; animation: blink 1.5s ease-in-out infinite; }

        .prog-track  { height: 3px; background: #f3f3f3; border-radius: 99px; overflow: hidden; }
        .prog-fill   { height: 100%; background: #10b981; border-radius: 99px; transition: width .4s ease, background .4s; }
        .prog-fill.warn   { background: #f59e0b; }
        .prog-fill.urgent { background: #ef4444; }

        .code-label { font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #22a06b; margin-bottom: 10px; }
        .code-box   {
          padding: 12px 10px; background: #edfaf4; border: 2px dashed #4ade80;
          border-radius: 14px; font-size: 20px; font-weight: 900;
          letter-spacing: 4px; color: #166534;
          font-family: 'SF Mono','Fira Mono','Courier New',monospace;
          margin-bottom: 12px; word-break: break-all;
        }
        .copy-btn {
          width: 100%; padding: 10px 0; background: #16a34a; color: #fff;
          border: none; border-radius: 12px; font-size: 12px; font-weight: 700;
          cursor: pointer; transition: all .2s;
          box-shadow: 0 3px 8px rgba(22,163,74,.3); letter-spacing: .02em;
        }
        .copy-btn:hover  { background: #15803d; transform: translateY(-1px); }
        .copy-btn:active { transform: scale(.97); }
        .copy-btn.done   { background: #166534; }

        .loading-box {
          font-size: 11px; color: #888; padding: 16px 0;
          display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .loading-box .spinner {
          width: 14px; height: 14px;
          border: 2px solid #e5e7eb; border-top-color: #10b981;
          border-radius: 50%; animation: spin .7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .msg-box { font-size: 11px; line-height: 1.6; text-align: left; padding: 10px 12px; border-radius: 12px; background: #fafafa; border: 1px solid #eee; color: #555; }
        .msg-box strong { color: #111; font-weight: 800; }

        .err-box {
          font-size: 11px; line-height: 1.6; text-align: left;
          padding: 12px 12px 10px; border-radius: 12px;
          background: #fff5f5; border: 1px solid #fecaca; color: #991b1b;
        }
        .err-box .err-title {
          display: flex; align-items: center; gap: 6px;
          font-size: 10px; font-weight: 800; letter-spacing: .06em;
          text-transform: uppercase; color: #dc2626; margin-bottom: 6px;
        }
        .err-box .err-title svg { flex-shrink: 0; }
        .err-box .err-msg {
          font-size: 11px; font-weight: 500; color: #7f1d1d; line-height: 1.55;
          word-break: break-word;
        }
        .err-box .err-retry {
          margin-top: 10px; width: 100%; padding: 7px 0;
          background: #dc2626; color: #fff; border: none; border-radius: 10px;
          font-size: 11px; font-weight: 700; cursor: pointer; transition: background .2s;
        }
        .err-box .err-retry:hover { background: #b91c1c; }
      `;
      host._shadow.appendChild(style);
      const popupEl = document.createElement('div');
      popupEl.className = 'popup';
      host._shadow.appendChild(popupEl);
    }
    return host;
  }

  function showPopup(host)  { host.style.setProperty('display', 'block', 'important'); }
  function hidePopup(host)  { host.style.setProperty('display', 'none',  'important'); }
  function getPopupEl(host) { return host._shadow.querySelector('.popup'); }

  function copyText(text, btnEl) {
    const done = () => {
      btnEl.classList.add('done'); btnEl.textContent = 'Đã sao chép!';
      setTimeout(() => { btnEl.classList.remove('done'); btnEl.textContent = 'Sao chép mã'; }, 2500);
    };
    try {
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(done);
      else {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.cssText = 'position:fixed;opacity:0;';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy');
        document.body.removeChild(ta); done();
      }
    } catch (_) {}
  }

  function renderLoading(popupHost, msg) {
    const p = getPopupEl(popupHost);
    p.innerHTML = `<div class="loading-box"><div class="spinner"></div>${msg || 'Đang kết nối...'}</div>`;
  }

  function renderCountdown(popupHost, secs, totalSecs, scrollPct, paused) {
    const p = getPopupEl(popupHost);
    const ratio    = Math.max(0, Math.min(1, secs / totalSecs));
    const percent  = (ratio * 100).toFixed(1) + '%';
    const cls      = secs <= 10 ? 'urgent' : secs <= 30 ? 'warn' : '';
    const pct      = Math.min(100, Math.max(0, scrollPct));
    const mainColor = cls === 'urgent' ? '#ef4444' : cls === 'warn' ? '#f59e0b' : '#10b981';

    p.innerHTML = `
      <div class="cd-label">ĐANG XÁC MINH</div>
      <div class="square-wrap">
        <div class="square-progress ${cls}" style="background:conic-gradient(${mainColor} 0% ${percent},#e5e7eb ${percent} 100%);"></div>
        <div class="square-inner"><span class="ring-num ${cls}">${secs}</span></div>
      </div>
      <div class="scroll-hint ${paused ? 'paused' : ''}">
        ${paused ? 'Cuộn trang để tiếp tục đếm' : 'Vui lòng cuộn trang để tiếp tục'}
      </div>
      <div class="prog-track"><div class="prog-fill ${cls}" style="width:${pct}%"></div></div>
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

  function renderError(popupHost, text, onRetry) {
    const p = getPopupEl(popupHost);
    const safeText = String(text || 'Đã xảy ra lỗi. Vui lòng thử lại.')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
    p.innerHTML = `
      <div class="err-box">
        <div class="err-title">
          <svg width="13" height="13" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="10" cy="10" r="9" stroke="#dc2626" stroke-width="2"/>
            <path d="M10 5v6" stroke="#dc2626" stroke-width="2.2" stroke-linecap="round"/>
            <circle cx="10" cy="14.5" r="1.1" fill="#dc2626"/>
          </svg>
          Không thể lấy mã
        </div>
        <div class="err-msg">${safeText}</div>
        <button class="err-retry">Thử lại</button>
      </div>
    `;
    const retryBtn = p.querySelector('.err-retry');
    if (retryBtn && typeof onRetry === 'function') {
      retryBtn.addEventListener('click', onRetry);
    }
  }

  // ─── Tạo widget nút ──────────────────────────────────────────────────────────
  function createWidget() {
    const shadow = getOrCreateShadowHost(WIDGET_HOST_ID);
    Array.from(shadow.children).forEach(el => { if (el.tagName !== 'STYLE') el.remove(); });

    const wrap = document.createElement('div');
    wrap.className = 'wrap';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn';
    btn.setAttribute('aria-label', 'Nhấn để nhận mã');

    const img = document.createElement('img');
    img.alt = '';
    img.setAttribute('data-src', LOGO_URL);

    if ('IntersectionObserver' in window) {
      const imgObserver = new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            const el  = entry.target;
            const src = el.getAttribute('data-src');
            if (src) {
              el.onload  = function () { el.classList.add('loaded'); };
              el.onerror = function () { el.classList.add('loaded'); };
              el.src = src;
              el.removeAttribute('data-src');
            }
            obs.unobserve(el);
          }
        });
      }, { rootMargin: '200px' });
      imgObserver.observe(img);
    } else {
      img.onload = function () { img.classList.add('loaded'); };
      img.src = LOGO_URL;
    }

    btn.appendChild(img);
    wrap.appendChild(btn);
    shadow.appendChild(wrap);
    return { btn, shadow };
  }

  // ─── Lazy inject ─────────────────────────────────────────────────────────────
  function lazyInjectWidget(onReady) {
    let fired = false;

    function doInject(sentinelEl) {
      if (fired) return;
      fired = true;
      cleanup();

      if (sentinelEl && sentinelEl.id === SENTINEL_ID) {
        const host = document.createElement('div');
        host.id = WIDGET_HOST_ID;
        host.setAttribute('style', 'all:initial;display:block;width:100%;box-sizing:border-box!important');
        if (sentinelEl.parentNode) sentinelEl.parentNode.replaceChild(host, sentinelEl);
      }

      onReady();
    }

    let sentinel = document.getElementById(WIDGET_HOST_ID) || document.getElementById(SENTINEL_ID);
    if (!sentinel) {
      sentinel = document.createElement('div');
      sentinel.id = SENTINEL_ID;
      sentinel.setAttribute('style', 'display:block;width:100%;height:2px;overflow:hidden;');
      const footer = document.querySelector('footer');
      if (footer) footer.parentNode.insertBefore(sentinel, footer);
      else document.body.appendChild(sentinel);
    }

    function isNearViewport(el, margin) {
      try {
        const r  = el.getBoundingClientRect();
        const vh = window.innerHeight || document.documentElement.clientHeight;
        return r.bottom >= -margin && r.top <= vh + margin;
      } catch (_) { return false; }
    }

    let io = null;
    let scrollTimer = null;

    function cleanup() {
      if (io) { try { io.disconnect(); } catch(_){} io = null; }
      window.removeEventListener('scroll', onScrollCheck, true);
      window.removeEventListener('load',   onPageLoad);
    }

    function onScrollCheck() {
      if (fired) return;
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(function () {
        const el = document.getElementById(WIDGET_HOST_ID) || document.getElementById(SENTINEL_ID);
        if (el && isNearViewport(el, 150)) doInject(el);
      }, 200);
    }

    function onPageLoad() {
      if (fired) return;
      const el = document.getElementById(WIDGET_HOST_ID) || document.getElementById(SENTINEL_ID);
      if (!el) return;
      if (isNearViewport(el, 150)) { doInject(el); return; }
      if (io) {
        try { io.unobserve(el); io.observe(el); } catch (_) {}
      }
    }

    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting || fired) return;
          obs.unobserve(entry.target);
          doInject(entry.target);
        });
      }, { rootMargin: '150px', threshold: 0 });

      io.observe(sentinel);
    } else {
      doInject(sentinel);
      return;
    }

    window.addEventListener('scroll', onScrollCheck, { passive: true, capture: true });
    window.addEventListener('load',   onPageLoad,    { once: true });

    var ric = window.requestIdleCallback || function(fn){ setTimeout(fn, 500); };
    ric(function () {
      if (fired) return;
      const el = document.getElementById(WIDGET_HOST_ID) || document.getElementById(SENTINEL_ID);
      if (el && isNearViewport(el, 300)) doInject(el);
    });
  }

  // ─── Countdown + scroll logic ────────────────────────────────────────────────
  async function countdownWithScroll(popupHost, totalSeconds) {
    return new Promise((resolve) => {
      let remaining   = totalSeconds;
      let active      = true;
      let cycleStart  = Date.now();
      let accumulated = 0;
      let lastScrollY = window.scrollY;
      let timerId     = null;

      function updateUI() {
        const pct = Math.round((accumulated / SCROLL_REQ_PX) * 100);
        renderCountdown(popupHost, remaining, totalSeconds, pct, !active);
      }

      function onScroll() {
        const delta = Math.abs(window.scrollY - lastScrollY);
        lastScrollY = window.scrollY;
        accumulated += delta;
        if (accumulated >= SCROLL_REQ_PX) { active = true; cycleStart = Date.now(); accumulated = 0; }
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
          resolve(); return;
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
        if (refHost !== socHost) { renderMsg(popupHost, 'Vui lòng truy cập từ ' + socHost + ' để nhận mã.'); return false; }
      } catch (_) { renderMsg(popupHost, 'Nguồn truy cập không hợp lệ.'); return false; }
    }
    return true;
  }

  function showBtnAgain(shadow, btn, delayMs = 0) {
    if (delayMs > 0) setTimeout(() => { btn.style.display = ''; }, delayMs);
    else btn.style.display = '';
  }

  // ─── Flow logic ──────────────────────────────────────────────────────────────

  // ★ THAY ĐỔI CHÍNH: create → start_countdown → countdown → finalize
  async function runSimpleFlow(popupHost, cfg, hostname, shadow, btn, onRetry) {
    const step1Time = cfg.countdown_times[0] + randomExtra();

    // 1. Hiện loading trong khi create
    renderLoading(popupHost, 'Đang khởi tạo phiên...');

    const createRes = await apiCall('create', {
      data: { hostname, domain: window.location.origin, plan: cfg.plan, max_steps: 1, referrer: document.referrer || '' }
    });
    if (!createRes.ok) {
      renderError(popupHost, createRes.error, onRetry);
      showBtnAgain(shadow, btn);
      return;
    }

    const docId = createRes.data.docId;

    // 2. Gọi start_countdown NGAY KHI user thấy popup — server bắt đầu tính giờ thật
    const startRes = await apiCall('start_countdown', { docId, step: 1 });
    if (!startRes.ok) {
      renderError(popupHost, startRes.error, onRetry);
      showBtnAgain(shadow, btn);
      return;
    }

    // 3. Bắt đầu đếm ngược phía client (đồng bộ với server)
    await countdownWithScroll(popupHost, step1Time);

    if (!checkReferrer(popupHost, cfg.type, cfg.url_social)) { showBtnAgain(shadow, btn); return; }

    // 4. Finalize
    const finalRes = await apiCall('finalize', {
      docId,
      steps_completed: 1,
      duration_sec: step1Time,
    });

    clearState();

    if (finalRes.ok && finalRes.data && finalRes.data.code) {
      renderCode(popupHost, finalRes.data.code);
    } else {
      renderError(popupHost, finalRes.error, onRetry);
    }
    showBtnAgain(shadow, btn);
  }

  async function runMultiStepFlow(popupHost, cfg, hostname, shadow, btn, onRetry) {
    const paddedTimes = cfg.countdown_times.map(t => t + randomExtra());

    // 1. Create trước
    renderLoading(popupHost, 'Đang khởi tạo phiên...');

    const createRes = await apiCall('create', {
      data: { hostname, domain: window.location.origin, plan: cfg.plan, max_steps: cfg.max_steps, referrer: document.referrer || '' }
    });
    if (!createRes.ok) {
      renderError(popupHost, createRes.error, onRetry);
      showBtnAgain(shadow, btn);
      return;
    }

    const docId = createRes.data.docId;

    // 2. start_countdown bước 1 ngay lập tức
    const startRes = await apiCall('start_countdown', { docId, step: 1 });
    if (!startRes.ok) {
      renderError(popupHost, startRes.error, onRetry);
      showBtnAgain(shadow, btn);
      return;
    }

    // 3. Đếm ngược bước 1
    await countdownWithScroll(popupHost, paddedTimes[0]);

    if (!checkReferrer(popupHost, cfg.type, cfg.url_social)) { showBtnAgain(shadow, btn); return; }

    const updateRes = await apiCall('update_step', { docId, steps_completed: 1 });
    if (!updateRes.ok) {
      renderError(popupHost, updateRes.error, onRetry);
      showBtnAgain(shadow, btn);
      return;
    }

    saveState({
      docId,
      plan: cfg.plan,
      max_steps: cfg.max_steps,
      countdown_times: paddedTimes,
      steps_completed: 1,
      hostname,
    });

    renderMsg(popupHost, 'Bước 1 hoàn thành! Hãy nhấp vào nút ở trang khác để tiếp tục Bước 2.');
    showBtnAgain(shadow, btn, 1500);
  }

  async function resumeFromStep(state, popupHost, shadow, btn, onRetry) {
    if (!state) {
      renderError(popupHost, 'Phiên đã hết hạn. Vui lòng nhấn nút để bắt đầu lại từ đầu.', onRetry);
      showBtnAgain(shadow, btn);
      return;
    }

    for (let i = state.steps_completed; i < state.max_steps; i++) {
      const stepNum = i + 1; // bước tiếp theo (2, 3...)

      // Gọi start_countdown cho bước này ngay khi user nhấn nút
      renderLoading(popupHost, `Đang bắt đầu Bước ${stepNum}...`);
      const startRes = await apiCall('start_countdown', { docId: state.docId, step: stepNum });
      if (!startRes.ok) {
        renderError(popupHost, startRes.error, onRetry);
        showBtnAgain(shadow, btn);
        return;
      }

      await countdownWithScroll(popupHost, state.countdown_times[i]);

      if (i < state.max_steps - 1) {
        const updateRes = await apiCall('update_step', { docId: state.docId, steps_completed: i + 1 });
        if (!updateRes.ok) {
          renderError(popupHost, updateRes.error, onRetry);
          showBtnAgain(shadow, btn);
          return;
        }
        // Cập nhật state đã lưu
        state.steps_completed = i + 1;
        saveState(state);

        renderMsg(popupHost, `Bước ${i+1} hoàn thành! Hãy nhấp vào nút ở trang khác để tiếp tục Bước ${i+2}.`);
        showBtnAgain(shadow, btn, 1500);
        return;
      }
    }

    // Bước cuối — finalize
    const totalDuration = state.countdown_times.reduce((a, b) => a + b, 0);
    const finalRes = await apiCall('finalize', {
      docId: state.docId,
      steps_completed: state.max_steps,
      duration_sec: totalDuration,
    });

    clearState();

    if (finalRes.ok && finalRes.data && finalRes.data.code) {
      renderCode(popupHost, finalRes.data.code);
    } else {
      renderError(popupHost, finalRes.error, onRetry);
    }
    showBtnAgain(shadow, btn);
  }

  // ─── Boot ────────────────────────────────────────────────────────────────────
  function boot() {
    lazyInjectWidget(function () {
      const hostname  = window.location.hostname;
      const popupHost = createPopup();
      const { btn, shadow } = createWidget();
      let busy = false;

      async function handleClick() {
        if (busy) return;
        busy = true;
        btn.style.display = 'none';
        showPopup(popupHost);

        function onRetry() {
          clearState();
          busy = false;
          btn.style.display = '';
          const p = getPopupEl(popupHost);
          if (p) p.innerHTML = '';
          hidePopup(popupHost);
        }

        const pending = loadState();
        if (pending && pending.hostname === hostname && pending.steps_completed >= 1 && pending.steps_completed < pending.max_steps) {
          await resumeFromStep(pending, popupHost, shadow, btn, onRetry);
          busy = false; return;
        }

        // Lấy config
        const cfgRes = await apiCall('get_config', { hostname });
        if (!cfgRes.ok) {
          renderError(popupHost, cfgRes.error, onRetry);
          showBtnAgain(shadow, btn);
          busy = false;
          return;
        }

        const cfg = cfgRes.data;
        const activeCfg = (cfg && cfg.plan) ? {
          plan: cfg.plan,
          max_steps: cfg.max_steps || 1,
          countdown_times: cfg.countdown_times || [60],
          type: cfg.type || null,
          url_social: cfg.url_social || null,
        } : { ...FALLBACK_PLAN };

        if (activeCfg.max_steps === 1) {
          await runSimpleFlow(popupHost, activeCfg, hostname, shadow, btn, onRetry);
        } else {
          await runMultiStepFlow(popupHost, activeCfg, hostname, shadow, btn, onRetry);
        }

        busy = false;
      }

      btn.addEventListener('click', handleClick);
    });
  }

  if (document.body) {
    boot();
  } else {
    document.addEventListener('DOMContentLoaded', boot);
  }

})();
