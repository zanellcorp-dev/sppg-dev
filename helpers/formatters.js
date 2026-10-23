/**
 * SPPG Monitoring - Formatter & Utilitas Teks / Tanggal / Angka
 * Modul pembantu mandiri untuk standarisasi tampilan data pada view EJS.
 */

'use strict';

/**
 * Mengubah nama/teks menjadi Title Case dan membersihkan spasi ganda.
 * Contoh: "sd negeri   01 kebondanas" -> "SD Negeri 01 Kebondanas" (atau title case teratur)
 * @param {string|any} str 
 * @returns {string}
 */
function formatTitleCase(str) {
  if (str === null || str === undefined) return '—';
  var cleaned = String(str).replace(/\s+/g, ' ').trim();
  if (!cleaned) return '—';
  
  // Kata-kata umum singkatan/partikel yang dapat disesuaikan
  var lowerWords = new Set(['dan', 'atau', 'di', 'ke', 'dari', 'yang', 'pada', 'untuk', 'dengan', 'bin', 'binti']);
  var upperWords = new Set(['sd', 'smp', 'sma', 'smk', 'mi', 'mts', 'ma', 'paud', 'tk', 'ra', 'tklb', 'slb', 'sppg', 'bgn', 'kpm', 'nik', 'nisn', 'npsn', 'rt', 'rw', 'sk', 'ktp', 'sop']);

  return cleaned.split(' ').map(function(word, idx) {
    var lower = word.toLowerCase();
    if (upperWords.has(lower)) {
      return lower.toUpperCase();
    }
    if (idx > 0 && lowerWords.has(lower)) {
      return lower;
    }
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
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
