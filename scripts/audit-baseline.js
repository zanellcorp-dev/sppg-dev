const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
const schema=fs.readFileSync(path.join(root,'schema.sql'),'utf8');
const checks=[
 ['version 1.8.36.4',server.includes("APP_VERSION='1.8.36.4'")],
 ['no staging.sppgline reference',!server.toLowerCase().includes('staging.sppgline')],
 ['no KLoter typo',!server.includes("'KLoter'")],
 ['Pengawas Gizi role',server.includes('PENGAWAS_GIZI')],
 ['Pengawas Keuangan role',server.includes('PENGAWAS_KEUANGAN')],
 ['issues lifecycle route',server.includes("app.post('/issues/:id/status'")],
 ['feedback route',server.includes("app.post('/feedback'")],
 ['cluster cancellation non-destructive',server.includes('cancellation_reason')&&!server.includes('DELETE FROM distribution_clusters')],
 ['persistent storage guard',server.includes('DATA_DIR tidak aman: storage persisten wajib berada di luar folder aplikasi/release.')],
 ['CSRF',server.includes('function csrfValid')],
 ['health endpoint',server.includes("app.get('/health'")],
 ['kpm daily effective data',server.includes('kpm_daily_data')],
 ['audit log',server.includes('activity_log')],
 ['schema includes issues',schema.includes('operational_issues')],
 ['schema includes feedback',schema.includes('operational_feedback')],
 ['DATA KPM PM permission',server.includes('data_kpm_pm.view')&&server.includes('data_kpm_pm.review')],
 ['DATA KPM PM isolated submission tables',server.includes('kpm_pm_submissions')&&server.includes('kpm_pm_submission_rows')&&server.includes('kpm_pm_submission_history')],
 ['DATA KPM PM explicit review before apply',server.includes("s.status!=='DISETUJUI'")&&server.includes("status='DISETUJUI'")],
 ['DATA KPM PM apply marks applied',server.includes("DITERAPKAN")],
 ['DATA KPM PM submission is separate from Master',server.includes("INSERT INTO kpm_pm_submissions")&&!server.includes("UPDATE kpm SET name=.*DIAJUKAN")],
 ['PM effective-date history',server.includes('pm_change_history')&&schema.includes('pm_change_history')],
 ['KPM portal token access',server.includes('kpm_portal_tokens')&&server.includes("/portal/kpm/:token")],
 ['Apply records effective_from',server.includes('pm_change_history')&&server.includes('s.effective_from')],
 ['team scope enforcement',server.includes('function assertTeamScope')&&server.includes('assertTeamScope(req,team,true)')],
 ['task assignment enforcement',server.includes('function assertTaskAssignment')&&server.includes('operational_task_assignments')],
 ['task assignment routes',server.includes("app.post('/work/assignment'")&&server.includes("app.post('/work/assignment/remove'")],
 ['team_members schema has single is_active',(()=>{const m=server.match(/CREATE TABLE IF NOT EXISTS team_members \(([\s\S]*?)\) ENGINE=InnoDB/); return !!m && (m[1].match(/\bis_active\s+TINYINT/gi)||[]).length===1;})()],
 ['no stale css cache version',!server.includes('style.css?v=1.8.36.3')],
 ['KPM portal statement upload',server.includes('kpm_portal_statements')&&server.includes("/portal/kpm/:token/statement")&&server.includes('SURAT_PERNYATAAN')],
 ['KPM portal statement scoped access',server.includes("WHERE id=? AND kpm_id=?")&&server.includes('resolveStoredFile(statement.file_path)')],
];
let fail=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)fail++;}
console.log(`\nResult: ${checks.length-fail} PASS / ${fail} FAIL`);process.exitCode=fail?1:0;
