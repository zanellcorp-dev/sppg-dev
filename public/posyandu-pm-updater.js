/**
 * posyandu-pm-updater.js
 * Modul Mandiri Pengajuan Pembaruan Data PM Posyandu (Paket Mutasi)
 * Terisolasi bersih tanpa konflik line code dengan skrip master / Leaflet.
 */

(function() {
  'use strict';

  // 1. Data Store & State
  let KPM_ID = 0;
  let STORAGE_KEY = 'SPPG_PM_PACKAGE_DRAFT_0';
  let ACTIVE_PM_MAP = {};
  let packageDraft = [];

  // Helper sanitasi teks
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // 2. Inisialisasi Data dari JSON Payload
  function initDataPayload() {
    try {
      const payloadEl = document.getElementById('posyanduPmDataPayload');
      if (payloadEl && payloadEl.textContent) {
        const parsed = JSON.parse(payloadEl.textContent);
        if (parsed.kpmId) {
          KPM_ID = parsed.kpmId;
          STORAGE_KEY = 'SPPG_PM_PACKAGE_DRAFT_' + KPM_ID;
        }
        if (Array.isArray(parsed.activePm)) {
          parsed.activePm.forEach(p => {
            if (p && p.id) {
              ACTIVE_PM_MAP[p.id] = {
                id: p.id,
                full_name: p.full_name || '',
                nik: p.nik || '',
                gender: p.gender || 'P',
                category: p.category || 'BALITA',
                class_group: p.class_group || '',
                birth_date: p.birth_date ? String(p.birth_date).slice(0, 10) : ''
              };
            }
          });
        }
      }
    } catch (e) {
      console.warn('[PosyanduUpdater] Gagal membaca data payload PM:', e);
    }
  }

  // 3. Relokasi Modal ke Body (Bebas dari Stacking Context & Overflow Parent)
  function relocateModalsToBody() {
    const modalIds = [
      'modalMutationPicker',
      'modalNewPm',
      'modalExitPm',
      'modalCorrectionPm',
      'modalCategoryChange',
      'modalPackageDetail'
    ];
    modalIds.forEach(id => {
      const el = document.getElementById(id);
      if (el && el.parentElement !== document.body) {
        document.body.appendChild(el);
      }
    });
  }

  // 4. Modal Open & Close Engine
  function openModal(id) {
    const el = document.getElementById(id);
    if (!el) {
      console.warn('[PosyanduUpdater] Modal tidak ditemukan:', id);
      return;
    }
    // Pastikan modal berada langsung di body agar selalu di layer terdepan
    if (el.parentElement !== document.body) {
      document.body.appendChild(el);
    }
    el.style.setProperty('display', 'flex', 'important');
    el.classList.add('active');
    try { document.body.style.overflow = 'hidden'; } catch (e) {}
  }

  function closeModal(id) {
    const el = document.getElementById(id);
    if (el) {
      el.style.setProperty('display', 'none', 'important');
      el.classList.remove('active');
    }
    const openModals = document.querySelectorAll('.pm-modal-backdrop.active, .pm-modal-backdrop[style*="display: flex"]');
    if (!openModals.length) {
      try { document.body.style.overflow = ''; } catch (e) {}
    }
  }

  // 5. Draft Storage & Perhitungan Proyeksi
  function loadDraft() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        packageDraft = JSON.parse(stored) || [];
      }
    } catch (e) {
      packageDraft = [];
    }
    renderDraftTable();
    updateMetrics();
  }

  function saveDraft() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(packageDraft));
    } catch (e) {}
    renderDraftTable();
    updateMetrics();
  }

  function updateMetrics() {
    const draftCount = packageDraft.length;
    const elDraftCount = document.getElementById('metricDraftCount');
    const elDraftDetail = document.getElementById('metricDraftDetail');
    const elTabDraftBadge = document.getElementById('tabDraftBadge');
    const elPill = document.getElementById('draftStatusPill');
    const elNavTabBadge = document.getElementById('badgeTabDraftCount');

    if (elDraftCount) elDraftCount.textContent = draftCount;
    if (elDraftDetail) elDraftDetail.textContent = draftCount + ' item perubahan';
    if (elTabDraftBadge) elTabDraftBadge.textContent = draftCount;

    if (elNavTabBadge) {
      if (draftCount > 0) {
        elNavTabBadge.textContent = draftCount + ' Perubahan';
        elNavTabBadge.className = 'tab-badge highlight has-items';
      } else {
        elNavTabBadge.textContent = 'Paket Baru';
        elNavTabBadge.className = 'tab-badge highlight';
      }
    }

    if (elPill) {
      if (draftCount > 0) {
        elPill.textContent = draftCount + ' Item Siap Diajukan';
        elPill.className = 'pm-draft-status-pill has-items';
      } else {
        elPill.textContent = 'Draft (0 Item)';
        elPill.className = 'pm-draft-status-pill';
      }
    }

    // Mini Counters
    const newCount = packageDraft.filter(x => x.action_type === 'PM_BARU').length;
    const exitCount = packageDraft.filter(x => x.action_type === 'PM_KELUAR').length;
    const corrCount = packageDraft.filter(x => x.action_type === 'KOREKSI').length;
    const catCount = packageDraft.filter(x => x.action_type === 'PERUBAHAN_KATEGORI').length;

    const elNew = document.getElementById('counterNewPm');
    const elExit = document.getElementById('counterExitPm');
    const elCorr = document.getElementById('counterCorrectionPm');
    const elCat = document.getElementById('counterCategoryPm');

    if (elNew) elNew.textContent = newCount;
    if (elExit) elExit.textContent = exitCount;
    if (elCorr) elCorr.textContent = corrCount;
    if (elCat) elCat.textContent = catCount;

    // Perhitungan Porsi MBG
    let smallDelta = 0;
    let largeDelta = 0;

    packageDraft.forEach(item => {
      if (item.action_type === 'PM_BARU') {
        if (item.category === 'BALITA') smallDelta += 1;
        else if (['BUMIL', 'BUSUI'].includes(item.category)) largeDelta += 1;
      } else if (item.action_type === 'PM_KELUAR') {
        if (item.category === 'BALITA') smallDelta -= 1;
        else if (['BUMIL', 'BUSUI'].includes(item.category)) largeDelta -= 1;
      } else if (item.action_type === 'PERUBAHAN_KATEGORI') {
        const fromCat = item.category;
        const toCat = item.target_category;
        if (fromCat === 'BALITA' && ['BUMIL', 'BUSUI'].includes(toCat)) {
          smallDelta -= 1;
          largeDelta += 1;
        } else if (['BUMIL', 'BUSUI'].includes(fromCat) && toCat === 'BALITA') {
          largeDelta -= 1;
          smallDelta += 1;
        }
      }
    });

    const elTotal = document.getElementById('impactTotalItems');
    const elSmall = document.getElementById('impactSmallPortion');
    const elLarge = document.getElementById('impactLargePortion');

    if (elTotal) elTotal.textContent = draftCount + ' Item';
    if (elSmall) elSmall.textContent = (smallDelta >= 0 ? '+' : '') + smallDelta + ' Balita';
    if (elLarge) elLarge.textContent = (largeDelta >= 0 ? '+' : '') + largeDelta + ' Bumil/Busui';
  }

  function renderDraftTable() {
    const tableWrap = document.getElementById('pkgItemsTableWrap');
    const emptyState = document.getElementById('pkgEmptyState');
    const subPanel = document.getElementById('pkgSubmissionPanel');
    const countNote = document.getElementById('pkgItemsCountNote');
    const tbody = document.getElementById('pkgItemsTableBody');

    if (!tbody) return;

    if (!packageDraft.length) {
      if (emptyState) emptyState.style.display = 'block';
      if (tableWrap) tableWrap.style.display = 'none';
      if (subPanel) subPanel.style.display = 'none';
      if (countNote) countNote.textContent = '0 perubahan';
      tbody.innerHTML = '';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (tableWrap) tableWrap.style.display = 'block';
    if (subPanel) subPanel.style.display = 'block';
    if (countNote) countNote.textContent = packageDraft.length + ' perubahan siap diajukan';

    let html = '';
    packageDraft.forEach((item, idx) => {
      let badgeHtml = '';
      let descHtml = '';

      if (item.action_type === 'PM_BARU') {
        badgeHtml = '<span class="pm-mut-badge pm-baru">👶 PM Baru</span>';
        descHtml = '<strong>Pendaftaran Baru</strong><br><small style="color:#64748b">' + escapeHtml(item.reason || '-') + '</small>';
      } else if (item.action_type === 'PM_KELUAR') {
        badgeHtml = '<span class="pm-mut-badge pm-keluar">🚪 PM Keluar</span>';
        descHtml = '<span style="color:#be123c">Alasan: ' + escapeHtml(item.reason || '-') + '</span>';
      } else if (item.action_type === 'KOREKSI') {
        badgeHtml = '<span class="pm-mut-badge koreksi">✏️ Koreksi</span>';
        descHtml = '<span>' + escapeHtml(item.reason || 'Perbaikan data identitas') + '</span>';
      } else if (item.action_type === 'PERUBAHAN_KATEGORI') {
        badgeHtml = '<span class="pm-mut-badge perubahan-kategori">🔄 Alih Kategori</span>';
        descHtml = '<strong>' + escapeHtml(item.category) + ' → ' + escapeHtml(item.target_category) + '</strong><br><small style="color:#64748b">' + escapeHtml(item.reason || '-') + '</small>';
      }

      html += '<tr>' +
        '<td style="text-align:center;color:#64748b;font-weight:700">' + (idx + 1) + '</td>' +
        '<td>' + badgeHtml + '</td>' +
        '<td><strong>' + escapeHtml(item.full_name) + '</strong><br><code style="font-size:11px;background:#f1f5f9;padding:1px 4px;border-radius:4px">' + escapeHtml(item.nik || '-') + '</code> · ' + escapeHtml(item.gender || '-') + '</td>' +
        '<td><span class="pm-cat-pill">' + escapeHtml(item.category) + '</span><br><small style="color:#64748b">' + escapeHtml(item.class_group || '-') + '</small></td>' +
        '<td>' + descHtml + '</td>' +
        '<td><span style="font-size:12px;color:#1e293b">' + escapeHtml(item.effective_from || '-') + '</span></td>' +
        '<td style="text-align:center">' +
          '<button type="button" class="btn danger" style="padding:4px 8px;font-size:11px" data-action="remove-draft-item" data-index="' + idx + '" onclick="window.removeDraftItem(' + idx + ')" title="Hapus dari paket">' +
            '🗑️' +
          '</button>' +
        '</td>' +
      '</tr>';
    });

    tbody.innerHTML = html;
  }

  // 6. Action Handlers (Form Submits)
  function handleAddNewPmSubmit(e) {
    if (e) e.preventDefault();
    const cat = document.querySelector('input[name="newpm_category"]:checked')?.value || 'BALITA';
    const name = document.getElementById('newpm_name')?.value.trim();
    const nik = document.getElementById('newpm_nik')?.value.trim();
    const gender = document.getElementById('newpm_gender')?.value || 'P';
    const birth = document.getElementById('newpm_birth')?.value;
    const subgroup = document.getElementById('newpm_subgroup')?.value;
    const reason = document.getElementById('newpm_reason')?.value.trim();
    const eff = document.getElementById('newpm_effective')?.value || new Date().toISOString().slice(0, 10);

    if (!name) return alert('Nama lengkap wajib diisi.');

    packageDraft.push({
      action_type: 'PM_BARU',
      pm_id: null,
      full_name: name,
      nik: nik || null,
      gender: gender,
      category: cat,
      class_group: subgroup,
      birth_date: birth || null,
      reason: reason || 'Penerima baru terdaftar',
      effective_from: eff
    });

    saveDraft();
    closeModal('modalNewPm');
    const form = e && e.target ? e.target : document.querySelector('#modalNewPm form');
    if (form) form.reset();
  }

  function handleAddExitPmSubmit(e) {
    if (e) e.preventDefault();
    const checkedRadio = document.querySelector('input[name="selected_exit_pm_id"]:checked');
    if (!checkedRadio) return alert('Pilih penerima manfaat yang akan dikeluarkan.');

    const pmId = checkedRadio.value;
    const row = checkedRadio.closest('.pm-db-picker-row');
    const name = row ? (row.querySelector('.pm-db-row-content strong')?.textContent || '-') : '-';
    const cat = (row && row.dataset.cat) ? row.dataset.cat : 'BALITA';
    const reason = document.getElementById('exit_reason')?.value;
    const eff = document.getElementById('exit_effective')?.value || new Date().toISOString().slice(0, 10);
    const customNote = document.getElementById('exit_custom_note')?.value.trim();

    if (!reason) return alert('Pilih alasan PM keluar.');

    const fullReason = reason + (customNote ? ' — ' + customNote : '');

    if (packageDraft.some(x => x.pm_id == pmId && x.action_type === 'PM_KELUAR')) {
      return alert('PM ini sudah ada dalam daftar PM keluar di paket saat ini.');
    }

    packageDraft.push({
      action_type: 'PM_KELUAR',
      pm_id: Number(pmId),
      full_name: name,
      category: cat,
      reason: fullReason,
      effective_from: eff
    });

    saveDraft();
    closeModal('modalExitPm');
    const form = e && e.target ? e.target : document.querySelector('#modalExitPm form');
    if (form) form.reset();
    const prev = document.getElementById('exitSelectedPreview');
    if (prev) prev.style.display = 'none';
  }

  function handleAddCorrectionSubmit(e) {
    if (e) e.preventDefault();
    const pmId = document.getElementById('corr_pm_id')?.value;
    const name = document.getElementById('corr_name')?.value.trim();
    const nik = document.getElementById('corr_nik')?.value.trim();
    const gender = document.getElementById('corr_gender')?.value;
    const reason = document.getElementById('corr_reason')?.value.trim();
    const eff = document.getElementById('corr_effective')?.value || new Date().toISOString().slice(0, 10);

    if (!name || !pmId) return alert('Data PM dan nama wajib valid.');

    packageDraft.push({
      action_type: 'KOREKSI',
      pm_id: Number(pmId),
      full_name: name,
      nik: nik || null,
      gender: gender,
      reason: reason || 'Koreksi data identitas',
      effective_from: eff
    });

    saveDraft();
    closeModal('modalCorrectionPm');
    const form = e && e.target ? e.target : document.querySelector('#modalCorrectionPm form');
    if (form) form.reset();
    const fields = document.getElementById('corrFormFields');
    const btn = document.getElementById('btnSubmitCorrPm');
    if (fields) fields.style.display = 'none';
    if (btn) btn.disabled = true;
  }

  function handleAddCategoryChangeSubmit(e) {
    if (e) e.preventDefault();
    const pmId = document.getElementById('catchange_pm_id')?.value;
    const name = document.getElementById('catchange_target_name')?.textContent;
    const originCat = document.getElementById('catchange_origin_cat')?.value;
    const targetCat = document.getElementById('catchange_target_cat')?.value;
    const targetSub = document.getElementById('catchange_target_subgroup')?.value;
    const reason = document.getElementById('catchange_reason')?.value.trim();
    const eff = document.getElementById('catchange_effective')?.value || new Date().toISOString().slice(0, 10);

    if (!pmId || !originCat || !targetCat) return alert('Pilih penerima manfaat dan kategori tujuan.');

    packageDraft.push({
      action_type: 'PERUBAHAN_KATEGORI',
      pm_id: Number(pmId),
      full_name: name,
      category: originCat,
      target_category: targetCat,
      class_group: targetSub,
      reason: reason || 'Alih kategori status program',
      effective_from: eff
    });

    saveDraft();
    closeModal('modalCategoryChange');
    const form = e && e.target ? e.target : document.querySelector('#modalCategoryChange form');
    if (form) form.reset();
    const fields = document.getElementById('catChangeFormFields');
    const btn = document.getElementById('btnSubmitCatChange');
    if (fields) fields.style.display = 'none';
    if (btn) btn.disabled = true;
  }

  // 7. Interactive Filter & Selection Helpers
  function filterExitPmList() {
    const query = (document.getElementById('exitSearchInput')?.value || '').toLowerCase().trim();
    const filterCat = document.querySelector('input[name="exit_cat_filter"]:checked')?.value || 'ALL';
    const rows = document.querySelectorAll('#exitPmPickerContainer .pm-db-picker-row');

    rows.forEach(r => {
      const cat = r.dataset.cat || '';
      const name = r.dataset.name || '';
      const nik = r.dataset.nik || '';

      const matchCat = filterCat === 'ALL' || cat === filterCat;
      const matchQuery = !query || name.includes(query) || nik.includes(query);

      r.style.display = (matchCat && matchQuery) ? 'flex' : 'none';
    });
  }

  function onExitPmSelected(radio) {
    if (!radio) return;
    const row = radio.closest('.pm-db-picker-row');
    const name = row ? (row.querySelector('.pm-db-row-content strong')?.textContent || '-') : '-';
    const meta = row ? (row.querySelector('.pm-db-row-content small')?.textContent || '-') : '-';

    const prevBox = document.getElementById('exitSelectedPreview');
    const prevName = document.getElementById('exitSelectedName');
    const prevMeta = document.getElementById('exitSelectedMeta');

    if (prevBox) prevBox.style.display = 'block';
    if (prevName) prevName.textContent = name;
    if (prevMeta) prevMeta.textContent = meta;
  }

  function filterCorrectionPmList() {
    const query = (document.getElementById('corrSearchInput')?.value || '').toLowerCase().trim();
    const rows = document.querySelectorAll('#corrPmPickerContainer .pm-db-picker-row');
    rows.forEach(r => {
      const name = r.dataset.name || '';
      const nik = r.dataset.nik || '';
      r.style.display = (!query || name.includes(query) || nik.includes(query)) ? 'flex' : 'none';
    });
  }

  function onCorrPmSelected(pmDataOrId) {
    const pmData = (typeof pmDataOrId === 'object' && pmDataOrId !== null)
      ? pmDataOrId
      : ACTIVE_PM_MAP[pmDataOrId];
    if (!pmData) return;

    const fields = document.getElementById('corrFormFields');
    const btn = document.getElementById('btnSubmitCorrPm');
    if (fields) fields.style.display = 'block';
    if (btn) btn.disabled = false;

    const idEl = document.getElementById('corr_pm_id');
    const nameEl = document.getElementById('corr_name');
    const nikEl = document.getElementById('corr_nik');
    const genEl = document.getElementById('corr_gender');

    if (idEl) idEl.value = pmData.id;
    if (nameEl) nameEl.value = pmData.full_name || '';
    if (nikEl) nikEl.value = pmData.nik || '';
    if (genEl) genEl.value = pmData.gender || 'P';
  }

  function filterCatChangePmList() {
    const query = (document.getElementById('catChangeSearchInput')?.value || '').toLowerCase().trim();
    const rows = document.querySelectorAll('#catChangePmPickerContainer .pm-db-picker-row');
    rows.forEach(r => {
      const name = r.dataset.name || '';
      const nik = r.dataset.nik || '';
      r.style.display = (!query || name.includes(query) || nik.includes(query)) ? 'flex' : 'none';
    });
  }

  function onCatChangeSelected(pmDataOrId) {
    const pmData = (typeof pmDataOrId === 'object' && pmDataOrId !== null)
      ? pmDataOrId
      : ACTIVE_PM_MAP[pmDataOrId];
    if (!pmData) return;

    const fields = document.getElementById('catChangeFormFields');
    const btn = document.getElementById('btnSubmitCatChange');
    if (fields) fields.style.display = 'block';
    if (btn) btn.disabled = false;

    const idEl = document.getElementById('catchange_pm_id');
    const nameEl = document.getElementById('catchange_target_name');
    const metaEl = document.getElementById('catchange_target_meta');
    const originEl = document.getElementById('catchange_origin_cat');

    if (idEl) idEl.value = pmData.id;
    if (nameEl) nameEl.textContent = pmData.full_name;
    if (metaEl) metaEl.textContent = 'NIK: ' + (pmData.nik || '-') + ' · Kategori Saat Ini: ' + pmData.category;
    if (originEl) originEl.value = pmData.category;

    const targetSelect = document.getElementById('catchange_target_cat');
    if (targetSelect) {
      if (pmData.category === 'BUMIL') {
        targetSelect.value = 'BUSUI';
      } else if (pmData.category === 'BUSUI') {
        targetSelect.value = 'BALITA';
      } else {
        targetSelect.value = 'BUMIL';
      }
    }
    updateCatChangeSubgroups();
  }

  function updateNewPmSubgroupOptions() {
    const cat = document.querySelector('input[name="newpm_category"]:checked')?.value || 'BALITA';
    const select = document.getElementById('newpm_subgroup');
    const genderSelect = document.getElementById('newpm_gender');
    if (!select) return;

    if (cat === 'BALITA') {
      select.innerHTML = '<option value="0-5 Bulan (Bayi)">0-5 Bulan (Bayi)</option><option value="6-23 Bulan (Baduta)" selected>6-23 Bulan (Baduta)</option><option value="24-59 Bulan (Balita)">24-59 Bulan (Balita)</option>';
      if (genderSelect) genderSelect.disabled = false;
    } else if (cat === 'BUMIL') {
      select.innerHTML = '<option value="Trimester 1 (1–12 Minggu)">Trimester 1 (1–12 Minggu)</option><option value="Trimester 2 (13–27 Minggu)" selected>Trimester 2 (13–27 Minggu)</option><option value="Trimester 3 (28–40 Minggu)">Trimester 3 (28–40 Minggu)</option>';
      if (genderSelect) { genderSelect.value = 'P'; genderSelect.disabled = true; }
    } else if (cat === 'BUSUI') {
      select.innerHTML = '<option value="Bayi 0–6 Bulan (ASI Eksklusif)" selected>Bayi 0–6 Bulan (ASI Eksklusif)</option><option value="Bayi 7–12 Bulan">Bayi 7–12 Bulan</option><option value="Bayi 13–24 Bulan">Bayi 13–24 Bulan</option>';
      if (genderSelect) { genderSelect.value = 'P'; genderSelect.disabled = true; }
    }
  }

  function updateCatChangeSubgroups() {
    const targetCat = document.getElementById('catchange_target_cat')?.value;
    const select = document.getElementById('catchange_target_subgroup');
    if (!select || !targetCat) return;

    if (targetCat === 'BUSUI') {
      select.innerHTML = '<option value="Bayi 0–6 Bulan (ASI Eksklusif)" selected>Bayi 0–6 Bulan (ASI Eksklusif)</option><option value="Bayi 7–12 Bulan">Bayi 7–12 Bulan</option><option value="Bayi 13–24 Bulan">Bayi 13–24 Bulan</option>';
    } else if (targetCat === 'BUMIL') {
      select.innerHTML = '<option value="Trimester 1 (1–12 Minggu)">Trimester 1 (1–12 Minggu)</option><option value="Trimester 2 (13–27 Minggu)" selected>Trimester 2 (13–27 Minggu)</option><option value="Trimester 3 (28–40 Minggu)">Trimester 3 (28–40 Minggu)</option>';
    } else if (targetCat === 'BALITA') {
      select.innerHTML = '<option value="0-5 Bulan (Bayi)">0-5 Bulan (Bayi)</option><option value="6-23 Bulan (Baduta)" selected>6-23 Bulan (Baduta)</option><option value="24-59 Bulan (Balita)">24-59 Bulan (Balita)</option>';
    }
  }

  function switchPackageTab(tabId) {
    const btnPaket = document.getElementById('tabBtnPaket');
    const btnRiwayat = document.getElementById('tabBtnRiwayat');
    const contentPaket = document.getElementById('tabContentPaket');
    const contentRiwayat = document.getElementById('tabContentRiwayat');

    if (tabId === 'tab-paket') {
      if (btnPaket) btnPaket.classList.add('active');
      if (btnRiwayat) btnRiwayat.classList.remove('active');
      if (contentPaket) contentPaket.classList.add('active');
      if (contentRiwayat) contentRiwayat.classList.remove('active');
    } else {
      if (btnRiwayat) btnRiwayat.classList.add('active');
      if (btnPaket) btnPaket.classList.remove('active');
      if (contentRiwayat) contentRiwayat.classList.add('active');
      if (contentPaket) contentPaket.classList.remove('active');
    }
  }

  function viewPackageDetailModal(subId) {
    const modal = document.getElementById('modalPackageDetail');
    const loading = document.getElementById('detailLoadingState');
    const content = document.getElementById('detailContentState');
    const tbody = document.getElementById('detailItemsTableBody');

    if (modal) openModal('modalPackageDetail');
    if (loading) loading.style.display = 'block';
    if (content) content.style.display = 'none';

    fetch('/api/kpm-package/submissions/' + subId + '/items')
      .then(res => res.json())
      .then(data => {
        if (!data.success) throw new Error(data.error || 'Gagal memuat rincian paket.');

        if (loading) loading.style.display = 'none';
        if (content) content.style.display = 'block';

        const sub = data.submission;
        const items = data.items || [];

        const codeEl = document.getElementById('detailPackageCode');
        const effEl = document.getElementById('detailEffectiveDate');
        const submitEl = document.getElementById('detailSubmitDate');
        const statusEl = document.getElementById('detailPackageStatus');
        const noteEl = document.getElementById('detailReviewNoteText');

        if (codeEl) codeEl.textContent = '#PKT-' + String(sub.id).padStart(4, '0') + ' (' + items.length + ' Item)';
        if (effEl) effEl.textContent = 'Tanggal Berlaku: ' + (sub.effective_from || '-');
        if (submitEl) submitEl.textContent = 'Dibuat: ' + new Date(sub.created_at).toLocaleDateString('id-ID');
        if (statusEl) {
          statusEl.textContent = sub.status;
          statusEl.className = 'pm-hc-badge ' + (sub.status === 'DISETUJUI' ? 'approved' : sub.status === 'DITOLAK' ? 'rejected' : 'pending');
        }
        if (noteEl) noteEl.textContent = sub.review_note || 'Tidak ada catatan khusus.';

        let rowsHtml = '';
        items.forEach((item, idx) => {
          let badgeHtml = '<span class="pm-mut-badge pm-baru">PM Baru</span>';
          if (item.action_type === 'PM_KELUAR') badgeHtml = '<span class="pm-mut-badge pm-keluar">PM Keluar</span>';
          else if (item.action_type === 'KOREKSI') badgeHtml = '<span class="pm-mut-badge koreksi">Koreksi</span>';
          else if (item.action_type === 'PERUBAHAN_KATEGORI') badgeHtml = '<span class="pm-mut-badge perubahan-kategori">Alih Kategori</span>';

          rowsHtml += '<tr>' +
            '<td style="text-align:center;color:#64748b">' + (idx + 1) + '</td>' +
            '<td>' + badgeHtml + '</td>' +
            '<td><strong>' + escapeHtml(item.full_name) + '</strong><br><small style="color:#64748b">NIK: ' + escapeHtml(item.nik || '-') + '</small></td>' +
            '<td>' + escapeHtml(item.category || '-') + '<br><small style="color:#64748b">' + escapeHtml(item.class_group || '-') + '</small></td>' +
            '<td>' + escapeHtml(item.change_reason || '-') + '</td>' +
          '</tr>';
        });

        if (!items.length) {
          rowsHtml = '<tr><td colspan="5" style="text-align:center;padding:16px;color:#64748b">Belum ada baris perubahan tercatat dalam paket ini.</td></tr>';
        }

        if (tbody) tbody.innerHTML = rowsHtml;

        const execActions = document.getElementById('detailExecutiveActions');
        const btnApprove = document.getElementById('btnDetailApprove');
        const btnReject = document.getElementById('btnDetailReject');
        if (execActions && btnApprove && btnReject) {
          if (['DIAJUKAN', 'DITINJAU'].includes(sub.status)) {
            execActions.style.display = 'flex';
            btnApprove.onclick = function() { handleExecutiveReviewAction(sub.id, 'DISETUJUI'); };
            btnReject.onclick = function() { handleExecutiveReviewAction(sub.id, 'PERLU_PERBAIKAN'); };
          } else {
            execActions.style.display = 'none';
          }
        }
      })
      .catch(err => {
        if (loading) loading.innerHTML = '<span style="color:#d92d20">Gagal memuat detail paket: ' + err.message + '</span>';
      });
  }

  function handleExecutiveReviewAction(subId, decision) {
    const isApprove = decision === 'DISETUJUI';
    const promptMsg = isApprove
      ? 'Masukkan catatan persetujuan Ka. SPPG (opsional):'
      : 'Masukkan alasan permintaan perbaikan / pengembalian data:';

    const note = prompt(promptMsg, isApprove ? 'Disetujui sesuai koordinasi kader' : 'Perbaiki NIK / data yang belum lengkap');
    if (note === null) return;

    fetch('/api/kpm-package/submissions/' + subId + '/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, note })
    })
    .then(res => res.json())
    .then(res => {
      if (res.success) {
        alert(res.message);
        window.location.reload();
      } else {
        alert('Gagal merekam review: ' + (res.error || 'Terjadi kesalahan'));
      }
    })
    .catch(err => alert('Kesalahan jaringan: ' + err.message));
  }

  function submitPackageDraft(isDraft) {
    if (!packageDraft.length && !isDraft) {
      return alert('Belum ada item perubahan dalam paket. Silakan tambahkan minimal satu perubahan.');
    }

    const confirmMsg = isDraft
      ? 'Simpan draft paket pembaruan ini?'
      : 'Kirim paket pembaruan (' + packageDraft.length + ' perubahan) kepada Ka. SPPG untuk diverifikasi?';

    if (!confirm(confirmMsg)) return;

    const inputJson = document.getElementById('pkgItemsJsonInput');
    const inputIsDraft = document.getElementById('pkgIsDraftInput');
    const form = document.getElementById('pkgFinalSubmitForm');

    if (inputJson && inputIsDraft && form) {
      inputJson.value = JSON.stringify(packageDraft);
      inputIsDraft.value = isDraft ? '1' : '0';

      if (!isDraft) {
        try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
      }

      form.submit();
    }
  }

  // 8. Event Delegation (Data-Action Architecture)
  document.addEventListener('click', function(e) {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) {
      // Backdrop click to close modal
      if (e.target && e.target.classList.contains('pm-modal-backdrop')) {
        closeModal(e.target.id);
      }
      return;
    }

    const action = actionEl.getAttribute('data-action');
    switch (action) {
      case 'open-mutation-picker':
        openModal('modalMutationPicker');
        break;
      case 'open-new-pm':
        closeModal('modalMutationPicker');
        openModal('modalNewPm');
        break;
      case 'open-exit-pm':
        closeModal('modalMutationPicker');
        openModal('modalExitPm');
        break;
      case 'open-correction-pm':
        closeModal('modalMutationPicker');
        openModal('modalCorrectionPm');
        break;
      case 'open-category-change':
        closeModal('modalMutationPicker');
        openModal('modalCategoryChange');
        break;
      case 'close-modal': {
        const targetId = actionEl.getAttribute('data-target') || actionEl.closest('.pm-modal-backdrop')?.id;
        if (targetId) closeModal(targetId);
        break;
      }
      case 'switch-package-tab': {
        const tab = actionEl.getAttribute('data-tab') || 'tab-paket';
        switchPackageTab(tab);
        break;
      }
      case 'remove-draft-item': {
        const idx = Number(actionEl.getAttribute('data-index'));
        if (!isNaN(idx)) {
          if (confirm('Hapus perubahan ini dari paket?')) {
            packageDraft.splice(idx, 1);
            saveDraft();
          }
        }
        break;
      }
      case 'clear-draft':
        if (confirm('Bersihkan seluruh draft perubahan di paket saat ini?')) {
          packageDraft = [];
          saveDraft();
        }
        break;
      case 'submit-package-real':
        submitPackageDraft(false);
        break;
      case 'submit-package-draft':
        submitPackageDraft(true);
        break;
    }
  });

  // Escape key closes modals
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      document.querySelectorAll('.pm-modal-backdrop.active, .pm-modal-backdrop[style*="display: flex"]').forEach(m => {
        closeModal(m.id);
      });
    }
  });

  // 9. Export ke Window Global (Dual Safety)
  window.openModal = openModal;
  window.closeModal = closeModal;
  window.openMutationPickerModal = function() { openModal('modalMutationPicker'); };
  window.openNewPmModal = function() { closeModal('modalMutationPicker'); openModal('modalNewPm'); };
  window.openExitPmModal = function() { closeModal('modalMutationPicker'); openModal('modalExitPm'); };
  window.openCorrectionPmModal = function() { closeModal('modalMutationPicker'); openModal('modalCorrectionPm'); };
  window.openCategoryChangeModal = function() { closeModal('modalMutationPicker'); openModal('modalCategoryChange'); };
  window.viewPackageDetailModal = viewPackageDetailModal;
  window.switchPackageTab = switchPackageTab;
  window.filterExitPmList = filterExitPmList;
  window.onExitPmSelected = onExitPmSelected;
  window.filterCorrectionPmList = filterCorrectionPmList;
  window.onCorrPmSelected = onCorrPmSelected;
  window.filterCatChangePmList = filterCatChangePmList;
  window.onCatChangeSelected = onCatChangeSelected;
  window.updateNewPmSubgroupOptions = updateNewPmSubgroupOptions;
  window.updateCatChangeSubgroups = updateCatChangeSubgroups;
  window.handleAddNewPmSubmit = handleAddNewPmSubmit;
  window.handleAddExitPmSubmit = handleAddExitPmSubmit;
  window.handleAddCorrectionSubmit = handleAddCorrectionSubmit;
  window.handleAddCategoryChangeSubmit = handleAddCategoryChangeSubmit;
  window.submitPackageDraft = submitPackageDraft;
  window.removeDraftItem = function(idx) {
    if (confirm('Hapus perubahan ini dari paket?')) {
      packageDraft.splice(idx, 1);
      saveDraft();
    }
  };
  window.clearPackageDraft = function() {
    if (confirm('Bersihkan seluruh draft perubahan di paket saat ini?')) {
      packageDraft = [];
      saveDraft();
    }
  };

  // 10. Bootstrap Lifecycle
  function boot() {
    initDataPayload();
    relocateModalsToBody();
    loadDraft();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
