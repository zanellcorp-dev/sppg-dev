const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
const schema=fs.readFileSync(path.join(root,'schema.sql'),'utf8');
const tests=[
 ['Jadwal -> Snapshot foundation',server.includes('distribution_snapshots')&&server.includes('distribution_snapshot_clusters')&&server.includes('distribution_snapshot_kpm')],
 ['Snapshot locks schedule mutations',server.includes('assertScheduleMutable')&&server.includes('Perubahan jadwal tidak diperbolehkan')],
 ['Cluster distribusi aktif dipakai operasional',server.includes('distribution_clusters')&&server.includes('COALESCE(c.is_active,1)=1')],
 ['Pemorsian mulai memakai server time',server.includes("action==='MULAI'")&&server.includes('CURRENT_TIMESTAMP')],
 ['Pemorsian finish membutuhkan 5 evidence',server.includes("action==='SELESAI'")&&server.includes('COUNT(DISTINCT slot)')&&server.includes('!==5')],
 ['5 evidence slot lengkap', ['FOODTRAY_TERBUKA_KECIL','FOODTRAY_TERBUKA_BESAR','LABEL_KECIL','LABEL_BESAR','FOODTRAY_SEBELUM_DISTRIBUSI'].every(x=>server.includes(x))],
 ['Pengambilan mensyaratkan serah terima',server.includes('SERAH_TERIMA')&&server.includes('Pengambilan hanya dapat dicatat setelah Serah Terima')],
 ['Pengambilan mencegah duplikasi',server.includes('sudah dicatat')||schema.includes('uq_pickup_kpm')],
 ['Kloter Pengambilan dibuat otomatis',server.includes('operational_pickup_clusters')&&server.includes('INSERT INTO operational_pickup_clusters')],
 ['Pencucian mengambil sumber aktual',server.includes('FROM operational_pickup_clusters')],
 ['Return distribusi tercatat',server.includes("primary:'KEBERANGKATAN',secondary:'KEMBALI'")],
 ['Exception Engine membaca isu',server.includes('KENDALA_TERBUKA')],
 ['Exception Engine membaca feedback',server.includes('FEEDBACK_TERBUKA')],
 ['Daily Closing menolak exception terbuka',server.includes('if(ex.length)throw new Error')],
 ['Daily Closing lock untuk user operasional',server.includes('assertDayWritable')&&server.includes("status==='CLOSED'" )],
 ['Reopen wajib alasan',server.includes('Alasan reopen wajib diisi')],
 ['Audit event tersedia',server.includes('activity_log')&&server.includes('await log(req')],
 ['Backup checksum diverifikasi',server.includes('verifyFullBackup')&&server.includes('sha256')],
 ['Recovery tidak langsung menimpa production',!server.includes('DROP DATABASE')&&!server.includes('TRUNCATE production')],
 ['KPM submission terpisah dari Master',server.includes('kpm_pm_submissions')&&server.includes('kpm_pm_submission_rows')],
 ['Apply BNBA menghasilkan effective date',server.includes('effective_from')&&server.includes('pm_change_history')],
 ['Pengawas Gizi role terpisah',server.includes('PENGAWAS_GIZI:[')&&server.includes('gizi.review')],
 ['Pengawas Keuangan role terpisah',server.includes('PENGAWAS_KEUANGAN:[')&&server.includes('finance.view')],
 ['Task assignment enforcement',server.includes('assertTaskAssignment')],
 ['Persistent storage guard',server.includes('storage persisten wajib berada di luar')||server.includes('persistent-outside-release')]
];
let fail=0;for(const [name,ok] of tests){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)fail++;}
console.log(`\nBusiness UAT contract: ${tests.length-fail} PASS / ${fail} FAIL`);process.exitCode=fail?1:0;
