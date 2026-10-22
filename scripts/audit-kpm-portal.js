const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
const kpmViewFiles=['portal.ejs','posyandu-card.ejs','education-card.ejs','pm-management.ejs','posyandu-pm-updater.ejs'];
const view=kpmViewFiles.map(f=>{const p=path.join(root,'views/kpm',f);return fs.existsSync(p)?fs.readFileSync(p,'utf8'):''}).join('\n');
let pass=0,fail=0;function ok(name,cond){if(cond){console.log('PASS',name);pass++}else{console.log('FAIL',name);fail++}}
ok('preview route exists',server.includes("app.get('/portal/kpm/preview/:id"));
ok('portal token route exists',server.includes("app.get('/portal/kpm/:token'"));
ok('same portal view used by preview',server.includes("res.render('kpm/portal',{title:'Preview Portal KPM'"));
ok('same portal view used by token',server.includes("res.render('kpm/portal',{title:'Portal KPM'"));
ok('portal scoped by kpm_id',server.includes('WHERE kpm_id=? ORDER BY FIELD(category'));
ok('school identity fields',view.includes('NPSN')&&view.includes('Kepala Satuan Pendidikan')&&view.includes('PIC MBG Satuan Pendidikan'));
ok('posyandu identity fields',view.includes('Kader Posyandu'));
ok('coordinates and View Maps',(view.includes('View Maps')||view.includes('Buka Google Maps'))&&view.includes('google.com/maps/search'));
ok('PM school groups',view.includes("['PENDIDIK','Pendidik']")&&view.includes("['TENAGA_KEPENDIDIKAN','Tenaga Kependidikan']")&&view.includes("['PESERTA_DIDIK','Peserta Didik']"));
ok('PM posyandu groups',view.includes("['BALITA','Balita']")&&view.includes("['BUMIL','Bumil']")&&view.includes("['BUSUI','Busui']"));
ok('statement section',view.includes('Surat Pernyataan KPM'));
ok('preview does not expose wrong edit route',!view.includes("previewMode ? '/data-kpm-pm/new'"));
ok('master KPM identity is loaded',server.includes('head_name,head_phone,pic_name,pic_phone,cadre_name,cadre_phone,latitude,longitude'));
ok('data completeness warning',server.includes('function kpmProfileMissing')&&view.includes('Data belum dilengkapi oleh KPM'));
ok('KPM profile edit route',server.includes("app.get('/portal/kpm/:token/profile/edit'")&&server.includes("app.post('/portal/kpm/:token/profile/edit'"));
ok('profile edits require review before master apply',server.includes('kpm_portal_profile_submissions')&&server.includes('DITERAPKAN'));
ok('internal profile review',server.includes("app.get('/kpm/portal-profile-submissions'")&&server.includes("app.post('/kpm/portal-profile-submissions/:id"));
ok('profile edit view',fs.existsSync(path.join(root,'views/kpm/portal-profile-edit.ejs')));
ok('profile review view',fs.existsSync(path.join(root,'views/kpm/portal-profile-submissions.ejs')));
console.log(`\nKPM portal audit: ${pass} PASS / ${fail} FAIL`);process.exit(fail?1:0)
