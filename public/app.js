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

  // Initialize upon DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      bindSidebar();
      bindPageHandlers();
    });
  } else {
    bindSidebar();
    bindPageHandlers();
  }
})();
