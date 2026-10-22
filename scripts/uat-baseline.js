const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
const schema=fs.readFileSync(path.join(root,'schema.sql'),'utf8');
const tests=[
 ['baseline version',server.includes("APP_VERSION='1.8.36.4'")],
 ['no staging reference',!server.toLowerCase().includes('staging.sppgline.com')],
 ['no QC implementation',!server.includes('QC PASS')&&!server.includes('QC gate')&&!server.includes('qc_status')],
 ['five portioning evidence slots',server.includes('FOODTRAY_TERBUKA_KECIL')&&server.includes('FOODTRAY_TERBUKA_BESAR')&&server.includes('LABEL_KECIL')&&server.includes('LABEL_BESAR')&&server.includes('FOODTRAY_SEBELUM_DISTRIBUSI')],
 ['server timestamps for portioning',server.includes('CURRENT_TIMESTAMP')],
 ['pickup creates automatic pickup cluster',server.includes('operational_pickup_clusters')],
 ['washing reads actual pickup',server.includes("FROM operational_pickup_clusters")],
 ['daily closing lock',server.includes('assertDayWritable')&&server.includes('daily_closings')],
 ['reopen requires reason',server.includes('Alasan reopen wajib diisi.')],
 ['exception engine',server.includes('calculateExceptions')],
 ['issue lifecycle history',server.includes('CREATE TABLE IF NOT EXISTS operational_issue_updates')],
 ['feedback lifecycle',server.includes('operational_feedback_updates')&&server.includes("DITUTUP")],
 ['task assignment enforcement',server.includes('assertTaskAssignment')],
 ['data kpm pm isolated',server.includes('kpm_pm_submissions')&&server.includes('kpm_pm_submission_rows')],
 ['effective-date PM history',server.includes('pm_change_history')&&server.includes('effective_from')],
 ['persistent storage guard',server.includes('storage persisten wajib berada di luar folder aplikasi/release')],
 ['backup checksum',server.includes('sha256')&&server.includes('verifyFullBackup')],
 ['backup integrity verification route',server.includes("app.post('/backup/verify/:id'")],
 ['backup schema checksum column',schema.includes('sha256 CHAR(64)')],
 ['CSRF on backup actions',server.includes("requireCsrf(req,res)")||server.includes("csrfValid(req,req.body._csrf)")],
 ['health endpoint',server.includes("app.get('/health'")],
 ['audit log',server.includes('activity_log')],
 ['KPM statement upload and persistent storage',server.includes("kpm_portal_statements")&&server.includes("upload.single('file')")&&server.includes('resolveStoredFile')],
 ['KPM statement replacement preserves history',server.includes('SET is_current=0 WHERE kpm_id=?')&&server.includes('is_current=1')],
];
let fail=0;for(const [name,ok] of tests){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)fail++;}
console.log(`\nResult: ${tests.length-fail} PASS / ${fail} FAIL`);process.exitCode=fail?1:0;
