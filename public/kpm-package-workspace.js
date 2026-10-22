/**
 * kpm-package-workspace.js
 * Modul Lembar Kerja Pengajuan Paket Mutasi Data PM (Posyandu & Satuan Pendidikan)
 * Versi Mandiri & Terisolasi - 100% Bebas Konflik
 */

(function() {
  'use strict';

  let KPM_ID = 0;
  let KPM_TYPE = 'POSYANDU';
  let STORAGE_KEY = 'SPPG_PM_PACKAGE_DRAFT_0';
  let ACTIVE_PM_MAP = {};
  let packageDraft = [];
  const memStore = {};

  function safeGet(key) {
    try { return (typeof localStorage !== 'undefined' && localStorage) ? localStorage.getItem(key) : (memStore[key] || null); }
    catch(e) { return memStore[key] || null; }
  }
  function safeSet(key, val) {
    try { if (typeof localStorage !== 'undefined' && localStorage) localStorage.setItem(key, val); }
    catch(e) {}
    memStore[key] = val;
  }
  function safeRemove(key) {
    try { if (typeof localStorage !== 'undefined' && localStorage) localStorage.removeItem(key); }
    catch(e) {}
    delete memStore[key];
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // 1. Inisialisasi Data Payload
  function initDataPayload() {
    try {
      const payloadEl = document.getElementById('posyanduPmDataPayload');
      if (payloadEl && payloadEl.textContent) {
        const parsed = JSON.parse(payloadEl.textContent);
        if (parsed.kpmId) {
          KPM_ID = parsed.kpmId;
          STORAGE_KEY = 'SPPG_PM_PACKAGE_DRAFT_' + KPM_ID;
        }
        if (parsed.kpmType) {
          KPM_TYPE = parsed.kpmType;
        }
        if (Array.isArray(parsed.activePm)) {
          parsed.activePm.forEach(p => {
            if (p && p.id) {
              ACTIVE_PM_MAP[p.id] = {
                id: p.id,
                full_name: p.full_name || '',
                nik: p.nik || '',
                nisn: p.nisn || '',
                gender: p.gender || 'P',
                category: p.category || (KPM_TYPE === 'POSYANDU' ? 'BALITA' : 'PESERTA_DIDIK'),
                class_group: p.class_group || '',
                birth_date: p.birth_date ? String(p.birth_date).slice(0, 10) : ''
              };
            }
          });
        }
      }
    } catch (e) {
      console.warn('[Workspace] Gagal membaca data payload PM:', e);
    }
  }

  // 2. Modal Management
  function relocateModalsToBody() {
    var modals = document.querySelectorAll('.pm-modal-backdrop');
    modals.forEach(function(m) {
      if (m.parentNode !== document.body) {
        document.body.appendChild(m);
      }
    });
  }

  function openModal(id) {
    var el = document.getElementById(id);
    if (!el) return;
    if (el.parentNode !== document.body) {
      document.body.appendChild(el);
    }
    el.style.display = 'flex';
    el.classList.add('active');
    try { document.body.style.overflow = 'hidden'; } catch (e) {}
  }

  function closeModal(id) {
    const el = document.getElementById(id);
    if (el) {
      el.style.display = 'none';
      el.classList.remove('active');
    }
    const openModals = document.querySelectorAll('.pm-modal-backdrop.active, .pm-modal-backdrop[style*="display: flex"]');
    if (!openModals.length) {
      try { document.body.style.overflow = ''; } catch (e) {}
    }
  }

  // 3. Tab Switcher Lembar Kerja vs Riwayat
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

  // 4. Draft Storage & Perhitungan Proyeksi
  function loadDraft() {
    try {
      const stored = safeGet(STORAGE_KEY);
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
      safeSet(STORAGE_KEY, JSON.stringify(packageDraft));
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

    if (elDraftCount) elDraftCount.textContent = draftCount;
    if (elDraftDetail) elDraftDetail.textContent = draftCount + ' item perubahan';
    if (elTabDraftBadge) elTabDraftBadge.textContent = draftCount;

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
      const isPosyandu = KPM_TYPE === 'POSYANDU';
      if (isPosyandu) {
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
      } else {
        // Satuan Pendidikan
        if (item.action_type === 'PM_BARU') {
          if (item.category === 'PESERTA_DIDIK') smallDelta += 1;
          else largeDelta += 1;
        } else if (item.action_type === 'PM_KELUAR') {
          if (item.category === 'PESERTA_DIDIK') smallDelta -= 1;
          else largeDelta -= 1;
        }
      }
    });

    const elTotal = document.getElementById('impactTotalItems');
    const elSmall = document.getElementById('impactSmallPortion');
    const elLarge = document.getElementById('impactLargePortion');

    if (elTotal) elTotal.textContent = draftCount + ' Item';
    if (elSmall) {
      elSmall.textContent = (smallDelta >= 0 ? '+' : '') + smallDelta + (KPM_TYPE === 'POSYANDU' ? ' Balita' : ' Siswa');
    }
    if (elLarge) {
      elLarge.textContent = (largeDelta >= 0 ? '+' : '') + largeDelta + (KPM_TYPE === 'POSYANDU' ? ' Bumil/Busui' : ' Porsi Besar');
    }
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
        badgeHtml = '<span class="pm-mut-badge perubahan-kategori">🔄 Alih Status</span>';
        descHtml = '<strong>' + escapeHtml(item.category) + ' → ' + escapeHtml(item.target_category) + '</strong><br><small style="color:#64748b">' + escapeHtml(item.reason || '-') + '</small>';
      }

      html += '<tr>' +
        '<td style="text-align:center;color:#64748b;font-weight:700">' + (idx + 1) + '</td>' +
        '<td>' + badgeHtml + '</td>' +
        '<td>' +
          '<strong style="color:#0f243d;display:block">' + escapeHtml(item.full_name) + '</strong>' +
          '<small style="color:#64748b;font-family:monospace">' + (item.nik ? ('NIK: ' + escapeHtml(item.nik)) : (item.nisn ? ('NISN: ' + escapeHtml(item.nisn)) : '-')) + ' · ' + (item.gender === 'L' ? 'Laki-laki' : 'Perempuan') + '</small>' +
        '</td>' +
        '<td>' +
          '<span class="pm-cat-pill">' + escapeHtml(item.category) + '</span>' +
          '<small style="display:block;color:#64748b;margin-top:2px">' + escapeHtml(item.class_group || '-') + '</small>' +
        '</td>' +
        '<td>' + descHtml + '</td>' +
        '<td style="text-align:center">' +
          '<button type="button" class="btn gray small" onclick="window.removeDraftItem(' + idx + ')" style="padding:4px 9px;border-radius:6px;border:1px solid #fecaca;background:#fef2f2;color:#b91c1c;font-size:11px;font-weight:700;cursor:pointer">✕ Hapus</button>' +
        '</td>' +
      '</tr>';
    });

    tbody.innerHTML = html;
  }

  // 5. Pencarian & Filter di Modal PM Keluar, Koreksi, Alih Kategori
  function filterExitPmList(q) {
    const list = document.getElementById('exitPmSelectList');
    if (!list) return;
    const term = (q || '').toLowerCase().trim();
    const rows = list.querySelectorAll('.pm-db-picker-row');
    rows.forEach(r => {
      const text = r.textContent.toLowerCase();
      r.style.display = (!term || text.includes(term)) ? 'flex' : 'none';
    });
  }

  function onExitPmSelected(id) {
    const p = ACTIVE_PM_MAP[id];
    if (!p) return;
    document.getElementById('exitTargetPmId').value = p.id;
    document.getElementById('exitTargetName').value = p.full_name;
    document.getElementById('exitTargetNik').value = p.nik || '';
    document.getElementById('exitTargetGender').value = p.gender;
    document.getElementById('exitTargetCategory').value = p.category;
    document.getElementById('exitTargetClassGroup').value = p.class_group || '';

    const preview = document.getElementById('exitSelectedPreview');
    if (preview) {
      preview.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between"><div><strong style="color:#0f243d;font-size:13.5px">' + escapeHtml(p.full_name) + '</strong><small style="color:#64748b">' + (p.nik ? ('NIK: ' + p.nik) : '') + ' · ' + p.category + ' (' + (p.class_group || '-') + ')</small></div><span style="color:#007a5e;font-weight:800;font-size:12px">✓ Terpilih</span></div>';
      preview.style.display = 'block';
    }
  }

  function filterCorrectionPmList(q) {
    const list = document.getElementById('corrPmSelectList');
    if (!list) return;
    const term = (q || '').toLowerCase().trim();
    const rows = list.querySelectorAll('.pm-db-picker-row');
    rows.forEach(r => {
      const text = r.textContent.toLowerCase();
      r.style.display = (!term || text.includes(term)) ? 'flex' : 'none';
    });
  }

  function onCorrPmSelected(id) {
    const p = ACTIVE_PM_MAP[id];
    if (!p) return;
    document.getElementById('corrTargetPmId').value = p.id;
    document.getElementById('corrFormFullName').value = p.full_name;
    document.getElementById('corrFormNik').value = p.nik || '';
    document.getElementById('corrFormBirthDate').value = p.birth_date || '';
    document.getElementById('corrTargetOriginalCat').value = p.category;
    document.getElementById('corrTargetOriginalClass').value = p.class_group || '';

    const radios = document.querySelectorAll('input[name="corr_gender"]');
    radios.forEach(r => {
      r.checked = (r.value === p.gender);
    });

    const preview = document.getElementById('corrSelectedPreview');
    if (preview) {
      preview.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between"><div><strong style="color:#0f243d;font-size:13.5px">' + escapeHtml(p.full_name) + '</strong><small style="color:#64748b">' + (p.nik ? ('NIK: ' + p.nik) : '') + ' · ' + p.category + '</small></div><span style="color:#007a5e;font-weight:800;font-size:12px">✓ Terpilih</span></div>';
      preview.style.display = 'block';
    }
    const formFields = document.getElementById('corrFormFields');
    if (formFields) formFields.style.display = 'block';
  }

  function filterCatChangePmList(q) {
    const list = document.getElementById('catChangeSelectList');
    if (!list) return;
    const term = (q || '').toLowerCase().trim();
    const rows = list.querySelectorAll('.pm-db-picker-row');
    rows.forEach(r => {
      const text = r.textContent.toLowerCase();
      r.style.display = (!term || text.includes(term)) ? 'flex' : 'none';
    });
  }

  function onCatChangeSelected(id) {
    const p = ACTIVE_PM_MAP[id];
    if (!p) return;
    document.getElementById('catChangeTargetPmId').value = p.id;
    document.getElementById('catChangeTargetName').value = p.full_name;
    document.getElementById('catChangeTargetNik').value = p.nik || '';
    document.getElementById('catChangeTargetGender').value = p.gender;
    document.getElementById('catChangeSourceCategory').value = p.category;
    document.getElementById('catChangeSourceClass').value = p.class_group || '';

    const preview = document.getElementById('catChangeSelectedPreview');
    if (preview) {
      preview.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between"><div><strong style="color:#0f243d;font-size:13.5px">' + escapeHtml(p.full_name) + '</strong><small style="color:#64748b">' + (p.nik ? ('NIK: ' + p.nik) : '') + ' · Kategori Saat Ini: <strong>' + p.category + '</strong> (' + (p.class_group || '-') + ')</small></div><span style="color:#007a5e;font-weight:800;font-size:12px">✓ Terpilih</span></div>';
      preview.style.display = 'block';
    }

    const formFields = document.getElementById('catChangeFormFields');
    if (formFields) formFields.style.display = 'block';

    const sourceCatDisp = document.getElementById('dispSourceCat');
    if (sourceCatDisp) sourceCatDisp.textContent = p.category;

    updateCatChangeSubgroups();
  }

  function updateNewPmSubgroupOptions() {
    const catSelect = document.getElementById('newPmCategorySelect');
    const subgroupSelect = document.getElementById('newPmSubgroupSelect');
    if (!catSelect || !subgroupSelect) return;
    const cat = catSelect.value;

    if (KPM_TYPE === 'POSYANDU') {
      if (cat === 'BALITA') {
        subgroupSelect.innerHTML = '<option value="0-5 Bulan (Bayi)">0-5 Bulan (Bayi)</option><option value="6-23 Bulan (Baduta)" selected>6-23 Bulan (Baduta)</option><option value="24-59 Bulan (Balita)">24-59 Bulan (Balita)</option>';
      } else if (cat === 'BUMIL') {
        subgroupSelect.innerHTML = '<option value="Trimester 1 (1–12 Minggu)">Trimester 1 (1–12 Minggu)</option><option value="Trimester 2 (13–27 Minggu)" selected>Trimester 2 (13–27 Minggu)</option><option value="Trimester 3 (28–40 Minggu)">Trimester 3 (28–40 Minggu)</option>';
      } else if (cat === 'BUSUI') {
        subgroupSelect.innerHTML = '<option value="Bayi 0–6 Bulan (ASI Eksklusif)" selected>Bayi 0–6 Bulan (ASI Eksklusif)</option><option value="Bayi >6 Bulan (MPASI & Menyusui)">Bayi >6 Bulan (MPASI & Menyusui)</option>';
      }
    } else {
      // Satuan Pendidikan
      if (cat === 'PESERTA_DIDIK') {
        subgroupSelect.innerHTML = '<option value="Kelas 1" selected>Kelas 1</option><option value="Kelas 2">Kelas 2</option><option value="Kelas 3">Kelas 3</option><option value="Kelas 4">Kelas 4</option><option value="Kelas 5">Kelas 5</option><option value="Kelas 6">Kelas 6</option><option value="PAUD/TK">PAUD/TK</option>';
      } else if (cat === 'PENDIDIK') {
        subgroupSelect.innerHTML = '<option value="Guru Kelas" selected>Guru Kelas</option><option value="Guru Mapel">Guru Mapel</option><option value="Guru Pembimbing">Guru Pembimbing</option>';
      } else {
        subgroupSelect.innerHTML = '<option value="Tenaga Administrasi / TU" selected>Tenaga Administrasi / TU</option><option value="Staf Keamanan">Staf Keamanan</option><option value="Staf Kebersihan">Staf Kebersihan</option><option value="Pengelola Dapur">Pengelola Dapur</option>';
      }
    }
  }

  function updateCatChangeSubgroups() {
    const targetCatSelect = document.getElementById('catChangeTargetCat');
    const select = document.getElementById('catChangeTargetSubgroup');
    if (!targetCatSelect || !select) return;
    const targetCat = targetCatSelect.value;

    if (KPM_TYPE === 'POSYANDU') {
      if (targetCat === 'BUSUI') {
        select.innerHTML = '<option value="Bayi 0–6 Bulan (ASI Eksklusif)" selected>Bayi 0–6 Bulan (ASI Eksklusif)</option><option value="Bayi >6 Bulan (MPASI & Menyusui)">Bayi >6 Bulan (MPASI & Menyusui)</option>';
      } else if (targetCat === 'BUMIL') {
        select.innerHTML = '<option value="Trimester 1 (1–12 Minggu)">Trimester 1 (1–12 Minggu)</option><option value="Trimester 2 (13–27 Minggu)" selected>Trimester 2 (13–27 Minggu)</option><option value="Trimester 3 (28–40 Minggu)">Trimester 3 (28–40 Minggu)</option>';
      } else if (targetCat === 'BALITA') {
        select.innerHTML = '<option value="0-5 Bulan (Bayi)">0-5 Bulan (Bayi)</option><option value="6-23 Bulan (Baduta)" selected>6-23 Bulan (Baduta)</option><option value="24-59 Bulan (Balita)">24-59 Bulan (Balita)</option>';
      }
    } else {
      if (targetCat === 'PESERTA_DIDIK') {
        select.innerHTML = '<option value="Kelas 2">Naik ke Kelas 2</option><option value="Kelas 3">Naik ke Kelas 3</option><option value="Kelas 4">Naik ke Kelas 4</option><option value="Kelas 5">Naik ke Kelas 5</option><option value="Kelas 6">Naik ke Kelas 6</option>';
      } else {
        select.innerHTML = '<option value="Staf Internal">Staf Internal</option>';
      }
    }
  }

  // 6. Action Form Submit Handlers (Menambah Item ke Paket Draft)
  function handleAddNewPmSubmit() {
    const name = document.getElementById('newPmFullName').value.trim();
    const nik = document.getElementById('newPmNik').value.trim();
    const genderEl = document.querySelector('input[name="new_pm_gender"]:checked');
    const gender = genderEl ? genderEl.value : 'P';
    const category = document.getElementById('newPmCategorySelect').value;
    const classGroup = document.getElementById('newPmSubgroupSelect').value;
    const birthDate = document.getElementById('newPmBirthDate').value;
    const reason = document.getElementById('newPmReason').value.trim();

    if (!name) {
      alert('Nama lengkap PM wajib diisi.');
      return;
    }

    const item = {
      action_type: 'PM_BARU',
      pm_id: null,
      full_name: name,
      nik: nik || null,
      gender: gender,
      category: category,
      class_group: classGroup,
      birth_date: birthDate || null,
      reason: reason || 'Pendaftaran PM baru'
    };

    packageDraft.push(item);
    saveDraft();
    closeModal('modalNewPm');

    document.getElementById('newPmFullName').value = '';
    document.getElementById('newPmNik').value = '';
    document.getElementById('newPmReason').value = '';
  }

  function handleAddExitPmSubmit() {
    const pmId = document.getElementById('exitTargetPmId').value;
    const name = document.getElementById('exitTargetName').value;
    const nik = document.getElementById('exitTargetNik').value;
    const gender = document.getElementById('exitTargetGender').value;
    const category = document.getElementById('exitTargetCategory').value;
    const classGroup = document.getElementById('exitTargetClassGroup').value;
    const reasonType = document.getElementById('exitReasonType').value;
    const reasonNote = document.getElementById('exitReasonNote').value.trim();

    if (!pmId || !name) {
      alert('Pilih salah satu penerima manfaat dari daftar.');
      return;
    }

    if (packageDraft.some(x => x.pm_id == pmId && x.action_type === 'PM_KELUAR')) {
      alert('Penerima manfaat ini sudah ada di dalam daftar perubahan keluar.');
      return;
    }

    const fullReason = reasonType + (reasonNote ? (' - ' + reasonNote) : '');
    const item = {
      action_type: 'PM_KELUAR',
      pm_id: Number(pmId),
      full_name: name,
      nik: nik || null,
      gender: gender,
      category: category,
      class_group: classGroup,
      reason: fullReason
    };

    packageDraft.push(item);
    saveDraft();
    closeModal('modalExitPm');

    document.getElementById('exitTargetPmId').value = '';
    document.getElementById('exitTargetName').value = '';
    document.getElementById('exitReasonNote').value = '';
    const preview = document.getElementById('exitSelectedPreview');
    if (preview) preview.style.display = 'none';
  }

  function handleAddCorrectionSubmit() {
    const pmId = document.getElementById('corrTargetPmId').value;
    const name = document.getElementById('corrFormFullName').value.trim();
    const nik = document.getElementById('corrFormNik').value.trim();
    const genderEl = document.querySelector('input[name="corr_gender"]:checked');
    const gender = genderEl ? genderEl.value : 'P';
    const birthDate = document.getElementById('corrFormBirthDate').value;
    const origCat = document.getElementById('corrTargetOriginalCat').value;
    const origClass = document.getElementById('corrTargetOriginalClass').value;
    const reason = document.getElementById('corrFormReason').value.trim();

    if (!pmId || !name) {
      alert('Pilih salah satu penerima manfaat dan isi nama lengkap.');
      return;
    }

    const orig = ACTIVE_PM_MAP[pmId] || {};
    const item = {
      action_type: 'KOREKSI',
      pm_id: Number(pmId),
      full_name: name,
      nik: nik || null,
      gender: gender,
      category: origCat,
      class_group: origClass,
      birth_date: birthDate || null,
      reason: reason || 'Koreksi data identitas',
      before_data: {
        full_name: orig.full_name,
        nik: orig.nik,
        gender: orig.gender,
        birth_date: orig.birth_date
      }
    };

    packageDraft.push(item);
    saveDraft();
    closeModal('modalCorrectionPm');

    document.getElementById('corrTargetPmId').value = '';
    document.getElementById('corrFormFullName').value = '';
    document.getElementById('corrFormReason').value = '';
    const preview = document.getElementById('corrSelectedPreview');
    if (preview) preview.style.display = 'none';
    const fields = document.getElementById('corrFormFields');
    if (fields) fields.style.display = 'none';
  }

  function handleAddCategoryChangeSubmit() {
    const pmId = document.getElementById('catChangeTargetPmId').value;
    const name = document.getElementById('catChangeTargetName').value;
    const nik = document.getElementById('catChangeTargetNik').value;
    const gender = document.getElementById('catChangeTargetGender').value;
    const sourceCat = document.getElementById('catChangeSourceCategory').value;
    const sourceClass = document.getElementById('catChangeSourceClass').value;
    const targetCat = document.getElementById('catChangeTargetCat').value;
    const targetClass = document.getElementById('catChangeTargetSubgroup').value;
    const reason = document.getElementById('catChangeReason').value.trim();

    if (!pmId || !name) {
      alert('Pilih salah satu penerima manfaat.');
      return;
    }

    const item = {
      action_type: 'PERUBAHAN_KATEGORI',
      pm_id: Number(pmId),
      full_name: name,
      nik: nik || null,
      gender: gender,
      category: sourceCat,
      class_group: sourceClass,
      target_category: targetCat,
      target_class_group: targetClass,
      reason: reason || ('Alih kategori dari ' + sourceCat + ' ke ' + targetCat)
    };

    packageDraft.push(item);
    saveDraft();
    closeModal('modalCategoryChange');

    document.getElementById('catChangeTargetPmId').value = '';
    document.getElementById('catChangeTargetName').value = '';
    document.getElementById('catChangeReason').value = '';
    const preview = document.getElementById('catChangeSelectedPreview');
    if (preview) preview.style.display = 'none';
    const fields = document.getElementById('catChangeFormFields');
    if (fields) fields.style.display = 'none';
  }

  // 7. Pengiriman Paket ke Server (POST)
  function submitPackageDraft(isDraft) {
    if (!packageDraft.length && !isDraft) {
      alert('Paket masih kosong. Tambahkan minimal satu item perubahan sebelum mengirim ke Ka. SPPG.');
      return;
    }

    const effDate = document.getElementById('pkgEffectiveDate').value;
    if (!effDate) {
      alert('Pilih tanggal berlaku paket perubahan.');
      return;
    }

    const note = document.getElementById('pkgSubmissionNote').value.trim();
    const promptMsg = isDraft
      ? 'Simpan paket ini sebagai draft sementara?'
      : 'Kirim paket perubahan ini kepada Ka. SPPG untuk diverifikasi dan disahkan?';

    if (!confirm(promptMsg)) return;

    const form = document.getElementById('formPackageSubmission');
    if (form) {
      document.getElementById('hiddenIsDraft').value = isDraft ? '1' : '0';
      document.getElementById('hiddenEffectiveFrom').value = effDate;
      document.getElementById('hiddenSubmissionNote').value = note;
      document.getElementById('hiddenItemsJson').value = JSON.stringify(packageDraft);

      safeRemove(STORAGE_KEY);

      form.submit();
    }
  }

  // 8. Detail Riwayat Pengajuan Paket (AJAX fetch items)
  function viewPackageDetailModal(subId) {
    const modal = document.getElementById('modalPackageDetail');
    const loading = document.getElementById('detailLoadingState');
    const content = document.getElementById('detailContentState');
    const tbody = document.getElementById('detailItemsTableBody');

    if (!modal) return;
    openModal('modalPackageDetail');
    if (loading) loading.style.display = 'flex';
    if (content) content.style.display = 'none';

    fetch('/api/kpm-package/submissions/' + subId + '/items')
      .then(res => res.json())
      .then(data => {
        if (loading) loading.style.display = 'none';
        if (content) content.style.display = 'block';

        if (!data.success || !data.submission) {
          alert('Gagal memuat detail paket.');
          closeModal('modalPackageDetail');
          return;
        }

        const sub = data.submission;
        const codeEl = document.getElementById('detailPkgCode');
        const statusEl = document.getElementById('detailPkgStatus');
        const effEl = document.getElementById('detailPkgEffective');
        const dateEl = document.getElementById('detailPkgCreated');
        const noteEl = document.getElementById('detailPkgNote');

        if (codeEl) codeEl.textContent = 'Paket #' + sub.id;
        if (statusEl) {
          statusEl.textContent = sub.status;
          statusEl.className = 'pm-hc-badge ' + (sub.status === 'DIAJUKAN' || sub.status === 'DITINJAU' ? 'pending' : (sub.status === 'DISETUJUI' || sub.status === 'DITERAPKAN' ? 'approved' : 'rejected'));
        }
        if (effEl) effEl.textContent = 'Berlaku: ' + (sub.effective_from ? String(sub.effective_from).slice(0, 10) : '-');
        if (dateEl) dateEl.textContent = 'Diajukan: ' + (sub.created_at ? String(sub.created_at).slice(0, 16).replace('T', ' ') : '-');
        if (noteEl) noteEl.textContent = sub.review_note || sub.submission_note || 'Tidak ada catatan.';

        if (tbody) {
          tbody.innerHTML = '';
          (data.items || []).forEach((row, i) => {
            const meta = row.meta || {};
            const actType = meta.action_type || row.validation_note || 'PM_BARU';
            let badge = '<span class="pm-mut-badge pm-baru">👶 Baru</span>';
            if (actType === 'PM_KELUAR') badge = '<span class="pm-mut-badge pm-keluar">🚪 Keluar</span>';
            else if (actType === 'KOREKSI') badge = '<span class="pm-mut-badge koreksi">✏️ Koreksi</span>';
            else if (actType === 'PERUBAHAN_KATEGORI') badge = '<span class="pm-mut-badge perubahan-kategori">🔄 Alih Status</span>';

            const tr = document.createElement('tr');
            tr.innerHTML = '<td style="text-align:center">' + (i + 1) + '</td>' +
              '<td>' + badge + '</td>' +
              '<td><strong>' + escapeHtml(row.full_name) + '</strong><br><small style="color:#64748b">' + (row.nik ? ('NIK: ' + row.nik) : '-') + '</small></td>' +
              '<td>' + escapeHtml(row.category) + '<br><small style="color:#64748b">' + escapeHtml(row.class_group || '-') + '</small></td>' +
              '<td>' + escapeHtml(meta.reason || row.validation_note || '-') + '</td>';
            tbody.appendChild(tr);
          });
        }
      })
      .catch(err => {
        if (loading) loading.style.display = 'none';
        alert('Terjadi kesalahan memuat detail paket.');
        closeModal('modalPackageDetail');
      });
  }

  // 9. Delegasi Event & Keyboard Shortcuts
  document.addEventListener('click', function(e) {
    if (e.target && e.target.classList.contains('pm-modal-backdrop')) {
      closeModal(e.target.id);
    }
  });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      document.querySelectorAll('.pm-modal-backdrop.active, .pm-modal-backdrop[style*="display: flex"]').forEach(m => {
        closeModal(m.id);
      });
    }
  });

  // Export functions to window
  window.openModal = openModal;
  window.closeModal = closeModal;
  window.openMutationPickerModal = function() { openModal('modalMutationPicker'); };
  window.openNewPmModal = function() {
    closeModal('modalMutationPicker');
    var fName = document.getElementById('newPmFullName');
    var fNik = document.getElementById('newPmNik');
    var fReason = document.getElementById('newPmReason');
    var fDate = document.getElementById('newPmBirthDate');
    if (fName) fName.value = '';
    if (fNik) fNik.value = '';
    if (fReason) fReason.value = '';
    if (fDate) fDate.value = '';
    updateNewPmSubgroupOptions();
    openModal('modalNewPm');
  };
  window.openExitPmModal = function() {
    closeModal('modalMutationPicker');
    filterExitPmList('');
    var preview = document.getElementById('exitSelectedPreview');
    if (preview) preview.style.display = 'none';
    var targetId = document.getElementById('exitTargetPmId');
    if (targetId) targetId.value = '';
    openModal('modalExitPm');
  };
  window.openCorrectionPmModal = function() {
    closeModal('modalMutationPicker');
    filterCorrectionPmList('');
    var preview = document.getElementById('corrSelectedPreview');
    if (preview) preview.style.display = 'none';
    var fields = document.getElementById('corrFormFields');
    if (fields) fields.style.display = 'none';
    var targetId = document.getElementById('corrTargetPmId');
    if (targetId) targetId.value = '';
    openModal('modalCorrectionPm');
  };
  window.openCategoryChangeModal = function() {
    closeModal('modalMutationPicker');
    filterCatChangePmList('');
    var preview = document.getElementById('catChangeSelectedPreview');
    if (preview) preview.style.display = 'none';
    var fields = document.getElementById('catChangeFormFields');
    if (fields) fields.style.display = 'none';
    var targetId = document.getElementById('catChangeTargetPmId');
    if (targetId) targetId.value = '';
    updateCatChangeSubgroups();
    openModal('modalCategoryChange');
  };
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

  // Bootstrap
  function boot() {
    relocateModalsToBody();
    initDataPayload();
    loadDraft();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
