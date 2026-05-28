/* ═══════════════════════════════════════════════════════════════
   محجوز — Unified Notification Bell  جرس الإشعارات الموحد
   Replaces: ph19-pill · notif-bell-wrap · da-bell
   Each source calls: window.__unifiedNotif.update(sourceId, items, count)
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const SOURCES = {
    live:   { label: '🛎️ تنبيهات حيّة',   color: '#7c3aed', items: [], count: 0 },
    notif:  { label: '🔔 إشعاراتي',        color: '#0ea5e9', items: [], count: 0 },
    driver: { label: '🚚 طلبات التوصيل',  color: '#0d9488', items: [], count: 0 },
  };

  /* ── Public API ─────────────────────────────────────────────── */
  window.__unifiedNotif = {
    update(sourceId, items, count) {
      if (!SOURCES[sourceId]) return;
      SOURCES[sourceId].items = items || [];
      SOURCES[sourceId].count = Math.max(0, count || 0);
      _updateBadge();
      _refreshPanelIfOpen();
    },
  };

  /* ── Badge ──────────────────────────────────────────────────── */
  function _totalCount() {
    return Object.values(SOURCES).reduce((a, s) => a + (s.count || 0), 0);
  }

  function _updateBadge() {
    const badge = document.getElementById('unified-bell-badge');
    if (!badge) return;
    const total = _totalCount();
    badge.textContent = total > 99 ? '99+' : String(total);
    badge.style.display = total > 0 ? 'inline-flex' : 'none';
  }

  function _refreshPanelIfOpen() {
    const panel = document.getElementById('unified-bell-panel');
    if (panel && panel.classList.contains('ub-open')) _renderPanel();
  }

  /* ── Panel Rendering ────────────────────────────────────────── */
  function _esc(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  function _renderItemLive(item) {
    const nav = _esc(item.nav || '');
    return `<div class="ub-item" ${nav ? `onclick="navigate('${nav}');toggleUnifiedNotif()"` : ''}>
      <span class="ub-item-icon">${item.icon || '📋'}</span>
      <div class="ub-item-body">
        <div class="ub-item-title">${_esc(item.title)}</div>
        ${item.sub  ? `<div class="ub-item-sub">${_esc(item.sub)}</div>` : ''}
        <div class="ub-item-time">${_esc(item.time || '')}</div>
      </div>
    </div>`;
  }

  function _renderItemNotif(item) {
    const link = item.link ? `'${_esc(item.link)}'` : 'null';
    return `<div class="ub-item ${item.read ? '' : 'ub-unread'}"
        onclick="onNotifClick('${_esc(item.id)}',${link});toggleUnifiedNotif()">
      <span class="ub-item-icon">🔔</span>
      <div class="ub-item-body">
        <div class="ub-item-title">${_esc(item.title || '')}</div>
        ${item.body ? `<div class="ub-item-sub">${_esc(item.body)}</div>` : ''}
        <div class="ub-item-time">${typeof fmtDate === 'function' ? fmtDate(item.createdAt) : ''}</div>
      </div>
    </div>`;
  }

  function _renderItemDriver(item) {
    return `<div class="ub-item">
      <span class="ub-item-icon">${item.icon || '🚚'}</span>
      <div class="ub-item-body">
        <div class="ub-item-title">${_esc(item.title)}</div>
        ${item.sub ? `<div class="ub-item-sub">${_esc(item.sub)}</div>` : ''}
        <div class="ub-item-time">${_esc(item.time || '')}</div>
      </div>
    </div>`;
  }

  function _renderPanel() {
    const panel = document.getElementById('unified-bell-panel');
    if (!panel) return;

    const active = Object.entries(SOURCES).filter(([, s]) => s.items.length > 0);
    const hasUnreadNotif = (SOURCES.notif.items || []).some(n => !n.read);

    let body = '';
    if (active.length === 0) {
      body = `<div class="ub-empty">لا توجد إشعارات جديدة</div>`;
    } else {
      body = `<div class="ub-body">${active.map(([id, src]) => `
        <div class="ub-section">
          <div class="ub-section-title" style="color:${src.color}">${src.label}</div>
          ${src.items.slice(0, 8).map(item =>
            id === 'live'   ? _renderItemLive(item)   :
            id === 'notif'  ? _renderItemNotif(item)  :
                              _renderItemDriver(item)
          ).join('')}
        </div>`).join('')}
      </div>`;
    }

    const markAllBtn = hasUnreadNotif
      ? `<button class="ub-mark-all" onclick="markAllNotifsRead?.()">تحديد الكل كمقروء</button>`
      : '';

    panel.innerHTML = `
      <div class="ub-header">
        <span>🔔 الإشعارات</span>
        <div style="display:flex;align-items:center;gap:8px;">
          ${markAllBtn}
          <button class="ub-close" onclick="toggleUnifiedNotif()">✕</button>
        </div>
      </div>
      ${body}`;
  }

  /* ── Bell Injection ─────────────────────────────────────────── */
  function _ensureBell() {
    if (document.getElementById('unified-bell-wrap')) return;
    const target = document.getElementById('nav-notif-target');
    if (!target) return;

    const wrap = document.createElement('div');
    wrap.id = 'unified-bell-wrap';
    wrap.innerHTML = `
      <button id="unified-bell-btn" onclick="toggleUnifiedNotif(event)" title="الإشعارات">
        🔔
        <span id="unified-bell-badge" style="display:none;"></span>
      </button>
      <div id="unified-bell-panel" class="ub-panel"></div>`;
    target.appendChild(wrap);
    _updateBadge();

    document.addEventListener('click', e => {
      const w = document.getElementById('unified-bell-wrap');
      const p = document.getElementById('unified-bell-panel');
      if (w && p && !w.contains(e.target)) p.classList.remove('ub-open');
    });
  }

  /* ── Toggle (global) ────────────────────────────────────────── */
  window.toggleUnifiedNotif = function (event) {
    if (event && event.stopPropagation) event.stopPropagation();
    const panel = document.getElementById('unified-bell-panel');
    if (!panel) return;
    const opening = !panel.classList.contains('ub-open');
    panel.classList.toggle('ub-open');
    if (opening) {
      _renderPanel();
      Object.values(SOURCES).forEach(s => { s.count = 0; });
      _updateBadge();
    }
  };

  /* ── Hook into render() ─────────────────────────────────────── */
  const _orig = window.render;
  window.render = async function (...args) {
    const result = typeof _orig === 'function' ? await _orig.apply(this, args) : undefined;
    setTimeout(_ensureBell, 80);
    return result;
  };

  document.addEventListener('DOMContentLoaded', () => setTimeout(_ensureBell, 600));

  /* ── Styles ─────────────────────────────────────────────────── */
  const style = document.createElement('style');
  style.id = 'unified-bell-css';
  style.textContent = `
    #unified-bell-wrap {
      position: relative; display: inline-flex; align-items: center;
    }
    #unified-bell-btn {
      width: 38px; height: 38px; border-radius: 50%;
      background: var(--glass-bg, rgba(255,255,255,0.08));
      border: 1.5px solid var(--border, rgba(255,255,255,0.12));
      color: var(--text-main, #f1f5f9); font-size: 18px; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      position: relative; transition: background 0.2s;
      font-family: sans-serif;
    }
    #unified-bell-btn:hover {
      background: var(--bg-secondary, rgba(255,255,255,0.15));
    }
    #unified-bell-badge {
      position: absolute; top: -4px; right: -4px;
      background: #ef4444; color: #fff; border-radius: 99px;
      font-size: 10px; font-weight: 900;
      min-width: 17px; height: 17px;
      align-items: center; justify-content: center;
      padding: 0 3px; font-family: 'Cairo', sans-serif;
      line-height: 1; pointer-events: none;
    }
    .ub-panel {
      display: none; flex-direction: column;
      position: absolute; top: calc(100% + 10px); inset-inline-end: 0;
      width: 320px; max-height: 480px; overflow: hidden;
      background: var(--bg-card, #1e293b);
      border: 1.5px solid var(--border, rgba(255,255,255,0.1));
      border-radius: 16px;
      box-shadow: 0 16px 48px rgba(0,0,0,0.35);
      z-index: 9999; font-family: 'Cairo', sans-serif; direction: rtl;
    }
    .ub-panel.ub-open { display: flex; }
    .ub-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 13px 15px 10px;
      border-bottom: 1.5px solid var(--border, rgba(255,255,255,0.1));
      font-weight: 900; font-size: 14px; color: var(--text-main, #f1f5f9);
      flex-shrink: 0;
    }
    .ub-close {
      background: none; border: none; cursor: pointer;
      color: var(--text-muted, #9ca3af); font-size: 15px;
      line-height: 1; padding: 3px 7px; border-radius: 6px;
    }
    .ub-close:hover { background: var(--bg-secondary, rgba(255,255,255,0.08)); }
    .ub-mark-all {
      background: none; border: none; cursor: pointer;
      color: var(--accent, #7c3aed); font-size: 11px; font-weight: 700;
      font-family: 'Cairo', sans-serif; padding: 3px 7px; border-radius: 6px;
    }
    .ub-mark-all:hover { background: rgba(124,58,237,0.1); }
    .ub-body { overflow-y: auto; flex: 1; }
    .ub-empty {
      padding: 36px 16px; text-align: center;
      color: var(--text-muted, #9ca3af); font-size: 13px;
    }
    .ub-section { border-bottom: 1.5px solid var(--border, rgba(255,255,255,0.08)); }
    .ub-section:last-child { border-bottom: none; }
    .ub-section-title {
      padding: 10px 14px 5px;
      font-size: 11px; font-weight: 900; letter-spacing: 0.3px;
    }
    .ub-item {
      display: flex; align-items: flex-start; gap: 10px;
      padding: 9px 14px; cursor: pointer;
      border-bottom: 1px solid var(--glass-border, rgba(255,255,255,0.05));
      transition: background 0.15s;
    }
    .ub-item:last-child { border-bottom: none; }
    .ub-item:hover { background: var(--bg-secondary, rgba(255,255,255,0.06)); }
    .ub-item.ub-unread { background: rgba(14,165,233,0.06); }
    .ub-item-icon { font-size: 20px; flex-shrink: 0; margin-top: 1px; }
    .ub-item-body { flex: 1; min-width: 0; }
    .ub-item-title {
      font-size: 13px; font-weight: 700;
      color: var(--text-main, #f1f5f9); line-height: 1.3;
    }
    .ub-item-sub {
      font-size: 11px; color: var(--text-secondary, #94a3b8);
      margin-top: 2px; line-height: 1.4;
    }
    .ub-item-time {
      font-size: 10px; color: var(--text-muted, #64748b); margin-top: 3px;
    }
  `;
  document.head.appendChild(style);

  console.log('[UnifiedBell] جرس الإشعارات الموحد جاهز 🔔');
})();
