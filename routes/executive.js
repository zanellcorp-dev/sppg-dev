const express = require('express');

module.exports = function createExecutiveRouter(deps) {
  const { pool, log, clean, requireCsrf, defaultAppSettings, XLSX } = deps;
  const router = express.Router();

  // Helper async wrapper
  const ar = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

  // Executive authorization guard: must be logged in as leadership or admin
  function requireExecutive(req, res, next) {
    if (!req.session || !req.session.user) {
      return res.redirect('/login');
    }
    const role = req.session.user.role;
    const permissions = req.session.user.permissions || [];
    const isLeadership = ['ADMIN', 'KASP', 'PENGAWAS_GIZI', 'PENGAWAS_KEUANGAN', 'ASLAP'].includes(role);
    const hasPerm = permissions.includes('executive.view') || permissions.includes('executive.manage') || role === 'ADMIN';

    if (!isLeadership && !hasPerm) {
      if (req.flash) req.flash('error', 'Akses ditolak: Ruang Kerja Eksekutif hanya diperuntukkan bagi pimpinan dan administrator sah.');
      return res.redirect('/');
    }
    next();
  }

  router.use(requireExecutive);

  // Helper to fetch today's closing status
  async function getDailyClosing(date) {
    try {
      const [[r]] = await pool.query('SELECT * FROM daily_closings WHERE work_date=?', [date]);
      return r || { work_date: date, status: 'OPEN' };
    } catch {
      return { work_date: date, status: 'OPEN' };
    }
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

  // API: Get pending approval count for real-time notification badge
  router.get('/pending-count', ar(async (req, res) => {
    let pendingCount = 0;
    try {
      const [[subCount]] = await pool.query("SELECT COUNT(*) total FROM kpm_pm_submissions WHERE status IN ('DIAJUKAN', 'DITINJAU')");
      const [[profCount]] = await pool.query("SELECT COUNT(*) total FROM kpm_portal_profile_submissions WHERE status IN ('DIAJUKAN', 'DITINJAU')");
      pendingCount = (Number(subCount?.total) || 0) + (Number(profCount?.total) || 0);
    } catch (e) {
      console.warn('[Executive] count error:', e.message);
    }
    res.json({ success: true, count: pendingCount });
  }));

  // 1. Executive Command Center Overview
  router.get('/', ar(async (req, res) => {
    const today = new Date().toISOString().slice(0, 10);
    const closing = await getDailyClosing(today);

    // Summary counts
    let pendingApprovalsCount = 0;
    try {
      const [[subCount]] = await pool.query("SELECT COUNT(*) total FROM kpm_pm_submissions WHERE status IN ('DIAJUKAN', 'DITINJAU')");
      const [[profCount]] = await pool.query("SELECT COUNT(*) total FROM kpm_portal_profile_submissions WHERE status IN ('DIAJUKAN', 'DITINJAU')");
      pendingApprovalsCount = (Number(subCount?.total) || 0) + (Number(profCount?.total) || 0);
    } catch (e) {
      console.warn('[Executive] sub count error:', e.message);
    }

    let totalKpm = 0;
    let totalPm = 0;
    try {
      const [[kpmCount]] = await pool.query("SELECT COUNT(*) total FROM kpm WHERE active=1");
      totalKpm = Number(kpmCount?.total) || 0;
      const [[pmCount]] = await pool.query("SELECT COUNT(*) total FROM pm WHERE active=1");
      totalPm = Number(pmCount?.total) || 0;
    } catch (e) {
      console.warn('[Executive] kpm/pm count error:', e.message);
    }

    let openIssuesCount = 0;
    try {
      const [[issues]] = await pool.query("SELECT COUNT(*) total FROM operational_issues WHERE status='TERBUKA'");
      openIssuesCount = Number(issues?.total) || 0;
    } catch {}

    // Recent pending submissions for review table
    let recentPending = [];
    try {
      const [pendingRows] = await pool.query(`
        SELECT s.id, s.kpm_id, s.submission_type, s.effective_from, s.status, s.created_at, k.name AS kpm_name, k.type AS kpm_type
        FROM kpm_pm_submissions s
        LEFT JOIN kpm k ON k.id = s.kpm_id
        ORDER BY FIELD(s.status, 'DIAJUKAN', 'DITINJAU', 'DISETUJUI', 'DITOLAK'), s.created_at DESC
        LIMIT 6
      `);
      recentPending = pendingRows || [];
    } catch {}

    // Recent executive / audit logs
    let recentLogs = [];
    try {
      const [logRows] = await pool.query(`
        SELECT a.*, u.name AS user_name, u.role AS user_role
        FROM activity_log a
        LEFT JOIN users u ON u.id = a.user_id
        ORDER BY a.created_at DESC
        LIMIT 8
      `);
      recentLogs = logRows || [];
    } catch {}

    res.render('executive/index', {
      title: 'Pusat Komando Eksekutif',
      today,
      closing,
      pendingApprovalsCount,
      totalKpm,
      totalPm,
      openIssuesCount,
      recentPending,
      recentLogs
    });
  }));

  // 2. Maker-Checker & Change Approvals Hub
  router.get('/approvals', ar(async (req, res) => {
    const statusFilter = clean(req.query.status || 'ALL');
    let sql = `
      SELECT s.*, k.name AS kpm_name, k.code AS kpm_code, k.type AS kpm_type, u.name AS submitter_name, r.name AS reviewer_name
      FROM kpm_pm_submissions s
      LEFT JOIN kpm k ON k.id = s.kpm_id
      LEFT JOIN users u ON u.id = s.submitted_by
      LEFT JOIN users r ON r.id = s.reviewed_by
    `;
    const params = [];
    if (statusFilter && statusFilter !== 'ALL') {
      sql += ' WHERE s.status = ?';
      params.push(statusFilter);
    }
    sql += ' ORDER BY FIELD(s.status, \'DIAJUKAN\', \'DITINJAU\', \'DISETUJUI\', \'DITERAPKAN\', \'DITOLAK\'), s.created_at DESC LIMIT 100';

    let submissions = [];
    try {
      const [rows] = await pool.query(sql, params);
      submissions = rows || [];
    } catch (e) {
      console.warn('[Executive Approvals]', e.message);
    }

    // Attach row items to submissions for diff display
    for (const sub of submissions) {
      try {
        const [subRows] = await pool.query('SELECT * FROM kpm_pm_submission_rows WHERE submission_id = ? ORDER BY row_no', [sub.id]);
        sub.items = (subRows || []).map(r => {
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
            action_reason: meta.reason || r.validation_note || '-'
          };
        });
      } catch {
        sub.items = [];
      }
    }

    res.render('executive/approvals', {
      title: 'Pusat Persetujuan Perubahan (Maker-Checker)',
      submissions,
      statusFilter
    });
  }));

  // Handle Decision (Approve / Reject)
  router.post('/approvals/:id/decide', ar(async (req, res) => {
    if (!requireCsrf(req, res)) return;
    const id = Number(req.params.id);
    const decision = clean(req.body.decision); // 'DISETUJUI' or 'DITOLAK'
    const note = clean(req.body.review_note || '');

    if (!['DISETUJUI', 'DITOLAK'].includes(decision)) {
      throw new Error('Keputusan tidak valid. Harus DISETUJUI atau DITOLAK.');
    }
    if (decision === 'DITOLAK' && (!note || note.length < 5)) {
      throw new Error('Pimpinan wajib mengisi alasan penolakan secara jelas (minimal 5 karakter).');
    }

    const [[sub]] = await pool.query('SELECT * FROM kpm_pm_submissions WHERE id = ?', [id]);
    if (!sub) return res.status(404).send('Pengajuan tidak ditemukan.');

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      await conn.query(`
        UPDATE kpm_pm_submissions
        SET status = ?, reviewed_by = ?, reviewed_at = NOW(), review_note = ?, applied_by = ?, applied_at = ?
        WHERE id = ?
      `, [
        decision === 'DISETUJUI' ? 'DISETUJUI' : 'DITOLAK',
        req.session.user.id,
        note || (decision === 'DISETUJUI' ? 'Disetujui dan disahkan oleh Pimpinan/Ka. SPPG' : 'Perlu perbaikan data'),
        decision === 'DISETUJUI' ? req.session.user.id : null,
        decision === 'DISETUJUI' ? new Date() : null,
        id
      ]);

      // If approved, apply proposed changes to actual PM / KPM
      if (decision === 'DISETUJUI') {
        const [rows] = await conn.query('SELECT * FROM kpm_pm_submission_rows WHERE submission_id = ?', [id]);
        for (const item of rows) {
          let meta = {};
          try {
            if (item.validation_note && (item.validation_note.startsWith('{') || item.validation_note.startsWith('['))) {
              meta = JSON.parse(item.validation_note);
            }
          } catch {}

          const actionType = meta.action_type || (item.pm_id ? 'KOREKSI' : 'PM_BARU');
          const effDate = meta.effective_from || sub.effective_from || new Date().toISOString().slice(0, 10);
          const reasonText = meta.reason || item.validation_note || 'Diterapkan dari persetujuan pimpinan paket #' + id;

          if (actionType === 'PM_KELUAR' && item.pm_id) {
            // 1. Nonaktifkan PM dari distribusi operasional
            const [[beforePm]] = await conn.query('SELECT * FROM pm WHERE id=? AND kpm_id=?', [item.pm_id, sub.kpm_id]);
            await conn.query(`
              UPDATE pm
              SET active = 0, deactivated_at = NOW(), deactivation_reason = ?, approval_status = 'NONAKTIF_DISETUJUI', updated_at = NOW()
              WHERE id = ? AND kpm_id = ?
            `, [reasonText, item.pm_id, sub.kpm_id]);

            if (beforePm) {
              await conn.query(
                'INSERT INTO pm_change_history(pm_id, effective_from, action, before_data, after_data, reason, actor_id) VALUES(?,?,?,?,?,?,?)',
                [
                  item.pm_id,
                  effDate,
                  'DEACTIVATE',
                  JSON.stringify(beforePm),
                  JSON.stringify({ ...beforePm, active: 0, approval_status: 'NONAKTIF_DISETUJUI', deactivation_reason: reasonText }),
                  `PM Keluar: ${reasonText} (Disahkan Ka. SPPG paket #${id})`,
                  req.session.user.id
                ]
              );
            }
          } else if (actionType === 'PERUBAHAN_KATEGORI' && item.pm_id) {
            // 2. Alih status kategori (contoh Bumil -> Busui)
            const [[beforePm]] = await conn.query('SELECT * FROM pm WHERE id=? AND kpm_id=?', [item.pm_id, sub.kpm_id]);
            const targetCat = meta.target_category || item.category;
            const newClass = item.class_group || beforePm?.class_group || null;

            await conn.query(`
              UPDATE pm
              SET category = ?, class_group = ?, active = 1, updated_at = NOW()
              WHERE id = ? AND kpm_id = ?
            `, [targetCat, newClass, item.pm_id, sub.kpm_id]);

            if (beforePm) {
              await conn.query(
                'INSERT INTO pm_change_history(pm_id, effective_from, action, before_data, after_data, reason, actor_id) VALUES(?,?,?,?,?,?,?)',
                [
                  item.pm_id,
                  effDate,
                  'UPDATE',
                  JSON.stringify(beforePm),
                  JSON.stringify({ ...beforePm, category: targetCat, class_group: newClass, active: 1 }),
                  `Alih Kategori: ${beforePm.category} → ${targetCat} (${reasonText})`,
                  req.session.user.id
                ]
              );
            }
          } else if (item.pm_id) {
            // 3. Koreksi identitas PM lama
            const [[beforePm]] = await conn.query('SELECT * FROM pm WHERE id=? AND kpm_id=?', [item.pm_id, sub.kpm_id]);
            await conn.query(`
              UPDATE pm
              SET full_name = ?, nik = ?, gender = ?, class_group = ?, category = ?, active = 1, updated_at = NOW()
              WHERE id = ? AND kpm_id = ?
            `, [item.full_name, item.nik || null, item.gender || null, item.class_group || null, item.category, item.pm_id, sub.kpm_id]);

            if (beforePm) {
              await conn.query(
                'INSERT INTO pm_change_history(pm_id, effective_from, action, before_data, after_data, reason, actor_id) VALUES(?,?,?,?,?,?,?)',
                [
                  item.pm_id,
                  effDate,
                  'UPDATE',
                  JSON.stringify(beforePm),
                  JSON.stringify({ ...beforePm, full_name: item.full_name, nik: item.nik, gender: item.gender, category: item.category }),
                  `Koreksi Identitas: ${reasonText}`,
                  req.session.user.id
                ]
              );
            }
          } else if (item.full_name) {
            // 4. PM Baru
            const [pr] = await conn.query(`
              INSERT INTO pm (kpm_id, full_name, nik, nisn, gender, class_group, category, active, approval_status)
              VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'AKTIF')
            `, [sub.kpm_id, item.full_name, item.nik || null, item.nisn || null, item.gender || null, item.class_group || null, item.category]);

            const newPmId = pr.insertId;
            await conn.query('UPDATE kpm_pm_submission_rows SET pm_id=? WHERE id=?', [newPmId, item.id]);
            await conn.query(
              'INSERT INTO pm_change_history(pm_id, effective_from, action, before_data, after_data, reason, actor_id) VALUES(?,?,?,?,?,?,?)',
              [
                newPmId,
                effDate,
                'CREATE',
                null,
                JSON.stringify({ id: newPmId, kpm_id: sub.kpm_id, full_name: item.full_name, nik: item.nik, category: item.category }),
                `Pendaftaran PM Baru: ${reasonText} (Paket #${id})`,
                req.session.user.id
              ]
            );
          }
        }
        // Sync aggregated KPM daily data metrics
        await syncKpmDailyData(conn, sub.kpm_id, sub.effective_from);
      }

      await conn.query(
        'INSERT INTO kpm_pm_submission_history(submission_id, action, from_status, to_status, note, actor_id) VALUES(?,?,?,?,?,?)',
        [id, 'REVIEW', sub.status, decision, `${decision === 'DISETUJUI' ? 'Disahkan & Diterapkan' : 'Ditolak/Perlu Perbaikan'} oleh Pimpinan: ${note || '-'}`, req.session.user.id]
      );

      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }

    await log(
      req,
      decision === 'DISETUJUI' ? 'Persetujuan Perubahan Data' : 'Penolakan Perubahan Data',
      'EXECUTIVE_APPROVAL',
      id,
      `Pimpinan ${decision === 'DISETUJUI' ? 'menyetujui & mengunci' : 'menolak'} pengajuan #${id} (${note || 'Sesuai verifikasi'})`,
      { status: sub.status },
      { status: decision, review_note: note }
    );

    if (req.flash) {
      req.flash(
        decision === 'DISETUJUI' ? 'success' : 'error',
        `Pengajuan #${id} berhasil ${decision === 'DISETUJUI' ? 'disetujui & diterapkan secara sah' : 'ditolak'}.`
      );
    }
    res.redirect('/executive/approvals');
  }));

  // 3. Comprehensive Executive History & Audit Trail
  router.get('/history', ar(async (req, res) => {
    const actionFilter = clean(req.query.action || 'ALL');
    const q = clean(req.query.q || '');
    const dateFrom = /^\d{4}-\d{2}-\d{2}$/.test(clean(req.query.date_from)) ? clean(req.query.date_from) : '';
    const dateTo = /^\d{4}-\d{2}-\d{2}$/.test(clean(req.query.date_to)) ? clean(req.query.date_to) : '';

    let sql = `
      SELECT a.*, u.name AS user_name, u.role AS user_role
      FROM activity_log a
      LEFT JOIN users u ON u.id = a.user_id
      WHERE 1=1
    `;
    const params = [];

    if (actionFilter && actionFilter !== 'ALL') {
      sql += ' AND (a.entity_type = ? OR a.action LIKE ?)';
      params.push(actionFilter, `%${actionFilter}%`);
    }
    if (q) {
      sql += ' AND (a.description LIKE ? OR a.action LIKE ? OR u.name LIKE ? OR a.entity_type LIKE ?)';
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (dateFrom) {
      sql += ' AND DATE(a.created_at) >= ?';
      params.push(dateFrom);
    }
    if (dateTo) {
      sql += ' AND DATE(a.created_at) <= ?';
      params.push(dateTo);
    }

    sql += ' ORDER BY a.created_at DESC, a.id DESC LIMIT 300';

    let logs = [];
    try {
      const [rows] = await pool.query(sql, params);
      logs = rows || [];
    } catch (e) {
      console.warn('[Executive History]', e.message);
    }

    // Get unique actors for filter
    let actors = [];
    try {
      const [actorRows] = await pool.query("SELECT DISTINCT u.id, u.name, u.role FROM activity_log a JOIN users u ON u.id = a.user_id ORDER BY u.name");
      actors = actorRows || [];
    } catch {}

    res.render('executive/history', {
      title: 'Riwayat & Audit Eksekutif',
      logs,
      actionFilter,
      q,
      dateFrom,
      dateTo,
      actors
    });
  }));

  // Export Executive History to Excel (.xlsx)
  router.get('/history/export.xlsx', ar(async (req, res) => {
    let sql = `
      SELECT a.id AS 'ID Log', a.created_at AS 'Waktu (WIB)', u.name AS 'Aktor / Pengguna', u.role AS 'Role Aktor',
             a.action AS 'Aksi Tindakan', a.entity_type AS 'Kategori Entitas', a.entity_id AS 'ID Entitas',
             a.description AS 'Keterangan Rinci', a.ip_address AS 'Alamat IP'
      FROM activity_log a
      LEFT JOIN users u ON u.id = a.user_id
      ORDER BY a.created_at DESC LIMIT 500
    `;
    const [rows] = await pool.query(sql);
    const ws = XLSX.utils.json_to_sheet(rows || []);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Riwayat Audit Eksekutif');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
    const today = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Audit-Trail-SPPG-${today}.xlsx"`);
    res.send(buf);
  }));

  // 4. Daily Operational Lock & Certification Control
  router.get('/lock-control', ar(async (req, res) => {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(clean(req.query.date)) ? clean(req.query.date) : new Date().toISOString().slice(0, 10);
    const closing = await getDailyClosing(date);

    let closingUser = null;
    if (closing.closed_by) {
      try {
        const [[u]] = await pool.query('SELECT name, role FROM users WHERE id = ?', [closing.closed_by]);
        closingUser = u;
      } catch {}
    }

    let reopenUser = null;
    if (closing.reopened_by) {
      try {
        const [[ru]] = await pool.query('SELECT name, role FROM users WHERE id = ?', [closing.reopened_by]);
        reopenUser = ru;
      } catch {}
    }

    // Check checklist items for closing
    let checklist = {
      issuesOpen: 0,
      feedbackOpen: 0,
      docRecords: 0
    };
    try {
      const [[iss]] = await pool.query("SELECT COUNT(*) total FROM operational_issues WHERE status='TERBUKA'");
      checklist.issuesOpen = Number(iss?.total) || 0;
      const [[fb]] = await pool.query("SELECT COUNT(*) total FROM operational_feedback WHERE status='TERBUKA'");
      checklist.feedbackOpen = Number(fb?.total) || 0;
      const [[doc]] = await pool.query("SELECT COUNT(*) total FROM documentation_records WHERE documentation_date=?", [date]);
      checklist.docRecords = Number(doc?.total) || 0;
    } catch {}

    // Recent closings history
    let closingHistory = [];
    try {
      const [closings] = await pool.query(`
        SELECT dc.*, u.name AS closed_by_name, ru.name AS reopened_by_name
        FROM daily_closings dc
        LEFT JOIN users u ON u.id = dc.closed_by
        LEFT JOIN users ru ON ru.id = dc.reopened_by
        ORDER BY dc.work_date DESC LIMIT 14
      `);
      closingHistory = closings || [];
    } catch {}

    res.render('executive/lock-control', {
      title: 'Kontrol Penguncian Operasional',
      date,
      closing,
      closingUser,
      reopenUser,
      checklist,
      closingHistory
    });
  }));

  // Lock Action (Freeze)
  router.post('/lock-control/lock', ar(async (req, res) => {
    if (!requireCsrf(req, res)) return;
    const date = clean(req.body.date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Format tanggal tidak valid.');

    await pool.query(`
      INSERT INTO daily_closings(work_date, status, closed_by, closed_at)
      VALUES (?, 'CLOSED', ?, CURRENT_TIMESTAMP)
      ON DUPLICATE KEY UPDATE status='CLOSED', closed_by=VALUES(closed_by), closed_at=CURRENT_TIMESTAMP, reopened_by=NULL, reopened_at=NULL, reopen_reason=NULL
    `, [date, req.session.user.id]);

    await log(
      req,
      'Sertifikasi & Kunci Operasional',
      'EXECUTIVE_LOCK',
      0,
      `Pimpinan ${req.session.user.name} mengunci buku operasional tanggal ${date}. Data lapangan dibekukan dari modifikasi.`,
      null,
      { status: 'CLOSED', date }
    );

    if (req.flash) req.flash('success', `Buku operasional SPPG tanggal ${date} berhasil disertifikasi & dikunci permanen.`);
    res.redirect('/executive/lock-control?date=' + encodeURIComponent(date));
  }));

  // Reopen Action
  router.post('/lock-control/reopen', ar(async (req, res) => {
    if (!requireCsrf(req, res)) return;
    const date = clean(req.body.date);
    const reason = clean(req.body.reason || '');

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Format tanggal tidak valid.');
    if (!reason || reason.length < 8) throw new Error('Berita acara / alasan pembukaan kembali wajib diisi minimal 8 karakter.');

    await pool.query(`
      INSERT INTO daily_closings(work_date, status, reopened_by, reopened_at, reopen_reason)
      VALUES (?, 'REOPENED', ?, CURRENT_TIMESTAMP, ?)
      ON DUPLICATE KEY UPDATE status='REOPENED', reopened_by=VALUES(reopened_by), reopened_at=CURRENT_TIMESTAMP, reopen_reason=VALUES(reopen_reason)
    `, [date, req.session.user.id, reason]);

    await log(
      req,
      'Pembukaan Kembali (Reopen) Buku Operasional',
      'EXECUTIVE_REOPEN',
      0,
      `Pimpinan ${req.session.user.name} membuka kembali kunci tanggal ${date}. Alasan Berita Acara: "${reason}"`,
      { status: 'CLOSED' },
      { status: 'REOPENED', reason }
    );

    if (req.flash) req.flash('success', `Kunci buku operasional ${date} telah dibuka kembali dengan berita acara resmi.`);
    res.redirect('/executive/lock-control?date=' + encodeURIComponent(date));
  }));

  return router;
};
