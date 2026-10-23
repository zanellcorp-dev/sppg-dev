/**
 * SPPG Monitoring - Formatter & Utilitas Teks / Tanggal / Angka
 * Modul pembantu mandiri untuk standarisasi tampilan data pada view EJS.
 */

'use strict';

var UPPER_TOKENS = new Set([
  'SD', 'SDN', 'SDIT', 'SMP', 'SMPN', 'SMA', 'SMAN', 'SMK', 'SMKN',
  'MI', 'MIN', 'MTS', 'MTSN', 'MA', 'MAN', 'PAUD', 'TK', 'TKIT', 'KB',
  'RA', 'SLB', 'RT', 'RW', 'NIK', 'NISN', 'NPSN', 'SPPG', 'BGN', 'KPM',
  'SP', 'POS'
]);

var SPECIAL_TITLES = {
  's.pd': 'S.Pd.',
  's.pd.': 'S.Pd.',
  'm.kom': 'M.Kom.',
  'm.kom.': 'M.Kom.',
  's.kom': 'S.Kom.',
  's.kom.': 'S.Kom.',
  'm.pd': 'M.Pd.',
  'm.pd.': 'M.Pd.',
  's.e': 'S.E.',
  's.e.': 'S.E.',
  's.t': 'S.T.',
  's.t.': 'S.T.',
  's.sos': 'S.Sos.',
  's.sos.': 'S.Sos.',
  'dr.': 'Dr.',
  'dra.': 'Dra.',
  'drs.': 'Drs.'
};

var LOWER_WORDS = new Set(['dan', 'atau', 'di', 'ke', 'dari', 'yang', 'pada', 'untuk', 'dengan', 'bin', 'binti']);

/**
 * Mengubah nama/teks menjadi Title Case, mempertahankan singkatan baku & gelar,
 * dan memisahkan token berdasarkan spasi, tanda hubung, titik, garis miring, koma, kurung.
 * @param {string|any} str 
 * @returns {string}
 */
function formatTitleCase(str) {
  if (str === null || str === undefined) return '—';
  var s = String(str).replace(/\s+/g, ' ').trim();
  if (!s) return '—';

  // Lindungi gelar bertitik (seperti S.Pd., M.Kom.) sebelum pembelahan token
  var placeholders = [];
  s = s.replace(/\b([A-Za-z]\.[A-Za-z]+(?:\.[A-Za-z]+)*\.?)/gi, function(m) {
    var k = m.toLowerCase();
    var cleanK = k.endsWith('.') ? k.slice(0, -1) : k;
    if (SPECIAL_TITLES[k] || SPECIAL_TITLES[cleanK]) {
      var idx = placeholders.length;
      placeholders.push(SPECIAL_TITLES[k] || SPECIAL_TITLES[cleanK]);
      return '___TIT_' + idx + '___';
    }
    return m;
  });

  // Pisahkan token berdasarkan spasi, tanda hubung, titik, garis miring, koma, kurung
  var parts = s.split(/([\s\-\.\/\,\(\)]+)/);
  var wordCount = 0;

  var res = parts.map(function(part) {
    if (!part || /^[\s\-\.\/\,\(\)]+$/.test(part)) return part;
    if (part.startsWith('___TIT_') && part.endsWith('___')) {
      var idx = parseInt(part.replace('___TIT_', '').replace('___', ''), 10);
      wordCount++;
      return placeholders[idx] || part;
    }
    var up = part.toUpperCase();
    if (UPPER_TOKENS.has(up)) {
      wordCount++;
      return up;
    }
    var low = part.toLowerCase();
    if (wordCount > 0 && LOWER_WORDS.has(low)) {
      wordCount++;
      return low;
    }
    wordCount++;
    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
  }).join('');

  return res.replace(/\s+/g, ' ').trim();
}

/**
 * Memastikan singkatan/kode (NIK, NPSN, SPPG, kode KPM) tetap UPPERCASE dan bersih dari whitespace berlebih.
 * @param {string|any} str 
 * @returns {string}
 */
function formatUpper(str) {
  if (str === null || str === undefined) return '—';
  var val = String(str).trim();
  return val ? val.toUpperCase() : '—';
}

/**
 * Format tanggal resmi Indonesia (contoh: "18 Oktober 2026").
 * @param {string|Date|any} dateStr 
 * @param {boolean} withTime Opsional: sertakan jam:menit
 * @returns {string}
 */
function formatDateIndo(dateStr, withTime) {
  if (!dateStr) return '—';
  var d = (dateStr instanceof Date) ? dateStr : new Date(dateStr);
  if (isNaN(d.getTime())) {
    // Jika format YYYY-MM-DD murni
    var parts = String(dateStr).slice(0, 10).split('-');
    if (parts.length === 3) {
      var y = parseInt(parts[0], 10);
      var m = parseInt(parts[1], 10) - 1;
      var day = parseInt(parts[2], 10);
      d = new Date(y, m, day);
      if (isNaN(d.getTime())) return String(dateStr);
    } else {
      return String(dateStr);
    }
  }

  var months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  var day = d.getDate();
  var month = months[d.getMonth()] || '';
  var year = d.getFullYear();
  var res = day + ' ' + month + ' ' + year;

  if (withTime) {
    var hh = String(d.getHours()).padStart(2, '0');
    var mm = String(d.getMinutes()).padStart(2, '0');
    res += ' pukul ' + hh + ':' + mm + ' WIB';
  }

  return res;
}

/**
 * Format angka ribuan standar lokal Indonesia (contoh: 1.000, 25.500).
 * @param {number|string|any} num 
 * @returns {string}
 */
function formatNumber(num) {
  if (num === null || num === undefined || num === '') return '0';
  var n = Number(num);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('id-ID');
}

/**
 * Mengembalikan fallback (default: '—') jika data null, undefined, atau string kosong
 * agar sel tabel dan kartu tidak menciut/kempis.
 * @param {any} val 
 * @param {string} fallback 
 * @returns {string}
 */
function fallbackEmpty(val, fallback) {
  var fb = (fallback !== undefined && fallback !== null) ? fallback : '—';
  if (val === null || val === undefined) return fb;
  var s = String(val).trim();
  return s === '' ? fb : s;
}

/**
 * Memotong teks panjang diakhiri "..." agar tata letak mobile/kartu tetap simetris.
 * @param {string|any} str 
 * @param {number} max 
 * @returns {string}
 */
function truncateText(str, max) {
  var limit = (typeof max === 'number' && max > 0) ? max : 80;
  if (str === null || str === undefined) return '';
  var s = String(str).trim();
  if (s.length <= limit) return s;
  return s.slice(0, limit).trim() + '...';
}

module.exports = {
  formatTitleCase,
  formatUpper,
  formatDateIndo,
  formatNumber,
  fallbackEmpty,
  truncateText
};
