(function() {
  'use strict';

  function qs(selector, root) {
    return (root || document).querySelector(selector);
  }

  function qsa(selector, root) {
    return Array.from((root || document).querySelectorAll(selector));
  }

  function initIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  // Automatic CSRF header injection for mutating fetch requests (safeguarded against non-writable fetch getter)
  (function setupCsrfFetchInterceptor() {
    try {
      if (typeof window.fetch !== 'function' || window._csrfFetchBound) return;
      var origFetch = window.fetch;
      function safeWrappedFetch(resource, init) {
        init = init || {};
        var method = String(init.method || 'GET').toUpperCase();
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
          var csrfEl = document.querySelector('input[name="_csrf"]') || document.querySelector('meta[name="csrf-token"]');
          var token = csrfEl ? (csrfEl.value || csrfEl.getAttribute('content')) : '';
          if (token) {
            init.headers = init.headers || {};
            if (typeof Headers !== 'undefined' && init.headers instanceof Headers) {
              if (!init.headers.has('x-csrf-token') && !init.headers.has('X-CSRF-Token')) init.headers.set('x-csrf-token', token);
            } else if (Array.isArray(init.headers)) {
              if (!init.headers.some(function(h) { return h[0].toLowerCase() === 'x-csrf-token'; })) {
                init.headers.push(['x-csrf-token', token]);
              }
            } else {
              if (!init.headers['x-csrf-token'] && !init.headers['X-CSRF-Token']) {
                init.headers['x-csrf-token'] = token;
              }
            }
          }
        }
        return origFetch.call(this, resource, init);
      }

      var patched = false;
      try {
        window.fetch = safeWrappedFetch;
        patched = true;
      } catch (assignErr) {
        try {
          Object.defineProperty(window, 'fetch', {
            value: safeWrappedFetch,
            writable: true,
            configurable: true,
            enumerable: true
          });
          patched = true;
        } catch (defineErr) {
          // Window fetch is strictly locked in this iframe environment; standard form _csrf fields handle protection
        }
      }
      if (patched) {
        window._csrfFetchBound = true;
      }
    } catch (e) {
      // Graceful fallback: never let fetch interceptor interrupt UI event listeners
    }
  })();

  // Bind interactive handlers (password toggle, confirm dialogs, menu check-all)
  function bindPageHandlers(root) {
    var scope = root || document;
    initIcons();

    // 1. Password Visibility Toggle
    var pw = qs('#password-toggle', scope);
    if (pw && !pw._bound) {
      pw._bound = true;
      pw.addEventListener('click', function() {
        var input = qs('#password');
        if (!input) return;
        var isPw = input.type === 'password';
        input.type = isPw ? 'text' : 'password';
        pw.setAttribute('aria-label', isPw ? 'Sembunyikan password' : 'Tampilkan password');
      });
    }

    // 2. Confirmation Dialogs
    qsa('[data-confirm]', scope).forEach(function(el) {
      if (el._boundConfirm) return;
      el._boundConfirm = true;
      el.addEventListener('click', function(e) {
        var msg = el.getAttribute('data-confirm');
        if (msg && !window.confirm(msg)) {
          e.preventDefault();
          e.stopPropagation();
        }
      });
    });

    // 3. Batch Check-All Checkboxes
    var all = qs('#check-all', scope);
    if (all && !all._bound) {
      all._bound = true;
      all.addEventListener('change', function() {
        qsa('.menu-check', scope).forEach(function(x) {
          x.checked = all.checked;
        });
      });
    }
  }

  // Mobile sidebar toggle setup
  function bindSidebar() {
    var sidebar = qs('.sidebar');
    var menu = qs('.mobile-menu');

    if (menu && sidebar && !menu._boundSidebar) {
      menu._boundSidebar = true;
      menu.addEventListener('click', function(e) {
        e.stopPropagation();
        var isOpen = sidebar.classList.toggle('open');
        menu.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });
    }

    // Close mobile sidebar on clicking outside
    document.addEventListener('click', function(e) {
      if (window.innerWidth <= 820 && sidebar && sidebar.classList.contains('open')) {
        if (!sidebar.contains(e.target) && (!menu || !menu.contains(e.target))) {
          sidebar.classList.remove('open');
          if (menu) menu.setAttribute('aria-expanded', 'false');
        }
      }
    });

    // Close mobile sidebar when clicking any navigation link
    if (sidebar) {
      sidebar.addEventListener('click', function(e) {
        var a = e.target.closest('a');
        if (a && window.innerWidth <= 820) {
          sidebar.classList.remove('open');
          if (menu) menu.setAttribute('aria-expanded', 'false');
        }
      });
    }
  }

  // Auto-close details.user-menu when clicking outside or pressing Escape
  function bindUserMenu() {
    document.addEventListener('click', function(e) {
      qsa('details.user-menu').forEach(function(m) {
        if (m.open && !m.contains(e.target)) {
          m.open = false;
        }
      });
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        qsa('details.user-menu').forEach(function(m) {
          if (m.open) m.open = false;
        });
      }
    });
  }

  // Universal Modal & Action Engine (Anti-Macet for Tabs, Dialogs, and Action Triggers across mobile and desktop)
  function bindModalHandlers() {
    function openModalEl(modalId) {
      if (!modalId) return;
      var el = document.getElementById(modalId);
      if (!el) return;
      if (el.parentNode !== document.body) {
        document.body.appendChild(el);
      }
      el.style.display = 'flex';
      el.classList.add('open', 'show', 'active');
      el.setAttribute('aria-hidden', 'false');
      try { document.body.style.overflow = 'hidden'; } catch (e) {}
    }

    function closeModalEl(el) {
      if (!el) return;
      el.style.display = 'none';
      el.classList.remove('open', 'show', 'active');
      el.setAttribute('aria-hidden', 'true');
      var openModals = qsa('.pm-modal-backdrop.active, .pm-modal-backdrop[style*="display: flex"], .modal[style*="display: block"], .kpm-group-modal.active, [id*="history"][style*="display: flex"], [id*="History"][style*="display: flex"]');
      if (!openModals.length) {
        try { document.body.style.overflow = ''; } catch (e) {}
      }
    }

    function switchTab(tabId) {
      if (!tabId) return;
      var isPaket = (tabId === 'tab-paket');
      var btnPaket = document.getElementById('tabBtnPaket');
      var btnRiwayat = document.getElementById('tabBtnRiwayat');
      var contentPaket = document.getElementById('tabContentPaket');
      var contentRiwayat = document.getElementById('tabContentRiwayat');

      if (btnPaket) btnPaket.classList.toggle('active', isPaket);
      if (btnRiwayat) btnRiwayat.classList.toggle('active', !isPaket);
      if (contentPaket) contentPaket.classList.toggle('active', isPaket);
      if (contentRiwayat) contentRiwayat.classList.toggle('active', !isPaket);
    }

    // Capture-phase listener guarantees instant opening, tab-switching, and closing
    function handleGlobalInteractions(e) {
      // 1. Tab switching delegation
      var tabTrigger = e.target.closest('#tabBtnPaket, #tabBtnRiwayat, #cardDraftStatus, [onclick*="switchPackageTab"], [data-tab]');
      if (tabTrigger) {
        var tabId = tabTrigger.getAttribute('data-tab');
        if (!tabId) {
          var onclickAttr = tabTrigger.getAttribute('onclick') || '';
          if (onclickAttr.includes('tab-riwayat') || tabTrigger.id === 'tabBtnRiwayat' || tabTrigger.textContent.includes('Riwayat') || tabTrigger.textContent.includes('Menunggu') || tabTrigger.textContent.includes('Perlu') || tabTrigger.textContent.includes('Selesai')) {
            tabId = 'tab-riwayat';
          } else {
            tabId = 'tab-paket';
          }
        }
        switchTab(tabId);
        // If handled, prevent inline error
        if (typeof window.switchPackageTab === 'function') {
          try { window.switchPackageTab(tabId); } catch(err) {}
        }
      }

      // 2. Modal open triggers delegation
      var openTrigger = e.target.closest('[data-action], [onclick*="open"], [data-modal-target], .pm-mutation-shortcut');
      if (openTrigger) {
        var action = openTrigger.getAttribute('data-action') || '';
        var onclickVal = openTrigger.getAttribute('onclick') || '';
        var text = (openTrigger.textContent || '').toLowerCase();

        if (action === 'open-mutation-picker' || onclickVal.includes('openMutationPickerModal') || text.includes('tambah perubahan')) {
          openModalEl('modalMutationPicker');
          if (typeof window.openMutationPickerModal === 'function') {
            try { window.openMutationPickerModal(); } catch (err) {}
          }
        } else if (action === 'open-new-pm' || onclickVal.includes('openNewPmModal') || text.includes('pm baru')) {
          closeModalEl(document.getElementById('modalMutationPicker'));
          openModalEl('modalNewPm');
          if (typeof window.openNewPmModal === 'function') {
            try { window.openNewPmModal(); } catch (err) {}
          }
        } else if (action === 'open-exit-pm' || onclickVal.includes('openExitPmModal') || text.includes('pm keluar')) {
          closeModalEl(document.getElementById('modalMutationPicker'));
          openModalEl('modalExitPm');
          if (typeof window.openExitPmModal === 'function') {
            try { window.openExitPmModal(); } catch (err) {}
          }
        } else if (action === 'open-correction-pm' || onclickVal.includes('openCorrectionPmModal') || text.includes('koreksi identitas')) {
          closeModalEl(document.getElementById('modalMutationPicker'));
          openModalEl('modalCorrectionPm');
          if (typeof window.openCorrectionPmModal === 'function') {
            try { window.openCorrectionPmModal(); } catch (err) {}
          }
        } else if (action === 'open-category-change' || onclickVal.includes('openCategoryChangeModal') || text.includes('alih status') || text.includes('alih kategori')) {
          closeModalEl(document.getElementById('modalMutationPicker'));
          openModalEl('modalCategoryChange');
          if (typeof window.openCategoryChangeModal === 'function') {
            try { window.openCategoryChangeModal(); } catch (err) {}
          }
        } else if (onclickVal.includes('viewPackageDetailModal')) {
          openModalEl('modalPackageDetail');
          var match = onclickVal.match(/viewPackageDetailModal\((\d+)\)/);
          if (match && match[1] && typeof window.viewPackageDetailModal === 'function') {
            try { window.viewPackageDetailModal(Number(match[1])); } catch (err) {}
          }
        }
      }

      // 3. Modal close delegation (broad selector & text detection)
      var closeBtn = e.target.closest('.pm-modal-close, .modal-close, .btn-close, .kpm-group-close, [data-close-modal], [data-action="close"], button[aria-label="Tutup"], button[aria-label="Close"], [onclick*="close"]');
      if (!closeBtn) {
        var btnCandidate = e.target.closest('button, .btn, [role="button"]');
        if (btnCandidate) {
          var btnText = (btnCandidate.textContent || '').trim().toLowerCase();
          if (btnText === 'tutup' || btnText === 'batal' || btnText === 'close' || btnText === 'cancel') {
            closeBtn = btnCandidate;
          }
        }
      }

      if (closeBtn) {
        var modal = closeBtn.closest('.pm-modal-backdrop, .modal, [role="dialog"], .modal-backdrop, .kpm-group-modal, .kpm-group-dialog, [id*="history"], [id*="History"]');
        if (modal) {
          closeModalEl(modal);
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }

      // 4. Direct click on backdrop (outside card)
      if (e.target && (e.target.classList.contains('pm-modal-backdrop') || e.target.classList.contains('modal-backdrop') || e.target.classList.contains('kpm-group-modal') || (e.target.id && (e.target.id.includes('historyModal') || e.target.id.includes('HistoryModal'))))) {
        closeModalEl(e.target);
        e.preventDefault();
        e.stopPropagation();
      }
    }

    document.addEventListener('click', handleGlobalInteractions, true);
    document.addEventListener('touchend', handleGlobalInteractions, { passive: false, capture: true });

    // 5. Escape key closes any open modal
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        qsa('.pm-modal-backdrop, .modal, [role="dialog"], .modal-backdrop, .kpm-group-modal, [id*="history"], [id*="History"]').forEach(function(m) {
          if (m.style.display !== 'none') {
            closeModalEl(m);
          }
        });
      }
    });

    // 6. Safe global function definitions on window so inline onclick never fails
    window.openModal = window.openModal || function(id) { openModalEl(id); };
    window.closeModal = window.closeModal || function(id) { closeModalEl(document.getElementById(id)); };
    window.switchPackageTab = window.switchPackageTab || function(id) { switchTab(id); };
    window.openMutationPickerModal = window.openMutationPickerModal || function() { openModalEl('modalMutationPicker'); };
    window.openNewPmModal = window.openNewPmModal || function() { closeModalEl(document.getElementById('modalMutationPicker')); openModalEl('modalNewPm'); };
    window.openExitPmModal = window.openExitPmModal || function() { closeModalEl(document.getElementById('modalMutationPicker')); openModalEl('modalExitPm'); };
    window.openCorrectionPmModal = window.openCorrectionPmModal || function() { closeModalEl(document.getElementById('modalMutationPicker')); openModalEl('modalCorrectionPm'); };
    window.openCategoryChangeModal = window.openCategoryChangeModal || function() { closeModalEl(document.getElementById('modalMutationPicker')); openModalEl('modalCategoryChange'); };

    window.closeHistoryModal = function() {
      qsa('#pmHistoryModal, .kpm-group-modal, .pm-modal-backdrop, [id*="historyModal"], [id*="HistoryModal"]').forEach(function(m) {
        closeModalEl(m);
      });
    };

    ['closeDeactivateModal', 'closeBgnApproveModal', 'closeBgnRejectModal', 'closeReactivateModal'].forEach(function(fnName) {
      if (typeof window[fnName] !== 'function') {
        window[fnName] = function() {
          qsa('.pm-modal-backdrop, .modal, [role="dialog"]').forEach(function(m) {
            closeModalEl(m);
          });
        };
      }
    });
  }

  // Initialize upon DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      bindSidebar();
      bindPageHandlers();
      bindUserMenu();
      bindModalHandlers();
    });
  } else {
    bindSidebar();
    bindPageHandlers();
    bindUserMenu();
    bindModalHandlers();
  }
})();

