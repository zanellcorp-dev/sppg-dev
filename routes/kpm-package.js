const express = require('express');

module.exports = function createKpmPackageRouter(deps) {
  const { pool, log, logPortal, clean, requireCsrf, flash, defaultAppSettings } = deps;
  const router = express.Router();

  const ar = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

  // Helper to fetch portal access from token hash
  async function getAccessByToken(rawToken) {
    if (!/^[a-f0-9]{64}$/.test(rawToken)) return null;
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const [[access]] = await pool.query(
      'SELECT t.*, k.name kpm_name, k.code kpm_code, k.type kpm_type, k.education_level FROM kpm_portal_tokens t JOIN kpm k ON k.id=t.kpm_id WHERE t.token_hash=? AND t.active=1 AND (t.expires_at IS NULL OR t.expires_at>NOW())',
      [hash]
    );
    return access || null;
  }

  // Helper to format ISO date
  function toDateStr(val) {
    if (!val) return new Date().toISOString().slice(0, 10);
    if (val instanceof Date) return val.toISOString().slice(0, 10);
    return String(val).slice(0, 10);
  }

  // Helper to synchronize active PM count into kpm_daily_data
  async function syncKpmDailyData(conn, kpmId, effectiveDate) {
    try {
      const [activeRows] = await conn.query('SELECT category, gender, class_group FROM pm WHERE kpm_id=? AND active=1', [kpmId]);
      const rows = activeRows || [];
      const balita_male = rows.filter(p => p.category === 'BALITA' && p.gender === 'L').length;
      const balita_female = rows.filter(p => p.category === 'BALITA' && p.gender === 'P').length;
      const bumil = rows.filter(p => p.category === 'BUMIL').length;
      const busui = rows.filter(p => p.category === 'BUSUI').length;
      const small_male = rows.filter(p => p.category === 'PESERTA_DIDIK' && p.gender === 'L').length;
      const small_female = rows.filter(p => p.category === 'PESERTA_DIDIK' && p.gender === 'P').length;
      const teacher_male = rows.filter(p => p.category === 'PENDIDIK' && p.gender === 'L').length;
      const teacher_female = rows.filter(p => p.category === 'PENDIDIK' && p.gender === 'P').length;
      const staff_male = rows.filter(p => p.category === 'TENAGA_KEPENDIDIKAN' && p.gender === 'L').length;
      const staff_female = rows.filter(p => p.category === 'TENAGA_KEPENDIDIKAN' && p.gender === 'P').length;
      const large_female = rows.filter(p => p.category === 'PESERTA_DIDIK' && (p.class_group || '').toLowerCase().includes('besar') && p.gender === 'P').length;
      const large_male = rows.filter(p => p.category === 'PESERTA_DIDIK' && (p.class_group || '').toLowerCase().includes('besar') && p.gender === 'L').length;

      const eff = effectiveDate || new Date().toISOString().slice(0, 10);
      const [[existing]] = await conn.query('SELECT id FROM kpm_daily_data WHERE kpm_id=? AND effective_from=? LIMIT 1', [kpmId, eff]);
      if (existing) {
        await conn.query(
          'UPDATE kpm_daily_data SET balita_male=?, balita_female=?, bumil=?, busui=?, small_male=?, small_female=?, teacher_male=?, teacher_female=?, staff_male=?, staff_female=?, large_male=?, large_female=? WHERE id=?',
          [balita_male, balita_female, bumil, busui, small_male, small_female, teacher_male, teacher_female, staff_male, staff_female, large_male, large_female, existing.id]
        );
      } else {
        await conn.query(
          'INSERT INTO kpm_daily_data(kpm_id, effective_from, balita_male, balita_female, bumil, busui, small_male, small_female, teacher_male, teacher_female, staff_male, staff_female, large_male, large_female, created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)',
          [kpmId, eff, balita_male, balita_female, bumil, busui, small_male, small_female, teacher_male, teacher_female, staff_male, staff_female, large_male, large_female]
        );
      }
    } catch (err) {
      console.warn('[Sync KPM Daily Data]', err.message);
    }
  }

  // GET: Dedicated Workspace for Preview Mode
  router.get('/portal/kpm/preview/:kpmId([0-9]+)/paket', ar(async (req, res) => {
    const kpmId = Number(req.params.kpmId);
    const [[access]] = await pool.query(
      "SELECT id kpm_id, name kpm_name, code kpm_code, type kpm_type, education_level, address, npsn, head_name, head_phone, pic_name, pic_phone, cadre_name, cadre_phone, latitude, longitude, email FROM kpm WHERE id=?",
      [kpmId]
    );
    if (!access) return res.status(404).send('KPM tidak ditemukan.');

    const [pm] = await pool.query(
      "SELECT id, full_name, nik, nisn, gender, class_group, category, active, approval_status, deactivated_at, deactivation_reason, created_at, updated_at FROM pm WHERE kpm_id=? ORDER BY FIELD(category,'PENDIDIK','TENAGA_KEPENDIDIKAN','PESERTA_DIDIK','BALITA','BUMIL','BUSUI'),class_group,full_name",
      [kpmId]
    );
    const [subs] = await pool.query(
      'SELECT id, effective_from, status, created_at, reviewed_at, review_note FROM kpm_pm_submissions WHERE kpm_id=? ORDER BY created_at DESC, id DESC LIMIT 20',
      [kpmId]
    );
    const [settingsRows] = await pool.query('SELECT * FROM app_settings WHERE id=1');
    const settings = settingsRows[0] || {};

    res.render('kpm/package-workspace', {
      title: 'Lembar Kerja Pembaruan Data PM · ' + access.kpm_name,
      access,
      pm: pm || [],
      subs: subs || [],
      previewMode: true,
      portalToken: null,
      csrfToken: (typeof req.csrfToken === 'function') ? req.csrfToken() : '',
      settings: { ...(defaultAppSettings || {}), ...settings }
    });
  }));

  // GET: Dedicated Workspace for Portal Token (Kader/Private Access)
  router.get('/portal/kpm/:token/paket', ar(async (req, res) => {
    const rawToken = String(req.params.token || '');
    const access = await getAccessByToken(rawToken);
    if (!access) return res.status(403).send('Akses portal tidak valid atau sudah dicabut.');

    const [pm] = await pool.query(
      "SELECT id, full_name, nik, nisn, gender, class_group, category, active, approval_status, deactivated_at, deactivation_reason, created_at, updated_at FROM pm WHERE kpm_id=? ORDER BY FIELD(category,'PENDIDIK','TENAGA_KEPENDIDIKAN','PESERTA_DIDIK','BALITA','BUMIL','BUSUI'),class_group,full_name",
      [access.kpm_id]
    );
    const [subs] = await pool.query(
      'SELECT id, effective_from, status, created_at, reviewed_at, review_note FROM kpm_pm_submissions WHERE kpm_id=? ORDER BY created_at DESC, id DESC LIMIT 20',
      [access.kpm_id]
    );
    const [settingsRows] = await pool.query('SELECT * FROM app_settings WHERE id=1');
    const settings = settingsRows[0] || {};

    res.render('kpm/package-workspace', {
      title: 'Lembar Kerja Pembaruan Data PM · ' + access.kpm_name,
      access: { ...access, id: access.kpm_id },
      pm: pm || [],
      subs: subs || [],
      previewMode: false,
      portalToken: rawToken,
      csrfToken: (typeof req.csrfToken === 'function') ? req.csrfToken() : '',
      settings: { ...(defaultAppSettings || {}), ...settings }
    });
  }));

  // 1. Submit Package from Portal Kader (Token-based)
  router.post('/portal/kpm/:token/package-submission', ar(async (req, res) => {
    const rawToken = String(req.params.token || '');
    const access = await getAccessByToken(rawToken);
    if (!access) return res.status(403).send('Akses portal tidak valid atau sudah dicabut.');

    const isDraft = String(req.body.is_draft || '') === '1' || req.body.action === 'SAVE_DRAFT';
    const status = isDraft ? 'DRAFT' : 'DIAJUKAN';
    const effectiveFrom = toDateStr(req.body.effective_from);
    const submissionNote = clean(req.body.submission_note || '');

    let items = [];
    try {
      items = JSON.parse(String(req.body.items_json || '[]'));
    } catch {
      throw new Error('Format data paket perubahan tidak valid.');
    }

    if (!Array.isArray(items) || (!items.length && !isDraft)) {
      throw new Error('Minimal satu perubahan harus dimasukkan ke dalam paket.');
    }

    const conn = await pool.getConnection();
    let submissionId;
    try {
      await conn.beginTransaction();

      // Create main submission batch header
      const [r] = await conn.query(
        "INSERT INTO kpm_pm_submissions(kpm_id, submission_type, effective_from, status, submitted_by, review_note) VALUES(?, 'MANUAL', ?, ?, NULL, ?)",
        [access.kpm_id, effectiveFrom, status, submissionNote || null]
      );
      submissionId = r.insertId;

      // Insert all submission rows
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const actionType = clean(item.action_type || 'PM_BARU');
        const pmId = item.pm_id ? Number(item.pm_id) : null;
        const fullName = clean(item.full_name || '');
        const nik = clean(item.nik || '') || null;
        const gender = ['L', 'P'].includes(item.gender) ? item.gender : null;
        const category = clean(item.category || 'BALITA');
        const classGroup = clean(item.class_group || '') || null;
        const reason = clean(item.reason || '');

        const metaNote = JSON.stringify({
          action_type: actionType,
          reason,
          effective_from: item.effective_from || effectiveFrom,
          before_data: item.before_data || null,
          target_category: item.target_category || null
        });

        await conn.query(
          'INSERT INTO kpm_pm_submission_rows(submission_id, row_no, pm_id, full_name, nik, nisn, gender, class_group, category, status, validation_note) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
          [submissionId, i + 1, pmId, fullName, nik, null, gender, classGroup, category, 'VALID', metaNote]
        );
      }

      // Add submission history
      const historyNote = isDraft
        ? `Draft paket pembaruan (${items.length} perubahan) disimpan oleh Kader Posyandu.`
        : `Paket pembaruan (${items.length} perubahan) resmi diajukan ke Ka. SPPG oleh Kader Posyandu.`;

      await conn.query(
        'INSERT INTO kpm_pm_submission_history(submission_id, action, from_status, to_status, note, actor_id) VALUES(?,?,?,?,?,NULL)',
        [submissionId, isDraft ? 'SAVE_DRAFT' : 'SUBMIT', null, status, historyNote]
      );

      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }

    if (logPortal) {
      await logPortal(
        req,
        access,
        isDraft ? 'Simpan Draft Pembaruan PM' : 'Kirim Pengajuan Pembaruan PM',
        'DATA_KPM_PM',
        submissionId,
        isDraft
          ? `Kader menyimpan draft ${items.length} perubahan data PM`
          : `Kader mengajukan paket #${submissionId} (${items.length} perubahan) ke Ka. SPPG`,
        { effective_from: effectiveFrom, row_count: items.length }
      );
    }

    const successMsg = isDraft
      ? `Draft pembaruan (${items.length} perubahan) berhasil disimpan.`
      : `Paket pembaruan data PM #${submissionId} (${items.length} perubahan) berhasil dikirim kepada Ka. SPPG.`;
    if (typeof flash === 'function') {
      flash(req, isDraft ? 'info' : 'success', successMsg);
    } else if (req.session) {
      req.session.flash = { type: isDraft ? 'info' : 'success', message: successMsg };
    }

    res.redirect(`/portal/kpm/${rawToken}/paket`);
  }));

  // 2. Submit Package from Preview Mode (Internal SPPG / Ka. SPPG)
  router.post('/portal/kpm/preview/:kpmId/package-submission', ar(async (req, res) => {
    const kpmId = Number(req.params.kpmId);
    const [[kpm]] = await pool.query('SELECT * FROM kpm WHERE id=?', [kpmId]);
    if (!kpm) return res.status(404).send('KPM tidak ditemukan.');

    const isDraft = String(req.body.is_draft || '') === '1' || req.body.action === 'SAVE_DRAFT';
    const status = isDraft ? 'DRAFT' : 'DIAJUKAN';
    const effectiveFrom = toDateStr(req.body.effective_from);
    const submissionNote = clean(req.body.submission_note || '');

    let items = [];
    try {
      items = JSON.parse(String(req.body.items_json || '[]'));
    } catch {
      throw new Error('Format data paket perubahan tidak valid.');
    }

    if (!Array.isArray(items) || (!items.length && !isDraft)) {
      throw new Error('Minimal satu perubahan harus dimasukkan ke dalam paket.');
    }

    const conn = await pool.getConnection();
    let submissionId;
    try {
      await conn.beginTransaction();

      const [r] = await conn.query(
        "INSERT INTO kpm_pm_submissions(kpm_id, submission_type, effective_from, status, submitted_by, review_note) VALUES(?, 'MANUAL', ?, ?, ?, ?)",
        [kpmId, effectiveFrom, status, req.session?.user?.id || 1, submissionNote || null]
      );
      submissionId = r.insertId;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const actionType = clean(item.action_type || 'PM_BARU');
        const pmId = item.pm_id ? Number(item.pm_id) : null;
        const fullName = clean(item.full_name || '');
        const nik = clean(item.nik || '') || null;
        const gender = ['L', 'P'].includes(item.gender) ? item.gender : null;
        const category = clean(item.category || 'BALITA');
        const classGroup = clean(item.class_group || '') || null;
        const reason = clean(item.reason || '');

        const metaNote = JSON.stringify({
          action_type: actionType,
          reason,
          effective_from: item.effective_from || effectiveFrom,
          before_data: item.before_data || null,
          target_category: item.target_category || null
        });

        await conn.query(
          'INSERT INTO kpm_pm_submission_rows(submission_id, row_no, pm_id, full_name, nik, nisn, gender, class_group, category, status, validation_note) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
          [submissionId, i + 1, pmId, fullName, nik, null, gender, classGroup, category, 'VALID', metaNote]
        );
      }

      await conn.query(
        'INSERT INTO kpm_pm_submission_history(submission_id, action, from_status, to_status, note, actor_id) VALUES(?,?,?,?,?,?)',
        [
          submissionId,
          isDraft ? 'SAVE_DRAFT' : 'SUBMIT',
          null,
          status,
          `Pengajuan paket pembaruan #${submissionId} (${items.length} perubahan) dari mode preview.`,
          req.session?.user?.id || 1
        ]
      );

      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }

    if (log) {
      await log(
        req,
        isDraft ? 'Simpan Draft Pembaruan PM' : 'Kirim Paket Pembaruan PM',
        'DATA_KPM_PM',
        submissionId,
        `Paket #${submissionId} (${items.length} item perubahan) diajukan untuk KPM ${kpm.name}`,
        null,
        { kpm_id: kpmId, effective_from: effectiveFrom, row_count: items.length }
      );
    }

    const successMsg = isDraft
      ? `Draft paket pembaruan (${items.length} item) berhasil disimpan.`
      : `Paket pembaruan data PM #${submissionId} (${items.length} perubahan) berhasil diajukan kepada Ka. SPPG.`;
    if (typeof flash === 'function') {
      flash(req, isDraft ? 'info' : 'success', successMsg);
    } else if (req.session) {
      req.session.flash = { type: isDraft ? 'info' : 'success', message: successMsg };
    }

    res.redirect(`/portal/kpm/preview/${kpmId}/paket`);
  }));

  // 3. API: Get Items of a Submission (JSON for Detail Modal)
  router.get('/api/kpm-package/submissions/:id/items', ar(async (req, res) => {
    const id = Number(req.params.id);
    const [[sub]] = await pool.query(
      'SELECT s.*, k.name kpm_name, k.code kpm_code, k.type kpm_type FROM kpm_pm_submissions s JOIN kpm k ON k.id=s.kpm_id WHERE s.id=?',
      [id]
    );
    if (!sub) return res.status(404).json({ success: false, error: 'Pengajuan tidak ditemukan.' });

    const [rows] = await pool.query('SELECT * FROM kpm_pm_submission_rows WHERE submission_id=? ORDER BY row_no', [id]);

    const parsedRows = rows.map(r => {
      let meta = {};
      try {
        if (r.validation_note && (r.validation_note.startsWith('{') || r.validation_note.startsWith('['))) {
          meta = JSON.parse(r.validation_note);
        } else {
          meta = { reason: r.validation_note };
        }
      } catch {
        meta = { reason: r.validation_note };
      }
      return {
        ...r,
        meta,
        action_type: meta.action_type || (r.pm_id ? 'KOREKSI' : 'PM_BARU'),
        change_reason: meta.reason || r.validation_note || '-'
      };
    });

    res.json({
      success: true,
      submission: sub,
      items: parsedRows
    });
  }));

  // 4. API: Ka. SPPG / Executive Review (Approve / Return for Revision)
  router.post('/api/kpm-package/submissions/:id/review', ar(async (req, res) => {
    const id = Number(req.params.id);
    const decision = clean(req.body.decision || '').toUpperCase(); // 'DISETUJUI' or 'PERLU_PERBAIKAN' (or 'DITOLAK')
    const note = clean(req.body.note || req.body.review_note || '');

    if (!['DISETUJUI', 'PERLU_PERBAIKAN', 'DITOLAK'].includes(decision)) {
      return res.status(400).json({ success: false, error: 'Keputusan review tidak valid.' });
    }

    const [[sub]] = await pool.query('SELECT * FROM kpm_pm_submissions WHERE id=?', [id]);
    if (!sub) return res.status(404).json({ success: false, error: 'Pengajuan tidak ditemukan.' });

    const actorId = req.session?.user?.id || 1;
    const actorName = req.session?.user?.name || 'Ka. SPPG';

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const newStatus = decision === 'DISETUJUI' ? 'DISETUJUI' : 'DITOLAK';

      await conn.query(
        'UPDATE kpm_pm_submissions SET status=?, reviewed_by=?, reviewed_at=NOW(), review_note=?, applied_by=?, applied_at=? WHERE id=?',
        [
          newStatus,
          actorId,
          note || (decision === 'DISETUJUI' ? 'Disetujui dan disahkan oleh Ka. SPPG' : 'Perlu perbaikan data'),
          decision === 'DISETUJUI' ? actorId : null,
          decision === 'DISETUJUI' ? new Date() : null,
          id
        ]
      );

      // If approved, apply mutations to PM master database
      if (decision === 'DISETUJUI') {
        const [rows] = await conn.query('SELECT * FROM kpm_pm_submission_rows WHERE submission_id=?', [id]);
        for (const r of rows) {
          let meta = {};
          try {
            if (r.validation_note && (r.validation_note.startsWith('{') || r.validation_note.startsWith('['))) {
              meta = JSON.parse(r.validation_note);
            }
          } catch {}

          const actionType = meta.action_type || (r.pm_id ? 'KOREKSI' : 'PM_BARU');
          const effDate = meta.effective_from || sub.effective_from || new Date().toISOString().slice(0, 10);
          const reasonText = meta.reason || 'Diterapkan dari paket pembaruan data PM #' + id;

          if (actionType === 'PM_KELUAR' && r.pm_id) {
            // Nonaktifkan PM dari distribusi harian
            const [[beforePm]] = await conn.query('SELECT * FROM pm WHERE id=?', [r.pm_id]);
            await conn.query(
              'UPDATE pm SET active=0, deactivated_at=?, deactivation_reason=?, approval_status=?, updated_at=NOW() WHERE id=?',
              [new Date(), reasonText, 'NONAKTIF_DISETUJUI', r.pm_id]
            );
            if (beforePm) {
              await conn.query(
                'INSERT INTO pm_change_history(pm_id, effective_from, action, before_data, after_data, reason, actor_id) VALUES(?,?,?,?,?,?,?)',
                [
                  r.pm_id,
                  effDate,
                  'DEACTIVATE',
                  JSON.stringify(beforePm),
                  JSON.stringify({ ...beforePm, active: 0, approval_status: 'NONAKTIF_DISETUJUI', deactivation_reason: reasonText }),
                  `PM Keluar: ${reasonText} (Disahkan Ka. SPPG paket #${id})`,
                  actorId
                ]
              );
            }
          } else if (actionType === 'PERUBAHAN_KATEGORI' && r.pm_id) {
            // Ubah kategori PM lama (e.g. Bumil -> Busui)
            const [[beforePm]] = await conn.query('SELECT * FROM pm WHERE id=?', [r.pm_id]);
            const targetCat = meta.target_category || r.category;
            const newClass = r.class_group || beforePm?.class_group || null;

            await conn.query(
              'UPDATE pm SET category=?, class_group=?, active=1, updated_at=NOW() WHERE id=?',
              [targetCat, newClass, r.pm_id]
            );
            if (beforePm) {
              await conn.query(
                'INSERT INTO pm_change_history(pm_id, effective_from, action, before_data, after_data, reason, actor_id) VALUES(?,?,?,?,?,?,?)',
                [
                  r.pm_id,
                  effDate,
                  'UPDATE',
                  JSON.stringify(beforePm),
                  JSON.stringify({ ...beforePm, category: targetCat, class_group: newClass, active: 1 }),
                  `Alih Kategori: ${beforePm.category} → ${targetCat} (${reasonText})`,
                  actorId
                ]
              );
            }
          } else if (actionType === 'KOREKSI' && r.pm_id) {
            // Koreksi identitas PM lama
            const [[beforePm]] = await conn.query('SELECT * FROM pm WHERE id=?', [r.pm_id]);
            await conn.query(
              'UPDATE pm SET full_name=?, nik=?, gender=?, class_group=?, category=?, active=1, updated_at=NOW() WHERE id=?',
              [r.full_name, r.nik || null, r.gender || null, r.class_group || null, r.category, r.pm_id]
            );
            if (beforePm) {
              await conn.query(
                'INSERT INTO pm_change_history(pm_id, effective_from, action, before_data, after_data, reason, actor_id) VALUES(?,?,?,?,?,?,?)',
                [
                  r.pm_id,
                  effDate,
                  'UPDATE',
                  JSON.stringify(beforePm),
                  JSON.stringify({ ...beforePm, full_name: r.full_name, nik: r.nik, gender: r.gender, category: r.category }),
                  `Koreksi Identitas: ${reasonText}`,
                  actorId
                ]
              );
            }
          } else {
            // PM Baru: Tambahkan record baru ke pm
            const [pr] = await conn.query(
              'INSERT INTO pm (kpm_id, full_name, nik, nisn, gender, class_group, category, active, approval_status) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)',
              [sub.kpm_id, r.full_name, r.nik || null, null, r.gender || null, r.class_group || null, r.category, 'AKTIF']
            );
            const newPmId = pr.insertId;
            await conn.query('UPDATE kpm_pm_submission_rows SET pm_id=? WHERE id=?', [newPmId, r.id]);
            await conn.query(
              'INSERT INTO pm_change_history(pm_id, effective_from, action, before_data, after_data, reason, actor_id) VALUES(?,?,?,?,?,?,?)',
              [
                newPmId,
                effDate,
                'CREATE',
                null,
                JSON.stringify({ id: newPmId, kpm_id: sub.kpm_id, full_name: r.full_name, nik: r.nik, category: r.category }),
                `Pendaftaran PM Baru: ${reasonText} (Paket #${id})`,
                actorId
              ]
            );
          }
        }
        // Keep kpm_daily_data aggregated metrics in sync with new PM active records
        await syncKpmDailyData(conn, sub.kpm_id, sub.effective_from);
      }

      await conn.query(
        'INSERT INTO kpm_pm_submission_history(submission_id, action, from_status, to_status, note, actor_id) VALUES(?,?,?,?,?,?)',
        [id, 'REVIEW', sub.status, newStatus, `${decision === 'DISETUJUI' ? 'Disahkan' : 'Dikembalikan'} oleh ${actorName}: ${note || '-'}`, actorId]
      );

      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }

    if (log) {
      await log(
        req,
        decision === 'DISETUJUI' ? 'Sahkan Paket Pembaruan PM' : 'Minta Perbaikan Paket PM',
        'DATA_KPM_PM',
        id,
        `${actorName} ${decision === 'DISETUJUI' ? 'mengesahkan' : 'mengembalikan'} paket #${id} (${note || '-'})`,
        { status: sub.status },
        { status: decision === 'DISETUJUI' ? 'DISETUJUI' : 'DITOLAK', note }
      );
    }

    res.json({
      success: true,
      decision,
      note,
      message:
        decision === 'DISETUJUI'
          ? 'Paket pembaruan berhasil disahkan oleh Ka. SPPG dan data master PM telah disinkronkan!'
          : 'Paket telah dikembalikan kepada kader untuk perbaikan.'
    });
  }));

  return router;
};
