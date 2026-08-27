(function () {
  'use strict';

  if (window.__veinDropPullToRefreshLoaded) return;
  window.__veinDropPullToRefreshLoaded = true;

  var MOBILE_MAX_WIDTH = 900;
  var REFRESH_THRESHOLD = 64;
  var MAX_PULL_DISTANCE = 88;
  var startX = 0;
  var startY = 0;
  var pullDistance = 0;
  var tracking = false;
  var pulling = false;
  var refreshing = false;
  var indicator;
  var label;
  var icon;

  function isMobileTouchDevice() {
    var hasTouch = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
    return hasTouch && window.innerWidth <= MOBILE_MAX_WIDTH;
  }

  function isAtPageTop() {
    return window.scrollY <= 0 && document.documentElement.scrollTop <= 0;
  }

  function shouldIgnoreTarget(target) {
    if (!(target instanceof Element)) return false;

    return Boolean(target.closest(
      'input, textarea, select, button, a, [contenteditable="true"], ' +
      '.modal, dialog, .leaflet-container, [data-no-pull-refresh]'
    ));
  }

  function addStyles() {
    var style = document.createElement('style');
    style.id = 'veindrop-pull-to-refresh-styles';
    style.textContent = [
      '.veindrop-ptr{position:fixed;top:max(8px,env(safe-area-inset-top));left:50%;z-index:10000;display:none;align-items:center;gap:9px;min-height:42px;padding:9px 15px;border:1px solid rgba(128,0,0,.12);border-radius:999px;background:rgba(255,255,255,.96);box-shadow:0 8px 24px rgba(17,24,39,.16);color:#4b5563;font-family:"DM Sans",system-ui,-apple-system,sans-serif;font-size:.78rem;font-weight:700;pointer-events:none;opacity:0;transform:translate3d(-50%,calc(-100% - 20px),0);transition:transform .18s ease,opacity .18s ease;will-change:transform,opacity}',
      '.veindrop-ptr__icon{display:grid;width:24px;height:24px;place-items:center;border-radius:50%;background:#fbf2f3;color:#800000;font-size:1rem;line-height:1;transition:transform .18s ease}',
      '.veindrop-ptr[data-state="ready"] .veindrop-ptr__icon{transform:rotate(180deg)}',
      '.veindrop-ptr[data-state="refreshing"] .veindrop-ptr__icon{animation:veindrop-ptr-spin .75s linear infinite}',
      '@keyframes veindrop-ptr-spin{to{transform:rotate(360deg)}}',
      '@media(max-width:900px){html,body{overscroll-behavior-y:contain}.veindrop-ptr{display:flex}}',
      '@media(prefers-reduced-motion:reduce){.veindrop-ptr,.veindrop-ptr__icon{transition:none}.veindrop-ptr[data-state="refreshing"] .veindrop-ptr__icon{animation-duration:1.4s}}'
    ].join('');
    document.head.appendChild(style);
  }

  function createIndicator() {
    indicator = document.createElement('div');
    indicator.className = 'veindrop-ptr';
    indicator.setAttribute('role', 'status');
    indicator.setAttribute('aria-live', 'polite');
    indicator.setAttribute('aria-hidden', 'true');
    indicator.setAttribute('data-state', 'idle');

    icon = document.createElement('span');
    icon.className = 'veindrop-ptr__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '\u2193';

    label = document.createElement('span');
    label.textContent = 'Pull to refresh';

    indicator.appendChild(icon);
    indicator.appendChild(label);
    document.body.appendChild(indicator);
  }

  function setIndicator(distance, state) {
    var offset = Math.max(0, distance);
    indicator.style.transform = 'translate3d(-50%, calc(-100% - 20px + ' + offset + 'px), 0)';
    indicator.style.opacity = String(Math.min(1, offset / 28));
    indicator.setAttribute('data-state', state);
    indicator.setAttribute('aria-hidden', state === 'idle' ? 'true' : 'false');

    if (state === 'ready') {
      label.textContent = 'Release to refresh';
      icon.textContent = '\u2193';
    } else if (state === 'refreshing') {
      label.textContent = 'Refreshing...';
      icon.textContent = '\u21bb';
    } else {
      label.textContent = 'Pull to refresh';
      icon.textContent = '\u2193';
    }
  }

  function resetIndicator() {
    pulling = false;
    pullDistance = 0;
    setIndicator(0, 'idle');
    document.body.classList.remove('veindrop-ptr-active');
  }

  function onTouchStart(event) {
    if (refreshing || !isMobileTouchDevice() || !isAtPageTop()) return;
    if (document.body.classList.contains('modal-open') || shouldIgnoreTarget(event.target)) return;
    if (event.touches.length !== 1) return;

    startX = event.touches[0].clientX;
    startY = event.touches[0].clientY;
    tracking = true;
    pulling = false;
  }

  function onTouchMove(event) {
    if (!tracking || refreshing || event.touches.length !== 1) return;

    var deltaX = event.touches[0].clientX - startX;
    var deltaY = event.touches[0].clientY - startY;

    if (!pulling && Math.abs(deltaX) > Math.abs(deltaY)) {
      tracking = false;
      return;
    }

    if (deltaY <= 0 || !isAtPageTop()) {
      if (pulling) resetIndicator();
      tracking = false;
      return;
    }

    pulling = true;
    event.preventDefault();
    document.body.classList.add('veindrop-ptr-active');

    pullDistance = Math.min(MAX_PULL_DISTANCE, deltaY * 0.5);
    setIndicator(pullDistance, pullDistance >= REFRESH_THRESHOLD ? 'ready' : 'pulling');
  }

  function onTouchEnd() {
    if (!tracking && !pulling) return;
    tracking = false;

    if (pulling && pullDistance >= REFRESH_THRESHOLD) {
      refreshing = true;
      pulling = false;
      setIndicator(76, 'refreshing');
      document.body.classList.remove('veindrop-ptr-active');
      window.dispatchEvent(new CustomEvent('veindrop:refresh'));
      window.setTimeout(function () {
        window.location.reload();
      }, 350);
      return;
    }

    resetIndicator();
  }

  function init() {
    if (!document.getElementById('veindrop-pull-to-refresh-styles')) addStyles();
    createIndicator();

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    document.addEventListener('touchcancel', onTouchEnd, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
