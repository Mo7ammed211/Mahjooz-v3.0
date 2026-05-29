// ═══════════════════════════════════════
//  محجوز — PWA Install Manager
// ═══════════════════════════════════════
(function () {
  'use strict';

  let _deferredPrompt = null;
  const DISMISSED_KEY = 'pwa_banner_dismissed';
  const BANNER_DELAY  = 4000;

  // ── Register SW ──────────────────────
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }

  // ── Capture install prompt ────────────
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    _deferredPrompt = e;
    _onInstallable();
  });

  // ── Trigger install (called by buttons) ──
  window.pwaTriggerInstall = async function () {
    if (!_deferredPrompt) return;
    _hideBanner();
    _deferredPrompt.prompt();
    const { outcome } = await _deferredPrompt.userChoice;
    _deferredPrompt = null;
    if (outcome === 'accepted') _onInstalled();
  };

  // ── Dismiss banner ────────────────────
  window.pwaDismissBanner = function () {
    _hideBanner();
    try { localStorage.setItem(DISMISSED_KEY, Date.now()); } catch (_) {}
  };

  // ── When app is installable ───────────
  function _onInstallable() {
    // Show navbar button always
    const navBtn = document.getElementById('pwa-nav-btn');
    if (navBtn) navBtn.classList.add('pwa-ready');

    // Show banner (unless dismissed within last 3 days)
    const dismissed = Number(localStorage.getItem(DISMISSED_KEY) || 0);
    const threeDays = 3 * 24 * 60 * 60 * 1000;
    if (Date.now() - dismissed > threeDays) {
      setTimeout(_showBanner, BANNER_DELAY);
    }
  }

  // ── When app is installed ─────────────
  function _onInstalled() {
    _hideBanner();
    const navBtn = document.getElementById('pwa-nav-btn');
    if (navBtn) { navBtn.classList.remove('pwa-ready'); navBtn.style.display = 'none'; }
  }

  window.addEventListener('appinstalled', _onInstalled);

  // ── Banner helpers ────────────────────
  function _showBanner() {
    const b = document.getElementById('pwa-install-banner');
    if (b) { b.classList.remove('hiding'); b.classList.add('visible'); }
  }

  function _hideBanner() {
    const b = document.getElementById('pwa-install-banner');
    if (!b) return;
    b.classList.remove('visible');
    b.classList.add('hiding');
    setTimeout(() => b.classList.remove('hiding'), 450);
  }

  // ── If already installed (standalone) ─
  if (window.matchMedia('(display-mode: standalone)').matches) {
    try { localStorage.setItem(DISMISSED_KEY, Date.now()); } catch (_) {}
  }
})();
