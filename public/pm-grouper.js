/**
 * SPPG PM Grouper Module (public/pm-grouper.js)
 * ============================================================================
 * Modul Universal Pengelompokan & Filter Penerima Manfaat (KPM - Posyandu & Sekolah)
 * 
 * Fitur Modular:
 * 1. Isolasi Murni Kategori: Saat Balita diklik, HANYA data Balita yang muncul (100% Porsi Kecil).
 *    Begitu pula untuk Bumil (Porsi Besar) dan Busui (Porsi Besar).
 * 2. Navigasi Sub-Kelompok Interaktif (0-5 Bln Bayi, 6-23 Bln Baduta, 24-59 Bln Balita, Trimester Bumil, Masa Menyusui).
 * 3. Penomoran Ulang Otomatis (Re-indexing 1, 2, 3...) pada setiap filter aktif.
 * 4. Sinkronisasi URL (?cat=BALITA) & Riwayat tanpa reload halaman.
 * 5. Multi-Surface Support: Bekerja otomatis pada:
 *    - Halaman Detail KPM (/kpm/:id)
 *    - Halaman Preview Portal KPM (/portal/kpm/preview/:id)
 *    - Halaman Portal Mandiri KPM (/portal/kpm/:token)
 *    - Modal Cepat Master KPM (/kpm)
 * 6. Fitur Cetak Lembar Pemorsian & Ekspor CSV Khusus per Kelompok Aktif.
 * 7. Live Notification Badge Counter untuk Pimpinan (Pusat Komando & Persetujuan).
 * ============================================================================
 */
(function(window, document) {
  'use strict';

  // Injeksi CSS Modular khusus Grouper & Lembar Cetak agar tampilan konsisten & tertata
  function injectGrouperStyles() {
    if (document.getElementById('pm-grouper-styles')) return;
    var style = document.createElement('style');
    style.id = 'pm-grouper-styles';
    style.textContent = [
      '/* PM Grouper Cluster Bar & Interactive Chips */',
      '.pm-show-cluster-bar, .pm-posyandu-cluster-bar {',
      '  margin: 16px 0 14px;',
      '  padding: 14px 16px;',
      '  background: #ffffff;',
      '  border: 1px solid #d9e5ec;',
      '  border-left: 5px solid #007a5e;',
      '  border-radius: 12px;',
      '  box-shadow: 0 4px 16px rgba(15, 35, 55, 0.05);',
      '}',
      '.pm-show-cluster-head, .pm-cluster-header {',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: space-between;',
      '  flex-wrap: wrap;',
      '  gap: 12px;',
      '  margin-bottom: 12px;',
      '}',
      '.pm-show-cluster-title, .pm-cluster-title {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 8px;',
      '  font-size: 15px;',
      '  font-weight: 800;',
      '  color: #0b2d61;',
      '}',
      '.pm-show-cluster-title svg, .pm-cluster-title svg {',
      '  color: #007a5e;',
      '  flex-shrink: 0;',
      '}',
      '.pm-show-cluster-metrics, .pm-cluster-metrics {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 8px;',
      '  flex-wrap: wrap;',
      '}',
      '.pm-cluster-tools {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 8px;',
      '  flex-wrap: wrap;',
      '}',
      '.pm-tool-btn {',
      '  display: inline-flex;',
      '  align-items: center;',
      '  gap: 6px;',
      '  padding: 5px 11px;',
      '  border-radius: 8px;',
      '  background: #ffffff;',
      '  border: 1px solid #cbd5e1;',
      '  color: #1e293b;',
      '  font-size: 11px;',
      '  font-weight: 700;',
      '  cursor: pointer;',
      '  transition: all 0.15s ease;',
      '}',
      '.pm-tool-btn:hover {',
      '  background: #f8fafc;',
      '  border-color: #007a5e;',
      '  color: #007a5e;',
      '}',
      '.pm-tool-btn svg {',
      '  width: 13px;',
      '  height: 13px;',
      '  color: #007a5e;',
      '}',
      '.pm-show-badge, .pm-cluster-badge {',
      '  display: inline-flex;',
      '  align-items: center;',
      '  gap: 5px;',
      '  padding: 5px 10px;',
      '  border-radius: 999px;',
      '  background: #ecfdf5;',
      '  border: 1px solid #a7f3d0;',
      '  color: #065f46;',
      '  font-size: 11.5px;',
      '  font-weight: 700;',
      '}',
      '.pm-show-badge.amber, .pm-cluster-badge.amber {',
      '  background: #fffbeb;',
      '  border-color: #fde68a;',
      '  color: #92400e;',
      '}',
      '.pm-show-badge.blue, .pm-cluster-badge.blue {',
      '  background: #eff6ff;',
      '  border-color: #bfdbfe;',
      '  color: #1e40af;',
      '}',
      '.pm-show-subnav, .pm-cluster-subnav {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 8px;',
      '  flex-wrap: wrap;',
      '  padding-top: 10px;',
      '  border-top: 1px dashed #e2e8f0;',
      '}',
      '.pm-show-subbtn, .pm-subcat-btn {',
      '  display: inline-flex;',
      '  align-items: center;',
      '  gap: 6px;',
      '  padding: 7px 12px;',
      '  border: 1px solid #cbd5e1;',
      '  border-radius: 999px;',
      '  background: #f8fafc;',
      '  color: #334155;',
      '  font-size: 12px;',
      '  font-weight: 600;',
      '  cursor: pointer;',
      '  transition: all 0.15s ease-in-out;',
      '}',
      '.pm-show-subbtn:hover, .pm-subcat-btn:hover {',
      '  background: #f1f5f9;',
      '  border-color: #94a3b8;',
      '  color: #0f172a;',
      '}',
      '.pm-show-subbtn.active, .pm-subcat-btn.active {',
      '  background: #007a5e !important;',
      '  border-color: #007a5e !important;',
      '  color: #ffffff !important;',
      '  font-weight: 800 !important;',
      '  box-shadow: 0 2px 8px rgba(0, 122, 94, 0.35);',
      '}',
      '.pm-subcat-count {',
      '  display: inline-flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  min-width: 18px;',
      '  height: 18px;',
      '  padding: 0 5px;',
      '  border-radius: 999px;',
      '  background: rgba(0,0,0,0.08);',
      '  font-size: 10px;',
      '  font-weight: 800;',
      '}',
      '.pm-show-subbtn.active .pm-subcat-count, .pm-subcat-btn.active .pm-subcat-count {',
      '  background: rgba(255, 255, 255, 0.25);',
      '  color: #ffffff;',
      '}',
      '/* Active Highlight for Category Tabs */',
      '.show-pm-tab.active-cat, .pm-tab-btn.active {',
      '  background: #007a5e !important;',
      '  color: #ffffff !important;',
      '  border-color: #007a5e !important;',
      '  font-weight: 800 !important;',
      '  box-shadow: 0 2px 8px rgba(0, 122, 94, 0.3);',
      '}',
      '.kpm-rekap-interactive {',
      '  transition: transform 0.12s ease, background 0.12s ease;',
      '  border-radius: 8px;',
      '  padding: 6px 8px;',
      '  margin: -2px -4px;',
      '}',
      '.kpm-rekap-interactive:hover {',
      '  background: #f0fdf4;',
      '  transform: translateX(3px);',
      '}',
      '.kpm-stat {',
      '  transition: all 0.15s ease;',
      '}',
      '.kpm-stat:hover {',
      '  border-color: #007a5e;',
      '  box-shadow: 0 4px 12px rgba(0,122,94,0.12);',
      '  transform: translateY(-2px);',
      '}',
      '/* Print Sheet Styling (Isolated strictly to PM Sheet Mode) */',
      '@media print {',
      '  body.is-printing-pm-sheet * { visibility: hidden !important; }',
      '  body.is-printing-pm-sheet #pm-print-wrapper, body.is-printing-pm-sheet #pm-print-wrapper * { visibility: visible !important; }',
      '  body.is-printing-pm-sheet #pm-print-wrapper { position: absolute; left: 0; top: 0; width: 100%; padding: 20px; background: #fff; }',
      '}'
    ].join('\n');
    document.head.appendChild(style);
  }

  var PMGrouper = {
    currentCat: 'ALL',
    currentSubCat: 'ALL',
    currentSearch: '',
    currentStatus: 'ALL',
    isPosyandu: true,

    posyanduConfigs: {
      BALITA: {
        title: 'Daftar Balita Posyandu · 100% Standar Porsi Kecil',
        portionText: 'Porsi Kecil 100%',
        badgeClass: 'info',
        emptyNotice: 'Tidak ada data penerima manfaat kelompok Balita di Posyandu ini.',
        subgroups: [
          { key: 'ALL', label: 'Semua Balita', match: [] },
          { key: '0-5', label: '0–5 Bulan (Bayi)', match: ['0-5', '0–5', '0 - 5', 'bayi', '0 bln', '1 bln', '2 bln', '3 bln', '4 bln', '5 bln'] },
          { key: '6-23', label: '6–23 Bulan (Baduta)', match: ['6-23', '6–23', '6 - 23', 'baduta', '6 bln', '12 bln', '18 bln'] },
          { key: '24-59', label: '24–59 Bulan (Balita)', match: ['24-59', '24–59', '24 - 59', 'balita', '2 thn', '3 thn', '4 thn', '5 thn'] }
        ]
      },
      BUMIL: {
        title: 'Daftar Ibu Hamil (Bumil) · 100% Standar Porsi Besar',
        portionText: 'Porsi Besar 100%',
        badgeClass: 'amber',
        emptyNotice: 'Tidak ada data penerima manfaat kelompok Ibu Hamil di Posyandu ini.',
        subgroups: [
          { key: 'ALL', label: 'Semua Bumil', match: [] },
          { key: 'trimester 1', label: 'Trimester 1 (1–12 Minggu)', match: ['trimester 1', 'tm 1', 'tm1', 'trimester i'] },
          { key: 'trimester 2', label: 'Trimester 2 (13–27 Minggu)', match: ['trimester 2', 'tm 2', 'tm2', 'trimester ii'] },
          { key: 'trimester 3', label: 'Trimester 3 (28–40 Minggu)', match: ['trimester 3', 'tm 3', 'tm3', 'trimester iii'] },
          { key: 'kek', label: 'Risiko Tinggi / KEK / Anemia', match: ['kek', 'anemia', 'risiko', 'risti'] }
        ]
      },
      BUSUI: {
        title: 'Daftar Ibu Menyusui (Busui) · 100% Standar Porsi Besar',
        portionText: 'Porsi Besar 100%',
        badgeClass: 'blue',
        emptyNotice: 'Tidak ada data penerima manfaat kelompok Ibu Menyusui di Posyandu ini.',
        subgroups: [
          { key: 'ALL', label: 'Semua Busui', match: [] },
          { key: '0-6', label: 'Bayi 0–6 Bulan (ASI Eksklusif)', match: ['0-6', '0–6', '0 - 6', 'asi eksklusif', 'bayi 0'] },
          { key: '7-12', label: 'Bayi 7–12 Bulan', match: ['7-12', '7–12', '7 - 12', 'bayi 7'] },
          { key: '13-24', label: 'Bayi >12 Bulan', match: ['13-24', '13–24', '>12', '12+'] }
        ]
      },
      PESERTA_DIDIK: {
        title: 'Daftar Peserta Didik (Siswa / Siswi)',
        portionText: 'Porsi Siswa',
        badgeClass: 'primary',
        emptyNotice: 'Tidak ada data Peserta Didik pada kelompok ini.',
        subgroups: [
          { key: 'ALL', label: 'Semua Peserta Didik', match: [] },
          { key: 'porsi-kecil', label: 'Porsi Kecil (Kelas 1–3)', match: ['kelas 1', 'kelas 2', 'kelas 3', 'paud', 'tk'] },
          { key: 'porsi-besar', label: 'Porsi Besar (Kelas 4–6 / SMP / SMA)', match: ['kelas 4', 'kelas 5', 'kelas 6', 'smp', 'sma', 'smk'] }
        ]
      },
      PENDIDIK: {
        title: 'Daftar Pendidik (Guru / Ustadz)',
        portionText: 'Porsi Besar 100%',
        badgeClass: 'primary',
        emptyNotice: 'Tidak ada data Pendidik pada kelompok ini.',
        subgroups: [
          { key: 'ALL', label: 'Semua Pendidik', match: [] }
        ]
      },
      TENAGA_KEPENDIDIKAN: {
        title: 'Daftar Tenaga Kependidikan (Tendik)',
        portionText: 'Porsi Besar 100%',
        badgeClass: 'primary',
        emptyNotice: 'Tidak ada data Tenaga Kependidikan pada kelompok ini.',
        subgroups: [
          { key: 'ALL', label: 'Semua Tendik', match: [] }
        ]
      }
    },

    matchesSubgroup: function(subcatStr, subgroupItem) {
      if (!subgroupItem || subgroupItem.key === 'ALL') return true;
      if (!subcatStr) return false;
      var str = String(subcatStr).toLowerCase().replace(/–/g, '-');
      var key = String(subgroupItem.key).toLowerCase().replace(/–/g, '-');
      if (str.indexOf(key) !== -1) return true;
      if (Array.isArray(subgroupItem.match)) {
        for (var i = 0; i < subgroupItem.match.length; i++) {
          var m = subgroupItem.match[i].toLowerCase().replace(/–/g, '-');
          if (str.indexOf(m) !== -1) return true;
        }
      }
      return false;
    },

    init: function() {
      var self = this;
      if (self._initialized) return;
      self._initialized = true;

      injectGrouperStyles();

      // Inisialisasi Counter Notifikasi Eksekutif jika ada tombol pimpinan
      self.initPendingCounter();

      // Deteksi apakah konteks halaman memiliki tabel/data PM (show, portal, manajemen PM)
      var clusterBar = document.getElementById('showClusterBar') || document.getElementById('pmPosyanduClusterBar');
      var typeBadge = document.querySelector('.kpm-type') || document.querySelector('.posyandu-card-section') || document.querySelector('.posyandu-card-body');
      var typeText = typeBadge ? (typeBadge.textContent || '').toUpperCase() : '';
      var hasPmRows = document.querySelector('.show-pm-row, .pm-row, [data-pm-row], #showPmTable, #pmTable, .pm-management-container');

      if (!clusterBar && !hasPmRows && typeText.indexOf('POSYANDU') === -1) {
        // Halaman umum (Dashboard, Staf, Riwayat, Settings, dll) tidak perlu logika filter tabel PM
        return;
      }

      self.isPosyandu = !!(clusterBar || typeText.indexOf('POSYANDU') !== -1 || document.querySelector('[data-cat="BALITA"], [data-showcat="BALITA"]'));

      // 1. Baca query params (?cat=BALITA)
      try {
        var params = new URLSearchParams(window.location.search);
        var qCat = params.get('cat');
        if (qCat) {
          self.currentCat = qCat.toUpperCase();
        }
      } catch (e) {}

      // 2. Hubungkan delegasi klik universal HANYA untuk tombol tab/filter kategori resmi
      document.addEventListener('click', function(e) {
        // Jangan tangkap jika klik terjadi di dalam kolom aksi, tombol aksi, modal, form, atau sel tabel
        if (e.target.closest('.pm-action-group, .pm-btn, .pm-modal-card, .pm-modal-backdrop, td, th, form')) {
          return;
        }

        var btn = e.target.closest('.show-pm-tab, .pm-tab-btn, .kpm-rekap-interactive, button[data-showcat], button[data-pm-cat]');
        if (!btn) return;

        // Jangan tangkap jika ini adalah baris tabel (TR), sub-filter pill, atau tool cetak
        if (btn.tagName === 'TR' || btn.matches('.pm-show-subbtn, .pm-subcat-btn, [data-sub], .pm-tool-btn')) {
          return;
        }

        var cat = btn.getAttribute('data-showcat') || 
                  btn.getAttribute('data-pm-cat') || 
                  btn.getAttribute('data-cat');

        if (!cat && btn.classList.contains('kpm-rekap-interactive')) {
          var t = btn.textContent.toUpperCase();
          if (t.indexOf('BALITA') !== -1) cat = 'BALITA';
          else if (t.indexOf('BUMIL') !== -1) cat = 'BUMIL';
          else if (t.indexOf('BUSUI') !== -1) cat = 'BUSUI';
          else if (t.indexOf('PESERTA') !== -1) cat = 'PESERTA_DIDIK';
          else if (t.indexOf('PENDIDIK') !== -1) cat = 'PENDIDIK';
          else if (t.indexOf('TENDIK') !== -1) cat = 'TENAGA_KEPENDIDIKAN';
          else if (t.indexOf('SEMUA') !== -1 || t.indexOf('TOTAL') !== -1) cat = 'ALL';
        }

        if (cat) {
          e.preventDefault();
          self.filter(cat.toUpperCase(), 'ALL');
        }
      });

      // 3. Hubungkan input pencarian jika ada di DOM
      var searchInputs = document.querySelectorAll('#pmSearchInput, #showPmSearchInput, .pm-search-input, .pm-filter-search');
      searchInputs.forEach(function(inp) {
        inp.addEventListener('input', function() {
          self.currentSearch = (inp.value || '').toLowerCase().trim();
          self.applyFilter();
        });
      });

      // 4. Hubungkan dropdown filter status jika ada
      var statusSelects = document.querySelectorAll('#pmStatusSelect, .pm-select-status');
      statusSelects.forEach(function(sel) {
        sel.addEventListener('change', function() {
          self.currentStatus = sel.value || 'ALL';
          self.renderClusterBar();
          self.applyFilter();
        });
      });

      // Jalankan render awal
      self.renderTabs();
      self.renderClusterBar();
      self.applyFilter();
    },

    initPendingCounter: function() {
      var badges = document.querySelectorAll('.executive-pending-badge');
      if (!badges.length) return;

      fetch('/executive/pending-count')
        .then(function(r) {
          if (!r.ok) return null;
          var ct = r.headers.get('content-type') || '';
          if (ct.indexOf('application/json') === -1) return null;
          return r.json();
        })
        .then(function(data) {
          if (data && data.success && Number(data.count) > 0) {
            badges.forEach(function(b) {
              b.textContent = data.count;
              b.style.display = 'inline-flex';
              b.title = data.count + ' permohonan perubahan data memerlukan otorisasi persetujuan Anda';
            });
          } else {
            badges.forEach(function(b) {
              b.style.display = 'none';
            });
          }
        })
        .catch(function() {});
    },

    filter: function(cat, subcat) {
      this.currentCat = (cat || 'ALL').toUpperCase();
      this.currentSubCat = (subcat || 'ALL');

      // Update URL query string secara mulus tanpa merefresh halaman
      try {
        var url = new URL(window.location.href);
        if (this.currentCat !== 'ALL') {
          url.searchParams.set('cat', this.currentCat);
        } else {
          url.searchParams.delete('cat');
        }
        window.history.replaceState({}, '', url.toString());
      } catch (e) {}

      this.renderTabs();
      this.renderClusterBar();
      this.applyFilter();

      // Scroll halus ke arah tabel jika user memilih grup spesifik
      if (this.currentCat !== 'ALL') {
        var anchor = document.getElementById('showClusterBar') || 
                     document.getElementById('pmPosyanduClusterBar') ||
                     document.getElementById('pmDetailSection') || 
                     document.getElementById('pm-management-section') ||
                     document.getElementById('showPmTable') || 
                     document.getElementById('pmDataTable');
        if (anchor) {
          try {
            anchor.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          } catch(e) {}
        }
      }

      // Dispatch custom event untuk modul lain jika ingin subscribe
      try {
        var evt = new CustomEvent('pm:filter:changed', { detail: { category: this.currentCat, subgroup: this.currentSubCat } });
        window.dispatchEvent(evt);
      } catch(e) {}
    },

    renderTabs: function() {
      var self = this;
      var cat = self.currentCat;

      // 1. Update tombol di views/kpm/show.ejs (.show-pm-tab)
      var showTabs = document.querySelectorAll('.show-pm-tab');
      showTabs.forEach(function(t) {
        var c = (t.getAttribute('data-showcat') || t.getAttribute('data-cat') || '').toUpperCase();
        if (c === cat) {
          t.classList.remove('gray');
          t.classList.add('primary', 'active-cat');
          t.style.fontWeight = '800';
          t.style.boxShadow = '0 2px 8px rgba(0, 122, 94, 0.35)';
        } else {
          t.classList.remove('primary', 'active-cat');
          t.classList.add('gray');
          t.style.fontWeight = '600';
          t.style.boxShadow = 'none';
        }
      });

      // 2. Update tombol di views/kpm/pm-management.ejs (.pm-tab-btn)
      var catTabs = document.querySelectorAll('.pm-tab-btn');
      catTabs.forEach(function(t) {
        var c = (t.getAttribute('data-cat') || '').toUpperCase();
        if (c === cat) {
          t.classList.add('active');
        } else {
          t.classList.remove('active');
        }
      });
    },

    renderClusterBar: function() {
      var self = this;
      var titleEl = document.getElementById('showClusterTitle') || document.getElementById('pmClusterCategoryTitle');
      var metricsEl = document.getElementById('showClusterMetrics') || document.getElementById('pmClusterMetrics');
      var subNavEl = document.getElementById('showClusterSubNav') || document.getElementById('pmClusterSubNav');
      var colHeaderEl = document.getElementById('showColSubgroup') || document.getElementById('pmGroupHeaderCol');

      if (!titleEl && !metricsEl && !subNavEl) return;

      var rows = document.querySelectorAll('.show-pm-row, .pm-row');

      // KASUS 1: TAMPILKAN SEMUA (ALL)
      if (self.currentCat === 'ALL') {
        if (titleEl) {
          titleEl.textContent = self.isPosyandu ? 'Seluruh Penerima Manfaat Posyandu Terpadu' : 'Seluruh Penerima Manfaat Terdaftar';
        }
        if (colHeaderEl) {
          colHeaderEl.textContent = self.isPosyandu ? 'Sub-Kelompok' : 'Kelas / Jabatan';
        }

        // Hitung total per kategori
        var bCnt = 0, mCnt = 0, sCnt = 0;
        rows.forEach(function(r) {
          var c = (r.getAttribute('data-cat') || '').toUpperCase();
          if (c === 'BALITA') bCnt++;
          else if (c === 'BUMIL') mCnt++;
          else if (c === 'BUSUI') sCnt++;
        });

        var totalCount = rows.length;
        var smallCount = bCnt;
        var largeCount = mCnt + sCnt;

        if (metricsEl) {
          metricsEl.innerHTML = 
            '<span class="pm-show-badge pm-cluster-badge" style="background:#f1f5f9;color:#334155;border-color:#cbd5e1;font-weight:700">Total: ' + totalCount + ' PM</span>' +
            '<span class="pm-show-badge pm-cluster-badge" style="background:#ecfdf5;color:#065f46;border-color:#a7f3d0;font-weight:700">Porsi Kecil: ' + smallCount + '</span>' +
            '<span class="pm-show-badge pm-cluster-badge amber" style="font-weight:700">Porsi Besar: ' + largeCount + '</span>' +
            '<div class="pm-cluster-tools">' +
              '<button type="button" class="pm-tool-btn" onclick="window.PMGrouper.printCurrentGroup()" title="Cetak Lembar Kendali"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> Cetak</button>' +
              '<button type="button" class="pm-tool-btn" onclick="window.PMGrouper.exportCurrentGroupCsv()" title="Unduh CSV Kelompok"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Unduh CSV</button>' +
            '</div>';
        }

        // Hilangkan baris sub-filter duplikat saat status Semua aktif (karena kategori sudah ada di toolbar atas)
        if (subNavEl) {
          subNavEl.innerHTML = '';
          subNavEl.style.display = 'none';
        }
        return;
      }

      // KASUS 2: KELOMPOK SPESIFIK (BALITA, BUMIL, BUSUI, DLL)
      var cfg = self.posyanduConfigs[self.currentCat] || {
        title: 'Kelompok ' + self.currentCat.replace(/_/g, ' '),
        portionText: 'Standar',
        subgroups: [{ key: 'ALL', label: 'Semua' }]
      };

      if (titleEl) {
        titleEl.textContent = cfg.title;
      }
      if (colHeaderEl) {
        colHeaderEl.textContent = self.isPosyandu ? 'Sub-Kelompok' : 'Kelas / Jabatan';
      }

      // Hitung sub-kategori
      var totalInCat = 0, maleCount = 0, femaleCount = 0;
      var subCounts = { ALL: 0 };
      if (Array.isArray(cfg.subgroups)) {
        cfg.subgroups.forEach(function(sg) { subCounts[sg.key] = 0; });
      }

      rows.forEach(function(r) {
        var rCat = (r.getAttribute('data-cat') || '').toUpperCase();
        if (rCat !== self.currentCat) return;

        totalInCat++;
        subCounts.ALL++;
        var g = (r.getAttribute('data-gender') || '').toUpperCase();
        if (g === 'L') maleCount++;
        else if (g === 'P') femaleCount++;

        var sc = (r.getAttribute('data-subcat') || '').toLowerCase();
        if (Array.isArray(cfg.subgroups)) {
          cfg.subgroups.forEach(function(sg) {
            if (sg.key !== 'ALL' && self.matchesSubgroup(sc, sg)) {
              subCounts[sg.key]++;
            }
          });
        }
      });

      if (metricsEl) {
        var metricsHtml = '';
        if (self.currentCat === 'BALITA') {
          metricsHtml = 
            '<span class="pm-show-badge pm-cluster-badge" style="background:#e8f7ef;color:#065f46;border:1px solid #a7f3d0;font-weight:800">' +
              'Total Balita: ' + totalInCat + ' Anak · Porsi Kecil (100%)' +
            '</span>' +
            '<span class="pm-show-badge pm-cluster-badge blue">L: ' + maleCount + '</span>' +
            '<span class="pm-show-badge pm-cluster-badge amber">P: ' + femaleCount + '</span>';
        } else if (self.currentCat === 'BUMIL') {
          metricsHtml = 
            '<span class="pm-show-badge pm-cluster-badge amber" style="font-weight:800">' +
              'Total Ibu Hamil: ' + totalInCat + ' Orang · Porsi Besar (100%)' +
            '</span>';
        } else if (self.currentCat === 'BUSUI') {
          metricsHtml = 
            '<span class="pm-show-badge pm-cluster-badge blue" style="font-weight:800">' +
              'Total Ibu Menyusui: ' + totalInCat + ' Orang · Porsi Besar (100%)' +
            '</span>';
        } else {
          metricsHtml = 
            '<span class="pm-show-badge pm-cluster-badge">' +
              'Total: ' + totalInCat + ' Orang' + (maleCount || femaleCount ? ' (L: ' + maleCount + ' · P: ' + femaleCount + ')' : '') +
            '</span>';
        }

        metricsEl.innerHTML = metricsHtml + 
          '<div class="pm-cluster-tools">' +
            '<button type="button" class="pm-tool-btn" onclick="window.PMGrouper.printCurrentGroup()" title="Cetak Lembar Kendali Kelompok"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> Cetak Lembar</button>' +
            '<button type="button" class="pm-tool-btn" onclick="window.PMGrouper.exportCurrentGroupCsv()" title="Unduh CSV Kelompok"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Unduh CSV</button>' +
          '</div>';
      }

      if (subNavEl && Array.isArray(cfg.subgroups) && cfg.subgroups.length > 1) {
        subNavEl.style.display = 'flex';
        var html = '<button type="button" class="pm-show-subbtn pm-subcat-btn" style="background:#f1f5f9;color:#475569" onclick="window.PMGrouper.filter(\'ALL\',\'ALL\')">← Tampilkan Semua</button>';
        cfg.subgroups.forEach(function(sg) {
          var isAct = self.currentSubCat === sg.key;
          var cnt = subCounts[sg.key] !== undefined ? subCounts[sg.key] : 0;
          html += '<button type="button" class="pm-show-subbtn pm-subcat-btn ' + (isAct ? 'active' : '') + '" data-sub="' + sg.key + '">' +
                    '<span>' + sg.label + '</span>' +
                    '<span class="subcount pm-subcat-count">' + cnt + '</span>' +
                  '</button>';
        });
        subNavEl.innerHTML = html;

        subNavEl.querySelectorAll('[data-sub]').forEach(function(btn) {
          btn.addEventListener('click', function(ev) {
            ev.preventDefault();
            var subKey = btn.getAttribute('data-sub') || 'ALL';
            self.currentSubCat = subKey;
            subNavEl.querySelectorAll('[data-sub]').forEach(function(b) { b.classList.remove('active'); });
            btn.classList.add('active');
            self.applyFilter();
          });
        });
      }
    },

    applyFilter: function() {
      var self = this;
      var rows = document.querySelectorAll('.show-pm-row, .pm-row');
      var emptyEl = document.getElementById('showPmEmpty') || document.getElementById('pmEmptyRow');
      var visibleCount = 0;

      var currentCat = self.currentCat;
      var currentSubCat = self.currentSubCat;
      var currentSearch = self.currentSearch;
      var currentStatus = self.currentStatus;

      var cfg = self.posyanduConfigs[currentCat];
      var targetSubgroupItem = null;
      if (cfg && Array.isArray(cfg.subgroups)) {
        for (var i = 0; i < cfg.subgroups.length; i++) {
          if (cfg.subgroups[i].key === currentSubCat) {
            targetSubgroupItem = cfg.subgroups[i];
            break;
          }
        }
      }

      rows.forEach(function(row) {
        var rCat = (row.getAttribute('data-cat') || '').toUpperCase();
        var rSubCat = (row.getAttribute('data-subcat') || '').toLowerCase();
        var rStatus = row.getAttribute('data-status') || '';
        var rSearch = (row.getAttribute('data-search') || row.textContent || '').toLowerCase();

        // 1. Kategori Matching (Isolasi Murni)
        var matchCat = (currentCat === 'ALL') || (rCat === currentCat);

        // 2. Sub-kategori Matching
        var matchSub = true;
        if (matchCat && currentCat !== 'ALL' && currentSubCat !== 'ALL') {
          matchSub = self.matchesSubgroup(rSubCat, targetSubgroupItem);
        }

        // 3. Pencarian Teks (Search)
        var matchSearch = !currentSearch || (rSearch.indexOf(currentSearch) !== -1);

        // 4. Status Filter (Hanya jika dropdown status ada)
        var matchStatus = true;
        if (currentStatus !== 'ALL') {
          matchStatus = (rStatus === currentStatus);
        }

        if (matchCat && matchSub && matchSearch && matchStatus) {
          row.style.display = '';
          visibleCount++;
          // Renumber urutan nomor baris agar selalu 1, 2, 3...
          var noCell = row.querySelector('.show-row-no, .pm-row-index');
          if (noCell) noCell.textContent = visibleCount;
        } else {
          row.style.display = 'none';
        }
      });

      if (emptyEl) {
        if (visibleCount === 0) {
          emptyEl.style.display = '';
          var noticeText = (cfg && cfg.emptyNotice) ? cfg.emptyNotice : 'Tidak ada data penerima manfaat pada kelompok ini.';
          var emptyP = emptyEl.querySelector('p, strong');
          if (emptyP) emptyP.textContent = noticeText;
        } else {
          emptyEl.style.display = 'none';
        }
      }
    },

    getVisibleData: function() {
      var rows = document.querySelectorAll('.show-pm-row, .pm-row');
      var list = [];
      rows.forEach(function(row) {
        if (row.style.display === 'none') return;
        var no = (row.querySelector('.show-row-no, .pm-row-index') || {}).textContent || '';
        var nameEl = row.querySelector('.pm-fullname, td:nth-child(2) strong') || row.querySelector('td:nth-child(2)');
        var name = (nameEl ? nameEl.textContent : '').trim();
        var nikEl = row.querySelector('.pm-nik-code, td:nth-child(3)');
        var nik = (nikEl ? nikEl.textContent : '').trim();
        var gender = (row.getAttribute('data-gender') || '').toUpperCase();
        var cat = (row.getAttribute('data-cat') || '').toUpperCase();
        var subcat = (row.getAttribute('data-subcat') || '').trim();
        var isSmall = (cat === 'BALITA' || (cat === 'PESERTA_DIDIK' && /^(1|2|3)(\D|$)/i.test(subcat)));
        var porsi = isSmall ? 'Porsi Kecil' : 'Porsi Besar';

        list.push({ no: no, name: name, nik: nik, gender: gender, category: cat, subcat: subcat, porsi: porsi });
      });
      return list;
    },

    printCurrentGroup: function() {
      var self = this;
      var data = self.getVisibleData();
      var kpmTitleEl = document.querySelector('h1, h2, .kpm-form-head h2, .pm-management-head h2');
      var kpmName = kpmTitleEl ? kpmTitleEl.textContent.trim().split('\n')[0] : 'SPPG Subang Pusakajaya';
      var catTitle = self.posyanduConfigs[self.currentCat] ? self.posyanduConfigs[self.currentCat].title : 'Seluruh Penerima Manfaat';
      var today = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

      var oldPrintWrapper = document.getElementById('pm-print-wrapper');
      if (oldPrintWrapper) oldPrintWrapper.remove();

      var printDiv = document.createElement('div');
      printDiv.id = 'pm-print-wrapper';
      printDiv.innerHTML = [
        '<div style="text-align:center;border-bottom:2px solid #007a5e;padding-bottom:12px;margin-bottom:16px">',
        '  <h2 style="margin:0;color:#0b2d61;font-size:18px;text-transform:uppercase">BADAN GIZI NASIONAL · SATUAN PELAYANAN PEMENUHAN GIZI</h2>',
        '  <h3 style="margin:4px 0;color:#007a5e;font-size:15px">' + kpmName + '</h3>',
        '  <p style="margin:2px 0 0;font-size:12px;color:#475569">Lembar Kendali Penerima Manfaat & Pemorsian Distribusi Makanan Bergizi</p>',
        '</div>',
        '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:12px;font-weight:600;color:#334155">',
        '  <div>Kelompok: <span style="color:#007a5e">' + catTitle + '</span></div>',
        '  <div>Tanggal Cetak: ' + today + '</div>',
        '  <div>Total PM: ' + data.length + ' Orang</div>',
        '</div>',
        '<table style="width:100%;border-collapse:collapse;font-size:11.5px;margin-bottom:24px">',
        '  <thead>',
        '    <tr style="background:#f1f5f9;border-top:1px solid #cbd5e1;border-bottom:1px solid #cbd5e1">',
        '      <th style="padding:6px;border:1px solid #cbd5e1;width:35px;text-align:center">No</th>',
        '      <th style="padding:6px;border:1px solid #cbd5e1;text-align:left">Nama Penerima Manfaat</th>',
        '      <th style="padding:6px;border:1px solid #cbd5e1;text-align:center">NIK</th>',
        '      <th style="padding:6px;border:1px solid #cbd5e1;width:40px;text-align:center">L/P</th>',
        '      <th style="padding:6px;border:1px solid #cbd5e1;text-align:left">Tahapan / Kelompok</th>',
        '      <th style="padding:6px;border:1px solid #cbd5e1;text-align:center">Standar Porsi</th>',
        '      <th style="padding:6px;border:1px solid #cbd5e1;width:100px;text-align:center">Paraf Penerima</th>',
        '    </tr>',
        '  </thead>',
        '  <tbody>',
        data.map(function(item, idx) {
          return '<tr style="border-bottom:1px solid #e2e8f0">' +
                 '  <td style="padding:6px;border:1px solid #cbd5e1;text-align:center">' + (idx + 1) + '</td>' +
                 '  <td style="padding:6px;border:1px solid #cbd5e1"><strong>' + item.name + '</strong></td>' +
                 '  <td style="padding:6px;border:1px solid #cbd5e1;text-align:center">' + (item.nik || '-') + '</td>' +
                 '  <td style="padding:6px;border:1px solid #cbd5e1;text-align:center">' + (item.gender || '-') + '</td>' +
                 '  <td style="padding:6px;border:1px solid #cbd5e1">' + (item.subcat || '-') + '</td>' +
                 '  <td style="padding:6px;border:1px solid #cbd5e1;text-align:center;font-weight:700">' + item.porsi + '</td>' +
                 '  <td style="padding:6px;border:1px solid #cbd5e1"></td>' +
                 '</tr>';
        }).join(''),
        '  </tbody>',
        '</table>',
        '<div style="display:flex;justify-content:space-between;margin-top:24px;font-size:12px;text-align:center">',
        '  <div style="width:200px">Petugas Pemorsian SPPG<br><br><br><br>( .................................... )</div>',
        '  <div style="width:200px">Kader / Penanggung Jawab KPM<br><br><br><br>( .................................... )</div>',
        '</div>'
      ].join('\n');

      document.body.classList.add('is-printing-pm-sheet');
      document.body.appendChild(printDiv);

      var hasCleaned = false;
      function cleanupPrint() {
        if (hasCleaned) return;
        hasCleaned = true;
        document.body.classList.remove('is-printing-pm-sheet');
        if (printDiv && printDiv.parentNode) printDiv.parentNode.removeChild(printDiv);
        window.removeEventListener('afterprint', cleanupPrint);
      }

      window.addEventListener('afterprint', cleanupPrint);
      try {
        window.print();
      } catch (e) {
        console.warn('Print dialog error:', e);
      }
      setTimeout(cleanupPrint, 3500);
    },

    exportCurrentGroupCsv: function() {
      var self = this;
      var data = self.getVisibleData();
      if (!data.length) {
        alert('Tidak ada data pada kelompok yang sedang aktif untuk diunduh.');
        return;
      }
      var headers = ['No', 'Nama Lengkap', 'NIK', 'Gender', 'Kategori', 'Sub-Kelompok', 'Standar Porsi'];
      var csvRows = [headers.join(',')];

      data.forEach(function(item, idx) {
        var row = [
          idx + 1,
          '"' + (item.name || '').replace(/"/g, '""') + '"',
          '"' + (item.nik || '').replace(/"/g, '""') + '"',
          item.gender || '',
          item.category || '',
          '"' + (item.subcat || '').replace(/"/g, '""') + '"',
          item.porsi || ''
        ];
        csvRows.push(row.join(','));
      });

      var blob = new Blob([csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
      var link = document.createElement('a');
      var catSlug = (self.currentCat || 'SEMUA').toLowerCase();
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', 'Penerima-Manfaat-' + catSlug + '-' + new Date().toISOString().slice(0,10) + '.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Expose ke global window dengan alias ramah pemanggil
  window.PMGrouper = PMGrouper;
  window.filterShowPm = function(cat, subcat) {
    PMGrouper.filter(cat, subcat);
  };
  window.setPmCategory = function(cat, subcat) {
    PMGrouper.filter(cat, subcat);
  };
  window.filterPmTable = function(cat, subcat) {
    PMGrouper.filter(cat, subcat);
  };

  // Inisialisasi otomatis saat dokumen siap
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      PMGrouper.init();
    });
  } else {
    PMGrouper.init();
  }
})(window, document);
