/**
 * SPPG Monitoring - Modul Mutasi & Validasi Data PM
 * Mengisolasi logika mutasi PM (PM_BARU, PM_KELUAR, KOREKSI, ALIH_KATEGORI)
 * dan sinkronisasi agregasi kpm_daily_data.
 */

'use strict';

/**
 * Validasi ID numerik positif berhingga
 * @param {any} v 
 * @returns {number|null}
 */
function toFiniteId(v) {
  var n = Number(v);
  return (Number.isFinite(n) && n > 0) ? Math.floor(n) : null;
}

/**
 * Mengurai metadata validasi JSON dari kolom validation_note
 * @param {string|null} note 
 * @returns {object}
 */
function parseValidationMeta(note) {
  if (!note || typeof note !== 'string') return {};
  var trimmed = note.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed);
    } catch (e) {
      return {};
    }
  }
  return {};
}

/**
 * Menerapkan satu baris mutasi PM secara transaksional
 * Mendukung tipe: PM_BARU, PM_KELUAR, KOREKSI, ALIH_KATEGORI (dan alias PERUBAHAN_KATEGORI)
 */
async function applyPmRowMutation(conn, r, s, userId) {
  var meta = parseValidationMeta(r.validation_note);
  var actionType = (meta.action_type || (r.pm_id ? 'KOREKSI' : 'PM_BARU')).toUpperCase();
  var effDate = meta.effective_from || s.effective_from || new Date().toISOString().slice(0, 10);
  var reasonText = meta.reason || ('Diterapkan dari DATA KPM PM #' + s.id);

  if (actionType === 'PM_KELUAR' && r.pm_id) {
    const [[before]] = await conn.query('SELECT * FROM pm WHERE id=? FOR UPDATE', [r.pm_id]);
    await conn.query('UPDATE pm SET active=0, deactivated_at=NOW(), deactivation_reason=?, approval_status=?, updated_at=NOW() WHERE id=?', [reasonText, 'NONAKTIF_DISETUJUI', r.pm_id]);
    if (before) {
      await conn.query('INSERT INTO pm_change_history(pm_id,effective_from,action,before_data,after_data,reason,actor_id) VALUES(?,?,?,?,?,?,?)', [r.pm_id, effDate, 'DEACTIVATE', JSON.stringify(before), JSON.stringify(Object.assign({}, before, { active: 0, approval_status: 'NONAKTIF_DISETUJUI' })), reasonText, userId]);
    }
  } else if ((actionType === 'ALIH_KATEGORI' || actionType === 'PERUBAHAN_KATEGORI') && r.pm_id) {
    const [[before]] = await conn.query('SELECT * FROM pm WHERE id=? FOR UPDATE', [r.pm_id]);
    var targetCat = meta.target_category || r.category;
    var newClass = r.class_group || (before ? before.class_group : null);
    await conn.query('UPDATE pm SET category=?, class_group=?, active=1, updated_at=NOW() WHERE id=?', [targetCat, newClass, r.pm_id]);
    if (before) {
      var afterObj = Object.assign({}, before, { category: targetCat, class_group: newClass, active: 1 });
      await conn.query('INSERT INTO pm_change_history(pm_id,effective_from,action,before_data,after_data,reason,actor_id) VALUES(?,?,?,?,?,?,?)', [r.pm_id, effDate, 'UPDATE', JSON.stringify(before), JSON.stringify(afterObj), 'Alih Kategori: ' + before.category + ' → ' + targetCat + ' (' + reasonText + ')', userId]);
    }
  } else if (r.pm_id) {
    // KOREKSI data PM yang ada
    const [[before]] = await conn.query('SELECT * FROM pm WHERE id=? FOR UPDATE', [r.pm_id]);
    var after = {
      full_name: r.full_name,
      nik: r.nik || null,
      nisn: r.nisn || null,
      gender: r.gender,
      category: r.category,
      class_group: r.class_group || null,
      active: 1
    };
    await conn.query('UPDATE pm SET full_name=?, nik=?, nisn=?, gender=?, category=?, class_group=?, active=1, updated_at=NOW() WHERE id=?', [after.full_name, after.nik, after.nisn, after.gender, after.category, after.class_group, r.pm_id]);
    if (before) {
      await conn.query('INSERT INTO pm_change_history(pm_id,effective_from,action,before_data,after_data,reason,actor_id) VALUES(?,?,?,?,?,?,?)', [r.pm_id, effDate, 'UPDATE', JSON.stringify(before), JSON.stringify(after), reasonText, userId]);
    }
  } else {
    // PM_BARU
    const [pr] = await conn.query('INSERT INTO pm(kpm_id,full_name,nik,nisn,gender,category,class_group,active,approval_status) VALUES(?,?,?,?,?,?,?,1,?)', [s.kpm_id, r.full_name, r.nik || null, r.nisn || null, r.gender, r.category, r.class_group || null, 'AKTIF']);
    var newPmId = pr.insertId;
    await conn.query('UPDATE kpm_pm_submission_rows SET pm_id=? WHERE id=?', [newPmId, r.id]);
    const [[afterNew]] = await conn.query('SELECT * FROM pm WHERE id=?', [newPmId]);
    await conn.query('INSERT INTO pm_change_history(pm_id,effective_from,action,before_data,after_data,reason,actor_id) VALUES(?,?,?,?,?,?,?)', [newPmId, effDate, 'CREATE', null, JSON.stringify(afterNew), reasonText, userId]);
  }
}

/**
 * Sinkronisasi data harian agregasi KPM (kpm_daily_data)
 * Menghitung seluruh PM aktif terkini dan melakukan upsert pada tanggal efektif.
 */
async function syncKpmDailyData(conn, kpmId, effectiveFrom) {
  const [activeRows] = await conn.query('SELECT category, gender, class_group FROM pm WHERE kpm_id=? AND active=1', [kpmId]);
  var ar = activeRows || [];
  var bm = ar.filter(p => p.category === 'BALITA' && p.gender === 'L').length;
  var bf = ar.filter(p => p.category === 'BALITA' && p.gender === 'P').length;
  var bmil = ar.filter(p => p.category === 'BUMIL').length;
  var bsui = ar.filter(p => p.category === 'BUSUI').length;
  var sm = ar.filter(p => p.category === 'PESERTA_DIDIK' && p.gender === 'L').length;
  var sf = ar.filter(p => p.category === 'PESERTA_DIDIK' && p.gender === 'P').length;
  var tm = ar.filter(p => p.category === 'PENDIDIK' && p.gender === 'L').length;
  var tf = ar.filter(p => p.category === 'PENDIDIK' && p.gender === 'P').length;
  var stm = ar.filter(p => p.category === 'TENAGA_KEPENDIDIKAN' && p.gender === 'L').length;
  var stf = ar.filter(p => p.category === 'TENAGA_KEPENDIDIKAN' && p.gender === 'P').length;
  var lm = ar.filter(p => p.category === 'PESERTA_DIDIK' && (p.class_group || '').toLowerCase().includes('besar') && p.gender === 'L').length;
  var lf = ar.filter(p => p.category === 'PESERTA_DIDIK' && (p.class_group || '').toLowerCase().includes('besar') && p.gender === 'P').length;

  const [[ex]] = await conn.query('SELECT id FROM kpm_daily_data WHERE kpm_id=? AND effective_from=? LIMIT 1', [kpmId, effectiveFrom]);
  if (ex) {
    await conn.query('UPDATE kpm_daily_data SET balita_male=?, balita_female=?, bumil=?, busui=?, small_male=?, small_female=?, teacher_male=?, teacher_female=?, staff_male=?, staff_female=?, large_male=?, large_female=? WHERE id=?', [bm, bf, bmil, bsui, sm, sf, tm, tf, stm, stf, lm, lf, ex.id]);
  } else {
    await conn.query('INSERT INTO kpm_daily_data(kpm_id, effective_from, balita_male, balita_female, bumil, busui, small_male, small_female, teacher_male, teacher_female, staff_male, staff_female, large_male, large_female, created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)', [kpmId, effectiveFrom, bm, bf, bmil, bsui, sm, sf, tm, tf, stm, stf, lm, lf]);
  }
}

module.exports = {
  toFiniteId,
  parseValidationMeta,
  applyPmRowMutation,
  syncKpmDailyData
};
