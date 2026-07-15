/**
 * Aether Tasks — PWA bootstrap
 * Service Worker registration, install prompt, standalone detection, deep links.
 */
(function () {
  'use strict';

  const INSTALL_DISMISS_KEY = 'aether_pwa_install_dismissed';
  let deferredPrompt = null;

  function isStandalone() {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: window-controls-overlay)').matches ||
      window.navigator.standalone === true
    );
  }

  function canShowInstallBanner() {
    if (isStandalone()) return false;
    if (sessionStorage.getItem(INSTALL_DISMISS_KEY) === '1') return false;
    // iOS has no beforeinstallprompt — still show tips sometimes
    return true;
  }

  function isIos() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function createInstallUI() {
    if (document.getElementById('pwa-install-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Instalar aplicativo');
    banner.innerHTML = `
      <div class="pwa-install-inner">
        <img src="icons/icon-96x96.png" alt="" width="40" height="40" class="pwa-install-icon">
        <div class="pwa-install-text">
          <strong>Instalar Meu Kanban</strong>
          <span id="pwa-install-hint">Use como app na tela inicial, sem barra do navegador.</span>
        </div>
        <div class="pwa-install-actions">
          <button type="button" id="pwa-install-dismiss" class="pwa-btn-ghost">Agora não</button>
          <button type="button" id="pwa-install-btn" class="pwa-btn-main">Instalar</button>
        </div>
      </div>
    `;
    document.body.appendChild(banner);

    if (!document.getElementById('pwa-install-styles')) {
      const style = document.createElement('style');
      style.id = 'pwa-install-styles';
      style.textContent = `
        #pwa-install-banner {
          position: fixed;
          left: max(0.75rem, env(safe-area-inset-left));
          right: max(0.75rem, env(safe-area-inset-right));
          bottom: calc(var(--bottom-nav-h, 4.25rem) + env(safe-area-inset-bottom, 0px) + 0.75rem);
          z-index: 300;
          display: none;
        }
        @media (min-width: 768px) {
          #pwa-install-banner {
            left: auto;
            right: 1.25rem;
            bottom: 1.25rem;
            max-width: 26rem;
          }
        }
        #pwa-install-banner.visible { display: block; animation: pwaSlide 0.28s ease; }
        @keyframes pwaSlide {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .pwa-install-inner {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.75rem;
          padding: 0.85rem 1rem;
          border-radius: 1.15rem;
          border: 1px solid rgba(129, 140, 248, 0.4);
          background: linear-gradient(160deg, rgba(30, 41, 70, 0.96), rgba(15, 23, 42, 0.98));
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(16px);
        }
        .pwa-install-icon {
          border-radius: 0.7rem;
          flex-shrink: 0;
        }
        .pwa-install-text {
          flex: 1;
          min-width: 10rem;
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }
        .pwa-install-text strong {
          color: #f1f5f9;
          font-size: 0.92rem;
        }
        .pwa-install-text span {
          color: #94a3b8;
          font-size: 0.75rem;
          line-height: 1.35;
        }
        .pwa-install-actions {
          display: flex;
          gap: 0.4rem;
          margin-left: auto;
        }
        .pwa-btn-main, .pwa-btn-ghost {
          border: 0;
          border-radius: 999px;
          padding: 0.45rem 0.85rem;
          font-size: 0.78rem;
          font-weight: 700;
          cursor: pointer;
        }
        .pwa-btn-main {
          color: #fff;
          background: linear-gradient(135deg, #38bdf8, #6366f1, #a855f7);
        }
        .pwa-btn-ghost {
          color: #cbd5e1;
          background: rgba(148, 163, 184, 0.12);
          border: 1px solid rgba(148, 163, 184, 0.25);
        }
        body.pwa-standalone #pwa-install-banner { display: none !important; }
      `;
      document.head.appendChild(style);
    }

    document.getElementById('pwa-install-dismiss')?.addEventListener('click', () => {
      sessionStorage.setItem(INSTALL_DISMISS_KEY, '1');
      hideInstallBanner();
    });

    document.getElementById('pwa-install-btn')?.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        deferredPrompt = null;
        hideInstallBanner();
        if (choice?.outcome === 'accepted') {
          console.log('[PWA] Instalação aceita');
        }
        return;
      }
      // iOS / browsers without native prompt
      const hint = document.getElementById('pwa-install-hint');
      if (isIos()) {
        if (hint) {
          hint.textContent = 'No Safari: Compartilhar → “Adicionar à Tela de Início”.';
        }
      } else if (hint) {
        hint.textContent = 'Use o menu do navegador → “Instalar aplicativo” ou “Instalar Meu Kanban”.';
      }
    });
  }

  function showInstallBanner(message) {
    if (!canShowInstallBanner()) return;
    createInstallUI();
    const banner = document.getElementById('pwa-install-banner');
    const hint = document.getElementById('pwa-install-hint');
    if (message && hint) hint.textContent = message;
    banner?.classList.add('visible');
  }

  function hideInstallBanner() {
    document.getElementById('pwa-install-banner')?.classList.remove('visible');
  }

  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      console.warn('[PWA] Service Worker não suportado neste navegador.');
      return null;
    }
    try {
      const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
      console.log('[PWA] Service Worker registrado:', reg.scope);

      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[PWA] Nova versão disponível. Recarregue para atualizar.');
          }
        });
      });

      return reg;
    } catch (err) {
      console.error('[PWA] Falha ao registrar Service Worker:', err);
      return null;
    }
  }

  function handleLaunchParams() {
    try {
      const params = new URLSearchParams(window.location.search);
      const view = params.get('view');
      const action = params.get('action');

      const run = () => {
        if (typeof navigateTo === 'function' && view) {
          const allowed = ['dashboard', 'tasks', 'kanban', 'calendar', 'stats', 'gamification'];
          if (allowed.includes(view)) navigateTo(view);
        }
        if (action === 'new-task' && typeof openTaskModal === 'function') {
          openTaskModal();
        }
        // Clean query without reload (keep history clean)
        if (view || action || params.get('source') === 'pwa') {
          const clean = window.location.pathname + window.location.hash;
          window.history.replaceState({}, '', clean || './index.html');
        }
      };

      // App may boot after DOMContentLoaded / onload
      if (document.readyState === 'complete') {
        setTimeout(run, 400);
      } else {
        window.addEventListener('load', () => setTimeout(run, 400));
      }
    } catch (_) { /* ignore */ }
  }

  function markStandaloneClass() {
    if (isStandalone()) {
      document.documentElement.classList.add('pwa-standalone');
      document.body?.classList.add('pwa-standalone');
    }
  }

  function initPwa() {
    markStandaloneClass();
    registerServiceWorker();
    handleLaunchParams();

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      showInstallBanner('Instale o Meu Kanban e abra como app nativo.');
    });

    window.addEventListener('appinstalled', () => {
      deferredPrompt = null;
      hideInstallBanner();
      console.log('[PWA] App instalado com sucesso');
    });

    // iOS: show add-to-home tip once per session (delayed)
    if (isIos() && !isStandalone() && canShowInstallBanner()) {
      setTimeout(() => {
        showInstallBanner('No iPhone: Compartilhar → Adicionar à Tela de Início.');
      }, 4500);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPwa);
  } else {
    initPwa();
  }

  // Expose for debugging / settings
  window.AetherPWA = {
    isStandalone,
    showInstallBanner,
    hideInstallBanner,
    registerServiceWorker
  };
})();
