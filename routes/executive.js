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
        const [subRows] = await pool.query('SELECT * FROM kpm_pm_submission_rows WHERE submission_id = ?', [sub.id]);
        sub.items = subRows || [];
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
        note || 'Disetujui oleh Pimpinan/Administrator SPPG',
        decision === 'DISETUJUI' ? req.session.user.id : null,
        decision === 'DISETUJUI' ? new Date() : null,
        id
      ]);

      // If approved, apply proposed changes to actual PM / KPM
      if (decision === 'DISETUJUI') {
        const [rows] = await conn.query('SELECT * FROM kpm_pm_submission_rows WHERE submission_id = ?', [id]);
        for (const item of rows) {
          if (item.pm_id) {
            // Update existing PM
            await conn.query(`
              UPDATE pm
              SET full_name = ?, nik = ?, nisn = ?, gender = ?, class_group = ?, category = ?, active = 1
              WHERE id = ? AND kpm_id = ?
            `, [item.full_name, item.nik, item.nisn, item.gender, item.class_group, item.category, item.pm_id, sub.kpm_id]);
          } else if (item.full_name) {
            // Insert new PM
            await conn.query(`
              INSERT INTO pm (kpm_id, full_name, nik, nisn, gender, class_group, category, active)
              VALUES (?, ?, ?, ?, ?, ?, ?, 1)
            `, [sub.kpm_id, item.full_name, item.nik, item.nisn, item.gender, item.class_group, item.category]);
          }
        }
      }

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
