require('dotenv').config();
const path=require('path'),fs=require('fs'),crypto=require('crypto');
const express=require('express'),session=require('express-session'),helmet=require('helmet'),bcrypt=require('bcryptjs'),mysql=require('mysql2/promise'),multer=require('multer'),methodOverride=require('method-override'),XLSX=require('xlsx'),zlib=require('zlib'),stream=require('stream'),child_process=require('child_process'),util=require('util');
const execFile=util.promisify(child_process.execFile);

const app=express();
app.set('views',path.join(__dirname,'views'));
app.set('view engine','ejs');
const PORT=3000;
const APP_VERSION='1.8.36.4';
// Persistent storage: keep uploaded files outside the release/application directory.
// This prevents ZIP deployments from deleting photos/documents.
const configuredDataDir=String(process.env.DATA_DIR||'').trim();
const defaultDataDir = __dirname === '/' ? '/tmp/.sppg-monitoring-data' : path.join(__dirname,'..','.sppg-monitoring-data');
const dataDir=path.resolve(configuredDataDir||defaultDataDir);
// Compatibility: accept historical upload locations without copying/deleting user files.
const legacyDataUploadDir=path.resolve(path.join(defaultDataDir,'uploads'));
const dataDirRelative=path.relative(__dirname,dataDir);
if(__dirname !== '/' && (dataDir===__dirname||(!dataDirRelative.startsWith('..'+path.sep)&&dataDirRelative!=='..'))){
  throw new Error('DATA_DIR tidak aman: storage persisten wajib berada di luar folder aplikasi/release.');
}
const configuredUploadDir=String(process.env.UPLOAD_DIR||'uploads').trim();
const uploadDir=path.resolve(path.isAbsolute(configuredUploadDir)?configuredUploadDir:path.join(dataDir,configuredUploadDir));
const legacyUploadDir=path.resolve(path.join(__dirname,'uploads'));
const backupDir=path.join(dataDir,'backups');
const isProduction=process.env.NODE_ENV==='production';
const allowedRoles=new Set(['ADMIN','ASLAP','KASP','PENGAWAS_GIZI','PENGAWAS_KEUANGAN','PERSIAPAN','PENGOLAHAN','PEMORSIAN','DISTRIBUSI','PENCUCIAN']);
const operationalTeams=['PERSIAPAN','PENGOLAHAN','PEMORSIAN','DISTRIBUSI','PENCUCIAN'];
const permissionCatalog={
  'dashboard.view':'Dashboard',
  'executive.view':'Ruang Pimpinan & Audit — lihat', 'executive.manage':'Pusat Persetujuan & Kunci Pimpinan — kelola',
  'profile.view':'Profil SPPG — lihat', 'profile.manage':'Profil SPPG — kelola',
  'staff.view':'Kepegawaian — lihat', 'staff.manage':'Kepegawaian — kelola',
  'documents.view':'Dokumen & SOP — lihat', 'documents.manage':'Dokumen & SOP — kelola',
  'quick_links.view':'Akses Cepat — lihat', 'quick_links.manage':'Akses Cepat — kelola',
  'kpm.view':'Master KPM — lihat', 'kpm.manage':'Master KPM — kelola',
  'menu.view':'Master Menu — lihat', 'menu.manage':'Master Menu — kelola',
  'foodtray.view':'Label Foodtray — lihat', 'foodtray.manage':'Label Foodtray — kelola',
  'distribution.view':'Jadwal Distribusi — lihat', 'distribution.manage':'Jadwal Distribusi — kelola',
  'work.view':'Pekerjaan Tim — lihat', 'work.execute':'Pekerjaan Tim — eksekusi',
  'documentation.view':'Dokumentasi — lihat', 'documentation.manage':'Dokumentasi — kelola',
  'reports.view':'Laporan — lihat', 'roles.manage':'Role & Pengguna — kelola',
  'settings.manage':'Pengaturan — kelola', 'activity.view':'Aktivitas Sistem — lihat',
  'backup.manage':'Backup & Data — kelola',
  'gizi.review':'Pengawasan Gizi — review',
  'gizi.feedback':'Pengawasan Gizi — feedback',
  'finance.view':'Keuangan SPPG — lihat',
  'finance.manage':'Keuangan SPPG — kelola',
  'finance.export':'Keuangan SPPG — export',
  'issues.view':'Kendala — lihat', 'issues.manage':'Kendala — kelola',
  'feedback.view':'Feedback — lihat', 'feedback.manage':'Feedback — kelola',
  'data_kpm_pm.view':'DATA KPM PM — lihat', 'data_kpm_pm.manage':'DATA KPM PM — kelola', 'data_kpm_pm.review':'DATA KPM PM — review',
  'executive.view':'Tata Kelola Pimpinan — lihat', 'executive.manage':'Tata Kelola Pimpinan — kelola'
};
const defaultRolePermissions={
  ADMIN:Object.keys(permissionCatalog),
  ASLAP:['dashboard.view','executive.view','executive.manage','issues.view','issues.manage','feedback.view','feedback.manage','profile.view','staff.view','staff.manage','documents.view','documents.manage','quick_links.view','quick_links.manage','kpm.view','kpm.manage','menu.view','menu.manage','foodtray.view','foodtray.manage','distribution.view','distribution.manage','work.view','work.execute','documentation.view','documentation.manage','reports.view','activity.view','backup.manage','data_kpm_pm.view','data_kpm_pm.manage','data_kpm_pm.review'],
  KASP:['dashboard.view','executive.view','executive.manage','issues.view','issues.manage','feedback.view','feedback.manage','profile.view','staff.view','staff.manage','documents.view','kpm.view','menu.view','foodtray.view','distribution.view','work.view','work.execute','documentation.view','reports.view','activity.view','data_kpm_pm.view','data_kpm_pm.review'],
  PENGAWAS_GIZI:['dashboard.view','executive.view','profile.view','staff.view','documents.view','kpm.view','menu.view','foodtray.view','distribution.view','work.view','documentation.view','reports.view','gizi.review','gizi.feedback','issues.view','feedback.view','data_kpm_pm.view','data_kpm_pm.review'],
  PENGAWAS_KEUANGAN:['dashboard.view','executive.view','profile.view','staff.view','documents.view','distribution.view','reports.view','finance.view','finance.manage','finance.export','activity.view'],
  PERSIAPAN:['dashboard.view','work.view','work.execute','documentation.view','issues.view','issues.manage','feedback.view','feedback.manage'],
  PENGOLAHAN:['dashboard.view','work.view','work.execute','documentation.view','issues.view','issues.manage','feedback.view','feedback.manage'],
  PEMORSIAN:['dashboard.view','work.view','work.execute','documentation.view','issues.view','issues.manage','feedback.view','feedback.manage'],
  DISTRIBUSI:['dashboard.view','work.view','work.execute','documentation.view','issues.view','issues.manage','feedback.view','feedback.manage'],
  PENCUCIAN:['dashboard.view','work.view','work.execute','documentation.view','issues.view','issues.manage','feedback.view','feedback.manage']
};
const defaultAppSettings={app_name:'SPPG Monitoring',sppg_name:'SPPG Subang Pusakajaya',location_name:'Kebondanas',tagline:'Satuan Pelayanan Pemenuhan Gizi',logo_path:null,logo_name:null,favicon_path:null,favicon_name:null,opening_logo_path:null,opening_logo_name:null,login_logo_path:null,login_logo_name:null,portal_header_path:null,portal_header_name:null,portal_dashboard_title:'Pusat Data Penerima Manfaat',portal_dashboard_subtitle:'Kelola dan perbarui data penerima manfaat KPM',primary_color:'#007a5e',sidebar_color:'#0b2d61',sidebar_title_color:'#ffffff',sidebar_subtitle_color:'#20c878',sidebar_caption_color:'#9fb3ca',sidebar_menu_color:'#dce7f3',sidebar_menu_hover_color:'#ffffff',sidebar_menu_active_color:'#ffffff',sidebar_section_color:'#9fb3ca',sidebar_icon_color:'#dce7f3',sidebar_icon_active_color:'#20c878',font_family:'Arial',font_size_title:14,font_size_subtitle:12,font_size_caption:10,font_size_menu:14,font_size_section:11};
let appSettings={...defaultAppSettings};
const positions=['KaSPPG','Pengawas Gizi','Pengawas Keuangan','Asisten Lapangan','Chef','Tim Persiapan','Tim Pengolahan','Tim Pemorsian','Tim Distribusi','Kebersihan','Satpam'];
const docTypes=['E-KTP','NPWP','Pas Foto 4x6','Kartu Keluarga','Kesehatan','SKCK'];
const eduLevels=['SD/MI','SMP/MTs','SMA/SMK/MA','S1 (Strata I)'];
const statuses=['AKTIF','CUTI','NONAKTIF_SEMENTARA','MENGUNDURKAN_DIRI','MENINGGAL_DUNIA','DIBERHENTIKAN','KONTRAK_BERAKHIR','PINDAH_MUTASI'];
const levels=['PAUD/TK/RA/TKLB','SD/MI/SD SLB','SMP/MTs/SMP SLB/Pesantren Kelas 1-3','SMA/MA/SMK/SMA SLB/Pesantren Kelas 4-6'];
const cats=['PESERTA_DIDIK','PENDIDIK','TENAGA_KEPENDIDIKAN','BALITA','BUMIL','BUSUI'];
const sessionMaxDefault=8*60*60*1000;

const hasDbConfig=Boolean(String(process.env.DB_HOST||'').trim());
function fatalConfig(){
  const required=isProduction?['SESSION_SECRET','ADMIN_USERNAME','ADMIN_PASSWORD']:(hasDbConfig?['DB_HOST','DB_USER','DB_NAME']:[]);
  const missing=required.filter(k=>!String(process.env[k]||'').trim());
  if(missing.length) throw new Error('Konfigurasi wajib belum diisi: '+missing.join(', '));
  if(isProduction && String(process.env.SESSION_SECRET).length<64) throw new Error('SESSION_SECRET production wajib minimal 64 karakter.');
  if(isProduction && String(process.env.ADMIN_PASSWORD).length<12) throw new Error('ADMIN_PASSWORD production wajib minimal 12 karakter.');
}
fatalConfig();
app.set('trust proxy',1);
function ensureStorage(){ fs.mkdirSync(dataDir,{recursive:true}); fs.mkdirSync(uploadDir,{recursive:true}); fs.mkdirSync(backupDir,{recursive:true}); }
ensureStorage();
async function migrateLegacyUploads(){
  if(legacyUploadDir===uploadDir || !fs.existsSync(legacyUploadDir)) return;
  const entries=await fs.promises.readdir(legacyUploadDir,{withFileTypes:true});
  for(const e of entries){
    if(!e.isFile()) continue;
    const src=path.join(legacyUploadDir,e.name), dst=path.join(uploadDir,e.name);
    try { await fs.promises.access(dst); }
    catch { try { await fs.promises.copyFile(src,dst); } catch(err){ console.error('[STORAGE MIGRATION]',e.name,err.message); } }
  }
}
const storageMigrationPromise=migrateLegacyUploads().catch(e=>console.error('[STORAGE MIGRATION]',e));
function safeStoredName(value){ return path.basename(String(value||'')); }
async function resolveStoredFile(stored){
  const raw=String(stored||'').trim(); if(!raw) return null;
  await storageMigrationPromise;
  const name=safeStoredName(raw);
  const candidates=[];
  if(path.isAbsolute(raw)) candidates.push(path.resolve(raw));
  candidates.push(path.join(uploadDir,name));
  candidates.push(path.join(legacyUploadDir,name));
  if(legacyDataUploadDir!==uploadDir) candidates.push(path.join(legacyDataUploadDir,name));
  // Some older records stored a relative uploads/ prefix. Basename above keeps lookup safe.
  for(const candidate of candidates){
    try { if(fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate; } catch {}
  }
  return null;
}
async function removeUploaded(file){ if(file?.path) try{ await fs.promises.unlink(file.path); }catch{} }


const { createMockPool } = require('./mock-db');
let pool;
const isPlaceholderDb = !process.env.DB_PASSWORD || process.env.DB_PASSWORD === 'YOUR_DB_PASSWORD' || !hasDbConfig;
if (!isPlaceholderDb && process.env.MOCK_DB !== 'true') {
  try {
    pool = mysql.createPool({host:process.env.DB_HOST,port:Number(process.env.DB_PORT||3306),user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME,waitForConnections:true,connectionLimit:10,charset:'utf8mb4'});
  } catch (err) {
    console.warn('[AI Studio] MySQL createPool error, falling back to mock:', err.message);
    pool = createMockPool({ defaultAppSettings, operationalTeams, permissionCatalog, defaultRolePermissions });
  }
} else {
  console.log('[AI Studio] MySQL mock active (in-memory persistent session & database)');
  pool = createMockPool({ defaultAppSettings, operationalTeams, permissionCatalog, defaultRolePermissions });
}

class MySQLSessionStore extends session.Store{
  constructor(pool){super();this.pool=pool;this.ready=this.init()}
  async init(){await this.pool.query(`CREATE TABLE IF NOT EXISTS sppg_sessions (sid VARCHAR(255) NOT NULL PRIMARY KEY,sess LONGTEXT NOT NULL,expires_at BIGINT NULL,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB`)}
  get(sid,cb){this.ready.then(async()=>{const [r]=await this.pool.query('SELECT sess,expires_at FROM sppg_sessions WHERE sid=? LIMIT 1',[sid]);if(!r[0])return cb(null,null);if(r[0].expires_at&&Number(r[0].expires_at)<=Date.now()){await this.pool.query('DELETE FROM sppg_sessions WHERE sid=?',[sid]);return cb(null,null)}cb(null,JSON.parse(r[0].sess))}).catch(cb)}
  set(sid,sess,cb){this.ready.then(async()=>{const expires=sess.cookie&&sess.cookie.expires?new Date(sess.cookie.expires).getTime():null;await this.pool.query('INSERT INTO sppg_sessions(sid,sess,expires_at) VALUES(?,?,?) ON DUPLICATE KEY UPDATE sess=VALUES(sess),expires_at=VALUES(expires_at)',[sid,JSON.stringify(sess),expires]);cb&&cb(null)}).catch(e=>cb&&cb(e))}
  destroy(sid,cb){this.ready.then(()=>this.pool.query('DELETE FROM sppg_sessions WHERE sid=?',[sid])).then(()=>cb&&cb(null)).catch(e=>cb&&cb(e))}
  touch(sid,sess,cb){this.ready.then(async()=>{const expires=sess.cookie&&sess.cookie.expires?new Date(sess.cookie.expires).getTime():null;await this.pool.query('UPDATE sppg_sessions SET expires_at=? WHERE sid=?',[expires,sid]);cb&&cb(null)}).catch(e=>cb&&cb(e))}
  length(cb){this.ready.then(async()=>{const [[r]]=await this.pool.query('SELECT COUNT(*) count FROM sppg_sessions');cb(null,Number(r.count))}).catch(cb)}
  clear(cb){this.ready.then(()=>this.pool.query('DELETE FROM sppg_sessions')).then(()=>cb&&cb(null)).catch(e=>cb&&cb(e))}
  async prune(){await this.ready;await this.pool.query('DELETE FROM sppg_sessions WHERE expires_at IS NOT NULL AND expires_at<=?', [Date.now()])}
}
const sessionStore=new MySQLSessionStore(pool);

app.set('trust proxy', 1);

app.use(helmet({
  xFrameOptions: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'", "https:", "data:", "blob:"],
      baseUri: ["'self'"],
      fontSrc: ["'self'", "https:", "data:"],
      formAction: ["'self'"],
      frameAncestors: ["*"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://unpkg.com", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://cdn.jsdelivr.net"],
      connectSrc: ["'self'", "https:", "wss:", "ws:", "https://*.tile.openstreetmap.org", "https://tile.openstreetmap.org"],
      workerSrc: ["'self'", "blob:"]
    }
  }
}));

// Explicitly ensure no legacy X-Frame-Options blocks iframe embedding in AI Studio preview
app.use((req, res, next) => {
  res.removeHeader('X-Frame-Options');
  next();
});

app.use(express.urlencoded({extended:true,limit:'2mb'}));
app.use(express.json({limit:'2mb'}));
app.use(methodOverride('_method'));
app.use('/public',express.static(path.join(__dirname,'public'),{maxAge:isProduction?'1h':0}));
app.get('/health',async(req,res)=>{try{await pool.query('SELECT 1');await storageMigrationPromise;ensureStorage();res.status(200).json({status:'ok',app:'SPPG Monitoring',database:'ok',storage:'ok',storage_mode:'persistent-outside-release',time:new Date().toISOString()})}catch(e){res.status(503).json({status:'degraded',app:'SPPG Monitoring',database:'error',storage:'error',storage_mode:'persistent-outside-release',message:'Database atau storage belum tersedia',time:new Date().toISOString()})}});
app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'sppg-monitoring-session-secret-key-prod-2025',
  name: 'sppg.sid',
  resave: false,
  saveUninitialized: true,
  proxy: true,
  cookie: {
    httpOnly: true,
    sameSite: 'none',
    secure: 'auto',
    maxAge: sessionMaxDefault
  }
}));
let initPromise;
app.use((req,res,next)=>{if(req.path==='/health'||!initPromise)return next();initPromise.then(()=>next()).catch(()=>res.status(503).send('Aplikasi sedang menyiapkan database. Silakan coba lagi.'));});

// CSRF protection for every state-changing form, including login/logout.
function csrfValid(req,token){
  if(!token||!req.session.csrfToken)return false;
  const a=Buffer.from(String(token)),b=Buffer.from(String(req.session.csrfToken));
  return a.length===b.length&&crypto.timingSafeEqual(a,b);
}
const REVIEW_MODE = true; // Set to false before delivery to sibling / production
app.use((req,res,next)=>{
  if (REVIEW_MODE && !req.session.user) {
    req.session.user = { id: 1, username: 'admin', name: 'Administrator', role: 'ADMIN' };
  }
  if(!req.session.csrfToken) req.session.csrfToken=crypto.randomBytes(32).toString('hex');
  res.locals.csrfToken=req.session.csrfToken;
  res.locals.user=req.session.user||null;
  res.locals.appSettings=appSettings;
  res.locals.flash=req.session.flash||null;
  delete req.session.flash;
  if(['POST','PUT','PATCH','DELETE'].includes(req.method)){
    if(REVIEW_MODE) return next();
    // Multipart bodies are parsed by multer at the route level, so those routes perform the same check after parsing.
    const isMultipart=/^multipart\/form-data/i.test(req.get('content-type')||'');
    const token=req.body?req.body._csrf:req.get('x-csrf-token');
    if(req.path!=='/login'&&!isMultipart&&!csrfValid(req,token))return res.status(403).send('Permintaan ditolak: token keamanan tidak valid.');
  }
  next();
});
const sqlDate=v=>{if(v instanceof Date)return `${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,'0')}-${String(v.getDate()).padStart(2,'0')}`;return String(v||'').slice(0,10)};
const requireCsrf=(req,res)=>{if(REVIEW_MODE)return true;const token=req.body?req.body._csrf:req.get('x-csrf-token');if(!csrfValid(req,token)){res.status(403).send('Permintaan ditolak: token keamanan tidak valid.');return false}return true};

const flash=(req,type,message)=>{req.session.flash={type,message}};
const auth=(req,res,next)=>{
  if(REVIEW_MODE&&!req.session.user) req.session.user = { id: 1, username: 'admin', name: 'Administrator', role: 'ADMIN' };
  if(req.session.user&&allowedRoles.has(req.session.user.role))return next();
  req.session.user=null;return res.redirect('/login')
};
const ar=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
async function hasPermission(role,permissionKey){
  if(role==='ADMIN') return true;
  const [[row]]=await pool.query('SELECT rp.id FROM role_permissions rp JOIN permissions p ON p.id=rp.permission_id WHERE rp.role=? AND p.permission_key=? LIMIT 1',[role,permissionKey]);
  return !!row;
}
const requirePermission=permissionKey=>ar(async(req,res,next)=>{
  if(REVIEW_MODE&&!req.session.user) req.session.user = { id: 1, username: 'admin', name: 'Administrator', role: 'ADMIN' };
  if(!req.session.user||!allowedRoles.has(req.session.user.role)) return res.redirect('/login');
  if(await hasPermission(req.session.user.role,permissionKey)) return next();
  return res.status(403).render('module-dashboard',{title:'Akses Ditolak',kicker:'KEAMANAN',heading:'Akses Ditolak',description:'Akun Anda tidak memiliki izin untuk melakukan tindakan ini.',emptyTitle:'Tidak memiliki izin',emptyText:`Role ${req.session.user.role} tidak memiliki permission ${permissionKey}.`,actionHref:'/',actionLabel:'Kembali ke Dashboard'});
});
const requireAdmin=requirePermission('roles.manage');
const mutationPermission=(req)=>{
  const p=req.path;
  if(p==='/roles' || p.startsWith('/roles/')) return 'roles.manage';
  if(p==='/settings' || p.startsWith('/settings/')) return 'settings.manage';
  if(p==='/backup' || p.startsWith('/backup/')) return 'backup.manage';
  if(p==='/profile' || p.startsWith('/profile/')) return 'profile.manage';
  if(p==='/staff' || p.startsWith('/staff/')) return 'staff.manage';
  if(p==='/documents' || p.startsWith('/documents/')) return 'documents.manage';
  if(p==='/quick-links' || p.startsWith('/quick-links/')) return 'quick_links.manage';
  if(p==='/kpm' || p.startsWith('/kpm/')) return 'kpm.manage';
  if(p==='/menus' || p.startsWith('/menus/')) return 'menu.manage';
  if(p==='/foodtray' || p.startsWith('/foodtray/')) return 'foodtray.manage';
  if(p==='/distribution' || p.startsWith('/distribution/')) return 'distribution.manage';
  if(p==='/work' || p.startsWith('/work/')) return 'work.execute';
  if(p==='/documentation' || p.startsWith('/documentation/')) return 'documentation.manage';
  if(p==='/issues' || p.startsWith('/issues/')) return 'issues.manage';
  if(p==='/feedback' || p.startsWith('/feedback/')) return 'feedback.manage';
  return null;
};
app.use((req,res,next)=>{
  if(!['POST','PUT','PATCH','DELETE'].includes(req.method)||!req.session.user) return next();
  const permission=mutationPermission(req);
  if(!permission) return next();
  return hasPermission(req.session.user.role,permission).then(ok=>{
    if(ok) return next();
    return res.status(403).render('module-dashboard',{title:'Akses Ditolak',kicker:'KEAMANAN',heading:'Akses Ditolak',description:'Akun Anda tidak memiliki izin untuk melakukan tindakan ini.',emptyTitle:'Tidak memiliki izin',emptyText:`Role ${req.session.user.role} tidak memiliki permission ${permission}.`,actionHref:'/',actionLabel:'Kembali ke Dashboard'});
  }).catch(next);
});
const clean=v=>(v??'').toString().trim();
const code=p=>p+'-'+crypto.randomBytes(4).toString('hex').toUpperCase();
const canonicalKpmCode=(type,codeValue)=>type==='SATUAN_PENDIDIKAN'?/^KPM-SP-\d{3}$/.test(codeValue):/^KPM-POS-\d{3}$/.test(codeValue);
async function nextKpmCode(conn,type){
  const prefix=type==='POSYANDU'?'KPM-POS-':'KPM-SP-';
  const [rows]=await conn.query('SELECT code FROM kpm WHERE type=? AND code LIKE ?',[type,prefix+'%']);
  let max=0;
  for(const row of rows){const m=String(row.code||'').match(new RegExp('^'+prefix.replace('-','\\-')+'(\\d{3})$'));if(m)max=Math.max(max,Number(m[1]));}
  let n=max+1;
  while(n<=999){const candidate=prefix+String(n).padStart(3,'0');const [exists]=await conn.query('SELECT id FROM kpm WHERE code=? LIMIT 1',[candidate]);if(!exists.length)return candidate;n++;}
  throw new Error('Nomor Kode KPM sudah mencapai batas 999 untuk jenis ini.');
}
function normalizedName(v){return clean(v).replace(/\s+/g,' ').toLocaleLowerCase('id-ID');}
const safeInt=v=>Number.isFinite(Number(v))?Math.max(0,Math.floor(Number(v))):0;
const validDate=v=>!v||/^\d{4}-\d{2}-\d{2}$/.test(v);
const validNik=v=>!v||/^\d{16}$/.test(v);
const validPhone=v=>!v||/^[0-9+()\-\s]{7,30}$/.test(v);
const validEmail=v=>!v||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

function clientIp(req){return clean((req.ip||req.socket.remoteAddress||'').replace('::ffff:','')).slice(0,100)}
async function logPortal(req,access,action,entityType,entityId,description,after=null){
  await pool.query('INSERT INTO activity_log(user_id,action,entity_type,entity_id,description,before_json,after_json,ip_address,user_agent) VALUES(NULL,?,?,?,?,NULL,?,?,?)',[action,entityType,entityId,description,after?JSON.stringify(after):null,clientIp(req),clean(req.get('user-agent')).slice(0,500)||null]);
}
async function log(req,action,type,id,description,before=null,after=null){
  if(!req.session.user)return;
  await pool.query('INSERT INTO activity_log(user_id,action,entity_type,entity_id,description,before_json,after_json,ip_address,user_agent) VALUES(?,?,?,?,?,?,?,?,?)',[req.session.user.id,action,type,id,description||null,before?JSON.stringify(before):null,after?JSON.stringify(after):null,clientIp(req),clean(req.get('user-agent')).slice(0,500)||null]);
}
async function ensureColumn(table,column,definition){
  const [r]=await pool.query('SELECT COUNT(*) count FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? AND column_name=?',[table,column]);
  if(!Number(r[0].count)) await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
}
async function migrate(){
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(50) PRIMARY KEY,applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB`);
  await pool.query(`CREATE TABLE IF NOT EXISTS sppg_teams (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    team_code VARCHAR(30) NOT NULL UNIQUE,
    team_name VARCHAR(100) NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB`);
  for(const teamCode of operationalTeams){
    const teamName=teamCode==='PERSIAPAN'?'Persiapan':teamCode==='PENGOLAHAN'?'Pengolahan':teamCode==='PEMORSIAN'?'Pemorsian':teamCode==='DISTRIBUSI'?'Distribusi':'Pencucian';
    await pool.query('INSERT INTO sppg_teams(team_code,team_name) VALUES(?,?) ON DUPLICATE KEY UPDATE team_name=VALUES(team_name)',[teamCode,teamName]);
  }
  await ensureColumn('users','staff_id','INT UNSIGNED NULL');
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_users_staff_id ON users(staff_id)`).catch(async e=>{ if(!/duplicate key name|already exists/i.test(String(e.message))) throw e; });
  await pool.query(`CREATE TABLE IF NOT EXISTS team_members (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    team_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    left_at DATETIME NULL,
    assigned_by INT UNSIGNED NULL,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_team_user(team_id,user_id),
    INDEX idx_team_members_team(team_id,is_active),
    INDEX idx_team_members_user(user_id,is_active),
    CONSTRAINT fk_team_member_team FOREIGN KEY(team_id) REFERENCES sppg_teams(id) ON DELETE CASCADE,
    CONSTRAINT fk_team_member_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_team_member_assigned_by FOREIGN KEY(assigned_by) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB`);
  await pool.query(`CREATE TABLE IF NOT EXISTS operational_task_assignments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    work_date DATE NOT NULL,
    team ENUM('PERSIAPAN','PENGOLAHAN','PEMORSIAN','DISTRIBUSI','PENCUCIAN') NOT NULL,
    unit_type ENUM('KLOTER','KPM') NOT NULL,
    unit_id BIGINT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    assigned_by INT UNSIGNED NULL,
    assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    unassigned_at DATETIME NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    notes TEXT NULL,
    INDEX idx_task_assign(work_date,team,unit_type,unit_id,is_active),
    INDEX idx_task_assign_user(work_date,user_id,is_active),
    UNIQUE KEY uq_active_task_user(work_date,team,unit_type,unit_id,user_id,is_active),
    CONSTRAINT fk_task_assign_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_task_assign_by FOREIGN KEY(assigned_by) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB`);
  await pool.query(`ALTER TABLE users ADD CONSTRAINT fk_users_staff FOREIGN KEY(staff_id) REFERENCES staff(id) ON DELETE SET NULL`).catch(e=>{ if(!/duplicate|already exists|errno: 121/i.test(String(e.message))) throw e; });
  await pool.query(`CREATE TABLE IF NOT EXISTS operational_task_events (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    work_date DATE NOT NULL,
    team ENUM('PERSIAPAN','PENGOLAHAN','PEMORSIAN','DISTRIBUSI','PENCUCIAN') NOT NULL,
    unit_type ENUM('KLOTER','KPM') NOT NULL,
    unit_id BIGINT UNSIGNED NOT NULL,
    action VARCHAR(40) NOT NULL,
    note TEXT NULL,
    created_by INT UNSIGNED NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_task_event_lookup(work_date,team,unit_type,unit_id,created_at),
    INDEX idx_task_event_team(work_date,team,created_at)
  ) ENGINE=InnoDB`);
  await pool.query(`CREATE TABLE IF NOT EXISTS operational_issues (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    work_date DATE NOT NULL,
    team VARCHAR(30) NOT NULL,
    cluster_id BIGINT UNSIGNED NULL,
    cluster_kpm_id BIGINT UNSIGNED NULL,
    category VARCHAR(40) NOT NULL,
    impact VARCHAR(40) NOT NULL DEFAULT 'NO_IMPACT',
    priority VARCHAR(20) NOT NULL DEFAULT 'INFORMASI',
    description TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'BARU',
    pic_user_id INT UNSIGNED NULL,
    resolution_note TEXT NULL,
    created_by INT UNSIGNED NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_issue_date(work_date,team,status,created_at)
  ) ENGINE=InnoDB`);
  await pool.query(`CREATE TABLE IF NOT EXISTS operational_feedback (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    work_date DATE NOT NULL,
    team VARCHAR(30) NOT NULL,
    cluster_id BIGINT UNSIGNED NULL,
    cluster_kpm_id BIGINT UNSIGNED NULL,
    category VARCHAR(40) NOT NULL,
    description TEXT NOT NULL,
    created_by INT UNSIGNED NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_feedback_date(work_date,team,created_at)
  ) ENGINE=InnoDB`);
  await ensureColumn('operational_issues','last_activity_at','DATETIME NULL');
  await ensureColumn('operational_issues','resolution_note','TEXT NULL');
  await ensureColumn('operational_issues','pic_user_id','INT UNSIGNED NULL');
  await ensureColumn('operational_issues','updated_at','TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
  await ensureColumn('operational_feedback','status',"ENUM('BARU','DITINDAKLANJUTI','MENUNGGU','SELESAI','DITUTUP') NOT NULL DEFAULT 'BARU'");
  await ensureColumn('operational_feedback','pic_user_id','INT UNSIGNED NULL');
  await ensureColumn('operational_feedback','followup_note','TEXT NULL');
  await ensureColumn('operational_feedback','updated_at','TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
  await pool.query(`CREATE TABLE IF NOT EXISTS operational_issue_updates (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,issue_id BIGINT UNSIGNED NOT NULL,status VARCHAR(30) NULL,pic_user_id INT UNSIGNED NULL,note TEXT NULL,actor_user_id INT UNSIGNED NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,INDEX idx_issue_update(issue_id,created_at),CONSTRAINT fk_issue_update_issue FOREIGN KEY(issue_id) REFERENCES operational_issues(id) ON DELETE RESTRICT) ENGINE=InnoDB`);
  await pool.query(`CREATE TABLE IF NOT EXISTS operational_feedback_updates (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,feedback_id BIGINT UNSIGNED NOT NULL,status VARCHAR(30) NULL,pic_user_id INT UNSIGNED NULL,note TEXT NULL,actor_user_id INT UNSIGNED NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,INDEX idx_feedback_update(feedback_id,created_at),CONSTRAINT fk_feedback_update_feedback FOREIGN KEY(feedback_id) REFERENCES operational_feedback(id) ON DELETE RESTRICT) ENGINE=InnoDB`);
  await ensureColumn('operational_feedback','pic_user_id','INT UNSIGNED NULL');
  await ensureColumn('operational_feedback','followup_note','TEXT NULL');
  await ensureColumn('operational_feedback','updated_at','TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
  // Permission schema compatibility — NON-DESTRUCTIVE. Never MODIFY a legacy
  // permission column that may participate in an existing foreign key.
  await pool.query(`CREATE TABLE IF NOT EXISTS permissions (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,permission_key VARCHAR(100) NULL,label VARCHAR(180) NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB`);
  await ensureColumn('permissions','permission_key','VARCHAR(100) NULL');
  await ensureColumn('permissions','label','VARCHAR(180) NULL');
  const [permissionCols]=await pool.query('SELECT COLUMN_NAME FROM information_schema.columns WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?',['permissions']);
  const permissionColSet=new Set(permissionCols.map(x=>String(x.COLUMN_NAME||x.column_name)));
  if(permissionColSet.has('code')) await pool.query("UPDATE permissions SET permission_key=COALESCE(NULLIF(permission_key,''),NULLIF(code,'')) WHERE permission_key IS NULL OR permission_key=''");
  if(permissionColSet.has('name')) await pool.query("UPDATE permissions SET label=COALESCE(NULLIF(label,''),NULLIF(name,'')) WHERE label IS NULL OR label=''");
  await pool.query("UPDATE permissions SET permission_key=CONCAT('legacy.permission.',id) WHERE permission_key IS NULL OR permission_key=''");
  await pool.query("UPDATE permissions SET label=CONCAT('Legacy Permission ',id) WHERE label IS NULL OR label=''");
  const [dups]=await pool.query("SELECT permission_key FROM permissions GROUP BY permission_key HAVING COUNT(*)>1");
  for(const d of dups){ const [rows]=await pool.query('SELECT id FROM permissions WHERE permission_key=? ORDER BY id',[d.permission_key]); for(let i=1;i<rows.length;i++) await pool.query('UPDATE permissions SET permission_key=? WHERE id=?',[`${d.permission_key}.${rows[i].id}`,rows[i].id]); }
  const [[permissionIndex]]=await pool.query("SELECT COUNT(*) c FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='permissions' AND column_name='permission_key' AND non_unique=0");
  if(!Number(permissionIndex.c)) await pool.query('ALTER TABLE permissions ADD UNIQUE KEY uq_permissions_permission_key(permission_key)').catch(e=>{if(!/duplicate key name|already exists/i.test(String(e.message)))throw e});

  await pool.query(`CREATE TABLE IF NOT EXISTS role_permissions (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,role ENUM('ADMIN','ASLAP','KASP','PENGAWAS_GIZI','PENGAWAS_KEUANGAN','PERSIAPAN','PENGOLAHAN','PEMORSIAN','DISTRIBUSI','PENCUCIAN') NOT NULL,permission_id INT UNSIGNED NOT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,UNIQUE KEY uq_role_permission(role,permission_id),CONSTRAINT fk_role_perm_permission FOREIGN KEY(permission_id) REFERENCES permissions(id) ON DELETE CASCADE) ENGINE=InnoDB`);
  await ensureColumn('role_permissions','permission_id','INT UNSIGNED NULL');
  await ensureColumn('role_permissions','role',"ENUM('ADMIN','ASLAP','KASP','PENGAWAS_GIZI','PENGAWAS_KEUANGAN','PERSIAPAN','PENGOLAHAN','PEMORSIAN','DISTRIBUSI','PENCUCIAN') NULL");
  const [rpCols]=await pool.query('SELECT COLUMN_NAME,COLUMN_TYPE FROM information_schema.columns WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?',['role_permissions']);
  const rpColSet=new Set(rpCols.map(x=>String(x.COLUMN_NAME||x.column_name)));
  if(rpColSet.has('permission_key')) await pool.query('UPDATE role_permissions rp JOIN permissions p ON p.permission_key=rp.permission_key SET rp.permission_id=p.id WHERE rp.permission_id IS NULL');
  if(rpColSet.has('role_code')) await pool.query('UPDATE role_permissions SET role=role_code WHERE role IS NULL');
  // Only widen the role ENUM when necessary. permission_id is NEVER modified.
  const roleCol=rpCols.find(x=>String(x.COLUMN_NAME||x.column_name)==='role');
  if(roleCol && /^enum\(/i.test(String(roleCol.COLUMN_TYPE||roleCol.column_type))){
    const enumText=String(roleCol.COLUMN_TYPE||roleCol.column_type);
    const missing=['KASP','PENGAWAS_GIZI','PENGAWAS_KEUANGAN','PERSIAPAN','PENGOLAHAN','PEMORSIAN','DISTRIBUSI','PENCUCIAN'].some(v=>!enumText.includes(`'${v}'`));
    if(missing) await pool.query("ALTER TABLE role_permissions MODIFY role ENUM('ADMIN','ASLAP','KASP','PENGAWAS_GIZI','PENGAWAS_KEUANGAN','PERSIAPAN','PENGOLAHAN','PEMORSIAN','DISTRIBUSI','PENCUCIAN') NOT NULL");
  }
  for(const [key,label] of Object.entries(permissionCatalog)) await pool.query('INSERT INTO permissions(permission_key,label) VALUES(?,?) ON DUPLICATE KEY UPDATE label=VALUES(label)',[key,label]);
  for(const [role,keys] of Object.entries(defaultRolePermissions)) for(const key of keys){ const [[pr]]=await pool.query('SELECT id FROM permissions WHERE permission_key=?',[key]); if(pr) await pool.query('INSERT IGNORE INTO role_permissions(role,permission_id) VALUES(?,?)',[role,pr.id]); }
  const [userRoleCol]=await pool.query("SELECT COLUMN_TYPE FROM information_schema.columns WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='role'");
  if(userRoleCol[0] && /^enum\(/i.test(String(userRoleCol[0].COLUMN_TYPE))){
    const enumText=String(userRoleCol[0].COLUMN_TYPE);
    const missing=['KASP','PENGAWAS_GIZI','PENGAWAS_KEUANGAN','PERSIAPAN','PENGOLAHAN','PEMORSIAN','DISTRIBUSI','PENCUCIAN'].some(v=>!enumText.includes(`'${v}'`));
    if(missing) await pool.query("ALTER TABLE users MODIFY role ENUM('ADMIN','ASLAP','KASP','PENGAWAS_GIZI','PENGAWAS_KEUANGAN','PERSIAPAN','PENGOLAHAN','PEMORSIAN','DISTRIBUSI','PENCUCIAN') NOT NULL DEFAULT 'ADMIN'");
  }
  await pool.query(`CREATE TABLE IF NOT EXISTS backup_runs (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,backup_type VARCHAR(40) NOT NULL,filename VARCHAR(255) NOT NULL,file_path VARCHAR(500) NOT NULL,size_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,status ENUM('RUNNING','SUCCESS','FAILED') NOT NULL DEFAULT 'RUNNING',notes TEXT NULL,created_by INT UNSIGNED NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,completed_at TIMESTAMP NULL,INDEX idx_backup_created(created_at)) ENGINE=InnoDB`);
  await ensureColumn('backup_runs','sha256','CHAR(64) NULL AFTER size_bytes');
  await pool.query("INSERT IGNORE INTO schema_migrations(version) VALUES('1.8.36.4-backup-integrity')");
  await ensureColumn('users','username','VARCHAR(100) NULL');
  await pool.query("UPDATE users SET username=SUBSTRING_INDEX(email,'@',1) WHERE (username IS NULL OR username='') AND email IS NOT NULL AND email<>''");
  await pool.query("ALTER TABLE users MODIFY email VARCHAR(190) NULL");
  await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS uq_users_username ON users(username)").catch(async e=>{ if(!/duplicate key name|already exists/i.test(String(e.message))) throw e; });
  await ensureColumn('activity_log','before_json','LONGTEXT NULL');
  await ensureColumn('activity_log','after_json','LONGTEXT NULL');
  await ensureColumn('activity_log','ip_address','VARCHAR(100) NULL');
  await ensureColumn('activity_log','user_agent','VARCHAR(500) NULL');
  await ensureColumn('kpm','deactivated_at','DATETIME NULL');
  await ensureColumn('kpm','deactivation_reason','TEXT NULL');
  await ensureColumn('kpm','operational_note','TEXT NULL');
  await ensureColumn('kpm','kpm_status','VARCHAR(30) NULL');
  await ensureColumn('kpm','status_start','DATE NULL');
  await ensureColumn('kpm','status_end','DATE NULL');
  await ensureColumn('kpm','status_reason','VARCHAR(120) NULL');
  await ensureColumn('kpm','status_note','TEXT NULL');
  await ensureColumn('kpm','npsn','VARCHAR(30) NULL');
  await ensureColumn('kpm','head_name','VARCHAR(150) NULL');
  await ensureColumn('kpm','head_phone','VARCHAR(30) NULL');
  await ensureColumn('kpm','pic_name','VARCHAR(150) NULL');
  await ensureColumn('kpm','pic_phone','VARCHAR(30) NULL');
  await ensureColumn('kpm','cadre_name','VARCHAR(150) NULL');
  await ensureColumn('kpm','cadre_phone','VARCHAR(30) NULL');
  await ensureColumn('kpm','email','VARCHAR(190) NULL');
  await ensureColumn('kpm','latitude','DECIMAL(10,7) NULL');
  await ensureColumn('kpm','longitude','DECIMAL(10,7) NULL');
  await pool.query(`UPDATE kpm SET kpm_status=IF(active=1,'AKTIF','NONAKTIF') WHERE kpm_status IS NULL OR kpm_status=''`);
  await pool.query(`CREATE TABLE IF NOT EXISTS kpm_status_history (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,kpm_id INT UNSIGNED NOT NULL,status VARCHAR(30) NOT NULL,start_date DATE NOT NULL,end_date DATE NULL,reason VARCHAR(120) NULL,note TEXT NULL,created_by INT UNSIGNED NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,INDEX idx_kpm_status_hist(kpm_id,start_date),CONSTRAINT fk_kpm_status_kpm FOREIGN KEY(kpm_id) REFERENCES kpm(id) ON DELETE CASCADE,CONSTRAINT fk_kpm_status_user FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL) ENGINE=InnoDB`);
  await pool.query(`CREATE TABLE IF NOT EXISTS kpm_import_history (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,filename VARCHAR(255) NOT NULL,effective_from DATE NOT NULL,total_rows INT UNSIGNED NOT NULL DEFAULT 0,created_count INT UNSIGNED NOT NULL DEFAULT 0,updated_count INT UNSIGNED NOT NULL DEFAULT 0,remapped_count INT UNSIGNED NOT NULL DEFAULT 0,created_by INT UNSIGNED NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,INDEX idx_kpm_import_date(created_at),CONSTRAINT fk_kpm_import_user FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL) ENGINE=InnoDB`);
  await ensureColumn('kpm_import_history','remapped_count','INT UNSIGNED NOT NULL DEFAULT 0');
  await pool.query(`CREATE TABLE IF NOT EXISTS kpm_code_history (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,kpm_id INT UNSIGNED NOT NULL,old_code VARCHAR(30) NOT NULL,new_code VARCHAR(30) NOT NULL,reason VARCHAR(255) NULL,changed_by INT UNSIGNED NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,INDEX idx_kpm_code_hist_kpm(kpm_id,created_at),UNIQUE KEY uq_kpm_code_transition(old_code,new_code),CONSTRAINT fk_kpm_code_hist_kpm FOREIGN KEY(kpm_id) REFERENCES kpm(id) ON DELETE CASCADE,CONSTRAINT fk_kpm_code_hist_user FOREIGN KEY(changed_by) REFERENCES users(id) ON DELETE SET NULL) ENGINE=InnoDB`);
  await pool.query(`ALTER TABLE kpm MODIFY education_level VARCHAR(120) NULL`);
  await pool.query(`CREATE TABLE IF NOT EXISTS kpm_daily_data (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    kpm_id INT UNSIGNED NOT NULL,
    effective_from DATE NOT NULL,
    small_female INT UNSIGNED NOT NULL DEFAULT 0,
    small_male INT UNSIGNED NOT NULL DEFAULT 0,
    large_female INT UNSIGNED NOT NULL DEFAULT 0,
    large_male INT UNSIGNED NOT NULL DEFAULT 0,
    teacher_female INT UNSIGNED NOT NULL DEFAULT 0,
    teacher_male INT UNSIGNED NOT NULL DEFAULT 0,
    staff_female INT UNSIGNED NOT NULL DEFAULT 0,
    staff_male INT UNSIGNED NOT NULL DEFAULT 0,
    balita_female INT UNSIGNED NOT NULL DEFAULT 0,
    balita_male INT UNSIGNED NOT NULL DEFAULT 0,
    bumil INT UNSIGNED NOT NULL DEFAULT 0,
    busui INT UNSIGNED NOT NULL DEFAULT 0,
    created_by INT UNSIGNED NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_kpm_effective(kpm_id,effective_from),
    INDEX idx_kpm_effective(kpm_id,effective_from),
    CONSTRAINT fk_kpm_daily_kpm FOREIGN KEY(kpm_id) REFERENCES kpm(id) ON DELETE CASCADE,
    CONSTRAINT fk_kpm_daily_user FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB`);
  await pool.query(`CREATE TABLE IF NOT EXISTS kpm_pm_submissions (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,kpm_id INT UNSIGNED NOT NULL,submission_type ENUM('MANUAL','EXCEL') NOT NULL DEFAULT 'MANUAL',effective_from DATE NOT NULL,status ENUM('DRAFT','DIAJUKAN','DITINJAU','DISETUJUI','DITOLAK','DITERAPKAN') NOT NULL DEFAULT 'DRAFT',submitted_by INT UNSIGNED NULL,reviewed_by INT UNSIGNED NULL,reviewed_at DATETIME NULL,review_note TEXT NULL,applied_at DATETIME NULL,applied_by INT UNSIGNED NULL,source_filename VARCHAR(255) NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,INDEX idx_kpm_pm_sub_status(status),INDEX idx_kpm_pm_sub_kpm(kpm_id,effective_from),CONSTRAINT fk_kpm_pm_sub_kpm FOREIGN KEY(kpm_id) REFERENCES kpm(id) ON DELETE RESTRICT,CONSTRAINT fk_kpm_pm_sub_submitter FOREIGN KEY(submitted_by) REFERENCES users(id) ON DELETE SET NULL,CONSTRAINT fk_kpm_pm_sub_reviewer FOREIGN KEY(reviewed_by) REFERENCES users(id) ON DELETE SET NULL,CONSTRAINT fk_kpm_pm_sub_applied FOREIGN KEY(applied_by) REFERENCES users(id) ON DELETE SET NULL) ENGINE=InnoDB`);
  await pool.query(`CREATE TABLE IF NOT EXISTS kpm_pm_submission_rows (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,submission_id BIGINT UNSIGNED NOT NULL,row_no INT UNSIGNED NOT NULL,pm_id INT UNSIGNED NULL,full_name VARCHAR(200) NOT NULL,nik VARCHAR(30) NULL,nisn VARCHAR(30) NULL,gender ENUM('L','P') NOT NULL,class_group VARCHAR(80) NULL,category ENUM('PESERTA_DIDIK','PENDIDIK','TENAGA_KEPENDIDIKAN','BALITA','BUMIL','BUSUI') NOT NULL,phone VARCHAR(30) NULL,address TEXT NULL,status ENUM('VALID','TIDAK_LENGKAP','DUPLIKAT','TIDAK_VALID') NOT NULL DEFAULT 'VALID',validation_note TEXT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,INDEX idx_kpm_pm_sub_rows_submission(submission_id),INDEX idx_kpm_pm_sub_rows_identity(nik,nisn),CONSTRAINT fk_kpm_pm_sub_rows_submission FOREIGN KEY(submission_id) REFERENCES kpm_pm_submissions(id) ON DELETE CASCADE,CONSTRAINT fk_kpm_pm_sub_rows_pm FOREIGN KEY(pm_id) REFERENCES pm(id) ON DELETE SET NULL) ENGINE=InnoDB`);
  await pool.query(`CREATE TABLE IF NOT EXISTS kpm_pm_submission_history (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,submission_id BIGINT UNSIGNED NOT NULL,action VARCHAR(40) NOT NULL,from_status VARCHAR(30) NULL,to_status VARCHAR(30) NULL,note TEXT NULL,actor_id INT UNSIGNED NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,INDEX idx_kpm_pm_sub_hist(submission_id,created_at),CONSTRAINT fk_kpm_pm_sub_hist_submission FOREIGN KEY(submission_id) REFERENCES kpm_pm_submissions(id) ON DELETE CASCADE,CONSTRAINT fk_kpm_pm_sub_hist_actor FOREIGN KEY(actor_id) REFERENCES users(id) ON DELETE SET NULL) ENGINE=InnoDB`);
  await ensureColumn('pm','deactivated_at','DATETIME NULL');
  await ensureColumn('pm','deactivation_reason','TEXT NULL');
  try{
    await pool.query("UPDATE pm SET class_group='6-23 Bulan (Baduta)' WHERE category='BALITA' AND (class_group LIKE 'Posyandu%' OR class_group IS NULL OR class_group='')");
    await pool.query("UPDATE pm SET class_group='Trimester 2 (13–27 Minggu)' WHERE category='BUMIL' AND (class_group='Trimester 2' OR class_group LIKE 'Posyandu%' OR class_group IS NULL OR class_group='')");
    await pool.query("UPDATE pm SET class_group='Bayi 0–6 Bulan (ASI Eksklusif)' WHERE category='BUSUI' AND (class_group LIKE 'Bayi%' OR class_group LIKE 'Posyandu%' OR class_group IS NULL OR class_group='')");
  }catch(e){}
  await pool.query(`CREATE TABLE IF NOT EXISTS pm_change_history (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,pm_id INT UNSIGNED NOT NULL,effective_from DATE NOT NULL,action ENUM('CREATE','UPDATE','DEACTIVATE','REACTIVATE') NOT NULL,before_data JSON NULL,after_data JSON NULL,reason VARCHAR(255) NULL,actor_id INT UNSIGNED NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,INDEX idx_pm_hist(pm_id,effective_from,created_at),CONSTRAINT fk_pm_hist_pm FOREIGN KEY(pm_id) REFERENCES pm(id) ON DELETE RESTRICT,CONSTRAINT fk_pm_hist_user FOREIGN KEY(actor_id) REFERENCES users(id) ON DELETE SET NULL) ENGINE=InnoDB`);
  await ensureColumn('pm','updated_at','TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
  await ensureColumn('pm_change_history','reason','VARCHAR(500) NULL');
  await pool.query(`CREATE TABLE IF NOT EXISTS kpm_portal_tokens (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,kpm_id INT UNSIGNED NOT NULL,token_hash CHAR(64) NOT NULL UNIQUE,expires_at DATETIME NULL,active TINYINT(1) NOT NULL DEFAULT 1,last_used_at DATETIME NULL,created_by INT UNSIGNED NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,INDEX idx_kpm_portal_token_kpm(kpm_id,active),CONSTRAINT fk_kpm_portal_kpm FOREIGN KEY(kpm_id) REFERENCES kpm(id) ON DELETE CASCADE,CONSTRAINT fk_kpm_portal_user FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL) ENGINE=InnoDB`);
  await pool.query(`CREATE TABLE IF NOT EXISTS kpm_portal_statements (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,kpm_id INT UNSIGNED NOT NULL,statement_type VARCHAR(50) NOT NULL DEFAULT 'SURAT_PERNYATAAN',file_path VARCHAR(500) NOT NULL,original_name VARCHAR(255) NOT NULL,mime_type VARCHAR(100) NOT NULL,file_size BIGINT UNSIGNED NOT NULL DEFAULT 0,uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,uploaded_by_user INT UNSIGNED NULL,portal_token_id BIGINT UNSIGNED NULL,is_current TINYINT(1) NOT NULL DEFAULT 1,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,INDEX idx_kpm_statement_kpm(kpm_id,is_current,uploaded_at),CONSTRAINT fk_kpm_statement_kpm FOREIGN KEY(kpm_id) REFERENCES kpm(id) ON DELETE RESTRICT,CONSTRAINT fk_kpm_statement_user FOREIGN KEY(uploaded_by_user) REFERENCES users(id) ON DELETE SET NULL) ENGINE=InnoDB`);
  await pool.query(`CREATE TABLE IF NOT EXISTS kpm_portal_profile_submissions (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,kpm_id INT UNSIGNED NOT NULL,status ENUM('DIAJUKAN','DITINJAU','DISETUJUI','DITOLAK','DITERAPKAN') NOT NULL DEFAULT 'DIAJUKAN',before_data LONGTEXT NULL,after_data LONGTEXT NOT NULL,submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,reviewed_by INT UNSIGNED NULL,reviewed_at DATETIME NULL,review_note TEXT NULL,applied_by INT UNSIGNED NULL,applied_at DATETIME NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,INDEX idx_kpm_profile_sub_kpm(kpm_id,status,created_at),CONSTRAINT fk_kpm_profile_sub_kpm FOREIGN KEY(kpm_id) REFERENCES kpm(id) ON DELETE RESTRICT,CONSTRAINT fk_kpm_profile_sub_reviewer FOREIGN KEY(reviewed_by) REFERENCES users(id) ON DELETE SET NULL,CONSTRAINT fk_kpm_profile_sub_applier FOREIGN KEY(applied_by) REFERENCES users(id) ON DELETE SET NULL) ENGINE=InnoDB`);

  await pool.query(`INSERT IGNORE INTO schema_migrations(version) VALUES('1.8.36.4-kpm-portal-statement')`);
  await pool.query(`INSERT IGNORE INTO schema_migrations(version) VALUES('1.8.36.4-kpm-portal-profile-edit')`);
  await ensureColumn('kpm_portal_tokens','expires_at','DATETIME NULL');
  await ensureColumn('kpm_portal_tokens','active','TINYINT(1) NOT NULL DEFAULT 1');
  await ensureColumn('kpm_portal_tokens','last_used_at','DATETIME NULL');
  await ensureColumn('kpm_portal_tokens','created_by','INT UNSIGNED NULL');
  await ensureColumn('kpm_portal_statements','statement_type',"VARCHAR(50) NOT NULL DEFAULT 'SURAT_PERNYATAAN'");
  await ensureColumn('kpm_portal_statements','file_path','VARCHAR(500) NULL');
  await ensureColumn('kpm_portal_statements','original_name','VARCHAR(255) NULL');
  await ensureColumn('kpm_portal_statements','mime_type','VARCHAR(100) NULL');
  await ensureColumn('kpm_portal_statements','file_size','BIGINT UNSIGNED NOT NULL DEFAULT 0');
  await ensureColumn('kpm_portal_statements','uploaded_at','DATETIME NULL');
  await ensureColumn('kpm_portal_statements','uploaded_by_user','INT UNSIGNED NULL');
  await ensureColumn('kpm_portal_statements','is_current','TINYINT(1) NOT NULL DEFAULT 1');
  await ensureColumn('kpm_portal_statements','portal_token_id','BIGINT UNSIGNED NULL');
  await ensureColumn('sppg_profile','ba_verval_path','VARCHAR(500) NULL');
  await ensureColumn('sppg_profile','ba_verval_name','VARCHAR(255) NULL');
  await ensureColumn('sppg_profile','kasp_skep_path','VARCHAR(500) NULL');
  await ensureColumn('sppg_profile','kasp_skep_name','VARCHAR(255) NULL');
  await pool.query(`CREATE TABLE IF NOT EXISTS app_settings (
    id TINYINT UNSIGNED PRIMARY KEY DEFAULT 1,
    app_name VARCHAR(150) NOT NULL DEFAULT 'SPPG Monitoring',
    sppg_name VARCHAR(200) NULL,
    location_name VARCHAR(200) NULL,
    tagline VARCHAR(255) NULL,
    logo_path VARCHAR(500) NULL,
    logo_name VARCHAR(255) NULL,
    favicon_path VARCHAR(500) NULL,
    favicon_name VARCHAR(255) NULL,
    opening_logo_path VARCHAR(500) NULL,
    opening_logo_name VARCHAR(255) NULL,
    login_logo_path VARCHAR(500) NULL,
    login_logo_name VARCHAR(255) NULL,
    primary_color VARCHAR(20) NOT NULL DEFAULT '#007a5e',
    sidebar_color VARCHAR(20) NOT NULL DEFAULT '#0b2d61',
    updated_by INT UNSIGNED NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_app_settings_user FOREIGN KEY(updated_by) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB`);
  await pool.query(`INSERT IGNORE INTO app_settings(id,app_name,sppg_name,location_name,tagline,primary_color,sidebar_color) VALUES(1,'SPPG Monitoring','SPPG Subang Pusakajaya','Kebondanas','Satuan Pelayanan Pemenuhan Gizi','#007a5e','#0b2d61')`);
  await ensureColumn('app_settings','opening_logo_path','VARCHAR(500) NULL');
  await ensureColumn('app_settings','portal_header_path','VARCHAR(500) NULL');
  await ensureColumn('app_settings','portal_header_name','VARCHAR(255) NULL');
  await ensureColumn('app_settings','portal_dashboard_title','VARCHAR(200) NULL');
  await ensureColumn('app_settings','portal_dashboard_subtitle','VARCHAR(255) NULL');
  await ensureColumn('app_settings','opening_logo_name','VARCHAR(255) NULL');
  await ensureColumn('app_settings','sidebar_title_color','VARCHAR(20) NULL');
  await ensureColumn('app_settings','sidebar_subtitle_color','VARCHAR(20) NULL');
  await ensureColumn('app_settings','sidebar_caption_color','VARCHAR(20) NULL');
  await ensureColumn('app_settings','sidebar_menu_color','VARCHAR(20) NULL');
  await ensureColumn('app_settings','sidebar_menu_hover_color','VARCHAR(20) NULL');
  await ensureColumn('app_settings','sidebar_menu_active_color','VARCHAR(20) NULL');
  await ensureColumn('app_settings','sidebar_section_color','VARCHAR(20) NULL');
  await ensureColumn('app_settings','sidebar_icon_color','VARCHAR(20) NULL');
  await ensureColumn('app_settings','sidebar_icon_active_color','VARCHAR(20) NULL');
  await ensureColumn('app_settings','font_family','VARCHAR(40) NULL');
  await ensureColumn('app_settings','font_size_title','TINYINT UNSIGNED NULL');
  await ensureColumn('app_settings','font_size_subtitle','TINYINT UNSIGNED NULL');
  await ensureColumn('app_settings','font_size_caption','TINYINT UNSIGNED NULL');
  await ensureColumn('app_settings','font_size_menu','TINYINT UNSIGNED NULL');
  await ensureColumn('app_settings','font_size_section','TINYINT UNSIGNED NULL');
  await pool.query(`UPDATE app_settings SET sidebar_title_color=COALESCE(sidebar_title_color,'#ffffff'),sidebar_subtitle_color=COALESCE(sidebar_subtitle_color,'#20c878'),sidebar_caption_color=COALESCE(sidebar_caption_color,'#9fb3ca'),sidebar_menu_color=COALESCE(sidebar_menu_color,'#dce7f3'),sidebar_menu_hover_color=COALESCE(sidebar_menu_hover_color,'#ffffff'),sidebar_menu_active_color=COALESCE(sidebar_menu_active_color,'#ffffff'),sidebar_section_color=COALESCE(sidebar_section_color,'#9fb3ca'),sidebar_icon_color=COALESCE(sidebar_icon_color,'#dce7f3'),sidebar_icon_active_color=COALESCE(sidebar_icon_active_color,'#20c878'),font_family=COALESCE(font_family,'Arial'),font_size_title=COALESCE(font_size_title,14),font_size_subtitle=COALESCE(font_size_subtitle,12),font_size_caption=COALESCE(font_size_caption,10),font_size_menu=COALESCE(font_size_menu,14),font_size_section=COALESCE(font_size_section,11) WHERE id=1`);
  await pool.query(`CREATE TABLE IF NOT EXISTS staff_schedule (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,schedule_date DATE NOT NULL,staff_id INT UNSIGNED NOT NULL,shift_name VARCHAR(100),start_time TIME NULL,end_time TIME NULL,notes TEXT NULL,is_active TINYINT(1) NOT NULL DEFAULT 1,cancelled_by INT UNSIGNED NULL,cancelled_at DATETIME NULL,cancellation_reason VARCHAR(255) NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,INDEX idx_staff_schedule_date(schedule_date),CONSTRAINT fk_staff_schedule_staff FOREIGN KEY(staff_id) REFERENCES staff(id) ON DELETE CASCADE) ENGINE=InnoDB`);
  await ensureColumn('staff_schedule','team_id','INT UNSIGNED NULL');
  await ensureColumn('staff_schedule','is_active','TINYINT(1) NOT NULL DEFAULT 1');
  await ensureColumn('staff_schedule','cancelled_by','INT UNSIGNED NULL');
  await ensureColumn('staff_schedule','cancelled_at','DATETIME NULL');
  await ensureColumn('staff_schedule','cancellation_reason','VARCHAR(255) NULL');
  await pool.query(`CREATE TABLE IF NOT EXISTS staff_attendance (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,attendance_date DATE NOT NULL,staff_id INT UNSIGNED NOT NULL,team_id INT UNSIGNED NULL,status ENUM('HADIR','IZIN','SAKIT','ALPA','CUTI','DINAS') NOT NULL DEFAULT 'HADIR',check_in TIME NULL,check_out TIME NULL,note TEXT NULL,created_by INT UNSIGNED NULL,updated_by INT UNSIGNED NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,UNIQUE KEY uq_attendance_date_staff(attendance_date,staff_id),INDEX idx_attendance_date_team(attendance_date,team_id),INDEX idx_attendance_staff(attendance_date,staff_id),CONSTRAINT fk_attendance_staff FOREIGN KEY(staff_id) REFERENCES staff(id) ON DELETE CASCADE,CONSTRAINT fk_attendance_team FOREIGN KEY(team_id) REFERENCES sppg_teams(id) ON DELETE SET NULL,CONSTRAINT fk_attendance_created FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL,CONSTRAINT fk_attendance_updated FOREIGN KEY(updated_by) REFERENCES users(id) ON DELETE SET NULL) ENGINE=InnoDB`);
  await pool.query(`CREATE TABLE IF NOT EXISTS attendance_replacements (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,replacement_date DATE NOT NULL,team_id INT UNSIGNED NULL,absent_staff_id INT UNSIGNED NOT NULL,replacement_staff_id INT UNSIGNED NOT NULL,task_scope VARCHAR(255) NULL,reason VARCHAR(255) NULL,note TEXT NULL,is_active TINYINT(1) NOT NULL DEFAULT 1,cancelled_by INT UNSIGNED NULL,cancelled_at DATETIME NULL,cancellation_reason VARCHAR(255) NULL,created_by INT UNSIGNED NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,INDEX idx_replacement_date(replacement_date,team_id),INDEX idx_replacement_absent(replacement_date,absent_staff_id),INDEX idx_replacement_staff(replacement_date,replacement_staff_id),CONSTRAINT fk_repl_team FOREIGN KEY(team_id) REFERENCES sppg_teams(id) ON DELETE SET NULL,CONSTRAINT fk_repl_absent FOREIGN KEY(absent_staff_id) REFERENCES staff(id) ON DELETE CASCADE,CONSTRAINT fk_repl_staff FOREIGN KEY(replacement_staff_id) REFERENCES staff(id) ON DELETE CASCADE,CONSTRAINT fk_repl_created FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL) ENGINE=InnoDB`);
  await ensureColumn('attendance_replacements','is_active','TINYINT(1) NOT NULL DEFAULT 1');
  await ensureColumn('attendance_replacements','cancelled_by','INT UNSIGNED NULL');
  await ensureColumn('attendance_replacements','cancelled_at','DATETIME NULL');
  await ensureColumn('attendance_replacements','cancellation_reason','VARCHAR(255) NULL');
  await pool.query(`CREATE TABLE IF NOT EXISTS bgn_documents (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,title VARCHAR(255) NOT NULL,doc_type ENUM('JUKNIS','SURAT_EDARAN','SOP') NOT NULL,document_number VARCHAR(150) NULL,document_date DATE NULL,description TEXT NULL,file_path VARCHAR(500) NULL,original_name VARCHAR(255) NULL,active TINYINT(1) NOT NULL DEFAULT 1,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,INDEX idx_bgn_doc_type(doc_type),INDEX idx_bgn_doc_active(active)) ENGINE=InnoDB`);
  await pool.query(`CREATE TABLE IF NOT EXISTS quick_links (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,title VARCHAR(180) NOT NULL,description TEXT NULL,url VARCHAR(1000) NOT NULL,icon VARCHAR(50) NULL,sort_order INT NOT NULL DEFAULT 0,active TINYINT(1) NOT NULL DEFAULT 1,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB`);
  await pool.query(`CREATE TABLE IF NOT EXISTS menus (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,menu_code VARCHAR(40) NOT NULL UNIQUE,menu_name VARCHAR(200) NOT NULL,component_name VARCHAR(200) NULL,kpm_type ENUM('SATUAN_PENDIDIKAN','POSYANDU') NOT NULL,energy_small DECIMAL(10,2) NULL,protein_small DECIMAL(10,2) NULL,fat_small DECIMAL(10,2) NULL,carb_small DECIMAL(10,2) NULL,fiber_small DECIMAL(10,2) NULL,energy_large DECIMAL(10,2) NULL,protein_large DECIMAL(10,2) NULL,fat_large DECIMAL(10,2) NULL,carb_large DECIMAL(10,2) NULL,fiber_large DECIMAL(10,2) NULL,photo_small_path VARCHAR(500) NULL,photo_large_path VARCHAR(500) NULL,active TINYINT(1) NOT NULL DEFAULT 1,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,INDEX idx_menus_type(kpm_type),INDEX idx_menus_active(active)) ENGINE=InnoDB`);
  await pool.query(`CREATE TABLE IF NOT EXISTS menu_daily (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,menu_date DATE NOT NULL,menu_id BIGINT UNSIGNED NULL,menu_code VARCHAR(40) NOT NULL,menu_name VARCHAR(200) NOT NULL,component_name VARCHAR(200) NULL,kpm_type ENUM('SATUAN_PENDIDIKAN','POSYANDU') NOT NULL,energy_small DECIMAL(10,2) NULL,protein_small DECIMAL(10,2) NULL,fat_small DECIMAL(10,2) NULL,carb_small DECIMAL(10,2) NULL,fiber_small DECIMAL(10,2) NULL,energy_large DECIMAL(10,2) NULL,protein_large DECIMAL(10,2) NULL,fat_large DECIMAL(10,2) NULL,carb_large DECIMAL(10,2) NULL,fiber_large DECIMAL(10,2) NULL,photo_small_path VARCHAR(500) NULL,photo_large_path VARCHAR(500) NULL,created_by INT UNSIGNED NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,INDEX idx_menu_daily_date(menu_date),INDEX idx_menu_daily_code(menu_code),CONSTRAINT fk_menu_daily_master FOREIGN KEY(menu_id) REFERENCES menus(id) ON DELETE SET NULL,CONSTRAINT fk_menu_daily_user FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL) ENGINE=InnoDB`);
  // Menu code migration: MNU-DDMMNN (day, month, menu sequence for that date).
  const [[menuCodeMigration]]=await pool.query("SELECT 1 applied FROM schema_migrations WHERE version='1.8.18-menu-code-date' LIMIT 1");
  if(!menuCodeMigration){
    const conn=await pool.getConnection();
    try{
      await conn.beginTransaction();
      const [daily]=await conn.query('SELECT id,menu_id,menu_date FROM menu_daily ORDER BY menu_date,id FOR UPDATE');
      const byDate=new Map();
      for(const r of daily){const d=sqlDate(r.menu_date);const n=(byDate.get(d)||0)+1;if(n>99)throw new Error(`Migrasi kode menu gagal: lebih dari 99 menu pada ${d}.`);byDate.set(d,n);}
      if(daily.length){
        await conn.query("UPDATE menu_daily SET menu_code=CONCAT('TMP-MNU-',id)");
        for(const r of daily){
          const d=sqlDate(r.menu_date),n=byDate.get(d);const code=`MNU-${d.slice(8,10)}${d.slice(5,7)}${String(n).padStart(2,'0')}`;
          await conn.query('UPDATE menu_daily SET menu_code=? WHERE id=?',[code,r.id]);
        }
        const [masters]=await conn.query('SELECT id FROM menus WHERE id IN (SELECT DISTINCT menu_id FROM menu_daily WHERE menu_id IS NOT NULL) FOR UPDATE');
        if(masters.length) await conn.query("UPDATE menus SET menu_code=CONCAT('TMP-MASTER-',id) WHERE id IN (SELECT DISTINCT menu_id FROM menu_daily WHERE menu_id IS NOT NULL)");
        for(const m of masters){
          const [[first]]=await conn.query('SELECT menu_code FROM menu_daily WHERE menu_id=? ORDER BY menu_date,id LIMIT 1',[m.id]);
          if(first) await conn.query('UPDATE menus SET menu_code=? WHERE id=?',[first.menu_code,m.id]);
        }
      }
      await conn.query("INSERT INTO schema_migrations(version) VALUES('1.8.18-menu-code-date')");
      await conn.commit();
    }catch(e){await conn.rollback();throw e}finally{conn.release()}
  }
  await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS uq_menu_daily_date_code ON menu_daily(menu_date,menu_code)").catch(async e=>{ if(!/duplicate key name|already exists/i.test(String(e.message))) throw e; });
  await pool.query(`INSERT IGNORE INTO schema_migrations(version) VALUES('1.8.7-menu-daily')`);
  await pool.query(`CREATE TABLE IF NOT EXISTS documentation_records (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,documentation_date DATE NOT NULL,module ENUM('MENU','PEMORSIAN','DISTRIBUSI','PENCUCIAN') NOT NULL,title VARCHAR(255) NULL,description TEXT NULL,file_path VARCHAR(500) NOT NULL,original_name VARCHAR(255) NOT NULL,mime_type VARCHAR(100) NOT NULL,created_by INT UNSIGNED NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,INDEX idx_doc_date_module(documentation_date,module),CONSTRAINT fk_doc_user FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL) ENGINE=InnoDB`);
  await pool.query(`CREATE TABLE IF NOT EXISTS foodtray_templates (id TINYINT UNSIGNED PRIMARY KEY DEFAULT 1,title VARCHAR(200) NOT NULL DEFAULT 'Template Label Foodtray',description TEXT NULL,template_path VARCHAR(500) NULL,template_name VARCHAR(255) NULL,guide_text TEXT NULL,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB`);
  await pool.query(`INSERT IGNORE INTO foodtray_templates(id,title,guide_text) VALUES(1,'Template Label Foodtray','Template dan panduan label foodtray SPPG.')`);
  for(const [c,d] of [['is_active','TINYINT(1) NOT NULL DEFAULT 1'],['cancelled_by','INT UNSIGNED NULL'],['cancelled_at','DATETIME NULL'],['cancellation_reason','VARCHAR(255) NULL'],['prep_start','DATETIME NULL'],['processing_start','DATETIME NULL'],['portioning_time','DATETIME NULL'],['departure_time','DATETIME NULL'],['handover_time','DATETIME NULL'],['pickup_time','DATETIME NULL'],['return_time','DATETIME NULL'],['washing_start','DATETIME NULL'],['washing_end','DATETIME NULL']]) await ensureColumn('distribution',c,d);
  // v1.8.25 — Jadwal Distribusi berbasis tanggal → menu → kloter → KPM.
  await pool.query(`CREATE TABLE IF NOT EXISTS distribution_snapshots (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    schedule_id BIGINT UNSIGNED NOT NULL,
    snapshot_date DATE NOT NULL,
    status ENUM('LOCKED','CANCELLED') NOT NULL DEFAULT 'LOCKED',
    created_by INT UNSIGNED NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_snapshot_schedule(schedule_id),
    INDEX idx_snapshot_date(snapshot_date),
    CONSTRAINT fk_snapshot_schedule FOREIGN KEY(schedule_id) REFERENCES distribution_schedules(id) ON DELETE RESTRICT,
    CONSTRAINT fk_snapshot_user FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB`);
  await pool.query(`CREATE TABLE IF NOT EXISTS distribution_snapshot_clusters (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    snapshot_id BIGINT UNSIGNED NOT NULL,
    source_cluster_id BIGINT UNSIGNED NOT NULL,
    cluster_no INT UNSIGNED NOT NULL,
    kpm_type ENUM('SATUAN_PENDIDIKAN','POSYANDU') NOT NULL,
    route_name VARCHAR(100) NULL, staff_id INT UNSIGNED NULL, vehicle VARCHAR(20) NULL,
    prep_start TIME NULL, prep_end TIME NULL, processing_start TIME NULL, processing_end TIME NULL,
    portioning_start TIME NULL, portioning_end TIME NULL, departure_time TIME NULL, return_time TIME NULL,
    washing_start TIME NULL, washing_end TIME NULL, notes TEXT NULL,
    INDEX idx_snapshot_cluster(snapshot_id,cluster_no),
    CONSTRAINT fk_snapshot_cluster_snapshot FOREIGN KEY(snapshot_id) REFERENCES distribution_snapshots(id) ON DELETE RESTRICT,
    CONSTRAINT fk_snapshot_cluster_source FOREIGN KEY(source_cluster_id) REFERENCES distribution_clusters(id) ON DELETE RESTRICT
  ) ENGINE=InnoDB`);
  await pool.query(`CREATE TABLE IF NOT EXISTS distribution_snapshot_kpm (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    snapshot_cluster_id BIGINT UNSIGNED NOT NULL,
    source_cluster_kpm_id BIGINT UNSIGNED NOT NULL,
    kpm_id INT UNSIGNED NOT NULL,
    small_portions INT UNSIGNED NOT NULL DEFAULT 0,
    large_portions INT UNSIGNED NOT NULL DEFAULT 0,
    sort_order INT UNSIGNED NOT NULL DEFAULT 0,
    INDEX idx_snapshot_kpm(snapshot_cluster_id,sort_order),
    CONSTRAINT fk_snapshot_kpm_cluster FOREIGN KEY(snapshot_cluster_id) REFERENCES distribution_snapshot_clusters(id) ON DELETE RESTRICT,
    CONSTRAINT fk_snapshot_kpm_source FOREIGN KEY(source_cluster_kpm_id) REFERENCES distribution_cluster_kpm(id) ON DELETE RESTRICT,
    CONSTRAINT fk_snapshot_kpm_kpm FOREIGN KEY(kpm_id) REFERENCES kpm(id) ON DELETE RESTRICT
  ) ENGINE=InnoDB`);
  await pool.query(`INSERT IGNORE INTO schema_migrations(version) VALUES('1.8.36.4-distribution-snapshot')`);
  await pool.query(`CREATE TABLE IF NOT EXISTS distribution_schedules (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    distribution_date DATE NOT NULL UNIQUE,
    menu_sp_id BIGINT UNSIGNED NULL,
    menu_pos_id BIGINT UNSIGNED NULL,
    prep_start TIME NULL, prep_end TIME NULL,
    processing_start TIME NULL, processing_end TIME NULL,
    portioning_start TIME NULL, portioning_end TIME NULL,
    washing_start TIME NULL, washing_end TIME NULL,
    notes TEXT NULL,
    created_by INT UNSIGNED NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_dist_sched_menu_sp FOREIGN KEY(menu_sp_id) REFERENCES menu_daily(id) ON DELETE SET NULL,
    CONSTRAINT fk_dist_sched_menu_pos FOREIGN KEY(menu_pos_id) REFERENCES menu_daily(id) ON DELETE SET NULL,
    CONSTRAINT fk_dist_sched_user FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB`);
  await pool.query(`CREATE TABLE IF NOT EXISTS distribution_clusters (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    schedule_id BIGINT UNSIGNED NOT NULL,
    cluster_no INT UNSIGNED NOT NULL,
    kpm_type ENUM('SATUAN_PENDIDIKAN','POSYANDU') NOT NULL,
    route_name VARCHAR(100) NULL,
    staff_id INT UNSIGNED NULL,
    vehicle VARCHAR(20) NOT NULL,
    departure_time TIME NULL,
    return_time TIME NULL,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_dist_cluster(schedule_id,cluster_no),
    INDEX idx_dist_cluster_schedule(schedule_id),
    CONSTRAINT fk_dist_cluster_schedule FOREIGN KEY(schedule_id) REFERENCES distribution_schedules(id) ON DELETE CASCADE,
    CONSTRAINT fk_dist_cluster_staff FOREIGN KEY(staff_id) REFERENCES staff(id) ON DELETE SET NULL
  ) ENGINE=InnoDB`);
  for(const [c,d] of [['is_active','TINYINT(1) NOT NULL DEFAULT 1'],['cancelled_by','INT UNSIGNED NULL'],['cancelled_at','DATETIME NULL'],['cancellation_reason','VARCHAR(255) NULL'],['prep_start','TIME NULL'],['prep_end','TIME NULL'],['processing_start','TIME NULL'],['processing_end','TIME NULL'],['portioning_start','TIME NULL'],['portioning_end','TIME NULL'],['washing_start','TIME NULL'],['washing_end','TIME NULL']]) await ensureColumn('distribution_clusters',c,d);
  await pool.query(`CREATE TABLE IF NOT EXISTS distribution_cluster_kpm (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    cluster_id BIGINT UNSIGNED NOT NULL,
    kpm_id INT UNSIGNED NOT NULL,
    small_portions INT UNSIGNED NOT NULL DEFAULT 0,
    large_portions INT UNSIGNED NOT NULL DEFAULT 0,
    handover_time TIME NULL,
    pickup_time TIME NULL,
    sort_order INT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_dist_cluster_kpm(cluster_id,kpm_id),
    INDEX idx_dist_cluster_kpm_kpm(kpm_id),
    CONSTRAINT fk_dist_ck_cluster FOREIGN KEY(cluster_id) REFERENCES distribution_clusters(id) ON DELETE CASCADE,
    CONSTRAINT fk_dist_ck_kpm FOREIGN KEY(kpm_id) REFERENCES kpm(id) ON DELETE RESTRICT
  ) ENGINE=InnoDB`);
  await pool.query(`INSERT IGNORE INTO schema_migrations(version) VALUES('1.8.25-distribution-cluster-schedule')`);  await pool.query(`CREATE TABLE IF NOT EXISTS pemorsian_evidence (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    work_date DATE NOT NULL, cluster_id BIGINT UNSIGNED NOT NULL, slot ENUM('FOODTRAY_TERBUKA_KECIL','FOODTRAY_TERBUKA_BESAR','LABEL_KECIL','LABEL_BESAR','FOODTRAY_SEBELUM_DISTRIBUSI') NOT NULL,
    file_path VARCHAR(500) NOT NULL, original_name VARCHAR(255) NOT NULL, mime_type VARCHAR(100) NOT NULL,
    is_current TINYINT(1) NOT NULL DEFAULT 1, replaced_by BIGINT UNSIGNED NULL, uploaded_by INT UNSIGNED NULL, uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_pem_ev_cluster(work_date,cluster_id,slot,is_current),
    CONSTRAINT fk_pem_ev_cluster FOREIGN KEY(cluster_id) REFERENCES distribution_clusters(id) ON DELETE RESTRICT,
    CONSTRAINT fk_pem_ev_user FOREIGN KEY(uploaded_by) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB`);
  await pool.query(`CREATE TABLE IF NOT EXISTS operational_pickup_events (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, work_date DATE NOT NULL, source_cluster_id BIGINT UNSIGNED NOT NULL, cluster_kpm_id BIGINT UNSIGNED NOT NULL,
    event_type ENUM('PENGAMBILAN','RETURN') NOT NULL, occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, created_by INT UNSIGNED NULL,
    INDEX idx_pickup_source(source_cluster_id,work_date), INDEX idx_pickup_kpm(cluster_kpm_id,event_type),
    CONSTRAINT fk_pickup_cluster FOREIGN KEY(source_cluster_id) REFERENCES distribution_clusters(id) ON DELETE RESTRICT,
    CONSTRAINT fk_pickup_ck FOREIGN KEY(cluster_kpm_id) REFERENCES distribution_cluster_kpm(id) ON DELETE RESTRICT,
    CONSTRAINT fk_pickup_user FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB`);
  await pool.query(`INSERT IGNORE INTO schema_migrations(version) VALUES('1.8.36.4-pemorsian-evidence-pickup')`);
  await pool.query(`CREATE TABLE IF NOT EXISTS operational_pickup_clusters (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, work_date DATE NOT NULL, source_cluster_id BIGINT UNSIGNED NOT NULL, cluster_kpm_id BIGINT UNSIGNED NOT NULL,
    sequence_no INT UNSIGNED NOT NULL, status ENUM('AKTIF','SELESAI') NOT NULL DEFAULT 'AKTIF', created_by INT UNSIGNED NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, completed_at DATETIME NULL,
    UNIQUE KEY uq_pickup_sequence(source_cluster_id,sequence_no), UNIQUE KEY uq_pickup_kpm(work_date,cluster_kpm_id),
    INDEX idx_pickup_wash(work_date,status),
    CONSTRAINT fk_opc_source FOREIGN KEY(source_cluster_id) REFERENCES distribution_clusters(id) ON DELETE RESTRICT,
    CONSTRAINT fk_opc_ck FOREIGN KEY(cluster_kpm_id) REFERENCES distribution_cluster_kpm(id) ON DELETE RESTRICT,
    CONSTRAINT fk_opc_user FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB`);
  await pool.query(`INSERT IGNORE INTO schema_migrations(version) VALUES('1.8.36.4-pickup-cluster-auto')`);
  await pool.query(`CREATE TABLE IF NOT EXISTS documentation_records (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,documentation_date DATE NOT NULL,module ENUM('MENU','PEMORSIAN','DISTRIBUSI','PENCUCIAN') NOT NULL,title VARCHAR(255) NULL,description TEXT NULL,file_path VARCHAR(500) NOT NULL,original_name VARCHAR(255) NOT NULL,mime_type VARCHAR(100) NOT NULL,created_by INT UNSIGNED NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,INDEX idx_doc_date_module(documentation_date,module),CONSTRAINT fk_doc_user2 FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL) ENGINE=InnoDB`);
  await pool.query(`CREATE TABLE IF NOT EXISTS daily_closings (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,work_date DATE NOT NULL UNIQUE,status ENUM('OPEN','CLOSED','REOPENED') NOT NULL DEFAULT 'OPEN',closed_by INT UNSIGNED NULL,closed_at DATETIME NULL,reopened_by INT UNSIGNED NULL,reopened_at DATETIME NULL,reopen_reason TEXT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,CONSTRAINT fk_close_user FOREIGN KEY(closed_by) REFERENCES users(id) ON DELETE SET NULL,CONSTRAINT fk_reopen_user FOREIGN KEY(reopened_by) REFERENCES users(id) ON DELETE SET NULL) ENGINE=InnoDB`);
  await pool.query(`CREATE TABLE IF NOT EXISTS exception_items (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,work_date DATE NOT NULL,code VARCHAR(80) NOT NULL,team VARCHAR(50) NULL,severity ENUM('KRITIS','PENTING','INFORMASI') NOT NULL DEFAULT 'PENTING',title VARCHAR(255) NOT NULL,detail TEXT NULL,source_type VARCHAR(80) NULL,source_id BIGINT UNSIGNED NULL,status ENUM('OPEN','RESOLVED') NOT NULL DEFAULT 'OPEN',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,UNIQUE KEY uq_exception(work_date,code,source_type,source_id),INDEX idx_exception_date(work_date,status,severity)) ENGINE=InnoDB`);
  await pool.query(`INSERT IGNORE INTO schema_migrations(version) VALUES('1.8.36.4-daily-closing-exception-documentation')`);


  await pool.query(`INSERT IGNORE INTO schema_migrations(version) VALUES('1.6.0-operational-foundation')`);
  await pool.query(`INSERT IGNORE INTO schema_migrations(version) VALUES('1.8.36-role-permission-foundation'),('1.8.36.1-supervisor-roles'),('1.8.36.2-user-team-task-foundation'),('1.8.36.4-audit-hardening')`);
}

const mimeExt=new Map([['image/jpeg',new Set(['.jpg','.jpeg'])],['image/png',new Set(['.png'])],['application/pdf',new Set(['.pdf'])],['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',new Set(['.xlsx'])],['application/vnd.openxmlformats-officedocument.wordprocessingml.document',new Set(['.docx'])]]);
const storage=multer.diskStorage({destination:(r,f,cb)=>cb(null,uploadDir),filename:(r,f,cb)=>cb(null,Date.now()+'-'+crypto.randomBytes(8).toString('hex')+path.extname(f.originalname).toLowerCase())});
const upload=multer({storage,limits:{fileSize:Number(process.env.MAX_UPLOAD_MB||5)*1024*1024},fileFilter:(r,f,cb)=>{const ext=path.extname(f.originalname).toLowerCase(),ok=mimeExt.has(f.mimetype)&&mimeExt.get(f.mimetype).has(ext);cb(ok?null:new multer.MulterError('LIMIT_UNEXPECTED_FILE','file'),ok)}});
async function verifyUploadedFile(file){
  if(!file||!fs.existsSync(file.path))return false;
  const fd=await fs.promises.open(file.path,'r');const buf=Buffer.alloc(8);try{await fd.read(buf,0,8,0)}finally{await fd.close()}
  const ext=path.extname(file.originalname).toLowerCase();
  if(ext==='.pdf')return buf.subarray(0,5).toString()==='%PDF-';
  if(ext==='.png')return buf.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if(ext==='.jpg'||ext==='.jpeg')return buf[0]===0xff&&buf[1]===0xd8&&buf[2]===0xff;
  if(ext==='.xlsx'||ext==='.docx')return buf[0]===0x50&&buf[1]===0x4b&&buf[2]===0x03&&buf[3]===0x04;
  return false;
}

async function getPortalAccess(raw){
  if(!/^[a-f0-9]{64}$/.test(String(raw||''))) return null;
  const hash=crypto.createHash('sha256').update(String(raw)).digest('hex');
  const [[access]]=await pool.query('SELECT t.*,k.name kpm_name,k.code kpm_code,k.type kpm_type,k.education_level,k.address,k.npsn,k.head_name,k.head_phone,k.pic_name,k.pic_phone,k.cadre_name,k.cadre_phone,k.latitude,k.longitude,k.email FROM kpm_portal_tokens t JOIN kpm k ON k.id=t.kpm_id WHERE t.token_hash=? AND t.active=1 AND (t.expires_at IS NULL OR t.expires_at>NOW())',[hash]);
  return access||null;
}

function kpmProfileMissing(access){
  const missing=[];
  const req=(label,val)=>{if(!clean(val))missing.push(label)};
  req('Nama KPM',access.kpm_name);
  if(access.kpm_type==='SATUAN_PENDIDIKAN'){
    req('Jenjang/Keterangan',access.education_level);
    req('NPSN',access.npsn); req('Kepala Satuan Pendidikan',access.head_name); req('Kontak Kepala Satuan Pendidikan',access.head_phone);
    req('PIC MBG Satuan Pendidikan',access.pic_name); req('Kontak PIC MBG Satuan Pendidikan',access.pic_phone);
  }else{ req('Kader Posyandu',access.cadre_name); req('Kontak Kader Posyandu',access.cadre_phone); }
  req('Alamat',access.address);
  if(access.latitude===null||access.latitude===undefined||access.longitude===null||access.longitude===undefined||access.latitude===''||access.longitude==='')missing.push('Titik Koordinat KPM');
  return missing;
}

function kpmProfilePayload(body,access){
  const isSchool=access.kpm_type==='SATUAN_PENDIDIKAN';
  return {
    name:clean(body.name), education_level:isSchool?clean(body.education_level):null, address:clean(body.address), npsn:isSchool?(clean(body.npsn)||null):null,
    head_name:isSchool?(clean(body.head_name)||null):null, head_phone:isSchool?(clean(body.head_phone)||null):null,
    pic_name:isSchool?(clean(body.pic_name)||null):null, pic_phone:isSchool?(clean(body.pic_phone)||null):null,
    cadre_name:!isSchool?(clean(body.cadre_name)||null):null, cadre_phone:!isSchool?(clean(body.cadre_phone)||null):null,
    latitude:body.latitude!==''&&body.latitude!==undefined?Number(body.latitude):null, longitude:body.longitude!==''&&body.longitude!==undefined?Number(body.longitude):null
  };
}

function validatePortalKpmProfile(b,access){
  const p=kpmProfilePayload(b,access),errors=[];
  if(!p.name)errors.push('Nama KPM wajib diisi.');
  if(access.kpm_type==='SATUAN_PENDIDIKAN'){
    if(!p.education_level)errors.push('Jenjang/Keterangan wajib diisi.');
    if(!p.npsn)errors.push('NPSN wajib diisi.');
    if(p.npsn && !/^[0-9]{8,20}$/.test(p.npsn))errors.push('NPSN harus berupa angka.');
    if(!p.head_name)errors.push('Kepala Satuan Pendidikan wajib diisi.');
    if(!validPhone(p.head_phone))errors.push('Kontak Kepala Satuan Pendidikan tidak valid.');
    if(!p.pic_name)errors.push('PIC MBG Satuan Pendidikan wajib diisi.');
    if(!validPhone(p.pic_phone))errors.push('Kontak PIC MBG Satuan Pendidikan tidak valid.');
  }else{
    if(!p.cadre_name)errors.push('Kader Posyandu wajib diisi.');
    if(!validPhone(p.cadre_phone))errors.push('Kontak Kader Posyandu tidak valid.');
  }
  if(!p.address)errors.push('Alamat wajib diisi.');
  if(p.latitude===null||!Number.isFinite(p.latitude)||p.latitude<-90||p.latitude>90)errors.push('Latitude tidak valid.');
  if(p.longitude===null||!Number.isFinite(p.longitude)||p.longitude<-180||p.longitude>180)errors.push('Longitude tidak valid.');
  return {errors,payload:p};
}

// Login rate limiting: 5 failed attempts / 15 minutes per IP+username.
const loginAttempts=new Map();
function loginKey(req,username){return clientIp(req)+'|'+clean(username).toLowerCase()}
function checkLoginRate(req,username){const now=Date.now(),key=loginKey(req,username),a=loginAttempts.get(key)||[];const fresh=a.filter(x=>x>now-15*60*1000);loginAttempts.set(key,fresh);return fresh.length<5}
function recordLoginFailure(req,username){const key=loginKey(req,username),a=loginAttempts.get(key)||[];a.push(Date.now());loginAttempts.set(key,a)}
function clearLoginFailures(req,username){loginAttempts.delete(loginKey(req,username))}
setInterval(()=>{const cutoff=Date.now()-15*60*1000;for(const [k,a] of loginAttempts) {const fresh=a.filter(x=>x>cutoff);if(fresh.length)loginAttempts.set(k,fresh);else loginAttempts.delete(k)}},10*60*1000).unref();


async function listPersistentFiles(root,base=root){
  const out=[];
  if(!fs.existsSync(root)) return out;
  const entries=await fs.promises.readdir(root,{withFileTypes:true});
  for(const e of entries){
    const full=path.join(root,e.name);
    if(e.isDirectory()) out.push(...await listPersistentFiles(full,base));
    else if(e.isFile()){
      const st=await fs.promises.stat(full);
      out.push({path:path.relative(base,full).replace(/\\/g,'/'),size_bytes:st.size});
    }
  }
  return out;
}
async function getBackupTables(){
  const [rows]=await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema=DATABASE() AND table_type='BASE TABLE' AND table_name NOT IN ('sppg_sessions') ORDER BY table_name");
  return rows.map(r=>r.table_name).filter(Boolean);
}
function tarHeader(name,size,mode=0o644,mtime=Math.floor(Date.now()/1000),type='0'){
  const b=Buffer.alloc(512,0), put=(v,o,n)=>{const x=Buffer.from(String(v));x.copy(b,o,0,Math.min(x.length,n));};
  put(name,0,100);put(mode.toString(8).padStart(7,'0')+'\0',100,8);put('0'.repeat(7)+'\0',108,8);put('0'.repeat(7)+'\0',116,8);put(size.toString(8).padStart(11,'0')+'\0',124,12);put(mtime.toString(8).padStart(11,'0')+'\0',136,12);b.fill(0x20,148,156);put(type,156,1);put('ustar\0',257,6);put('00',263,2);let sum=0;for(const x of b)sum+=x;put(sum.toString(8).padStart(6,'0')+'\0 ',148,8);return b;
}
async function writeTarEntry(gz,name,content){
  const data=Buffer.isBuffer(content)?content:Buffer.from(String(content)); gz.write(tarHeader(name,data.length));gz.write(data);const pad=(512-(data.length%512))%512;if(pad)gz.write(Buffer.alloc(pad));
}
async function writeTarFile(gz,root,rel){const full=path.join(root,rel),data=await fs.promises.readFile(full);await writeTarEntry(gz,`storage/${rel.replace(/\\/g,'/')}`,data);}
async function verifyFullBackup(filePath){
  const f=path.resolve(filePath),rel=path.relative(backupDir,f);
  if(rel.startsWith('..'+path.sep)||path.isAbsolute(rel)||!fs.existsSync(f)) throw new Error('File backup tidak ditemukan atau path tidak valid.');
  const buf=await fs.promises.readFile(f);
  const hash=crypto.createHash('sha256').update(buf).digest('hex');
  const raw=zlib.gunzipSync(buf);
  let off=0,names=[],manifest=null,data=null;
  while(off+512<=raw.length){
    const h=raw.subarray(off,off+512); off+=512;
    let empty=true; for(const b of h){if(b!==0){empty=false;break;}}
    if(empty) break;
    const name=h.subarray(0,100).toString().replace(/\\0+$/,'');
    const size=parseInt(h.subarray(124,136).toString().replace(/\\0/g,'').trim()||'0',8)||0;
    const type=h[156]||48; const body=raw.subarray(off,off+size); off+=Math.ceil(size/512)*512;
    names.push(name);
    if(type===48 && (name==='manifest.json'||name==='database-operational-data.json')){
      try{const obj=JSON.parse(body.toString('utf8')); if(name==='manifest.json')manifest=obj; else data=obj;}catch(e){throw new Error(name+' tidak valid: JSON rusak.');}
    }
  }
  if(!manifest||manifest.backup_format!=='SPPG-FULL-1.0') throw new Error('Manifest backup tidak valid.');
  if(!data||data.backup_format!=='SPPG-DATA-1.0'||!data.tables) throw new Error('Data operasional backup tidak valid.');
  return {sha256:hash,bytes:buf.length,entries:names.length,tableCount:Object.keys(data.tables).length,fileCount:Number(manifest.file_count||0),appVersion:manifest.app_version};
}
async function buildFullBackup(){
  ensureStorage();
  const now=new Date(),stamp=now.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
  const filename=`sppg-monitoring-full-backup-${stamp}.tar.gz`,filePath=path.join(backupDir,filename),tmpPath=filePath+'.tmp';
  const tables=await getBackupTables();
  const fileInventory=await listPersistentFiles(uploadDir);
  const manifest={backup_format:'SPPG-FULL-1.0',generated_at:now.toISOString(),app_version:APP_VERSION,database:process.env.DB_NAME||'',storage_mode:'persistent-outside-release',database_tables:tables,file_count:fileInventory.length,file_bytes:fileInventory.reduce((n,x)=>n+Number(x.size_bytes||0),0),files:fileInventory,notes:['Backup ini adalah snapshot data operasional dan persistent files.','Password hash pengguna tidak disertakan.','Session login tidak disertakan karena bersifat sementara.','Backup Hostinger tetap menjadi lapisan backup infrastruktur terpisah.']};
  const data={backup_format:'SPPG-DATA-1.0',generated_at:now.toISOString(),database:process.env.DB_NAME||'',tables:{}};
  for(const table of tables){
    try{
      if(table==='users'){
        const [cols]=await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='users' AND column_name<>'password_hash' ORDER BY ordinal_position");
        const names=cols.map(c=>`\`${c.column_name.replace(/`/g,'``')}\``).join(',');
        const [rows]=await pool.query(`SELECT ${names} FROM \`users\``); data.tables[table]=rows;
      }else{const [rows]=await pool.query(`SELECT * FROM \`${table.replace(/`/g,'``')}\``);data.tables[table]=rows;}
    }catch(e){data.tables[table]={error:e.code||e.message};}
  }
  const output=fs.createWriteStream(tmpPath),gz=zlib.createGzip({level:6});gz.pipe(output);
  await new Promise((resolve,reject)=>{output.on('close',resolve);output.on('error',reject);gz.on('error',reject);(async()=>{try{
    await writeTarEntry(gz,'manifest.json',JSON.stringify(manifest,null,2));
    await writeTarEntry(gz,'database-operational-data.json',JSON.stringify(data,null,2));
    for(const f of fileInventory) await writeTarFile(gz,uploadDir,f.path);
    const tpl=path.join(__dirname,'templates'); if(fs.existsSync(tpl)){const tf=await listPersistentFiles(tpl);for(const f of tf){const full=path.join(tpl,f.path),buf=await fs.promises.readFile(full);await writeTarEntry(gz,`templates/${f.path.replace(/\\/g,'/')}`,buf);}}
    gz.write(Buffer.alloc(1024,0));gz.end();
  }catch(e){reject(e);try{gz.destroy(e)}catch{}}})()});
  const st=await fs.promises.stat(tmpPath);await fs.promises.rename(tmpPath,filePath);return {filename,filePath,sizeBytes:st.size,manifest};
}

app.get('/login',(req,res)=>{
  if(REVIEW_MODE && req.query.view!=='form') return res.redirect('/');
  res.render('login',{title:'Login'});
});
app.post('/login',ar(async(req,res)=>{
  const username=clean(req.body.username),pw=String(req.body.password||'');
  if(!username||!pw){flash(req,'error','Username dan password wajib diisi.');return res.redirect('/login')}
  if(!checkLoginRate(req,username)){res.set('Retry-After','900');return res.status(429).send('Terlalu banyak percobaan login. Silakan coba lagi beberapa saat.');}
  const [r]=await pool.query('SELECT * FROM users WHERE username=? LIMIT 1',[username]);
  if(!r[0]||!(await bcrypt.compare(pw,r[0].password_hash))||!allowedRoles.has(r[0].role)){recordLoginFailure(req,username);flash(req,'error','Username atau password salah.');return res.redirect('/login')}
  clearLoginFailures(req,username);
  const user={id:r[0].id,username:r[0].username,name:r[0].name,role:r[0].role};
  await new Promise((resolve,reject)=>req.session.regenerate(err=>err?reject(err):resolve()));
  req.session.user=user;req.session.csrfToken=crypto.randomBytes(32).toString('hex');req.session.cookie.maxAge=req.body.remember?(30*24*60*60*1000):sessionMaxDefault;
  await new Promise((resolve,reject)=>req.session.save(err=>err?reject(err):resolve()));
  res.redirect('/')
}));
app.post('/logout',auth,ar(async(req,res)=>{await new Promise(resolve=>req.session.destroy(()=>resolve()));res.clearCookie('sppg.sid');res.redirect('/login')}));

app.get('/',auth,ar(async(req,res)=>{
  const [[profile]]=await pool.query('SELECT * FROM sppg_profile WHERE id=1');
  const [[staffTotal]]=await pool.query('SELECT COUNT(*) total FROM staff');
  const [[staffActive]]=await pool.query("SELECT COUNT(*) total FROM staff WHERE status='AKTIF'");
  const [[staffInactive]]=await pool.query("SELECT COUNT(*) total FROM staff WHERE status IN ('CUTI','NONAKTIF_SEMENTARA')");
  const [[staffLeft]]=await pool.query("SELECT COUNT(*) total FROM staff WHERE status IN ('MENGUNDURKAN_DIRI','MENINGGAL_DUNIA','DIBERHENTIKAN','KONTRAK_BERAKHIR','PINDAH_MUTASI')");
  const [[sk]]=await pool.query("SELECT COUNT(*) kpm,COALESCE(SUM(pm_count),0) pm FROM (SELECT k.id,(SELECT COUNT(*) FROM pm p WHERE p.kpm_id=k.id AND p.active=1) pm_count FROM kpm k WHERE k.type='SATUAN_PENDIDIKAN' AND k.active=1)t");
  const [[po]]=await pool.query("SELECT COUNT(*) kpm,COALESCE(SUM(pm_count),0) pm FROM (SELECT k.id,(SELECT COUNT(*) FROM pm p WHERE p.kpm_id=k.id AND p.active=1) pm_count FROM kpm k WHERE k.type='POSYANDU' AND k.active=1)t");
  const [[pm]]=await pool.query('SELECT COUNT(*) total FROM pm WHERE active=1');
  const [[small]]=await pool.query("SELECT COUNT(*) total FROM pm p JOIN kpm k ON k.id=p.kpm_id WHERE p.active=1 AND ((k.type='POSYANDU' AND p.category='BALITA') OR (k.type='SATUAN_PENDIDIKAN' AND k.education_level IN ('SPS','PAUD','TK','RA') AND p.category='PESERTA_DIDIK') OR (k.type='SATUAN_PENDIDIKAN' AND k.education_level IN ('SD','MI','MIS') AND p.category='PESERTA_DIDIK' AND p.class_group IN ('Kelas 1','Kelas 2','Kelas 3'))) ");
  const [[large]]=await pool.query("SELECT COUNT(*) total FROM pm p JOIN kpm k ON k.id=p.kpm_id WHERE p.active=1 AND ((k.type='POSYANDU' AND p.category IN ('BUMIL','BUSUI')) OR (k.type='SATUAN_PENDIDIKAN' AND k.education_level IN ('SPS','PAUD','TK','RA') AND p.category IN ('PENDIDIK','TENAGA_KEPENDIDIKAN')) OR (k.type='SATUAN_PENDIDIKAN' AND k.education_level IN ('SD','MI','MIS') AND ((p.category='PESERTA_DIDIK' AND p.class_group IN ('Kelas 4','Kelas 5','Kelas 6')) OR p.category IN ('PENDIDIK','TENAGA_KEPENDIDIKAN'))) OR (k.type='SATUAN_PENDIDIKAN' AND k.education_level IN ('SMP','MTs','SMA','SMK','MA'))) ");
  const [[missingNik]]=await pool.query('SELECT COUNT(*) total FROM pm WHERE active=1 AND (nik IS NULL OR nik="")');
  const [[missingCoord]]=await pool.query('SELECT COUNT(*) total FROM kpm WHERE active=1 AND (latitude IS NULL OR longitude IS NULL)');
  const [[staffMissing]]=await pool.query("SELECT COUNT(*) total FROM staff s WHERE s.status='AKTIF' AND (SELECT COUNT(*) FROM staff_documents d WHERE d.staff_id=s.id)<6");
  const kpmPct=sk.kpm+po.kpm?Math.round((sk.kpm+po.kpm-missingCoord.total)/(sk.kpm+po.kpm)*100):100;const pmPct=pm.total?Math.round((pm.total-missingNik.total)/pm.total*100):100;
  const workDate=new Date().toISOString().slice(0,10);
  const [[workSchedule]]=await pool.query('SELECT id FROM distribution_schedules WHERE distribution_date=?',[workDate]);
  const teamSummary={};
  for(const key of ['PERSIAPAN','PENGOLAHAN','PEMORSIAN','DISTRIBUSI']){
    let total=0,done=0,started=0;
    if(workSchedule){const [[r]]=await pool.query('SELECT COUNT(*) total FROM distribution_clusters WHERE schedule_id=?',[workSchedule.id]);total=Number(r.total||0);const [ev]=await pool.query('SELECT unit_id,action FROM operational_task_events WHERE work_date=? AND team=? ORDER BY created_at DESC,id DESC',[workDate,key]);const latest=new Map();for(const e of ev){const k=String(e.unit_id);if(!latest.has(k))latest.set(k,e.action)}for(const a of latest.values()){if(a==='SELESAI'||a==='KEMBALI')done++;else if(a==='MULAI'||a==='KEBERANGKATAN')started++}}
    teamSummary[key]={total,done,started,pct:total?Math.round(done/total*100):0};
  }
  let washTotal=0,washDone=0,washStarted=0;
  if(workSchedule){const [[r]]=await pool.query('SELECT COUNT(*) total FROM distribution_cluster_kpm ck JOIN distribution_clusters c ON c.id=ck.cluster_id WHERE c.schedule_id=?',[workSchedule.id]);washTotal=Number(r.total||0);const [ev]=await pool.query("SELECT unit_id,action FROM operational_task_events WHERE work_date=? AND team='PENCUCIAN' ORDER BY created_at DESC,id DESC",[workDate]);const latest=new Map();for(const e of ev){const k=String(e.unit_id);if(!latest.has(k))latest.set(k,e.action)}for(const a of latest.values()){if(a==='SELESAI_CUCI')washDone++;else if(a==='MULAI_CUCI')washStarted++}}
  teamSummary.PENCUCIAN={total:washTotal,done:washDone,started:washStarted,pct:washTotal?Math.round(washDone/washTotal*100):0};

  res.render('dashboard',{title:'Dashboard',profile,stats:{staff:{total:staffTotal.total,active:staffActive.total,inactive:staffInactive.total,left:staffLeft.total},school:sk,posyandu:po,pm:pm.total},portions:{small:small.total,large:large.total},quality:{pmMissingNik:missingNik.total,kpmMissingCoords:missingCoord.total,staffMissingDocs:staffMissing.total,kpmPct:Math.max(0,kpmPct),pmPct},workDate,teamSummary})
}));

app.get('/staff',auth,requirePermission('staff.view'),ar(async(req,res)=>{const q=clean(req.query.q),status=clean(req.query.status);const [rows]=await pool.query(`SELECT * FROM staff WHERE (name LIKE ? OR nik LIKE ? OR kpj_bpjstk LIKE ? OR position LIKE ?) ${status?'AND status=?':''} ORDER BY status='AKTIF' DESC,name`,status?[`%${q}%`,`%${q}%`,`%${q}%`,`%${q}%`,status]:[`%${q}%`,`%${q}%`,`%${q}%`,`%${q}%`]);const [[tot]]=await pool.query('SELECT COUNT(*) total FROM staff');const [[act]]=await pool.query("SELECT COUNT(*) total FROM staff WHERE status='AKTIF'");const [[inactive]]=await pool.query("SELECT COUNT(*) total FROM staff WHERE status IN ('CUTI','NONAKTIF_SEMENTARA')");const [[left]]=await pool.query("SELECT COUNT(*) total FROM staff WHERE status IN ('MENGUNDURKAN_DIRI','MENINGGAL_DUNIA','DIBERHENTIKAN','KONTRAK_BERAKHIR','PINDAH_MUTASI')");res.render('staff/index',{title:'Kepegawaian',rows,q,status,statuses,summary:{total:tot.total,active:act.total,inactive:inactive.total,left:left.total}})}));
app.get('/staff/new',auth,requirePermission('staff.manage'),(req,res)=>res.render('staff/form',{title:'Tambah Staf',staff:null,positions,docTypes,eduLevels,edu:{},statuses}));
function validateStaff(b,isEdit=false){const errors=[];if(!clean(b.name))errors.push('Nama wajib diisi.');if(!/^\d{16}$/.test(clean(b.nik)))errors.push('NIK wajib 16 digit.');if(!positions.includes(b.position))errors.push('Jabatan tidak valid.');if(b.gender&&!['L','P'].includes(b.gender))errors.push('Jenis kelamin tidak valid.');if(b.marital_status&&!['Lajang','Menikah','Janda/Duda'].includes(b.marital_status))errors.push('Status kawin tidak valid.');if(!statuses.includes(b.status||'AKTIF'))errors.push('Status staf tidak valid.');if(!validDate(b.tanggal_masuk_bekerja)||!validDate(b.birth_date)||!validDate(b.tanggal_keluar))errors.push('Format tanggal tidak valid.');if(!validPhone(clean(b.phone)))errors.push('Nomor HP/WhatsApp tidak valid.');if(!validEmail(clean(b.email)))errors.push('Email tidak valid.');if(['MENGUNDURKAN_DIRI','MENINGGAL_DUNIA','DIBERHENTIKAN','KONTRAK_BERAKHIR','PINDAH_MUTASI'].includes(b.status)&&!clean(b.tanggal_keluar))errors.push('Tanggal keluar wajib diisi untuk status staf yang sudah keluar.');if(['AKTIF','CUTI','NONAKTIF_SEMENTARA'].includes(b.status||'AKTIF')&&clean(b.tanggal_keluar))errors.push('Status aktif/cuti/sementara tidak boleh memiliki tanggal keluar.');return errors}
app.post('/staff',auth,requirePermission('staff.manage'),ar(async(req,res)=>{const b=req.body,errors=validateStaff(b);if(errors.length){flash(req,'error',errors[0]);return res.redirect('/staff/new')}const [dup]=await pool.query('SELECT id FROM staff WHERE nik=?',[clean(b.nik)]);if(dup[0]){flash(req,'error','NIK sudah terdaftar.');return res.redirect('/staff/new')}const conn=await pool.getConnection();try{await conn.beginTransaction();const [r]=await conn.query(`INSERT INTO staff(name,nik,kpj_bpjstk,tanggal_masuk_bekerja,birth_place,birth_date,gender,ktp_address,position,marital_status,phone,email,domicile_address,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[clean(b.name),clean(b.nik),clean(b.kpj_bpjstk)||null,b.tanggal_masuk_bekerja||null,clean(b.birth_place)||null,b.birth_date||null,b.gender||null,clean(b.ktp_address)||null,b.position,b.marital_status||null,clean(b.phone)||null,clean(b.email)||null,clean(b.domicile_address)||null,b.status||'AKTIF']);const sid=r.insertId;for(const l of eduLevels)if(clean(b['edu_'+l]))await conn.query('INSERT INTO staff_education(staff_id,level,institution,major,graduation_year) VALUES(?,?,?,?,?)',[sid,l,clean(b['edu_'+l]),clean(b['major_'+l])||null,b['year_'+l]||null]);await conn.commit();await log(req,'Tambah','STAFF',sid,b.name);flash(req,'success','Data staf berhasil ditambahkan.');res.redirect('/staff/'+sid)}catch(e){await conn.rollback();throw e}finally{conn.release()}}));
app.get('/staff/:id([0-9]+)',auth,ar(async(req,res)=>{const [[staff]]=await pool.query('SELECT * FROM staff WHERE id=?',[req.params.id]);if(!staff)return res.status(404).send('Staf tidak ditemukan');const [documents]=await pool.query('SELECT * FROM staff_documents WHERE staff_id=?',[staff.id]);const [education]=await pool.query('SELECT * FROM staff_education WHERE staff_id=? ORDER BY FIELD(level,\'SD/MI\',\'SMP/MTs\',\'SMA/SMK/MA\',\'S1 (Strata I)\')',[staff.id]);const [history]=await pool.query('SELECT * FROM staff_history WHERE staff_id=? ORDER BY created_at DESC',[staff.id]);res.render('staff/show',{title:staff.name,staff,documents,education,docTypes,history})}));
app.get('/staff/:id([0-9]+)/edit',auth,requirePermission('staff.manage'),ar(async(req,res)=>{const [[staff]]=await pool.query('SELECT * FROM staff WHERE id=?',[req.params.id]);if(!staff)return res.sendStatus(404);const [education]=await pool.query('SELECT * FROM staff_education WHERE staff_id=?',[req.params.id]);res.render('staff/form',{title:'Edit Staf',staff,positions,docTypes,eduLevels,edu:Object.fromEntries(education.map(x=>[x.level,x])),statuses})}));
app.put('/staff/:id',auth,ar(async(req,res)=>{const b=req.body;const [[old]]=await pool.query('SELECT * FROM staff WHERE id=?',[req.params.id]);if(!old)return res.sendStatus(404);const errors=validateStaff(b,true);if(errors.length){flash(req,'error',errors[0]);return res.redirect('/staff/'+req.params.id+'/edit')}const [dup]=await pool.query('SELECT id FROM staff WHERE nik=? AND id<>?',[clean(b.nik),req.params.id]);if(dup[0]){flash(req,'error','NIK sudah terdaftar pada staf lain.');return res.redirect('/staff/'+req.params.id+'/edit')}
  const conn=await pool.getConnection();try{await conn.beginTransaction();await conn.query(`UPDATE staff SET name=?,nik=?,kpj_bpjstk=?,tanggal_masuk_bekerja=?,birth_place=?,birth_date=?,gender=?,ktp_address=?,position=?,marital_status=?,phone=?,email=?,domicile_address=?,status=?,tanggal_keluar=?,alasan_keluar=? WHERE id=?`,[clean(b.name),clean(b.nik),clean(b.kpj_bpjstk)||null,b.tanggal_masuk_bekerja||null,clean(b.birth_place)||null,b.birth_date||null,b.gender||null,clean(b.ktp_address)||null,b.position,b.marital_status||null,clean(b.phone)||null,clean(b.email)||null,clean(b.domicile_address)||null,b.status||'AKTIF',b.tanggal_keluar||null,clean(b.alasan_keluar)||null,req.params.id]);await conn.query('DELETE FROM staff_education WHERE staff_id=?',[req.params.id]);for(const l of eduLevels)if(clean(b['edu_'+l]))await conn.query('INSERT INTO staff_education(staff_id,level,institution,major,graduation_year) VALUES(?,?,?,?,?)',[req.params.id,l,clean(b['edu_'+l]),clean(b['major_'+l])||null,b['year_'+l]||null]);if(old.status!==b.status)await conn.query('INSERT INTO staff_history(staff_id,action_type,old_status,new_status,description) VALUES(?,?,?,?,?)',[req.params.id,'PERUBAHAN_STATUS',old.status,b.status,clean(b.alasan_keluar)||'Status diperbarui']);await conn.commit();await log(req,'Edit','STAFF',req.params.id,b.name,old,{...b});flash(req,'success','Data staf diperbarui.');res.redirect('/staff/'+req.params.id)}catch(e){await conn.rollback();throw e}finally{conn.release()}}));
app.post('/staff/:id/documents',auth,upload.single('file'),ar(async(req,res)=>{try{if(!requireCsrf(req,res)){await removeUploaded(req.file);return}if(!req.file||!docTypes.includes(req.body.doc_type)||!(await verifyUploadedFile(req.file))){await removeUploaded(req.file);flash(req,'error','Dokumen tidak valid atau isi file tidak sesuai.');return res.redirect('/staff/'+req.params.id)}const [old]=await pool.query('SELECT * FROM staff_documents WHERE staff_id=? AND doc_type=?',[req.params.id,req.body.doc_type]);await pool.query(`INSERT INTO staff_documents(staff_id,doc_type,file_path,original_name,mime_type) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE file_path=VALUES(file_path),original_name=VALUES(original_name),mime_type=VALUES(mime_type),uploaded_at=CURRENT_TIMESTAMP`,[req.params.id,req.body.doc_type,req.file.filename,req.file.originalname,req.file.mimetype]);if(old[0])await removeUploaded({path:path.join(uploadDir,path.basename(old[0].file_path))});await log(req,'Upload Dokumen','STAFF',req.params.id,req.body.doc_type);flash(req,'success','Dokumen berhasil diunggah.');res.redirect('/staff/'+req.params.id)}catch(e){await removeUploaded(req.file);throw e}}));
app.get('/uploads/:filename(*)',auth,ar(async(req,res)=>{const f=await resolveStoredFile(req.params.filename);if(!f)return res.sendStatus(404);res.set('Content-Disposition','inline');res.sendFile(f)}));

function rulesFor(l, type='SATUAN_PENDIDIKAN'){
  if(type==='POSYANDU')return{
    isPosyandu:true,
    small:'Balita',
    large:'Bumil + Busui',
    balitaGroups:['0-5 Bulan (Bayi)','6-23 Bulan (Baduta)','24-59 Bulan (Balita)'],
    bumilGroups:['Trimester 1 (1–12 Minggu)','Trimester 2 (13–27 Minggu)','Trimester 3 (28–40 Minggu)'],
    busuiGroups:['Bayi 0–6 Bulan (ASI Eksklusif)','Bayi 7–12 Bulan','Bayi 13–24 Bulan'],
    classes:['0-5 Bulan (Bayi)','6-23 Bulan (Baduta)','24-59 Bulan (Balita)','Trimester 1 (1–12 Minggu)','Trimester 2 (13–27 Minggu)','Trimester 3 (28–40 Minggu)','Bayi 0–6 Bulan (ASI Eksklusif)','Bayi 7–12 Bulan','Bayi 13–24 Bulan']
  };
  if(l==='PAUD/TK/RA/TKLB'||['SPS','PAUD','TK','RA'].includes(l))return{small:'Peserta Didik',large:'Pendidik + Tendik',classes:['Peserta Didik']};
  if(l==='SD/MI/SD SLB'||['SD','MI','MIS'].includes(l))return{small:'Kelas 1–3',large:'Kelas 4–6 + Pendidik + Tendik',classes:['Kelas 1','Kelas 2','Kelas 3','Kelas 4','Kelas 5','Kelas 6']};
  if(l==='SMP/MTs/SMP SLB/Pesantren Kelas 1-3'||['SMP','MTs'].includes(l))return{small:'0',large:'Peserta Didik + Pendidik + Tendik',classes:['Peserta Didik']};
  if(l==='SMA/MA/SMK/SMA SLB/Pesantren Kelas 4-6'||['SMA','SMK','MA'].includes(l))return{small:'0',large:'Peserta Didik + Pendidik + Tendik',classes:['Peserta Didik']};
  return null;
}
function intField(v){return Math.max(0,Math.floor(Number.isFinite(Number(v))?Number(v):0))}
function kpmCountPayload(b,type){
  const names=['small_female','small_male','large_female','large_male','teacher_female','teacher_male','staff_female','staff_male','balita_female','balita_male','bumil','busui'];
  const out={}; for(const n of names)out[n]=intField(b[n]);
  if(type==='SATUAN_PENDIDIKAN'){out.balita_female=0;out.balita_male=0;out.bumil=0;out.busui=0}else{out.small_female=out.small_female;out.small_male=out.small_male;out.large_female=0;out.large_male=0;out.teacher_female=0;out.teacher_male=0;out.staff_female=0;out.staff_male=0}
  return out;
}
function kpmTotals(k,c){
  if(k.type==='POSYANDU'){
    const balita=intField(c.balita_female)+intField(c.balita_male), large=intField(c.bumil)+intField(c.busui);
    return {small:balita,large,total:balita+large,balita,bumil:intField(c.bumil),busui:intField(c.busui)};
  }
  const small=intField(c.small_female)+intField(c.small_male), largePd=intField(c.large_female)+intField(c.large_male), teacher=intField(c.teacher_female)+intField(c.teacher_male), staff=intField(c.staff_female)+intField(c.staff_male);
  let smallTotal=small,largeTotal=largePd+teacher+staff;
  if(k.education_level==='SMP/MTs/SMP SLB/Pesantren Kelas 1-3'||k.education_level==='SMA/MA/SMK/SMA SLB/Pesantren Kelas 4-6'){smallTotal=0;largeTotal=largePd+teacher+staff}
  return {small:smallTotal,large:largeTotal,total:smallTotal+largeTotal,peserta:small+largePd,teacher,staff};
}
function validateKpm(b){const errors=[];if(!clean(b.name))errors.push('Nama KPM wajib diisi.');if(!clean(b.address))errors.push('Alamat KPM wajib diisi.');if(!['SATUAN_PENDIDIKAN','POSYANDU'].includes(b.type))errors.push('Jenis KPM tidak valid.');if(b.type==='SATUAN_PENDIDIKAN'&&!levels.includes(clean(b.education_level)))errors.push('Kelompok satuan pendidikan wajib dipilih.');if(b.type==='POSYANDU'&&clean(b.education_level))errors.push('Posyandu tidak boleh memiliki kelompok pendidikan.');if(b.type==='SATUAN_PENDIDIKAN'&&clean(b.npsn)&&!/^[0-9]{8,20}$/.test(clean(b.npsn)))errors.push('NPSN harus berupa angka.');if(!validPhone(clean(b.head_phone))||!validPhone(clean(b.pic_phone))||!validPhone(clean(b.cadre_phone)))errors.push('Nomor HP/WhatsApp KPM tidak valid.');if(b.latitude!==''){const lat=Number(b.latitude);if(!Number.isFinite(lat)||lat<-90||lat>90)errors.push('Latitude tidak valid.')}if(b.longitude!==''){const lng=Number(b.longitude);if(!Number.isFinite(lng)||lng<-180||lng>180)errors.push('Longitude tidak valid.')}return errors}
async function effectiveKpmData(kpmId,date){const [[row]]=await pool.query('SELECT * FROM kpm_daily_data WHERE kpm_id=? AND effective_from<=? ORDER BY effective_from DESC,id DESC LIMIT 1',[kpmId,date]);return row}
function countValidation(b,type){for(const n of ['small_female','small_male','large_female','large_male','teacher_female','teacher_male','staff_female','staff_male','balita_female','balita_male','bumil','busui']){if(b[n]!==undefined&&(!Number.isFinite(Number(b[n]))||Number(b[n])<0))return 'Jumlah penerima manfaat tidak boleh negatif.'}if(type==='SATUAN_PENDIDIKAN'&&['balita_female','balita_male','bumil','busui'].some(n=>intField(b[n])>0))return 'Data Balita/Bumil/Busui hanya untuk Posyandu.';if(type==='POSYANDU'&&['small_female','small_male','large_female','large_male','teacher_female','teacher_male','staff_female','staff_male'].some(n=>intField(b[n])>0))return 'Data peserta didik/pendidik/tendik hanya untuk Satuan Pendidikan.';return null}
function excelNumber(v){if(v===null||v===undefined||v==='')return 0;const n=Number(String(v).replace(/,/g,''));return Number.isFinite(n)&&n>=0?Math.floor(n):NaN}
function normalizeExcelLevel(v){const x=clean(v).replace(/\s+/g,' ').trim();const map=new Map([
 ['PAUD/TK/RA/TKLB','PAUD/TK/RA/TKLB'],
 ['SD/MI/SD SLB','SD/MI/SD SLB'],
 ['SMP/MTs/SMP SLB/Pesantren Kelas 1-3','SMP/MTs/SMP SLB/Pesantren Kelas 1-3'],
 ['SMP/MTs/SMP SLB/ Pesantren Kelas 1-3','SMP/MTs/SMP SLB/Pesantren Kelas 1-3'],
 ['SMA/MA/SMK/SMA SLB/Pesantren Kelas 4-6','SMA/MA/SMK/SMA SLB/Pesantren Kelas 4-6']
]);return map.get(x)||null}
function parseKpmExcel(filePath){
  const book=XLSX.readFile(filePath,{cellDates:false,raw:true});
  const requiredSheets=['Rekap','Satuan Pendidikan','Posyandu'];
  for(const name of requiredSheets)if(!book.Sheets[name])throw new Error(`Sheet "${name}" wajib tersedia pada Template Excel KPM PM.`);
  const schoolRows=XLSX.utils.sheet_to_json(book.Sheets['Satuan Pendidikan'],{header:1,defval:null,raw:true});
  const posRows=XLSX.utils.sheet_to_json(book.Sheets['Posyandu'],{header:1,defval:null,raw:true});
  const schoolHeader=schoolRows.findIndex(r=>clean(r[2]).toUpperCase()==='NAMA SATUAN PENDIDIKAN');
  const posHeader=posRows.findIndex(r=>clean(r[2]).toUpperCase()==='NAMA POSYANDU');
  if(schoolHeader<0||posHeader<0)throw new Error('Format Excel tidak sesuai Template Excel KPM PM. Sheet Satuan Pendidikan dan Posyandu wajib mengikuti template.');
  const data=[];const seenCodes=new Set();const seenEntities=new Set();let schoolGroup='';
  for(let i=schoolHeader+2;i<schoolRows.length;i++){
    const r=schoolRows[i]||[];const codeValue=clean(r[18]);const name=clean(r[2]);
    if(!name||/^JUMLAH TOTAL$/i.test(String(r[0]||'').trim()))continue;
    if(!codeValue)throw new Error(`Sheet Satuan Pendidikan baris ${i+1}: Kode KPM wajib diisi agar sistem tidak salah membaca nama KPM.`);
    if(!canonicalKpmCode('SATUAN_PENDIDIKAN',codeValue))throw new Error(`Sheet Satuan Pendidikan baris ${i+1}: Kode KPM ${codeValue} tidak sesuai format resmi. Gunakan KPM-SP-001, KPM-SP-002, dan seterusnya.`);
    const entityKey='SATUAN_PENDIDIKAN|'+normalizedName(name);if(seenEntities.has(entityKey))throw new Error(`Sheet Satuan Pendidikan baris ${i+1}: Nama KPM ${name} muncul lebih dari sekali. Gunakan satu Kode KPM untuk satu KPM.`);seenEntities.add(entityKey);
    if(seenCodes.has(codeValue))throw new Error(`Baris ${i+1}: Kode KPM ${codeValue} terduplikasi.`);seenCodes.add(codeValue);
    if(clean(r[1]))schoolGroup=clean(r[1]);
    const level=normalizeExcelLevel(schoolGroup);if(!level)throw new Error(`Sheet Satuan Pendidikan baris ${i+1}: kelompok tidak dikenali: ${schoolGroup||'-'}`);
    const vals={small_female:excelNumber(r[3]),small_male:excelNumber(r[4]),large_female:excelNumber(r[6]),large_male:excelNumber(r[7]),teacher_female:excelNumber(r[10]),teacher_male:excelNumber(r[11]),staff_female:excelNumber(r[13]),staff_male:excelNumber(r[14])};
    if(Object.values(vals).some(Number.isNaN))throw new Error(`Sheet Satuan Pendidikan baris ${i+1}: jumlah PM harus berupa angka 0 atau lebih.`);
    data.push({code:codeValue,type:'SATUAN_PENDIDIKAN',name,education_level:level,address:'',...vals,balita_female:0,balita_male:0,bumil:0,busui:0});
  }
  for(let i=posHeader+2;i<posRows.length;i++){
    const r=posRows[i]||[];const codeValue=clean(r[10]);const name=clean(r[2]);
    if(!name||/^JUMLAH TOTAL$/i.test(String(r[0]||'').trim()))continue;
    if(!codeValue)throw new Error(`Sheet Posyandu baris ${i+1}: Kode KPM wajib diisi agar sistem tidak salah membaca nama KPM.`);
    if(!canonicalKpmCode('POSYANDU',codeValue))throw new Error(`Sheet Posyandu baris ${i+1}: Kode KPM ${codeValue} tidak sesuai format resmi. Gunakan KPM-POS-001, KPM-POS-002, dan seterusnya.`);
    const entityKey='POSYANDU|'+normalizedName(name);if(seenEntities.has(entityKey))throw new Error(`Sheet Posyandu baris ${i+1}: Nama KPM ${name} muncul lebih dari sekali. Gunakan satu Kode KPM untuk satu KPM.`);seenEntities.add(entityKey);
    if(seenCodes.has(codeValue))throw new Error(`Baris ${i+1}: Kode KPM ${codeValue} terduplikasi.`);seenCodes.add(codeValue);
    const group=clean(r[1]);if(group&&group.toUpperCase()!=='BALITA, BUMIL & BUSUI')throw new Error(`Sheet Posyandu baris ${i+1}: kelompok PM tidak sesuai template.`);
    const vals={balita_female:excelNumber(r[3]),balita_male:excelNumber(r[4]),bumil:excelNumber(r[6]),busui:excelNumber(r[7]),small_female:0,small_male:0,large_female:0,large_male:0,teacher_female:0,teacher_male:0,staff_female:0,staff_male:0};
    if(Object.values(vals).some(Number.isNaN))throw new Error(`Sheet Posyandu baris ${i+1}: jumlah PM harus berupa angka 0 atau lebih.`);
    data.push({code:codeValue,type:'POSYANDU',name,education_level:null,address:'',...vals});
  }
  if(!data.length)throw new Error('Tidak ada data KPM yang dapat diimpor.');return data;
}
function parseBnbaExcel(filePath){
  const wb=XLSX.readFile(filePath,{cellDates:false,raw:false});
  const ws=wb.Sheets['BNBA']||wb.Sheets[wb.SheetNames[0]];
  if(!ws) throw new Error('Sheet BNBA tidak ditemukan.');
  const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
  if(rows.length<2) throw new Error('Sheet BNBA belum berisi data.');
  const headers=(rows[0]||[]).map(v=>clean(v).toUpperCase());
  const required=['KODE_KPM','NAMA_PM','JENIS_KELAMIN','KATEGORI_PM'];
  const missing=required.filter(x=>!headers.includes(x));
  if(missing.length) throw new Error('Kolom wajib belum ada: '+missing.join(', '));
  const idx=k=>headers.indexOf(k); const out=[]; const seen=new Set(); const identitySeen=new Map();
  const allowedCat=new Set(['PESERTA_DIDIK','PENDIDIK','TENAGA_KEPENDIDIKAN','BALITA','BUMIL','BUSUI']);
  for(let i=1;i<rows.length;i++){
    const r=rows[i]||[]; if(r.every(v=>!clean(v))) continue;
    const item={row_no:i+1,code:clean(r[idx('KODE_KPM')]),kpm_name:idx('NAMA_KPM')>=0?clean(r[idx('NAMA_KPM')]):'',kpm_type:idx('JENIS_KPM')>=0?clean(r[idx('JENIS_KPM')]).toUpperCase():'',full_name:clean(r[idx('NAMA_PM')]),nik:idx('NIK')>=0?clean(r[idx('NIK')]):'',nisn:idx('NISN')>=0?clean(r[idx('NISN')]):'',gender:idx('JENIS_KELAMIN')>=0?clean(r[idx('JENIS_KELAMIN')]).toUpperCase():'',class_group:idx('KELAS_KELOMPOK')>=0?clean(r[idx('KELAS_KELOMPOK')]):'',category:idx('KATEGORI_PM')>=0?clean(r[idx('KATEGORI_PM')]).toUpperCase():''};
    let status='VALID', notes=[];
    if(!item.code) {status='TIDAK_LENGKAP';notes.push('Kode KPM wajib diisi.');}
    if(!item.full_name) {status='TIDAK_LENGKAP';notes.push('Nama PM wajib diisi.');}
    if(!['L','P'].includes(item.gender)) {status='TIDAK_VALID';notes.push('Jenis kelamin harus L atau P.');}
    if(!allowedCat.has(item.category)) {status='TIDAK_VALID';notes.push('Kategori PM tidak dikenali.');}
    if(item.nik && !/^\d{8,20}$/.test(item.nik)) {status='TIDAK_VALID';notes.push('NIK harus berupa angka 8–20 digit.');}
    if(item.nisn && !/^\d{6,20}$/.test(item.nisn)) {status='TIDAK_VALID';notes.push('NISN harus berupa angka 6–20 digit.');}
    const key=item.code+'|'+(item.nik||item.nisn||normalizedName(item.full_name));
    if(seen.has(key)){status='DUPLIKAT';notes.push('Duplikat di dalam file import.');} else seen.add(key);
    out.push({...item,status,validation_note:notes.join(' ')||null});
  }
  if(!out.length) throw new Error('Tidak ada baris BNBA yang dapat diimpor.');
  return out;
}
app.get('/kpm/template.xlsx',auth,(req,res)=>{const file=path.join(__dirname,'templates','Template Excel KPM PM.xlsx');if(!fs.existsSync(file))return res.status(404).send('Template Excel KPM PM tidak ditemukan.');res.download(file,'Template Excel KPM PM.xlsx')});
app.get('/data-kpm-pm/template.xlsx',auth,requirePermission('data_kpm_pm.view'),(req,res)=>{const file=path.join(__dirname,'templates','Template BNBA KPM PM.xlsx');if(!fs.existsSync(file))return res.status(404).send('Template BNBA KPM PM tidak ditemukan.');res.download(file,'Template BNBA KPM PM.xlsx')});
app.get('/kpm/import',auth,requirePermission('kpm.manage'),(req,res)=>res.render('kpm/import',{title:'Import Excel KPM',effectiveDate:/^\d{4}-\d{2}-\d{2}$/.test(clean(req.query.date))?clean(req.query.date):new Date().toISOString().slice(0,10)}));
app.post('/kpm/import',auth,upload.single('file'),ar(async(req,res)=>{
  const effective=/^\d{4}-\d{2}-\d{2}$/.test(clean(req.body?.effective_from))?clean(req.body.effective_from):new Date().toISOString().slice(0,10);
  try{
    if(!requireCsrf(req,res)){await removeUploaded(req.file);return}
    if(!req.file||path.extname(req.file.originalname).toLowerCase()!=='.xlsx'||!(await verifyUploadedFile(req.file))){
      await removeUploaded(req.file);flash(req,'error','File harus berupa Excel .xlsx yang valid.');return res.redirect('/kpm/import?date='+encodeURIComponent(effective));
    }
    const items=parseKpmExcel(req.file.path);
    const conn=await pool.getConnection();
    let created=0,updated=0,remapped=0;
    const remaps=[];
    try{
      await conn.beginTransaction();
      for(const item of items){
        const [byCode]=await conn.query('SELECT * FROM kpm WHERE code=? LIMIT 1',[item.code]);
        let kpm=byCode[0];
        if(kpm){
          if(kpm.type!==item.type)throw new Error(`Kode KPM ${item.code} sudah digunakan untuk jenis KPM yang berbeda (${kpm.type}). Import dibatalkan agar data tidak tertukar.`);
          if(normalizedName(kpm.name)!==normalizedName(item.name))throw new Error(`Kode KPM ${item.code} sudah terdaftar untuk ${kpm.name}, sedangkan Excel berisi ${item.name}. Periksa Kode KPM pada Excel.`);
          await conn.query('UPDATE kpm SET name=?,education_level=? WHERE id=?',[item.name,item.education_level,kpm.id]);
          updated++;
        }else{
          // The Excel template is authoritative for official Kode KPM. If the same KPM
          // already exists under a legacy/generated code, re-key that existing row instead
          // of creating a duplicate. Foreign keys use kpm.id, so historical PM/distribution
          // records remain attached to the same KPM.
          const [sameNameRows]=await conn.query('SELECT * FROM kpm WHERE type=? AND name=? LIMIT 2',[item.type,item.name]);
          if(sameNameRows.length>1)throw new Error(`Nama KPM ${item.name} terdeteksi lebih dari satu kali di database. Selesaikan duplikasi terlebih dahulu sebelum import.`);
          if(sameNameRows.length===1){
            const existing=sameNameRows[0];
            const [codeConflict]=await conn.query('SELECT id,name,type FROM kpm WHERE code=? AND id<>? LIMIT 1',[item.code,existing.id]);
            if(codeConflict.length)throw new Error(`Kode KPM ${item.code} sudah digunakan oleh ${codeConflict[0].name}. Tidak aman melakukan pemetaan otomatis.`);
            const oldCode=existing.code;
            await conn.query('UPDATE kpm SET code=?,name=?,education_level=? WHERE id=?',[item.code,item.name,item.education_level,existing.id]);
            await conn.query('INSERT INTO kpm_code_history(kpm_id,old_code,new_code,reason,changed_by) VALUES(?,?,?,?,?)',[existing.id,oldCode,item.code,'Sinkronisasi Kode KPM resmi dari Template Excel KPM PM',req.session.user.id]);
            kpm={...existing,code:item.code,name:item.name,education_level:item.education_level};
            remapped++;remaps.push({id:existing.id,name:item.name,oldCode,newCode:item.code});
          }else{
            const [r]=await conn.query('INSERT INTO kpm(code,name,type,education_level,address) VALUES(?,?,?,?,?)',[item.code,item.name,item.type,item.education_level,item.address]);
            kpm={id:r.insertId,code:item.code,name:item.name,type:item.type,education_level:item.education_level};
            created++;
          }
        }
        const vals=[item.small_female,item.small_male,item.large_female,item.large_male,item.teacher_female,item.teacher_male,item.staff_female,item.staff_male,item.balita_female,item.balita_male,item.bumil,item.busui];
        const [existingDaily]=await conn.query('SELECT id FROM kpm_daily_data WHERE kpm_id=? AND effective_from=? LIMIT 1',[kpm.id,effective]);
        if(existingDaily.length){
          await conn.query(`UPDATE kpm_daily_data SET small_female=?,small_male=?,large_female=?,large_male=?,teacher_female=?,teacher_male=?,staff_female=?,staff_male=?,balita_female=?,balita_male=?,bumil=?,busui=?,created_by=? WHERE id=?`,[...vals,req.session.user.id,existingDaily[0].id]);
        }else{
          await conn.query(`INSERT INTO kpm_daily_data(kpm_id,effective_from,small_female,small_male,large_female,large_male,teacher_female,teacher_male,staff_female,staff_male,balita_female,balita_male,bumil,busui,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[kpm.id,effective,...vals,req.session.user.id]);
        }
      }
      await conn.commit();
    }catch(e){await conn.rollback();throw e}finally{conn.release()}
    await pool.query('INSERT INTO kpm_import_history(filename,effective_from,total_rows,created_count,updated_count,remapped_count,created_by) VALUES(?,?,?,?,?,?,?)',[req.file.originalname,effective,items.length,created,updated,remapped,req.session.user.id]);
    await log(req,'Import Excel','KPM',null,`Import ${items.length} KPM berlaku ${effective}${remapped?` dan sinkronisasi ${remapped} Kode KPM`:''}`,null,{count:items.length,created,updated,remapped,effective_from:effective,filename:req.file.originalname,remaps});
    await removeUploaded(req.file);
    const detail=remapped?` ${remapped} Kode KPM lama disinkronkan ke kode resmi template.`:'';
    flash(req,'success',`Import berhasil: ${items.length} KPM (${created} baru, ${updated} diperbarui).${detail}`);
    return res.redirect('/kpm?date='+encodeURIComponent(effective));
  }catch(e){
    await removeUploaded(req.file);
    flash(req,'error',e.message||'Import Excel gagal. Tidak ada perubahan yang disimpan.');
    return res.redirect('/kpm/import?date='+encodeURIComponent(effective));
  }
}));
app.get('/data-kpm-pm',auth,requirePermission('data_kpm_pm.view'),ar(async(req,res)=>{
  const status=clean(req.query.status),type=clean(req.query.type),q=clean(req.query.q);
  const params=[]; let where='WHERE 1=1';
  if(status){where+=' AND s.status=?';params.push(status)}
  if(type){where+=' AND k.type=?';params.push(type)}
  if(q){where+=' AND (k.name LIKE ? OR k.code LIKE ?)';params.push(`%${q}%`,`%${q}%`)}
  const [rows]=await pool.query(`SELECT s.*,k.name kpm_name,k.code kpm_code,k.type kpm_type,u.name submitter_name,r.name reviewer_name,(SELECT COUNT(*) FROM kpm_pm_submission_rows x WHERE x.submission_id=s.id) row_count,(SELECT COUNT(*) FROM kpm_pm_submission_rows x WHERE x.submission_id=s.id AND x.status='VALID') valid_count FROM kpm_pm_submissions s JOIN kpm k ON k.id=s.kpm_id LEFT JOIN users u ON u.id=s.submitted_by LEFT JOIN users r ON r.id=s.reviewed_by ${where} ORDER BY s.created_at DESC,s.id DESC`,params);
  const [[summary]] = await pool.query(`SELECT COUNT(*) total,SUM(status='DIAJUKAN') diajukan,SUM(status='DITINJAU') ditinjau,SUM(status='DISETUJUI') disetujui,SUM(status='DITOLAK') ditolak FROM kpm_pm_submissions`);
  res.render('data-kpm-pm/index',{title:'DATA KPM PM',rows,summary,status,type,q});
}));
app.get('/data-kpm-pm/import',auth,requirePermission('data_kpm_pm.manage'),(req,res)=>res.render('data-kpm-pm/import',{title:'Import BNBA KPM PM'}));
app.post('/data-kpm-pm/import',auth,requirePermission('data_kpm_pm.manage'),upload.single('file'),ar(async(req,res)=>{
  try{
    if(!requireCsrf(req,res)){await removeUploaded(req.file);return}
    if(!req.file||path.extname(req.file.originalname).toLowerCase()!=='.xlsx'||!(await verifyUploadedFile(req.file))){await removeUploaded(req.file);flash(req,'error','File harus berupa Excel .xlsx yang valid.');return res.redirect('/data-kpm-pm/import');}
    const parsed=parseBnbaExcel(req.file.path);
    const codes=[...new Set(parsed.map(x=>x.code).filter(Boolean))];
    const placeholders=codes.map(()=>'?').join(',');
    const [kpms]=codes.length?await pool.query(`SELECT id,code,name,type FROM kpm WHERE code IN (${placeholders})`,codes):[[]];
    const byCode=new Map(kpms.map(k=>[k.code,k]));
    const seenDb=new Set();
    for(const item of parsed){
      const k=byCode.get(item.code);
      if(!k){item.status='TIDAK_VALID';item.validation_note=[item.validation_note,'Kode KPM tidak ditemukan di Master KPM.'].filter(Boolean).join(' ');continue;}
      if(item.kpm_name && normalizedName(item.kpm_name)!==normalizedName(k.name)){item.status='TIDAK_VALID';item.validation_note=[item.validation_note,'Nama KPM berbeda dari Master; sistem tetap menggunakan Kode KPM.'].filter(Boolean).join(' ');}
      if(item.kpm_type && item.kpm_type!==k.type){item.status='TIDAK_VALID';item.validation_note=[item.validation_note,'Jenis KPM berbeda dari Master KPM.'].filter(Boolean).join(' ');}
      const identity=item.code+'|'+(item.nik||item.nisn||normalizedName(item.full_name));
      if(seenDb.has(identity)){item.status='DUPLIKAT';item.validation_note=[item.validation_note,'Duplikat identitas dalam file.'].filter(Boolean).join(' ');} else seenDb.add(identity);
      item.kpm_id=k.id;
      if(k.type==='POSYANDU' && ['PESERTA_DIDIK','PENDIDIK','TENAGA_KEPENDIDIKAN'].includes(item.category)){item.status='TIDAK_VALID';item.validation_note=[item.validation_note,'Kategori ini tidak sesuai untuk Posyandu.'].filter(Boolean).join(' ');}
      if(k.type==='SATUAN_PENDIDIKAN' && ['BALITA','BUMIL','BUSUI'].includes(item.category)){item.status='TIDAK_VALID';item.validation_note=[item.validation_note,'Kategori ini tidak sesuai untuk Satuan Pendidikan.'].filter(Boolean).join(' ');}
    }
    const conn=await pool.getConnection();let sid;
    try{await conn.beginTransaction();
      const [r]=await conn.query("INSERT INTO kpm_pm_submissions(kpm_id,submission_type,effective_from,status,submitted_by,source_filename) VALUES(?,?,?,?,?,?)",[parsed[0].kpm_id||null,'EXCEL',new Date().toISOString().slice(0,10),'DRAFT',req.session.user.id,req.file.originalname]); sid=r.insertId;
      for(let i=0;i<parsed.length;i++){const x=parsed[i];if(!x.kpm_id) continue;await conn.query('INSERT INTO kpm_pm_submission_rows(submission_id,row_no,full_name,nik,nisn,gender,class_group,category,status,validation_note) VALUES(?,?,?,?,?,?,?,?,?,?)',[sid,i+1,x.full_name,x.nik||null,x.nisn||null,x.gender||null,x.class_group||null,x.category||null,x.status,x.validation_note]);}
      // One submission must not span multiple KPM. Split is required to keep review/apply scope unambiguous.
      const uniqueKpm=[...new Set(parsed.map(x=>x.kpm_id).filter(Boolean))];
      if(uniqueKpm.length!==1) throw new Error('Satu pengajuan harus untuk satu KPM. File berisi lebih dari satu Kode KPM. Pisahkan file per KPM.');
      await conn.query('UPDATE kpm_pm_submissions SET kpm_id=? WHERE id=?',[uniqueKpm[0],sid]);
      await conn.query('INSERT INTO kpm_pm_submission_history(submission_id,action,from_status,to_status,note,actor_id) VALUES(?,?,?,?,?,?)',[sid,'IMPORT_PREVIEW',null,'DRAFT',`Preview import ${parsed.length} baris dari ${req.file.originalname}.`,req.session.user.id]);
      await conn.commit();
    }catch(e){await conn.rollback();throw e}finally{conn.release()}
    await log(req,'Import BNBA Preview','DATA_KPM_PM',sid,'Preview import Excel BNBA KPM PM',null,{row_count:parsed.length,filename:req.file.originalname});await removeUploaded(req.file);flash(req,'success',`Preview import berhasil dibuat (${parsed.length} baris). Periksa hasil validasi sebelum mengajukan review.`);res.redirect('/data-kpm-pm/'+sid);
  }catch(e){await removeUploaded(req.file);flash(req,'error',e.message||'Import BNBA gagal.');res.redirect('/data-kpm-pm/import');}
}));
app.get('/data-kpm-pm/new',auth,requirePermission('data_kpm_pm.manage'),ar(async(req,res)=>{
  const [kpms]=await pool.query("SELECT id,code,name,type,education_level FROM kpm WHERE active=1 ORDER BY type,name");
  res.render('data-kpm-pm/form',{title:'Ajukan Data KPM PM',kpms,submission:null,rows:[]});
}));
app.post('/data-kpm-pm',auth,requirePermission('data_kpm_pm.manage'),ar(async(req,res)=>{
  const kpmId=Number(req.body.kpm_id),effective=clean(req.body.effective_from); if(!kpmId||!/^\\d{4}-\\d{2}-\\d{2}$/.test(effective)) throw new Error('KPM dan tanggal berlaku wajib valid.');
  const [[kpm]]=await pool.query('SELECT id FROM kpm WHERE id=? AND active=1',[kpmId]); if(!kpm) throw new Error('KPM tidak ditemukan atau tidak aktif.');
  const names=Array.isArray(req.body.full_name)?req.body.full_name:[req.body.full_name].filter(Boolean), nik=Array.isArray(req.body.nik)?req.body.nik:[req.body.nik], nisn=Array.isArray(req.body.nisn)?req.body.nisn:[req.body.nisn], gender=Array.isArray(req.body.gender)?req.body.gender:[req.body.gender], cls=Array.isArray(req.body.class_group)?req.body.class_group:[req.body.class_group], cat=Array.isArray(req.body.category)?req.body.category:[req.body.category];
  if(!names.length) throw new Error('Minimal satu data PM harus diisi.');
  const allowed=['PESERTA_DIDIK','PENDIDIK','TENAGA_KEPENDIDIKAN','BALITA','BUMIL','BUSUI'];
  const conn=await pool.getConnection(); let sid;
  try{await conn.beginTransaction(); const [r]=await conn.query("INSERT INTO kpm_pm_submissions(kpm_id,submission_type,effective_from,status,submitted_by) VALUES(?,?,?,?,?)",[kpmId,'MANUAL',effective,'DIAJUKAN',req.session.user.id]); sid=r.insertId;
    for(let i=0;i<names.length;i++){const nm=clean(names[i]);const g=['L','P'].includes(gender[i])?gender[i]:null;const c=allowed.includes(cat[i])?cat[i]:null;let st='VALID',note=null;if(!nm||!g||!c){st='TIDAK_LENGKAP';note='Nama, jenis kelamin, dan kategori wajib valid.'}await conn.query('INSERT INTO kpm_pm_submission_rows(submission_id,row_no,full_name,nik,nisn,gender,class_group,category,status,validation_note) VALUES(?,?,?,?,?,?,?,?,?,?)',[sid,i+1,nm,clean(nik[i])||null,clean(nisn[i])||null,g,clean(cls[i])||null,c||'PESERTA_DIDIK',st,note]);}
    await conn.query('INSERT INTO kpm_pm_submission_history(submission_id,action,from_status,to_status,note,actor_id) VALUES(?,?,?,?,?,?)',[sid,'SUBMIT',null,'DIAJUKAN','Data diajukan untuk review Aslap.',req.session.user.id]); await conn.commit(); await log(req,'Ajukan','DATA_KPM_PM',sid,'Pengajuan Data KPM PM',null,{kpm_id:kpmId,effective_from:effective,row_count:names.length}); flash(req,'success','Data KPM PM berhasil diajukan dan menunggu review Aslap.'); res.redirect('/data-kpm-pm/'+sid);
  }catch(e){await conn.rollback();throw e}finally{conn.release()}
}));
app.get('/data-kpm-pm/:id([0-9]+)',auth,requirePermission('data_kpm_pm.view'),ar(async(req,res)=>{const [[submission]]=await pool.query(`SELECT s.*,k.name kpm_name,k.code kpm_code,k.type kpm_type,u.name submitter_name,r.name reviewer_name,a.name applier_name FROM kpm_pm_submissions s JOIN kpm k ON k.id=s.kpm_id LEFT JOIN users u ON u.id=s.submitted_by LEFT JOIN users r ON r.id=s.reviewed_by LEFT JOIN users a ON a.id=s.applied_by WHERE s.id=?`,[req.params.id]);if(!submission)return res.sendStatus(404);const [rows]=await pool.query('SELECT * FROM kpm_pm_submission_rows WHERE submission_id=? ORDER BY row_no',[req.params.id]);const [history]=await pool.query('SELECT h.*,u.name actor_name FROM kpm_pm_submission_history h LEFT JOIN users u ON u.id=h.actor_id WHERE h.submission_id=? ORDER BY h.created_at DESC,h.id DESC',[req.params.id]);res.render('data-kpm-pm/show',{title:'Detail DATA KPM PM',submission,rows,history});}));
app.post('/data-kpm-pm/:id([0-9]+)/submit',auth,requirePermission('data_kpm_pm.manage'),ar(async(req,res)=>{const id=Number(req.params.id);const [[s]]=await pool.query('SELECT * FROM kpm_pm_submissions WHERE id=?',[id]);if(!s)return res.sendStatus(404);if(s.status!=='DRAFT')throw new Error('Hanya draft yang dapat diajukan.');const [[bad]]=await pool.query("SELECT COUNT(*) c FROM kpm_pm_submission_rows WHERE submission_id=? AND status<>'VALID'",[id]);if(Number(bad.c)>0)throw new Error('Masih ada baris yang belum valid. Perbaiki file lalu buat import baru.');await pool.query("UPDATE kpm_pm_submissions SET status='DIAJUKAN',submitted_by=?,updated_at=NOW() WHERE id=?",[req.session.user.id,id]);await pool.query('INSERT INTO kpm_pm_submission_history(submission_id,action,from_status,to_status,note,actor_id) VALUES(?,?,?,?,?,?)',[id,'SUBMIT','DRAFT','DIAJUKAN','Hasil import dinyatakan valid dan diajukan untuk review.',req.session.user.id]);await log(req,'Ajukan Review','DATA_KPM_PM',id,'Mengajukan hasil import BNBA untuk review',s,{status:'DIAJUKAN'});flash(req,'success','Import BNBA berhasil diajukan untuk review.');res.redirect('/data-kpm-pm/'+id);}));
app.post('/data-kpm-pm/:id([0-9]+)/review',auth,requirePermission('data_kpm_pm.review'),ar(async(req,res)=>{const id=Number(req.params.id),decision=clean(req.body.decision),note=clean(req.body.note);if(!['DITINJAU','DISETUJUI','DITOLAK'].includes(decision))throw new Error('Keputusan review tidak valid.');const [[s]]=await pool.query('SELECT * FROM kpm_pm_submissions WHERE id=?',[id]);if(!s)return res.sendStatus(404);if(!['DIAJUKAN','DITINJAU'].includes(s.status))throw new Error('Pengajuan tidak berada pada tahap review.');if(decision==='DITOLAK'&&!note)throw new Error('Catatan wajib diisi saat menolak.');const [[bad]]=await pool.query("SELECT COUNT(*) c FROM kpm_pm_submission_rows WHERE submission_id=? AND status<>'VALID'",[id]);if(decision==='DISETUJUI'&&Number(bad.c)>0)throw new Error('Masih ada baris data yang belum valid/lengkap.');await pool.query('UPDATE kpm_pm_submissions SET status=?,reviewed_by=?,reviewed_at=NOW(),review_note=? WHERE id=?',[decision,req.session.user.id,note||null,id]);await pool.query('INSERT INTO kpm_pm_submission_history(submission_id,action,from_status,to_status,note,actor_id) VALUES(?,?,?,?,?,?)',[id,'REVIEW',s.status,decision,note||null,req.session.user.id]);await log(req,'Review','DATA_KPM_PM',id,'Review pengajuan Data KPM PM',s,{status:decision,note});flash(req,'success',`Pengajuan ${decision.toLowerCase()} oleh reviewer.`);res.redirect('/data-kpm-pm/'+id);}));
app.post('/data-kpm-pm/:id([0-9]+)/apply',auth,requirePermission('data_kpm_pm.manage'),ar(async(req,res)=>{
  const id=Number(req.params.id);
  const [[s]]=await pool.query('SELECT * FROM kpm_pm_submissions WHERE id=?',[id]);
  if(!s)return res.sendStatus(404);
  if(s.status!=='DISETUJUI')throw new Error('Hanya data yang disetujui yang dapat diterapkan.');
  const [rows]=await pool.query("SELECT * FROM kpm_pm_submission_rows WHERE submission_id=? AND status='VALID' ORDER BY row_no",[id]);
  if(!rows.length)throw new Error('Tidak ada baris VALID untuk diterapkan.');
  const conn=await pool.getConnection();
  try{
    await conn.beginTransaction();
    for(const r of rows){
      let meta = {};
      try {
        if (r.validation_note && (r.validation_note.startsWith('{') || r.validation_note.startsWith('['))) {
          meta = JSON.parse(r.validation_note);
        }
      } catch(e) {}
      const actionType = meta.action_type || (r.pm_id ? 'KOREKSI' : 'PM_BARU');
      const effDate = meta.effective_from || s.effective_from || new Date().toISOString().slice(0, 10);
      const reasonText = meta.reason || 'Diterapkan dari DATA KPM PM #' + id;

      if (actionType === 'PM_KELUAR' && r.pm_id) {
        const [[before]] = await conn.query('SELECT * FROM pm WHERE id=? FOR UPDATE', [r.pm_id]);
        await conn.query('UPDATE pm SET active=0, deactivated_at=NOW(), deactivation_reason=?, approval_status=?, updated_at=NOW() WHERE id=?', [reasonText, 'NONAKTIF_DISETUJUI', r.pm_id]);
        if (before) {
          await conn.query('INSERT INTO pm_change_history(pm_id,effective_from,action,before_data,after_data,reason,actor_id) VALUES(?,?,?,?,?,?,?)', [r.pm_id, effDate, 'DEACTIVATE', JSON.stringify(before), JSON.stringify({...before, active: 0, approval_status: 'NONAKTIF_DISETUJUI'}), reasonText, req.session.user.id]);
        }
      } else if (actionType === 'PERUBAHAN_KATEGORI' && r.pm_id) {
        const [[before]] = await conn.query('SELECT * FROM pm WHERE id=? FOR UPDATE', [r.pm_id]);
        const targetCat = meta.target_category || r.category;
        const newClass = r.class_group || before?.class_group || null;
        await conn.query('UPDATE pm SET category=?, class_group=?, active=1, updated_at=NOW() WHERE id=?', [targetCat, newClass, r.pm_id]);
        if (before) {
          await conn.query('INSERT INTO pm_change_history(pm_id,effective_from,action,before_data,after_data,reason,actor_id) VALUES(?,?,?,?,?,?,?)', [r.pm_id, effDate, 'UPDATE', JSON.stringify(before), JSON.stringify({...before, category: targetCat, class_group: newClass, active: 1}), `Alih Kategori: ${before.category} → ${targetCat} (${reasonText})`, req.session.user.id]);
        }
      } else if (r.pm_id) {
        const [[before]] = await conn.query('SELECT * FROM pm WHERE id=? FOR UPDATE', [r.pm_id]);
        const after = { full_name: r.full_name, nik: r.nik || null, nisn: r.nisn || null, gender: r.gender, category: r.category, class_group: r.class_group || null, active: 1 };
        await conn.query('UPDATE pm SET full_name=?, nik=?, nisn=?, gender=?, category=?, class_group=?, active=1, updated_at=NOW() WHERE id=?', [after.full_name, after.nik, after.nisn, after.gender, after.category, after.class_group, r.pm_id]);
        if (before) {
          await conn.query('INSERT INTO pm_change_history(pm_id,effective_from,action,before_data,after_data,reason,actor_id) VALUES(?,?,?,?,?,?,?)', [r.pm_id, effDate, 'UPDATE', JSON.stringify(before), JSON.stringify(after), reasonText, req.session.user.id]);
        }
      } else {
        const [pr] = await conn.query('INSERT INTO pm(kpm_id,full_name,nik,nisn,gender,category,class_group,active,approval_status) VALUES(?,?,?,?,?,?,?,1,?)', [s.kpm_id, r.full_name, r.nik || null, r.nisn || null, r.gender, r.category, r.class_group || null, 'AKTIF']);
        const newPmId = pr.insertId;
        await conn.query('UPDATE kpm_pm_submission_rows SET pm_id=? WHERE id=?', [newPmId, r.id]);
        const [[after]] = await conn.query('SELECT * FROM pm WHERE id=?', [newPmId]);
        await conn.query('INSERT INTO pm_change_history(pm_id,effective_from,action,before_data,after_data,reason,actor_id) VALUES(?,?,?,?,?,?,?)', [newPmId, effDate, 'CREATE', null, JSON.stringify(after), reasonText, req.session.user.id]);
      }
    }

    // Sync active PM daily summary counts
    try {
      const [activeRows] = await conn.query('SELECT category, gender, class_group FROM pm WHERE kpm_id=? AND active=1', [s.kpm_id]);
      const ar = activeRows || [];
      const bm = ar.filter(p => p.category === 'BALITA' && p.gender === 'L').length;
      const bf = ar.filter(p => p.category === 'BALITA' && p.gender === 'P').length;
      const bmil = ar.filter(p => p.category === 'BUMIL').length;
      const bsui = ar.filter(p => p.category === 'BUSUI').length;
      const sm = ar.filter(p => p.category === 'PESERTA_DIDIK' && p.gender === 'L').length;
      const sf = ar.filter(p => p.category === 'PESERTA_DIDIK' && p.gender === 'P').length;
      const tm = ar.filter(p => p.category === 'PENDIDIK' && p.gender === 'L').length;
      const tf = ar.filter(p => p.category === 'PENDIDIK' && p.gender === 'P').length;
      const stm = ar.filter(p => p.category === 'TENAGA_KEPENDIDIKAN' && p.gender === 'L').length;
      const stf = ar.filter(p => p.category === 'TENAGA_KEPENDIDIKAN' && p.gender === 'P').length;
      const lm = ar.filter(p => p.category === 'PESERTA_DIDIK' && (p.class_group||'').toLowerCase().includes('besar') && p.gender === 'L').length;
      const lf = ar.filter(p => p.category === 'PESERTA_DIDIK' && (p.class_group||'').toLowerCase().includes('besar') && p.gender === 'P').length;
      const [[ex]] = await conn.query('SELECT id FROM kpm_daily_data WHERE kpm_id=? AND effective_from=? LIMIT 1', [s.kpm_id, s.effective_from]);
      if (ex) {
        await conn.query('UPDATE kpm_daily_data SET balita_male=?, balita_female=?, bumil=?, busui=?, small_male=?, small_female=?, teacher_male=?, teacher_female=?, staff_male=?, staff_female=?, large_male=?, large_female=? WHERE id=?', [bm, bf, bmil, bsui, sm, sf, tm, tf, stm, stf, lm, lf, ex.id]);
      } else {
        await conn.query('INSERT INTO kpm_daily_data(kpm_id, effective_from, balita_male, balita_female, bumil, busui, small_male, small_female, teacher_male, teacher_female, staff_male, staff_female, large_male, large_female, created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)', [s.kpm_id, s.effective_from, bm, bf, bmil, bsui, sm, sf, tm, tf, stm, stf, lm, lf]);
      }
    } catch(err) { console.warn('[Apply Sync Daily Data]', err.message); }

    await conn.query("UPDATE kpm_pm_submissions SET status='DITERAPKAN',applied_by=?,applied_at=NOW() WHERE id=?",[req.session.user.id,id]);
    await conn.query('INSERT INTO kpm_pm_submission_history(submission_id,action,from_status,to_status,note,actor_id) VALUES(?,?,?,?,?,?)',[id,'APPLY','DISETUJUI','DITERAPKAN',`Data disetujui diterapkan ke Master PM dengan effective_from ${s.effective_from}.`,req.session.user.id]);
    await conn.commit();
    await log(req,'Terapkan','DATA_KPM_PM',id,'Menerapkan data ke Master PM dengan histori effective date',null,{row_count:rows.length,effective_from:s.effective_from});
    flash(req,'success','Data yang disetujui berhasil diterapkan ke Master PM. Histori perubahan dan tanggal berlaku tersimpan.');
    res.redirect('/data-kpm-pm/'+id);
  }catch(e){await conn.rollback();throw e}finally{conn.release()}
}));

app.post('/kpm/:id/portal-token',auth,requirePermission('kpm.manage'),ar(async(req,res)=>{const kpmId=Number(req.params.id);const [[kpm]]=await pool.query('SELECT id,code,name,active FROM kpm WHERE id=?',[kpmId]);if(!kpm)return res.sendStatus(404);const raw=crypto.randomBytes(32).toString('hex');const hash=crypto.createHash('sha256').update(raw).digest('hex');await pool.query('UPDATE kpm_portal_tokens SET active=0 WHERE kpm_id=?',[kpmId]);await pool.query('INSERT INTO kpm_portal_tokens(kpm_id,token_hash,created_by) VALUES(?,?,?)',[kpmId,hash,req.session.user.id]);await log(req,'Buat Token Portal','KPM',kpmId,'Membuat akses portal KPM');res.render('kpm/portal-token',{title:'Akses Portal KPM',kpm,portalUrl:`/portal/kpm/${raw}`});}));
function portalEditSignature(rawToken,pmId){return crypto.createHmac('sha256',process.env.SESSION_SECRET||'sppg-portal').update(`${rawToken}:${pmId}`).digest('hex');}
app.get('/portal/kpm/:token/profile/edit',ar(async(req,res)=>{
  const raw=String(req.params.token||''); const access=await getPortalAccess(raw);
  if(!access)return res.status(403).send('Akses portal tidak valid atau sudah dicabut.');
  const [pending]=await pool.query("SELECT id,status,submitted_at,reviewed_at,review_note FROM kpm_portal_profile_submissions WHERE kpm_id=? ORDER BY id DESC LIMIT 1",[access.kpm_id]);
  const settingsRows=await (async()=>{try{const [rows]=await pool.query('SELECT * FROM app_settings WHERE id=1');return rows}catch(e){return [{}]}})();
  res.render('kpm/portal-profile-edit',{title:'Perbaiki Data KPM',access,pending:pending[0]||null,settings:{...defaultAppSettings,...(settingsRows[0]||{})},portalToken:raw});
}));

app.post('/portal/kpm/:token/profile/edit',ar(async(req,res)=>{
  const raw=String(req.params.token||''); const access=await getPortalAccess(raw);
  if(!access)return res.status(403).send('Akses portal tidak valid atau sudah dicabut.');
  if(!requireCsrf(req,res))return;
  const {errors,payload}=validatePortalKpmProfile(req.body,access);
  if(errors.length){flash(req,'error',errors[0]);return res.redirect(`/portal/kpm/${raw}/profile/edit`);}
  const [[pending]]=await pool.query("SELECT * FROM kpm_portal_profile_submissions WHERE kpm_id=? AND status IN ('DIAJUKAN','DITINJAU') ORDER BY id DESC LIMIT 1",[access.kpm_id]);
  if(pending){flash(req,'error','Masih ada pengajuan perbaikan data KPM yang sedang direview SPPG.');return res.redirect(`/portal/kpm/${raw}`);}
  const before={name:access.kpm_name,education_level:access.education_level,address:access.address,npsn:access.npsn,head_name:access.head_name,head_phone:access.head_phone,pic_name:access.pic_name,pic_phone:access.pic_phone,cadre_name:access.cadre_name,cadre_phone:access.cadre_phone,latitude:access.latitude,longitude:access.longitude};
  await pool.query("INSERT INTO kpm_portal_profile_submissions(kpm_id,status,before_data,after_data) VALUES(?,'DIAJUKAN',?,?)",[access.kpm_id,JSON.stringify(before),JSON.stringify(payload)]);
  await log(req,'Ajukan Perbaikan Data KPM','KPM_PORTAL_PROFILE',access.kpm_id,'KPM mengajukan perbaikan identitas dari Portal KPM',before,payload);
  flash(req,'success','Perbaikan data berhasil diajukan. Data Master KPM berubah setelah diverifikasi dan diterapkan oleh SPPG.');
  res.redirect(`/portal/kpm/${raw}`);
}));

app.get('/portal/kpm/:token/pm/:id([0-9]+)/edit',ar(async(req,res)=>{const raw=String(req.params.token||''),pmId=Number(req.params.id);if(!/^[a-f0-9]{64}$/.test(raw))return res.sendStatus(404);const hash=crypto.createHash('sha256').update(raw).digest('hex');const [[access]]=await pool.query('SELECT t.*,k.name kpm_name,k.code kpm_code,k.type kpm_type,k.education_level FROM kpm_portal_tokens t JOIN kpm k ON k.id=t.kpm_id WHERE t.token_hash=? AND t.active=1 AND (t.expires_at IS NULL OR t.expires_at>NOW())',[hash]);if(!access)return res.status(403).send('Akses portal tidak valid atau sudah dicabut.');const [[pm]]=await pool.query('SELECT * FROM pm WHERE id=? AND kpm_id=?',[pmId,access.kpm_id]);if(!pm)return res.sendStatus(404);const [[settings]]=await pool.query('SELECT * FROM app_settings WHERE id=1');res.render('kpm/portal-edit',{title:'Ajukan Perubahan Data PM',access,pm,settings:{...defaultAppSettings,...settings},portalToken:raw,editSignature:portalEditSignature(raw,pmId)});}));
app.post('/portal/kpm/:token/pm/:id([0-9]+)/edit',ar(async(req,res)=>{const raw=String(req.params.token||''),pmId=Number(req.params.id);if(!/^[a-f0-9]{64}$/.test(raw))return res.sendStatus(404);if(String(req.body.edit_signature||'')!==portalEditSignature(raw,pmId))return res.status(403).send('Form perubahan tidak valid.');const hash=crypto.createHash('sha256').update(raw).digest('hex');const [[access]]=await pool.query('SELECT t.*,k.name kpm_name,k.code kpm_code,k.type kpm_type,k.education_level FROM kpm_portal_tokens t JOIN kpm k ON k.id=t.kpm_id WHERE t.token_hash=? AND t.active=1 AND (t.expires_at IS NULL OR t.expires_at>NOW())',[hash]);if(!access)return res.status(403).send('Akses portal tidak valid atau sudah dicabut.');const [[pm]]=await pool.query('SELECT * FROM pm WHERE id=? AND kpm_id=?',[pmId,access.kpm_id]);if(!pm)return res.sendStatus(404);const fullName=clean(req.body.full_name),nik=clean(req.body.nik)||null,nisn=clean(req.body.nisn)||null,gender=['L','P'].includes(req.body.gender)?req.body.gender:null,classGroup=clean(req.body.class_group)||null,category=clean(req.body.category);const allowed=['PESERTA_DIDIK','PENDIDIK','TENAGA_KEPENDIDIKAN','BALITA','BUMIL','BUSUI'];if(!fullName||!gender||!allowed.includes(category))throw new Error('Nama, jenis kelamin, dan kategori wajib valid.');if(access.kpm_type==='POSYANDU'&&!['BALITA','BUMIL','BUSUI'].includes(category))throw new Error('Kategori tidak sesuai untuk Posyandu.');if(access.kpm_type==='SATUAN_PENDIDIKAN'&&!['PESERTA_DIDIK','PENDIDIK','TENAGA_KEPENDIDIKAN'].includes(category))throw new Error('Kategori tidak sesuai untuk Satuan Pendidikan.');const effective=new Date().toISOString().slice(0,10);const conn=await pool.getConnection();let sid;try{await conn.beginTransaction();const [r]=await conn.query("INSERT INTO kpm_pm_submissions(kpm_id,submission_type,effective_from,status,submitted_by) VALUES(?,?,?,?,NULL)",[access.kpm_id,'MANUAL',effective,'DIAJUKAN']);sid=r.insertId;await conn.query('INSERT INTO kpm_pm_submission_rows(submission_id,row_no,pm_id,full_name,nik,nisn,gender,class_group,category,status,validation_note) VALUES(?,?,?,?,?,?,?,?,?,?,?)',[sid,1,pmId,fullName,nik,nisn,gender,classGroup,category,'VALID','Pengajuan perubahan satu PM dari Portal KPM.']);await conn.query('INSERT INTO kpm_pm_submission_history(submission_id,action,from_status,to_status,note,actor_id) VALUES(?,?,?,?,?,NULL)',[sid,'SUBMIT','', 'DIAJUKAN',`Pengajuan perubahan PM #${pmId} dikirim melalui Portal KPM.`]);await conn.commit();}catch(e){await conn.rollback();throw e}finally{conn.release()}await log(req,'Ajukan Perubahan PM','DATA_KPM_PM',sid,'Pengajuan perubahan satu PM melalui Portal KPM',null,{kpm_id:access.kpm_id,pm_id:pmId});res.redirect(`/portal/kpm/${raw}`);}));
app.post('/portal/kpm/:token/statement',upload.single('file'),ar(async(req,res)=>{
  const raw=String(req.params.token||''),access=await getPortalAccess(raw);
  if(!access){await removeUploaded(req.file);return res.status(403).send('Akses portal tidak valid atau sudah dicabut.');}
  if(!requireCsrf(req,res)){await removeUploaded(req.file);return;}
  const allowedMime=['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  if(!req.file||!allowedMime.includes(req.file.mimetype)||!(await verifyUploadedFile(req.file))){await removeUploaded(req.file);flash(req,'error','Surat pernyataan harus berupa PDF atau DOCX yang valid.');return res.redirect(`/portal/kpm/${raw}`);}
  const conn=await pool.getConnection();
  try{
    await conn.beginTransaction();
    await conn.query('UPDATE kpm_portal_statements SET is_current=0 WHERE kpm_id=? AND is_current=1',[access.kpm_id]);
    const [r]=await conn.query('INSERT INTO kpm_portal_statements(kpm_id,file_path,original_name,mime_type,file_size,uploaded_by_user,portal_token_id,is_current) VALUES(?,?,?,?,?,NULL,?,1)',[access.kpm_id,req.file.filename,req.file.originalname,req.file.mimetype,req.file.size,access.id]);
    await conn.commit();
    await logPortal(req,access,'Upload Surat Pernyataan','KPM_PORTAL_STATEMENT',r.insertId,'KPM mengunggah surat pernyataan melalui Dashboard KPM',{kpm_id:access.kpm_id,kpm_code:access.kpm_code,portal_token_id:access.id,original_name:req.file.originalname,size:req.file.size});
    flash(req,'success','Surat pernyataan berhasil diunggah.');
    res.redirect(`/portal/kpm/${raw}`);
  }catch(e){await conn.rollback();await removeUploaded(req.file);throw e}finally{conn.release()}
}));
app.get('/portal/kpm/:token/statement/:id([0-9]+)',ar(async(req,res)=>{
  const raw=String(req.params.token||''),id=Number(req.params.id),access=await getPortalAccess(raw);
  if(!access)return res.status(403).send('Akses portal tidak valid atau sudah dicabut.');
  const [[statement]]=await pool.query('SELECT * FROM kpm_portal_statements WHERE id=? AND kpm_id=?',[id,access.kpm_id]);
  if(!statement)return res.sendStatus(404);
  const file=await resolveStoredFile(statement.file_path);if(!file)return res.sendStatus(404);
  res.set('Content-Disposition','inline; filename="'+String(statement.original_name||'surat-pernyataan').replace(/["\r\n]/g,'_')+'"');
  res.type(statement.mime_type||'application/octet-stream');res.sendFile(file);
}));

app.get('/portal/kpm/:token',ar(async(req,res)=>{
  const raw=String(req.params.token||'');
  if(!/^[a-f0-9]{64}$/.test(raw))return res.sendStatus(404);
  const access=await getPortalAccess(raw);
  if(!access)return res.status(403).send('Akses portal tidak valid atau sudah dicabut.');
  await pool.query('UPDATE kpm_portal_tokens SET last_used_at=NOW() WHERE id=?',[access.id]);
  const safeQuery=async(sql,args=[],fallback)=>{try{const [rows]=await pool.query(sql,args);return rows}catch(e){console.error('[KPM PORTAL QUERY]',e.sqlMessage||e.message);return fallback;}};
  const settingsRows=await safeQuery('SELECT * FROM app_settings WHERE id=1',[],[{}]);
  const pm=await safeQuery("SELECT id,full_name,nik,nisn,gender,class_group,category,active,approval_status,deactivated_at,deactivation_reason,created_at,updated_at FROM pm WHERE kpm_id=? ORDER BY FIELD(category,'PENDIDIK','TENAGA_KEPENDIDIKAN','PESERTA_DIDIK','BALITA','BUMIL','BUSUI'),class_group,full_name",[access.kpm_id],[]);
  const subs=await safeQuery('SELECT id,effective_from,status,created_at,reviewed_at,review_note FROM kpm_pm_submissions WHERE kpm_id=? ORDER BY created_at DESC,id DESC LIMIT 10',[access.kpm_id],[]);
  const dailyRows=await safeQuery('SELECT * FROM kpm_daily_data WHERE kpm_id=? ORDER BY effective_from DESC LIMIT 1',[access.kpm_id],[]);
  const statementRows=await safeQuery('SELECT id,original_name,mime_type,file_size,uploaded_at FROM kpm_portal_statements WHERE kpm_id=? AND is_current=1 ORDER BY id DESC LIMIT 1',[access.kpm_id],[]);
  const activePm=pm.filter(x=>Number(x.active)===1);
  const isPosyandu=access.kpm_type==='POSYANDU';
  const smallCount=isPosyandu ? activePm.filter(x=>x.category==='BALITA').length : activePm.filter(x=>x.category==='PESERTA_DIDIK' && ['SPS','PAUD','TK','RA'].some(v=>String(access.education_level||'').toUpperCase().startsWith(v)) && /^(1|2|3)(\D|$)/.test(String(x.class_group||''))).length;
  const portalStats={total:activePm.length,small:smallCount,large:Math.max(0,activePm.length-smallCount)};
  const [profileRows]=await pool.query("SELECT id,status,submitted_at,reviewed_at,review_note FROM kpm_portal_profile_submissions WHERE kpm_id=? ORDER BY id DESC LIMIT 1",[access.kpm_id]);
  const profileMissing=kpmProfileMissing(access);
  const profilePending=profileRows[0]||null;
  res.render('kpm/portal',{title:'Portal KPM',access,pm,subs,daily:dailyRows[0]||null,statement:statementRows[0]||null,portalStats,profileMissing,profilePending,settings:{...defaultAppSettings,...(settingsRows[0]||{})},portalToken:raw,previewMode:false});
}));
app.get('/kpm/:kpmId([0-9]+)/portal-statement/:id([0-9]+)',auth,requirePermission('kpm.view'),ar(async(req,res)=>{const kpmId=Number(req.params.kpmId),id=Number(req.params.id);const [[statement]]=await pool.query('SELECT ps.* FROM kpm_portal_statements ps JOIN kpm k ON k.id=ps.kpm_id WHERE ps.id=? AND ps.kpm_id=?',[id,kpmId]);if(!statement)return res.sendStatus(404);const file=await resolveStoredFile(statement.file_path);if(!file)return res.sendStatus(404);res.set('Content-Disposition','inline; filename="'+String(statement.original_name||'surat-pernyataan').replace(/["\r\n]/g,'_')+'"');res.type(statement.mime_type||'application/octet-stream');res.sendFile(file)}));
app.get('/kpm/portal-profile-submissions',auth,requirePermission('kpm.manage'),ar(async(req,res)=>{const [rows]=await pool.query("SELECT s.*,k.name kpm_name,k.code kpm_code,k.type kpm_type,u.name reviewer_name FROM kpm_portal_profile_submissions s JOIN kpm k ON k.id=s.kpm_id LEFT JOIN users u ON u.id=s.reviewed_by ORDER BY s.created_at DESC,s.id DESC LIMIT 200");res.render('kpm/portal-profile-submissions',{title:'Perbaikan Data KPM',rows});}));
app.post('/kpm/portal-profile-submissions/:id([0-9]+)/review',auth,requirePermission('kpm.manage'),ar(async(req,res)=>{if(!requireCsrf(req,res))return;const id=Number(req.params.id),decision=clean(req.body.decision),note=clean(req.body.note);const [[s]]=await pool.query('SELECT * FROM kpm_portal_profile_submissions WHERE id=?',[id]);if(!s)return res.sendStatus(404);if(!['DITINJAU','DISETUJUI','DITOLAK'].includes(decision))throw new Error('Keputusan review tidak valid.');if(decision==='DITOLAK'&&!note)throw new Error('Catatan wajib diisi saat menolak.');await pool.query('UPDATE kpm_portal_profile_submissions SET status=?,reviewed_by=?,reviewed_at=NOW(),review_note=? WHERE id=?',[decision,req.session.user.id,note||null,id]);await log(req,'Review Perbaikan Data KPM','KPM_PORTAL_PROFILE',id,'Review pengajuan profil KPM',s,{status:decision,note});flash(req,'success','Review perbaikan data KPM berhasil direkam.');res.redirect('/kpm/portal-profile-submissions');}));
app.post('/kpm/portal-profile-submissions/:id([0-9]+)/apply',auth,requirePermission('kpm.manage'),ar(async(req,res)=>{if(!requireCsrf(req,res))return;const id=Number(req.params.id);const [[s]]=await pool.query("SELECT * FROM kpm_portal_profile_submissions WHERE id=? AND status='DISETUJUI'",[id]);if(!s)return res.status(409).send('Pengajuan belum disetujui atau tidak ditemukan.');const p=JSON.parse(s.after_data||'{}');const [[before]]=await pool.query('SELECT * FROM kpm WHERE id=?',[s.kpm_id]);await pool.query('UPDATE kpm SET name=?,education_level=?,address=?,npsn=?,head_name=?,head_phone=?,pic_name=?,pic_phone=?,cadre_name=?,cadre_phone=?,latitude=?,longitude=? WHERE id=?',[p.name,p.education_level,p.address,p.npsn,p.head_name,p.head_phone,p.pic_name,p.pic_phone,p.cadre_name,p.cadre_phone,p.latitude,p.longitude,s.kpm_id]);await pool.query("UPDATE kpm_portal_profile_submissions SET status='DITERAPKAN',applied_by=?,applied_at=NOW() WHERE id=?",[req.session.user.id,id]);await log(req,'Terapkan Perbaikan Data KPM','KPM',s.kpm_id,'Menerapkan pengajuan profil KPM yang disetujui',before,p);flash(req,'success','Perbaikan data KPM berhasil diterapkan ke Master KPM.');res.redirect('/kpm/portal-profile-submissions');}));

app.get('/kpm/portal-dashboard',auth,requirePermission('kpm.view'),ar(async(req,res)=>{const [kpms]=await pool.query("SELECT id,code,name,type,education_level,active,kpm_status FROM kpm WHERE active=1 OR kpm_status IN ('NONAKTIF_SEMENTARA','NONAKTIF') ORDER BY type,name");res.render('kpm/portal-dashboard',{title:'Dashboard Portal KPM',kpms})}));
app.get('/portal/kpm/preview/:id([0-9]+)',auth,requirePermission('kpm.view'),ar(async(req,res)=>{
  const kpmId=Number(req.params.id);
  const [[access]]=await pool.query("SELECT id kpm_id,name kpm_name,code kpm_code,type kpm_type,education_level,address,npsn,head_name,head_phone,pic_name,pic_phone,cadre_name,cadre_phone,latitude,longitude,email FROM kpm WHERE id=?",[kpmId]);
  if(!access)return res.sendStatus(404);
  const safeQuery=async(sql,args=[],fallback)=>{try{const [rows]=await pool.query(sql,args);return rows}catch(e){console.error('[KPM PREVIEW QUERY]',e.sqlMessage||e.message);return fallback;}};
  const settingsRows=await safeQuery('SELECT * FROM app_settings WHERE id=1',[],[{}]);
  const pm=await safeQuery("SELECT id,full_name,nik,nisn,gender,class_group,category,active,approval_status,deactivated_at,deactivation_reason,created_at,updated_at FROM pm WHERE kpm_id=? ORDER BY FIELD(category,'PENDIDIK','TENAGA_KEPENDIDIKAN','PESERTA_DIDIK','BALITA','BUMIL','BUSUI'),class_group,full_name",[kpmId],[]);
  const subs=await safeQuery('SELECT id,effective_from,status,created_at,reviewed_at,review_note FROM kpm_pm_submissions WHERE kpm_id=? ORDER BY created_at DESC,id DESC LIMIT 10',[kpmId],[]);
  const dailyRows=await safeQuery('SELECT * FROM kpm_daily_data WHERE kpm_id=? ORDER BY effective_from DESC LIMIT 1',[kpmId],[]);
  const statementRows=await safeQuery('SELECT id,original_name,mime_type,file_size,uploaded_at FROM kpm_portal_statements WHERE kpm_id=? AND is_current=1 ORDER BY id DESC LIMIT 1',[kpmId],[]);
  const daily=dailyRows[0]||null, statement=statementRows[0]||null, settings=settingsRows[0]||{};
  const activePm=pm.filter(x=>Number(x.active)===1);
  const isPosyandu=access.kpm_type==='POSYANDU';
  const smallCount=isPosyandu ? activePm.filter(x=>x.category==='BALITA').length : activePm.filter(x=>x.category==='PESERTA_DIDIK' && ['SPS','PAUD','TK','RA'].some(v=>String(access.education_level||'').toUpperCase().startsWith(v)) && /^(1|2|3)(\D|$)/.test(String(x.class_group||''))).length;
  const largeCount=Math.max(0,activePm.length-smallCount);
  const portalStats={total:activePm.length,small:smallCount,large:largeCount};
  await log(req,'Preview Dashboard KPM','KPM',kpmId,'Akses preview dashboard KPM oleh akun internal');
  const [profileRows]=await pool.query("SELECT id,status,submitted_at,reviewed_at,review_note FROM kpm_portal_profile_submissions WHERE kpm_id=? ORDER BY id DESC LIMIT 1",[kpmId]);
  const profileMissing=kpmProfileMissing(access); const profilePending=profileRows[0]||null;
  res.render('kpm/portal',{title:'Preview Portal KPM',access,pm,subs,daily,statement,portalStats,profileMissing,profilePending,settings:{...defaultAppSettings,...settings},previewMode:true,portalToken:null});
}));app.get('/kpm',auth,requirePermission('kpm.view'),ar(async(req,res)=>{const q=clean(req.query.q),type=clean(req.query.type),date=/^\d{4}-\d{2}-\d{2}$/.test(clean(req.query.date))?clean(req.query.date):new Date().toISOString().slice(0,10);const params=[date,date,date];let where='WHERE (k.active=1 OR k.kpm_status IN (\'NONAKTIF_SEMENTARA\',\'NONAKTIF\'))';if(q){where+=' AND (k.name LIKE ? OR k.code LIKE ? OR k.npsn LIKE ?)';params.push(`%${q}%`,`%${q}%`,`%${q}%`)}if(type){where+=' AND k.type=?';params.push(type)}const [rows]=await pool.query(`SELECT k.*,d.id AS daily_id,d.effective_from,d.small_female,d.small_male,d.large_female,d.large_male,d.teacher_female,d.teacher_male,d.staff_female,d.staff_male,d.balita_female,d.balita_male,d.bumil,d.busui,sh.status AS period_status,sh.start_date AS period_start,sh.end_date AS period_end,sh.reason AS period_reason,sh.note AS period_note FROM kpm k LEFT JOIN kpm_daily_data d ON d.id=(SELECT d2.id FROM kpm_daily_data d2 WHERE d2.kpm_id=k.id AND d2.effective_from<=? ORDER BY d2.effective_from DESC,d2.id DESC LIMIT 1) LEFT JOIN kpm_status_history sh ON sh.id=(SELECT h.id FROM kpm_status_history h WHERE h.kpm_id=k.id AND h.start_date<=? AND (h.end_date IS NULL OR h.end_date>=?) ORDER BY h.start_date DESC,h.id DESC LIMIT 1) ${where} ORDER BY k.type,k.name`,params);for(const r of rows){const c=r.daily_id?{small_female:r.small_female,small_male:r.small_male,large_female:r.large_female,large_male:r.large_male,teacher_female:r.teacher_female,teacher_male:r.teacher_male,staff_female:r.staff_female,staff_male:r.staff_male,balita_female:r.balita_female,balita_male:r.balita_male,bumil:r.bumil,busui:r.busui}:{};r.totals=kpmTotals(r,c);r.display_status=r.period_status||r.kpm_status||(r.active?'AKTIF':'NONAKTIF');r.completeness=100-([r.address,r.latitude,r.longitude,r.type==='SATUAN_PENDIDIKAN'?r.npsn:(r.cadre_name||r.cadre_phone),r.type==='SATUAN_PENDIDIKAN'?(r.pic_name||r.pic_phone):true].filter(v=>!v).length*20)}const [[school]]=await pool.query("SELECT COUNT(*) total FROM kpm WHERE type='SATUAN_PENDIDIKAN' AND active=1");const [[pos]]=await pool.query("SELECT COUNT(*) total FROM kpm WHERE type='POSYANDU' AND active=1");const summary={school:school.total,pos:pos.total,pm:rows.filter(r=>r.display_status!=='NONAKTIF').reduce((a,b)=>a+b.totals.total,0),small:rows.filter(r=>r.display_status!=='NONAKTIF').reduce((a,b)=>a+b.totals.small,0),large:rows.filter(r=>r.display_status!=='NONAKTIF').reduce((a,b)=>a+b.totals.large,0)};res.render('kpm/index',{title:'Master KPM',rows,q,type,date,summary})}));
app.get('/kpm/export.xlsx',auth,ar(async(req,res)=>{const date=/^\d{4}-\d{2}-\d{2}$/.test(clean(req.query.date))?clean(req.query.date):new Date().toISOString().slice(0,10);const type=clean(req.query.type);const params=[date];let where='WHERE k.active=1';if(type){where+=' AND k.type=?';params.push(type)}const [rows]=await pool.query(`SELECT k.*,d.* FROM kpm k LEFT JOIN kpm_daily_data d ON d.id=(SELECT d2.id FROM kpm_daily_data d2 WHERE d2.kpm_id=k.id AND d2.effective_from<=? ORDER BY d2.effective_from DESC,d2.id DESC LIMIT 1) ${where} ORDER BY k.type,k.name`,params);const out=rows.map(r=>({KODE_KPM:r.code,JENIS_KPM:r.type,NAMA_KPM:r.name,KELOMPOK:r.education_level||'',ALAMAT:r.address,NPSN:r.npsn||'',PORSI_KECIL_L:r.small_male||0,PORSI_KECIL_P:r.small_female||0,PORSI_BESAR_L:r.large_male||0,PORSI_BESAR_P:r.large_female||0,PENDIDIK_L:r.teacher_male||0,PENDIDIK_P:r.teacher_female||0,TENDIK_L:r.staff_male||0,TENDIK_P:r.staff_female||0,BALITA_L:r.balita_male||0,BALITA_P:r.balita_female||0,BUMIL_P:r.bumil||0,BUSUI_P:r.busui||0}));const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(out),'Data KPM');const buf=XLSX.write(wb,{type:'buffer',bookType:'xlsx'});res.setHeader('Content-Disposition',`attachment; filename="Data KPM ${date}.xlsx"`);res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(buf)}));
app.get('/kpm/new',auth,requirePermission('kpm.manage'),(req,res)=>res.render('kpm/form',{title:'Tambah KPM',kpm:null,levels,countData:null,effectiveDate:new Date().toISOString().slice(0,10)}));
app.post('/kpm',auth,ar(async(req,res)=>{
  const b=req.body,errors=validateKpm(b);if(errors.length){flash(req,'error',errors[0]);return res.redirect('/kpm/new')}
  const err=countValidation(b,b.type);if(err){flash(req,'error',err);return res.redirect('/kpm/new')}
  const effective=/^\d{4}-\d{2}-\d{2}$/.test(b.effective_from||'')?b.effective_from:new Date().toISOString().slice(0,10);
  const conn=await pool.getConnection();
  try{
    await conn.beginTransaction();
    const c=await nextKpmCode(conn,b.type);
    const [r]=await conn.query(`INSERT INTO kpm(code,name,type,education_level,address,npsn,head_name,head_phone,pic_name,pic_phone,cadre_name,cadre_phone,latitude,longitude,operational_note) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[c,clean(b.name),b.type,b.type==='SATUAN_PENDIDIKAN'?clean(b.education_level):null,clean(b.address),clean(b.npsn)||null,clean(b.head_name)||null,clean(b.head_phone)||null,clean(b.pic_name)||null,clean(b.pic_phone)||null,clean(b.cadre_name)||null,clean(b.cadre_phone)||null,b.latitude||null,b.longitude||null,clean(b.operational_note)||null]);
    const cd=kpmCountPayload(b,b.type);
    await conn.query(`INSERT INTO kpm_daily_data(kpm_id,effective_from,small_female,small_male,large_female,large_male,teacher_female,teacher_male,staff_female,staff_male,balita_female,balita_male,bumil,busui,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[r.insertId,effective,...Object.values(cd),req.session.user.id]);
    await conn.commit();
    await log(req,'Tambah','KPM',r.insertId,b.name,null,{code:c,name:clean(b.name),type:b.type,effective_from:effective});
    flash(req,'success',`KPM ${clean(b.name)} berhasil ditambahkan dengan Kode ${c}.`);res.redirect('/kpm/'+r.insertId);
  }catch(e){await conn.rollback();throw e}finally{conn.release()}
}));
app.get('/kpm/:id',auth,ar(async(req,res)=>{const [[kpm]]=await pool.query('SELECT * FROM kpm WHERE id=?',[req.params.id]);if(!kpm)return res.status(404).send('KPM tidak ditemukan');const date=/^\d{4}-\d{2}-\d{2}$/.test(clean(req.query.date))?clean(req.query.date):new Date().toISOString().slice(0,10);const countData=await effectiveKpmData(kpm.id,date);const [pm]=await pool.query('SELECT * FROM pm WHERE kpm_id=? AND active=1 ORDER BY category,class_group,full_name',[kpm.id]);const [statusHistory]=await pool.query('SELECT h.*,u.username FROM kpm_status_history h LEFT JOIN users u ON u.id=h.created_by WHERE h.kpm_id=? ORDER BY h.start_date DESC,h.id DESC',[kpm.id]);res.render('kpm/show',{title:kpm.name,kpm,pm,rules:rulesFor(kpm.education_level,kpm.type),countData,date,totals:kpmTotals(kpm,countData||{}),statusHistory})}));
app.get('/kpm/:id([0-9]+)/edit',auth,requirePermission('kpm.manage'),ar(async(req,res)=>{const [[kpm]]=await pool.query('SELECT * FROM kpm WHERE id=?',[req.params.id]);if(!kpm)return res.sendStatus(404);const date=/^\d{4}-\d{2}-\d{2}$/.test(clean(req.query.date))?clean(req.query.date):new Date().toISOString().slice(0,10);const countData=await effectiveKpmData(kpm.id,date);res.render('kpm/form',{title:'Edit KPM',kpm,levels,countData,effectiveDate:date})}));
app.post('/kpm/:id/status',auth,requirePermission('kpm.manage'),ar(async(req,res)=>{const status=['AKTIF','NONAKTIF_SEMENTARA','NONAKTIF'].includes(req.body.status)?req.body.status:'NONAKTIF';const [[old]]=await pool.query('SELECT * FROM kpm WHERE id=?',[req.params.id]);if(!old)return res.sendStatus(404);const start=/^\d{4}-\d{2}-\d{2}$/.test(clean(req.body.start_date))?clean(req.body.start_date):new Date().toISOString().slice(0,10);const end=/^\d{4}-\d{2}-\d{2}$/.test(clean(req.body.end_date))?clean(req.body.end_date):null;const reason=clean(req.body.reason)||null,note=clean(req.body.note)||null;if(status!=='AKTIF'&&!reason){flash(req,'error','Alasan perubahan status wajib diisi.');return res.redirect('/kpm/'+req.params.id)}if(end&&end<start){flash(req,'error','Tanggal selesai tidak boleh sebelum tanggal mulai.');return res.redirect('/kpm/'+req.params.id)}await pool.query('UPDATE kpm SET active=?,kpm_status=?,status_start=?,status_end=?,status_reason=?,status_note=?,deactivated_at=?,deactivation_reason=? WHERE id=?',[status==='AKTIF'?1:0,status,start,status==='NONAKTIF'?null:end,reason,note,status==='AKTIF'?null:new Date(),status==='AKTIF'?null:reason,req.params.id]);await pool.query('INSERT INTO kpm_status_history(kpm_id,status,start_date,end_date,reason,note,created_by) VALUES(?,?,?,?,?,?,?)',[req.params.id,status,start,status==='NONAKTIF'?null:end,reason,note,req.session.user.id]);await log(req,status==='AKTIF'?'Aktifkan':'Ubah Status','KPM',req.params.id,reason,old,{status,start_date:start,end_date:end,reason,note});flash(req,'success','Status KPM berhasil direkam.');res.redirect('/kpm/'+req.params.id+'?date='+encodeURIComponent(start))}));
app.post('/kpm/:id',auth,requirePermission('kpm.manage'),ar(async(req,res)=>{if(!requireCsrf(req,res))return;const b=req.body;const [[old]]=await pool.query('SELECT * FROM kpm WHERE id=?',[req.params.id]);if(!old)return res.sendStatus(404);const errors=validateKpm(b);if(errors.length){flash(req,'error',errors[0]);return res.redirect('/kpm/'+req.params.id+'/edit')}const err=countValidation(b,b.type);if(err){flash(req,'error',err);return res.redirect('/kpm/'+req.params.id+'/edit')}await pool.query(`UPDATE kpm SET name=?,type=?,education_level=?,address=?,npsn=?,head_name=?,head_phone=?,pic_name=?,pic_phone=?,cadre_name=?,cadre_phone=?,latitude=?,longitude=?,operational_note=? WHERE id=?`,[clean(b.name),b.type,b.type==='SATUAN_PENDIDIKAN'?clean(b.education_level):null,clean(b.address),clean(b.npsn)||null,clean(b.head_name)||null,clean(b.head_phone)||null,clean(b.pic_name)||null,clean(b.pic_phone)||null,clean(b.cadre_name)||null,clean(b.cadre_phone)||null,b.latitude||null,b.longitude||null,clean(b.operational_note)||null,req.params.id]);const cd=kpmCountPayload(b,b.type),effective=/^\d{4}-\d{2}-\d{2}$/.test(b.effective_from||'')?b.effective_from:new Date().toISOString().slice(0,10);const [existing]=await pool.query('SELECT id FROM kpm_daily_data WHERE kpm_id=? AND effective_from=?',[req.params.id,effective]);if(existing.length){await pool.query(`UPDATE kpm_daily_data SET small_female=?,small_male=?,large_female=?,large_male=?,teacher_female=?,teacher_male=?,staff_female=?,staff_male=?,balita_female=?,balita_male=?,bumil=?,busui=?,created_by=? WHERE id=?`,[cd.small_female,cd.small_male,cd.large_female,cd.large_male,cd.teacher_female,cd.teacher_male,cd.staff_female,cd.staff_male,cd.balita_female,cd.balita_male,cd.bumil,cd.busui,req.session.user.id,existing[0].id])}else{await pool.query(`INSERT INTO kpm_daily_data(kpm_id,effective_from,small_female,small_male,large_female,large_male,teacher_female,teacher_male,staff_female,staff_male,balita_female,balita_male,bumil,busui,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[req.params.id,effective,...Object.values(cd),req.session.user.id])}await log(req,'Edit','KPM',req.params.id,b.name,old,{...b,effective_from:effective});flash(req,'success',`Data KPM diperbarui dan berlaku mulai ${effective}.`);res.redirect('/kpm/'+req.params.id+'?date='+encodeURIComponent(effective))}));
app.put('/kpm/:id',auth,requirePermission('kpm.manage'),ar(async(req,res)=>{if(!requireCsrf(req,res))return;const b=req.body;const [[old]]=await pool.query('SELECT * FROM kpm WHERE id=?',[req.params.id]);if(!old)return res.sendStatus(404);const errors=validateKpm(b);if(errors.length){flash(req,'error',errors[0]);return res.redirect('/kpm/'+req.params.id+'/edit')}const err=countValidation(b,b.type);if(err){flash(req,'error',err);return res.redirect('/kpm/'+req.params.id+'/edit')}await pool.query(`UPDATE kpm SET name=?,type=?,education_level=?,address=?,npsn=?,head_name=?,head_phone=?,pic_name=?,pic_phone=?,cadre_name=?,cadre_phone=?,latitude=?,longitude=?,operational_note=? WHERE id=?`,[clean(b.name),b.type,b.type==='SATUAN_PENDIDIKAN'?clean(b.education_level):null,clean(b.address),clean(b.npsn)||null,clean(b.head_name)||null,clean(b.head_phone)||null,clean(b.pic_name)||null,clean(b.pic_phone)||null,clean(b.cadre_name)||null,clean(b.cadre_phone)||null,b.latitude||null,b.longitude||null,clean(b.operational_note)||null,req.params.id]);const cd=kpmCountPayload(b,b.type),effective=/^\d{4}-\d{2}-\d{2}$/.test(b.effective_from||'')?b.effective_from:new Date().toISOString().slice(0,10);const [existing]=await pool.query('SELECT id FROM kpm_daily_data WHERE kpm_id=? AND effective_from=?',[req.params.id,effective]);if(existing.length){await pool.query(`UPDATE kpm_daily_data SET small_female=?,small_male=?,large_female=?,large_male=?,teacher_female=?,teacher_male=?,staff_female=?,staff_male=?,balita_female=?,balita_male=?,bumil=?,busui=?,created_by=? WHERE id=?`,[cd.small_female,cd.small_male,cd.large_female,cd.large_male,cd.teacher_female,cd.teacher_male,cd.staff_female,cd.staff_male,cd.balita_female,cd.balita_male,cd.bumil,cd.busui,req.session.user.id,existing[0].id])}else{await pool.query(`INSERT INTO kpm_daily_data(kpm_id,effective_from,small_female,small_male,large_female,large_male,teacher_female,teacher_male,staff_female,staff_male,balita_female,balita_male,bumil,busui,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[req.params.id,effective,...Object.values(cd),req.session.user.id])}await log(req,'Edit','KPM',req.params.id,b.name,old,{...b,effective_from:effective});flash(req,'success',`Data KPM diperbarui dan berlaku mulai ${effective}.`);res.redirect('/kpm/'+req.params.id+'?date='+encodeURIComponent(effective))}));

function validatePm(b,kpm){
  const errors=[];
  if(!clean(b.full_name))errors.push('Nama PM wajib diisi.');
  if(!cats.includes(b.category))errors.push('Kategori PM tidak valid.');
  if(!validNik(clean(b.nik)))errors.push('NIK harus 16 digit jika diisi.');
  if(!validPhone(clean(b.phone)))errors.push('Nomor HP/WhatsApp tidak valid.');
  if(!validDate(b.birth_date))errors.push('Tanggal lahir tidak valid.');
  if(b.gender&&!['L','P'].includes(b.gender))errors.push('Jenis kelamin tidak valid.');
  if(kpm.type==='POSYANDU'&&!['BALITA','BUMIL','BUSUI'].includes(b.category))errors.push('Kategori PM tidak sesuai jenis KPM.');
  if(kpm.type==='SATUAN_PENDIDIKAN'&&['BALITA','BUMIL','BUSUI'].includes(b.category))errors.push('Kategori PM tidak sesuai jenis KPM.');
  let cls=clean(b.class_group)||null;
  if(kpm.type==='SATUAN_PENDIDIKAN'){
    if(['SD','MI','MIS'].includes(kpm.education_level)&&b.category==='PESERTA_DIDIK'&&!/^Kelas [1-6]$/.test(cls))errors.push('Peserta Didik SD/MI/MIS wajib memilih Kelas 1–6.');
    if(['SPS','PAUD','TK','RA','SMP','MTs','SMA','SMK','MA'].includes(kpm.education_level)&&b.category==='PESERTA_DIDIK'&&cls!=='Peserta Didik')errors.push('Peserta Didik wajib menggunakan kelompok Peserta Didik.');
    if(b.category!=='PESERTA_DIDIK')cls=cls||null;
  } else if(kpm.type==='POSYANDU'){
    if(['BUMIL','BUSUI'].includes(b.category)&&b.gender&&b.gender!=='P')errors.push('Kategori Bumil dan Busui harus berjenis kelamin Perempuan (P).');
  }
  return {errors,class_group:cls};
}
app.get('/kpm/:id/pm/new',auth,ar(async(req,res)=>{const [[kpm]]=await pool.query('SELECT * FROM kpm WHERE id=?',[req.params.id]);if(!kpm)return res.sendStatus(404);res.render('pm/form',{title:'Tambah Penerima Manfaat',kpm,pm:null,rules:rulesFor(kpm.education_level,kpm.type),pmCategories:cats})}));
app.post('/kpm/:id/pm',auth,requirePermission('kpm.manage'),ar(async(req,res)=>{const b=req.body;const [[kpm]]=await pool.query('SELECT * FROM kpm WHERE id=?',[req.params.id]);if(!kpm)return res.sendStatus(404);const v=validatePm(b,kpm);if(v.errors.length){flash(req,'error',v.errors[0]);return res.redirect('/kpm/'+req.params.id+'/pm/new')}let cls=v.class_group;if(['SPS','PAUD','TK','RA','SMP','MTs','SMA','SMK','MA'].includes(kpm.education_level)&&b.category==='PESERTA_DIDIK')cls='Peserta Didik';const [r]=await pool.query(`INSERT INTO pm(kpm_id,full_name,nik,nisn,identity_number,category,gender,class_group,birth_date,phone) VALUES(?,?,?,?,?,?,?,?,?,?)`,[kpm.id,clean(b.full_name),clean(b.nik)||null,clean(b.nisn)||null,clean(b.identity_number)||null,b.category,b.gender||null,cls,b.birth_date||null,clean(b.phone)||null]);await log(req,'Tambah','PM',r.insertId,b.full_name);flash(req,'success','Penerima Manfaat berhasil ditambahkan.');res.redirect('/kpm/'+kpm.id)}));
app.get('/pm/:id/edit',auth,ar(async(req,res)=>{const [[pm]]=await pool.query('SELECT p.*,k.name kpm_name,k.education_level,k.type FROM pm p JOIN kpm k ON k.id=p.kpm_id WHERE p.id=?',[req.params.id]);if(!pm)return res.sendStatus(404);res.render('pm/form',{title:'Edit Penerima Manfaat',kpm:{id:pm.kpm_id,name:pm.kpm_name,education_level:pm.education_level,type:pm.type},pm,rules:rulesFor(pm.education_level,pm.type),pmCategories:cats,redirect:clean(req.query.redirect)||''})}));
app.post('/pm/:id/status',auth,requirePermission('kpm.manage'),ar(async(req,res)=>{
  const active=String(req.body.active)==='1'?1:0;
  const [[old]]=await pool.query('SELECT p.*,k.id kpm_id FROM pm p JOIN kpm k ON k.id=p.kpm_id WHERE p.id=?',[req.params.id]);
  if(!old)return res.sendStatus(404);
  const reason=clean(req.body.reason)||null;
  await pool.query('UPDATE pm SET active=?,deactivated_at=?,deactivation_reason=? WHERE id=?',[active,active?null:new Date(),active?null:reason,req.params.id]);
  try{await pool.query('INSERT INTO pm_change_history(pm_id,effective_from,action,before_data,after_data,reason,actor_id) VALUES(?,?,?,?,?,?,?)',[req.params.id,new Date().toISOString().slice(0,10),active?'REACTIVATE':'DEACTIVATE',JSON.stringify(old),JSON.stringify({...old,active,deactivation_reason:reason}),reason,req.session.user.id]);}catch(e){console.error('[PM CHANGE HIST ERROR]',e.message);}
  await log(req,active?'Aktifkan':'Nonaktifkan','PM',req.params.id,reason,old,{active});
  flash(req,'success',active?'PM diaktifkan kembali.':'PM dinonaktifkan tanpa menghapus histori.');
  if((req.body.redirect||req.query.redirect)==='preview'||req.body.redirect==='portal'){
    return res.redirect(`/portal/kpm/preview/${old.kpm_id}#pm-management-section`);
  }
  res.redirect('/kpm/'+old.kpm_id);
}));

app.post('/portal/kpm/preview/:kpmId([0-9]+)/pm/:id([0-9]+)/status',auth,requirePermission('kpm.manage'),ar(async(req,res)=>{
  const kpmId=Number(req.params.kpmId);
  const pmId=Number(req.params.id);
  const decision=clean(req.body.decision)||clean(req.body.action_type);
  const [[old]]=await pool.query('SELECT * FROM pm WHERE id=? AND kpm_id=?',[pmId,kpmId]);
  if(!old)return res.sendStatus(404);

  const effectiveFrom=clean(req.body.effective_from)||new Date().toISOString().slice(0,10);
  let reason=clean(req.body.reason)||old.deactivation_reason||'Otorisasi Kepala BGN';
  if(req.body.custom_note && clean(req.body.custom_note)){
    reason = reason + (reason ? ' — ' : '') + clean(req.body.custom_note);
  }

  if(decision==='APPROVE_DEACTIVATE'||decision==='APPROVE'){
    // Kepala BGN mengesahkan penonaktifan
    await pool.query('UPDATE pm SET active=0,deactivated_at=?,deactivation_reason=?,approval_status=?,updated_at=NOW() WHERE id=?',[old.deactivated_at||new Date(),reason,'NONAKTIF_DISETUJUI',pmId]);
    try{await pool.query('INSERT INTO pm_change_history(pm_id,effective_from,action,before_data,after_data,reason,actor_id) VALUES(?,?,?,?,?,?,?)',[pmId,effectiveFrom,'DEACTIVATE',JSON.stringify(old),JSON.stringify({...old,active:0,approval_status:'NONAKTIF_DISETUJUI'}),'Penonaktifan disetujui & disahkan oleh Kepala BGN: '+reason,req.session.user.id]);}catch(e){console.error('[PM HIST ERROR]',e.message);}
    await log(req,'Setujui Nonaktif PM','PM',pmId,reason,old,{active:0,approval_status:'NONAKTIF_DISETUJUI',effective_from:effectiveFrom});
    flash(req,'success','Penonaktifan penerima manfaat berhasil disahkan oleh Kepala BGN.');
  } else if(decision==='REJECT_DEACTIVATE'||decision==='REJECT'||decision==='CANCEL'){
    // Kepala BGN menolak / membatalkan permohonan penonaktifan
    await pool.query('UPDATE pm SET active=1,deactivated_at=NULL,deactivation_reason=NULL,approval_status=?,updated_at=NOW() WHERE id=?',['AKTIF',pmId]);
    try{await pool.query('INSERT INTO pm_change_history(pm_id,effective_from,action,before_data,after_data,reason,actor_id) VALUES(?,?,?,?,?,?,?)',[pmId,effectiveFrom,'REACTIVATE',JSON.stringify(old),JSON.stringify({...old,active:1,approval_status:'AKTIF'}),'Permohonan nonaktif dibatalkan/ditolak oleh Kepala BGN. Data tetap aktif: '+reason,req.session.user.id]);}catch(e){console.error('[PM HIST ERROR]',e.message);}
    await log(req,'Tolak Permohonan Nonaktif PM','PM',pmId,reason,old,{active:1,approval_status:'AKTIF',effective_from:effectiveFrom});
    flash(req,'success','Permohonan nonaktif dibatalkan oleh Kepala BGN. Penerima manfaat tetap aktif.');
  } else if(String(req.body.active)==='1'||decision==='RESTORE'){
    // Kepala BGN memulihkan kembali data yang nonaktif
    await pool.query('UPDATE pm SET active=1,deactivated_at=NULL,deactivation_reason=NULL,approval_status=?,updated_at=NOW() WHERE id=?',['AKTIF',pmId]);
    try{await pool.query('INSERT INTO pm_change_history(pm_id,effective_from,action,before_data,after_data,reason,actor_id) VALUES(?,?,?,?,?,?,?)',[pmId,effectiveFrom,'REACTIVATE',JSON.stringify(old),JSON.stringify({...old,active:1,approval_status:'AKTIF'}),'Data penerima manfaat dipulihkan kembali oleh Kepala BGN: '+reason,req.session.user.id]);}catch(e){console.error('[PM HIST ERROR]',e.message);}
    await log(req,'Pulihkan PM','PM',pmId,reason,old,{active:1,approval_status:'AKTIF',effective_from:effectiveFrom});
    flash(req,'success','Penerima manfaat berhasil dipulihkan kembali menjadi Aktif oleh Kepala BGN.');
  } else {
    // Kepala BGN langsung menonaktifkan
    await pool.query('UPDATE pm SET active=0,deactivated_at=?,deactivation_reason=?,approval_status=?,updated_at=NOW() WHERE id=?',[new Date(),reason,'NONAKTIF_DISETUJUI',pmId]);
    try{await pool.query('INSERT INTO pm_change_history(pm_id,effective_from,action,before_data,after_data,reason,actor_id) VALUES(?,?,?,?,?,?,?)',[pmId,effectiveFrom,'DEACTIVATE',JSON.stringify(old),JSON.stringify({...old,active:0,approval_status:'NONAKTIF_DISETUJUI'}),'Dinonaktifkan langsung oleh Kepala BGN: '+reason,req.session.user.id]);}catch(e){console.error('[PM HIST ERROR]',e.message);}
    await log(req,'Nonaktifkan PM','PM',pmId,reason,old,{active:0,approval_status:'NONAKTIF_DISETUJUI',effective_from:effectiveFrom});
    flash(req,'success','Penerima manfaat berhasil dinonaktifkan dan tersimpan ke arsip riwayat.');
  }
  res.redirect(`/portal/kpm/preview/${kpmId}#pm-management-section`);
}));

app.post('/portal/kpm/:token/pm/:id([0-9]+)/status',ar(async(req,res)=>{
  const raw=String(req.params.token||'');
  const pmId=Number(req.params.id);
  const access=await getPortalAccess(raw);
  if(!access)return res.status(403).send('Akses portal tidak valid atau sudah dicabut.');
  const [[old]]=await pool.query('SELECT * FROM pm WHERE id=? AND kpm_id=?',[pmId,access.kpm_id]);
  if(!old)return res.sendStatus(404);

  // Otorisasi: Pengguna umum KPM dilarang mengaktifkan/memulihkan sendiri tanpa otorisasi Kepala BGN
  if(String(req.body.active)==='1'){
    return res.status(403).send('Pengaktifan kembali data dari arsip hanya dapat disahkan oleh Kepala / Admin BGN.');
  }

  const effectiveFrom=clean(req.body.effective_from)||new Date().toISOString().slice(0,10);
  let reason=clean(req.body.reason)||'Dinonaktifkan oleh Kader KPM';
  if(req.body.custom_note && clean(req.body.custom_note)){
    reason = reason + (reason ? ' — ' : '') + clean(req.body.custom_note);
  }

  // Simpan permohonan penonaktifan dengan status MENUNGGU_VERIFIKASI_BGN
  await pool.query('UPDATE pm SET active=0,deactivated_at=?,deactivation_reason=?,approval_status=?,updated_at=NOW() WHERE id=?',[new Date(),reason,'MENUNGGU_VERIFIKASI_BGN',pmId]);
  try{
    await pool.query('INSERT INTO pm_change_history(pm_id,effective_from,action,before_data,after_data,reason,actor_id) VALUES(?,?,?,?,?,?,?)',[pmId,effectiveFrom,'DEACTIVATE',JSON.stringify(old),JSON.stringify({...old,active:0,approval_status:'MENUNGGU_VERIFIKASI_BGN',deactivation_reason:reason}),reason+' (Diajukan oleh Kader KPM, Menunggu Otorisasi Kepala BGN)',null]);
  }catch(e){console.error('[PM CHANGE HIST ERROR]',e.message);}
  await logPortal(req,access,'Ajukan Nonaktif PM','PM',pmId,`Kader KPM mengajukan penonaktifan PM #${pmId}`,{reason,effective_from:effectiveFrom});
  flash(req,'success','Permohonan penonaktifan berhasil diajukan dan dicatat di riwayat. Menunggu otorisasi Kepala BGN.');
  res.redirect(`/portal/kpm/${raw}#pm-management-section`);
}));

app.get('/portal/kpm/:token/pm/:id([0-9]+)/history',ar(async(req,res)=>{
  const raw=String(req.params.token||'');
  const pmId=Number(req.params.id);
  const access=await getPortalAccess(raw);
  if(!access)return res.status(403).json({error:'Akses portal tidak valid.'});
  const [[pm]]=await pool.query('SELECT p.*,k.name kpm_name,k.type kpm_type FROM pm p JOIN kpm k ON k.id=p.kpm_id WHERE p.id=? AND p.kpm_id=?',[pmId,access.kpm_id]);
  if(!pm)return res.status(404).json({error:'Data PM tidak ditemukan pada ruang privat KPM ini.'});
  const [history]=await pool.query('SELECT h.*,u.name actor_name FROM pm_change_history h LEFT JOIN users u ON u.id=h.actor_id WHERE h.pm_id=? ORDER BY h.created_at DESC,h.id DESC',[pmId]);
  const [submissions]=await pool.query('SELECT r.id,r.full_name,r.category,r.status,r.validation_note,s.effective_from,s.status submission_status,s.created_at,s.reviewed_at,s.review_note FROM kpm_pm_submission_rows r JOIN kpm_pm_submissions s ON s.id=r.submission_id WHERE r.pm_id=? ORDER BY s.created_at DESC',[pmId]);
  res.json({
    success:true,
    isBgnAdmin:false,
    pm:{
      id:pm.id,kpm_id:pm.kpm_id,kpm_name:pm.kpm_name,kpm_type:pm.kpm_type,
      full_name:pm.full_name,nik:pm.nik,nisn:pm.nisn,category:pm.category,gender:pm.gender,
      class_group:pm.class_group,birth_date:pm.birth_date,phone:pm.phone,active:pm.active,
      approval_status:pm.approval_status||(pm.active?'AKTIF':'NONAKTIF_DISETUJUI'),
      deactivated_at:pm.deactivated_at,deactivation_reason:pm.deactivation_reason,
      created_at:pm.created_at,updated_at:pm.updated_at
    },
    history,
    submissions
  });
}));

app.get('/portal/kpm/preview/:kpmId([0-9]+)/pm/:id([0-9]+)/history',auth,requirePermission('kpm.view'),ar(async(req,res)=>{
  const kpmId=Number(req.params.kpmId);
  const pmId=Number(req.params.id);
  const [[pm]]=await pool.query('SELECT p.*,k.name kpm_name,k.type kpm_type FROM pm p JOIN kpm k ON k.id=p.kpm_id WHERE p.id=? AND p.kpm_id=?',[pmId,kpmId]);
  if(!pm)return res.status(404).json({error:'Data PM tidak ditemukan pada KPM ini.'});
  const [history]=await pool.query('SELECT h.*,u.name actor_name FROM pm_change_history h LEFT JOIN users u ON u.id=h.actor_id WHERE h.pm_id=? ORDER BY h.created_at DESC,h.id DESC',[pmId]);
  const [submissions]=await pool.query('SELECT r.id,r.full_name,r.category,r.status,r.validation_note,s.effective_from,s.status submission_status,s.created_at,s.reviewed_at,s.review_note FROM kpm_pm_submission_rows r JOIN kpm_pm_submissions s ON s.id=r.submission_id WHERE r.pm_id=? ORDER BY s.created_at DESC',[pmId]);
  res.json({
    success:true,
    isBgnAdmin:true,
    bgnUser:req.session.user?.name||'Kepala BGN',
    pm:{
      id:pm.id,kpm_id:pm.kpm_id,kpm_name:pm.kpm_name,kpm_type:pm.kpm_type,
      full_name:pm.full_name,nik:pm.nik,nisn:pm.nisn,category:pm.category,gender:pm.gender,
      class_group:pm.class_group,birth_date:pm.birth_date,phone:pm.phone,active:pm.active,
      approval_status:pm.approval_status||(pm.active?'AKTIF':'NONAKTIF_DISETUJUI'),
      deactivated_at:pm.deactivated_at,deactivation_reason:pm.deactivation_reason,
      created_at:pm.created_at,updated_at:pm.updated_at
    },
    history,
    submissions
  });
}));

app.get('/api/kpm/:id([0-9]+)/pm-group',auth,requirePermission('kpm.view'),ar(async(req,res)=>{
  const kpmId=Number(req.params.id);
  const [[kpm]]=await pool.query('SELECT id,name,code,type,education_level FROM kpm WHERE id=?',[kpmId]);
  if(!kpm)return res.status(404).json({error:'KPM tidak ditemukan'});
  const [rows]=await pool.query('SELECT id,kpm_id,full_name,nik,nisn,identity_number,category,gender,class_group,birth_date,phone,active,approval_status FROM pm WHERE kpm_id=? AND active=1 ORDER BY FIELD(category,"BALITA","BUMIL","BUSUI","PESERTA_DIDIK","PENDIDIK","TENAGA_KEPENDIDIKAN"),class_group,full_name',[kpmId]);
  res.json({success:true,kpm,data:rows});
}));

app.get('/api/pm/:id([0-9]+)/history',ar(async(req,res)=>{
  const pmId=Number(req.params.id);
  const [[pm]]=await pool.query('SELECT p.*,k.name kpm_name,k.type kpm_type FROM pm p JOIN kpm k ON k.id=p.kpm_id WHERE p.id=?',[pmId]);
  if(!pm)return res.status(404).json({error:'Data PM tidak ditemukan.'});
  const [history]=await pool.query('SELECT h.*,u.name actor_name FROM pm_change_history h LEFT JOIN users u ON u.id=h.actor_id WHERE h.pm_id=? ORDER BY h.created_at DESC,h.id DESC',[pmId]);
  const [submissions]=await pool.query('SELECT r.id,r.full_name,r.category,r.status,r.validation_note,s.effective_from,s.status submission_status,s.created_at,s.reviewed_at,s.review_note FROM kpm_pm_submission_rows r JOIN kpm_pm_submissions s ON s.id=r.submission_id WHERE r.pm_id=? ORDER BY s.created_at DESC',[pmId]);
  res.json({
    success:true,
    isBgnAdmin:!!req.session?.user,
    bgnUser:req.session?.user?.name||null,
    pm:{
      id:pm.id,kpm_id:pm.kpm_id,kpm_name:pm.kpm_name,kpm_type:pm.kpm_type,
      full_name:pm.full_name,nik:pm.nik,nisn:pm.nisn,category:pm.category,gender:pm.gender,
      class_group:pm.class_group,birth_date:pm.birth_date,phone:pm.phone,active:pm.active,
      approval_status:pm.approval_status||(pm.active?'AKTIF':'NONAKTIF_DISETUJUI'),
      deactivated_at:pm.deactivated_at,deactivation_reason:pm.deactivation_reason,
      created_at:pm.created_at,updated_at:pm.updated_at
    },
    history,
    submissions
  });
}));
const handleUpdatePm = async (req,res)=>{
  if(!requireCsrf(req,res))return;
  const b=req.body;
  const [[old]]=await pool.query('SELECT p.*,k.name kpm_name,k.education_level,k.type FROM pm p JOIN kpm k ON k.id=p.kpm_id WHERE p.id=?',[req.params.id]);
  if(!old)return res.sendStatus(404);
  const v=validatePm(b,old);
  if(v.errors.length){flash(req,'error',v.errors[0]);return res.redirect('/pm/'+req.params.id+'/edit')}
  let cls=v.class_group;
  if(['SPS','PAUD','TK','RA','SMP','MTs','SMA','SMK','MA'].includes(old.education_level)&&b.category==='PESERTA_DIDIK')cls='Peserta Didik';
  const effectiveFrom=clean(b.effective_from)||new Date().toISOString().slice(0,10);
  let changeReason=clean(b.change_reason)||clean(b.reason)||'Pembaruan data identitas penerima manfaat';
  if(b.custom_note && clean(b.custom_note)){
    changeReason = changeReason + ' — ' + clean(b.custom_note);
  }
  await pool.query(`UPDATE pm SET full_name=?,nik=?,nisn=?,identity_number=?,category=?,gender=?,class_group=?,birth_date=?,phone=?,updated_at=NOW() WHERE id=?`,[clean(b.full_name),clean(b.nik)||null,clean(b.nisn)||null,clean(b.identity_number)||null,b.category,b.gender||null,cls,b.birth_date||null,clean(b.phone)||null,req.params.id]);
  const after={full_name:clean(b.full_name),nik:clean(b.nik)||null,nisn:clean(b.nisn)||null,category:b.category,gender:b.gender||null,class_group:cls,birth_date:b.birth_date||null,phone:clean(b.phone)||null,active:old.active};
  try{
    await pool.query('INSERT INTO pm_change_history(pm_id,effective_from,action,before_data,after_data,reason,actor_id) VALUES(?,?,?,?,?,?,?)',[req.params.id,effectiveFrom,'UPDATE',JSON.stringify(old),JSON.stringify(after),changeReason,req.session.user.id]);
  }catch(e){console.error('[PM CHANGE HIST ERROR]',e.message);}
  await log(req,'Edit','PM',req.params.id,b.full_name,old,{...after,change_reason:changeReason,effective_from:effectiveFrom});
  flash(req,'success','Data PM diperbarui dan rekam jejak riwayat tanggal berhasil disimpan.');
  if(b.redirect === 'preview' || req.query.redirect === 'preview'){
    return res.redirect(`/portal/kpm/preview/${old.kpm_id}#pm-management-section`);
  }
  res.redirect('/kpm/'+old.kpm_id);
};
app.post('/pm/:id',auth,requirePermission('kpm.manage'),ar(handleUpdatePm));
app.put('/pm/:id',auth,requirePermission('kpm.manage'),ar(handleUpdatePm));

app.post('/distribution/snapshot',auth,requirePermission('distribution.manage'),ar(async(req,res)=>{
  if(!requireCsrf(req,res))return;
  const scheduleId=Number(req.body.schedule_id||0); if(!scheduleId)throw new Error('Jadwal tidak valid.');
  const conn=await pool.getConnection();
  try{
    await conn.beginTransaction();
    const [[schedule]]=await conn.query('SELECT * FROM distribution_schedules WHERE id=? FOR UPDATE',[scheduleId]);
    if(!schedule)throw new Error('Jadwal tidak ditemukan.');
    const [[existing]]=await conn.query('SELECT id,status FROM distribution_snapshots WHERE schedule_id=?',[scheduleId]);
    if(existing)throw new Error('Jadwal ini sudah memiliki Snapshot.');
    const [clusters]=await conn.query('SELECT * FROM distribution_clusters WHERE schedule_id=? AND COALESCE(is_active,1)=1 ORDER BY cluster_no',[scheduleId]);
    if(!clusters.length)throw new Error('Snapshot tidak dapat dibuat karena belum ada Kloter aktif.');
    const [sr]=await conn.query('INSERT INTO distribution_snapshots(schedule_id,snapshot_date,created_by) VALUES(?,?,?)',[scheduleId,schedule.distribution_date,req.session.user.id]);
    for(const c of clusters){
      const [cr]=await conn.query(`INSERT INTO distribution_snapshot_clusters(snapshot_id,source_cluster_id,cluster_no,kpm_type,route_name,staff_id,vehicle,prep_start,prep_end,processing_start,processing_end,portioning_start,portioning_end,departure_time,return_time,washing_start,washing_end,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[sr.insertId,c.id,c.cluster_no,c.kpm_type,c.route_name,c.staff_id,c.vehicle,c.prep_start,c.prep_end,c.processing_start,c.processing_end,c.portioning_start,c.portioning_end,c.departure_time,c.return_time,c.washing_start,c.washing_end,c.notes]);
      const [items]=await conn.query('SELECT * FROM distribution_cluster_kpm WHERE cluster_id=? ORDER BY sort_order',[c.id]);
      for(const k of items) await conn.query('INSERT INTO distribution_snapshot_kpm(snapshot_cluster_id,source_cluster_kpm_id,kpm_id,small_portions,large_portions,sort_order) VALUES(?,?,?,?,?,?)',[cr.insertId,k.id,k.kpm_id,k.small_portions,k.large_portions,k.sort_order]);
    }
    await conn.commit();
    await log(req,'Buat Snapshot Jadwal','DISTRIBUTION_SNAPSHOT',sr.insertId,'Snapshot '+schedule.distribution_date,null,{schedule_id:scheduleId,cluster_count:clusters.length});
    flash(req,'success','Snapshot jadwal berhasil dibuat dan dikunci sebagai salinan historis.');
    res.redirect('/distribution');
  }catch(e){await conn.rollback();throw e}finally{conn.release()}
}));

app.get('/distribution',auth,requirePermission('distribution.view'),ar(async(req,res)=>{
  const date=/^\d{4}-\d{2}-\d{2}$/.test(clean(req.query.date))?clean(req.query.date):new Date().toISOString().slice(0,10);
  const [[schedule]]=await pool.query(`SELECT ds.*,ms.menu_name menu_sp_name,mp.menu_name menu_pos_name
    FROM distribution_schedules ds
    LEFT JOIN menu_daily ms ON ms.id=ds.menu_sp_id
    LEFT JOIN menu_daily mp ON mp.id=ds.menu_pos_id
    WHERE ds.distribution_date=?`,[date]);
  const filterType=['SATUAN_PENDIDIKAN','POSYANDU'].includes(clean(req.query.type))?clean(req.query.type):'';
  const filterCluster=/^\d+$/.test(clean(req.query.cluster))?Number(req.query.cluster):null;
  const filterRoute=clean(req.query.route)||'';
  const filterQ=clean(req.query.q)||'';
  let clusters=[];
  if(schedule){
    const params=[schedule.id];
    const conditions=['c.schedule_id=?'];
    if(filterType){conditions.push('c.kpm_type=?');params.push(filterType)}
    if(filterCluster){conditions.push('c.cluster_no=?');params.push(filterCluster)}
    if(filterRoute){conditions.push('c.route_name=?');params.push(filterRoute)}
    if(filterQ){conditions.push('EXISTS (SELECT 1 FROM distribution_cluster_kpm qck JOIN kpm qk ON qk.id=qck.kpm_id WHERE qck.cluster_id=c.id AND (qk.name LIKE ? OR qk.code LIKE ?))');params.push('%'+filterQ+'%','%'+filterQ+'%')}
    [clusters]=await pool.query(`SELECT c.*,s.name driver_name,
      COUNT(ck.id) kpm_count,COALESCE(SUM(ck.small_portions),0) small_total,COALESCE(SUM(ck.large_portions),0) large_total,
      COALESCE(SUM(ck.small_portions+ck.large_portions),0) pm_total
      FROM distribution_clusters c
      LEFT JOIN staff s ON s.id=c.staff_id
      LEFT JOIN distribution_cluster_kpm ck ON ck.cluster_id=c.id
      WHERE ${conditions.join(' AND ')} GROUP BY c.id ORDER BY c.cluster_no`,params);
  }
  const totalParams=[date];
  const totalConditions=['ds.distribution_date=?'];
  if(filterType){totalConditions.push('c.kpm_type=?');totalParams.push(filterType)}
  if(filterCluster){totalConditions.push('c.cluster_no=?');totalParams.push(filterCluster)}
  if(filterRoute){totalConditions.push('c.route_name=?');totalParams.push(filterRoute)}
  if(filterQ){totalConditions.push('EXISTS (SELECT 1 FROM distribution_cluster_kpm qck JOIN kpm qk ON qk.id=qck.kpm_id WHERE qck.cluster_id=c.id AND (qk.name LIKE ? OR qk.code LIKE ?))');totalParams.push('%'+filterQ+'%','%'+filterQ+'%')}
  const [[totals]]=await pool.query(`SELECT COUNT(DISTINCT c.id) clusters,COUNT(DISTINCT ck.kpm_id) kpm_count,
    COALESCE(SUM(ck.small_portions),0) small_total,COALESCE(SUM(ck.large_portions),0) large_total,
    COALESCE(SUM(ck.small_portions+ck.large_portions),0) pm_total
    FROM distribution_clusters c LEFT JOIN distribution_cluster_kpm ck ON ck.cluster_id=c.id
    LEFT JOIN distribution_schedules ds ON ds.id=c.schedule_id WHERE ${totalConditions.join(' AND ')}`,totalParams);
  if(clusters.length){
    const ids=clusters.map(c=>c.id);
    const [rows]=await pool.query(`SELECT ck.cluster_id,ck.kpm_id,ck.small_portions,ck.large_portions,ck.handover_time,ck.pickup_time,k.code,k.name
      FROM distribution_cluster_kpm ck JOIN kpm k ON k.id=ck.kpm_id WHERE ck.cluster_id IN (${ids.map(()=>'?').join(',')}) ORDER BY ck.cluster_id,ck.sort_order,k.name`,ids);
    const byCluster=new Map(); rows.forEach(r=>{if(!byCluster.has(r.cluster_id))byCluster.set(r.cluster_id,[]);byCluster.get(r.cluster_id).push(r)});
    clusters.forEach(c=>c.kpm_items=byCluster.get(c.id)||[]);
  }
  res.render('distribution/index',{title:'Jadwal Distribusi',date,schedule,clusters,totals,filterType,filterCluster,filterRoute,filterQ});
}));

app.get('/distribution/new',auth,requirePermission('distribution.manage'),ar(async(req,res)=>{
  const date=/^\d{4}-\d{2}-\d{2}$/.test(clean(req.query.date))?clean(req.query.date):new Date().toISOString().slice(0,10);
  const [menus]=await pool.query('SELECT id,menu_name,menu_code,kpm_type FROM menu_daily WHERE menu_date=? ORDER BY kpm_type,menu_name,id',[date]);
  const [[schedule]]=await pool.query('SELECT * FROM distribution_schedules WHERE distribution_date=?',[date]);
  let clusters=[];
  if(schedule){
    const [rows]=await pool.query('SELECT * FROM distribution_clusters WHERE schedule_id=? ORDER BY cluster_no',[schedule.id]);
    if(rows.length){
      const ids=rows.map(r=>r.id);
      const [items]=await pool.query(`SELECT ck.cluster_id,ck.kpm_id,ck.handover_time,ck.pickup_time,k.code,k.name FROM distribution_cluster_kpm ck JOIN kpm k ON k.id=ck.kpm_id WHERE ck.cluster_id IN (${ids.map(()=>'?').join(',')}) ORDER BY ck.cluster_id,ck.sort_order,k.name`,ids);
      const map=new Map(rows.map(r=>[r.id,r]));
      items.forEach(i=>{const c=map.get(i.cluster_id);(c.kpm_items||(c.kpm_items=[])).push(i)});
      clusters=rows;
    }
  }
  const [staff]=await pool.query("SELECT id,name,position FROM staff WHERE status='AKTIF' AND position='Tim Distribusi' ORDER BY name");
  const [kpms]=await pool.query(`SELECT k.id,k.code,k.name,k.type,k.education_level,
    CASE WHEN k.type='POSYANDU' THEN COALESCE(dd.balita_female,0)+COALESCE(dd.balita_male,0) ELSE COALESCE(dd.small_female,0)+COALESCE(dd.small_male,0) END small_portions,
    CASE WHEN k.type='POSYANDU' THEN COALESCE(dd.bumil,0)+COALESCE(dd.busui,0) ELSE COALESCE(dd.large_female,0)+COALESCE(dd.large_male,0)+COALESCE(dd.teacher_female,0)+COALESCE(dd.teacher_male,0)+COALESCE(dd.staff_female,0)+COALESCE(dd.staff_male,0) END large_portions
    FROM kpm k LEFT JOIN kpm_daily_data dd ON dd.id=(SELECT x.id FROM kpm_daily_data x WHERE x.kpm_id=k.id AND x.effective_from<=? ORDER BY x.effective_from DESC,x.id DESC LIMIT 1) WHERE k.active=1 ORDER BY k.type,k.name`,[date]);
  res.render('distribution/schedule-form',{title:schedule?'Edit Jadwal Distribusi':'Buat Jadwal Distribusi',date,schedule,menus,staff,kpms,clusters});
}));

app.post('/distribution/schedule',auth,requirePermission('distribution.manage'),ar(async(req,res)=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(req.body.distribution_date||''))throw new Error('Tanggal distribusi tidak valid.');
  const b=req.body;
  const menuSp=Number(b.menu_sp_id)||null, menuPos=Number(b.menu_pos_id)||null;
  if(menuSp){const [[m]]=await pool.query("SELECT id FROM menu_daily WHERE id=? AND menu_date=? AND kpm_type='SATUAN_PENDIDIKAN'",[menuSp,b.distribution_date]);if(!m)throw new Error('Menu Satuan Pendidikan tidak valid untuk tanggal tersebut.');}
  if(menuPos){const [[m]]=await pool.query("SELECT id FROM menu_daily WHERE id=? AND menu_date=? AND kpm_type='POSYANDU'",[menuPos,b.distribution_date]);if(!m)throw new Error('Menu Posyandu tidak valid untuk tanggal tersebut.');}
  let clusters=[];
  try{clusters=JSON.parse(b.clusters_json||'[]');}catch{throw new Error('Data kloter tidak valid.');}
  if(!Array.isArray(clusters))clusters=[];
  const conn=await pool.getConnection();
  try{await conn.beginTransaction();
    const [[existing]]=await conn.query('SELECT id FROM distribution_schedules WHERE distribution_date=?',[b.distribution_date]);    if(existing) await assertScheduleMutable(existing.id);
    let scheduleId=existing?.id;
    if(scheduleId){
      await conn.query(`UPDATE distribution_schedules SET menu_sp_id=?,menu_pos_id=?,notes=? WHERE id=?`,[menuSp,menuPos,clean(b.notes)||null,scheduleId]);
    }else{
      const [r]=await conn.query(`INSERT INTO distribution_schedules(distribution_date,menu_sp_id,menu_pos_id,notes,created_by) VALUES(?,?,?,?,?)`,[b.distribution_date,menuSp,menuPos,clean(b.notes)||null,req.session.user?.id||null]);
      scheduleId=r.insertId;
    }
    const keep=[];
    for(const c of clusters){
      const no=Number(c.cluster_no); if(!Number.isInteger(no)||no<1)continue;
      const type=['SATUAN_PENDIDIKAN','POSYANDU'].includes(c.kpm_type)?c.kpm_type:null; if(!type)continue;
      const vehicle=['E 8684 RD','E 8871 RD'].includes(c.vehicle)?c.vehicle:''; if(!vehicle)throw new Error('Kendaraan kloter '+no+' tidak valid.');
      let ids=Array.isArray(c.kpm_ids)?c.kpm_ids.map(Number).filter(Number.isInteger):[]; if(!ids.length)throw new Error('Kloter '+no+' belum memiliki KPM.');
      let clusterId=Number(c.id)||0;
      if(clusterId){const [[chk]]=await conn.query('SELECT id FROM distribution_clusters WHERE id=? AND schedule_id=?',[clusterId,scheduleId]);if(!chk)clusterId=0;}
      if(clusterId){
        await conn.query(`UPDATE distribution_clusters SET is_active=1,cancelled_by=NULL,cancelled_at=NULL,cancellation_reason=NULL,cluster_no=?,kpm_type=?,route_name=?,staff_id=?,vehicle=?,prep_start=?,prep_end=?,processing_start=?,processing_end=?,portioning_start=?,portioning_end=?,departure_time=?,return_time=?,washing_start=?,washing_end=?,notes=? WHERE id=?`,[no,type,clean(c.route_name)||null,Number(c.staff_id)||null,vehicle,clean(c.prep_start)||null,clean(c.prep_end)||null,clean(c.processing_start)||null,clean(c.processing_end)||null,clean(c.portioning_start)||null,clean(c.portioning_end)||null,clean(c.departure_time)||null,clean(c.return_time)||null,clean(c.washing_start)||null,clean(c.washing_end)||null,clean(c.notes)||null,clusterId]);
        await conn.query('DELETE FROM distribution_cluster_kpm WHERE cluster_id=?',[clusterId]);
      }else{
        const [r]=await conn.query(`INSERT INTO distribution_clusters(schedule_id,cluster_no,kpm_type,route_name,staff_id,vehicle,prep_start,prep_end,processing_start,processing_end,portioning_start,portioning_end,departure_time,return_time,washing_start,washing_end,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[scheduleId,no,type,clean(c.route_name)||null,Number(c.staff_id)||null,vehicle,clean(c.prep_start)||null,clean(c.prep_end)||null,clean(c.processing_start)||null,clean(c.processing_end)||null,clean(c.portioning_start)||null,clean(c.portioning_end)||null,clean(c.departure_time)||null,clean(c.return_time)||null,clean(c.washing_start)||null,clean(c.washing_end)||null,clean(c.notes)||null]);
        clusterId=r.insertId;
      }
      const [valid]=await conn.query(`SELECT k.id,k.type,CASE WHEN k.type='POSYANDU' THEN COALESCE(dd.balita_female,0)+COALESCE(dd.balita_male,0) ELSE COALESCE(dd.small_female,0)+COALESCE(dd.small_male,0) END small_portions,CASE WHEN k.type='POSYANDU' THEN COALESCE(dd.bumil,0)+COALESCE(dd.busui,0) ELSE COALESCE(dd.large_female,0)+COALESCE(dd.large_male,0)+COALESCE(dd.teacher_female,0)+COALESCE(dd.teacher_male,0)+COALESCE(dd.staff_female,0)+COALESCE(dd.staff_male,0) END large_portions FROM kpm k LEFT JOIN kpm_daily_data dd ON dd.id=(SELECT x.id FROM kpm_daily_data x WHERE x.kpm_id=k.id AND x.effective_from<=? ORDER BY x.effective_from DESC,x.id DESC LIMIT 1) WHERE k.id IN (${ids.map(()=>'?').join(',')}) AND k.active=1`,[b.distribution_date,...ids]);
      if(valid.length!==ids.length)throw new Error('Sebagian KPM pada Kloter '+no+' tidak ditemukan/aktif.');
      for(let i=0;i<valid.length;i++){const k=valid[i];if(k.type!==type)throw new Error('Jenis KPM dalam Kloter '+no+' harus sama.');const h=(c.handover||{})[String(k.id)]||null,p=(c.pickup||{})[String(k.id)]||null;await conn.query('INSERT INTO distribution_cluster_kpm(cluster_id,kpm_id,small_portions,large_portions,handover_time,pickup_time,sort_order) VALUES(?,?,?,?,?,?,?)',[clusterId,k.id,k.small_portions,k.large_portions,clean(h)||null,clean(p)||null,i+1]);}
      keep.push(clusterId);
    }
    if(keep.length)await conn.query(`UPDATE distribution_clusters SET is_active=0,cancelled_by=?,cancelled_at=CURRENT_TIMESTAMP,cancellation_reason='Dikeluarkan dari revisi jadwal' WHERE schedule_id=? AND id NOT IN (${keep.map(()=>'?').join(',')}) AND COALESCE(is_active,1)=1`,[req.session.user.id,scheduleId,...keep]);
    else await conn.query(`UPDATE distribution_clusters SET is_active=0,cancelled_by=?,cancelled_at=CURRENT_TIMESTAMP,cancellation_reason='Dikeluarkan dari revisi jadwal' WHERE schedule_id=? AND COALESCE(is_active,1)=1`,[req.session.user.id,scheduleId]);
    await conn.commit();
  }catch(e){await conn.rollback();throw e}finally{conn.release()}
  flash(req,'success','Jadwal, kloter, dan KPM berhasil disimpan.');res.redirect('/distribution?date='+encodeURIComponent(b.distribution_date));
}));

app.get('/distribution/:id([0-9]+)',auth,ar(async(req,res)=>{
  const [[cluster]]=await pool.query(`SELECT c.*,ds.distribution_date,s.name driver_name FROM distribution_clusters c JOIN distribution_schedules ds ON ds.id=c.schedule_id LEFT JOIN staff s ON s.id=c.staff_id WHERE c.id=?`,[req.params.id]);
  if(!cluster)return res.sendStatus(404);
  const [items]=await pool.query(`SELECT ck.*,k.code,k.name,k.type,k.education_level FROM distribution_cluster_kpm ck JOIN kpm k ON k.id=ck.kpm_id WHERE ck.cluster_id=? ORDER BY ck.sort_order,k.name`,[cluster.id]);
  const [[schedule]]=await pool.query(`SELECT ds.*,ms.menu_name menu_sp_name,ms.menu_code menu_sp_code,mp.menu_name menu_pos_name,mp.menu_code menu_pos_code FROM distribution_schedules ds LEFT JOIN menu_daily ms ON ms.id=ds.menu_sp_id LEFT JOIN menu_daily mp ON mp.id=ds.menu_pos_id WHERE ds.id=?`,[cluster.schedule_id]);
  const [[totals]]=await pool.query('SELECT COALESCE(SUM(small_portions),0) small_total,COALESCE(SUM(large_portions),0) large_total,COUNT(*) kpm_count FROM distribution_cluster_kpm WHERE cluster_id=?',[cluster.id]);
  res.render('distribution/cluster',{title:'Detail Kloter Distribusi',cluster,items,schedule,totals});
}));

app.get('/distribution/cluster/new',auth,ar(async(req,res)=>{
  const scheduleId=Number(req.query.schedule_id);if(!scheduleId) return res.redirect('/distribution');
  const [[schedule]]=await pool.query('SELECT * FROM distribution_schedules WHERE id=?',[scheduleId]);if(!schedule)return res.sendStatus(404);
  const [staff]=await pool.query("SELECT id,name,position FROM staff WHERE status='AKTIF' AND position='Tim Distribusi' ORDER BY name");
  const [kpms]=await pool.query(`SELECT k.id,k.code,k.name,k.type,k.education_level,
    CASE WHEN k.type='POSYANDU' THEN COALESCE(dd.balita_female,0)+COALESCE(dd.balita_male,0) ELSE COALESCE(dd.small_female,0)+COALESCE(dd.small_male,0) END small_portions,
    CASE WHEN k.type='POSYANDU' THEN COALESCE(dd.bumil,0)+COALESCE(dd.busui,0) ELSE COALESCE(dd.large_female,0)+COALESCE(dd.large_male,0)+COALESCE(dd.teacher_female,0)+COALESCE(dd.teacher_male,0)+COALESCE(dd.staff_female,0)+COALESCE(dd.staff_male,0) END large_portions
    FROM kpm k LEFT JOIN kpm_daily_data dd ON dd.id=(SELECT x.id FROM kpm_daily_data x WHERE x.kpm_id=k.id AND x.effective_from<=? ORDER BY x.effective_from DESC,x.id DESC LIMIT 1)
    WHERE k.active=1 ORDER BY k.type,k.name`,[schedule.distribution_date]);
  const [[maxRow]]=await pool.query('SELECT COALESCE(MAX(cluster_no),0) max_no FROM distribution_clusters WHERE schedule_id=?',[scheduleId]);
  res.render('distribution/cluster-form',{title:'Tambah Kloter Distribusi',schedule,staff,kpms,nextCluster:Number(maxRow.max_no||0)+1});
}));

app.post('/distribution/cluster',auth,requirePermission('distribution.manage'),ar(async(req,res)=>{
  const b=req.body,scheduleId=Number(b.schedule_id);if(!scheduleId)throw new Error('Jadwal distribusi tidak valid.');
  const type=['SATUAN_PENDIDIKAN','POSYANDU'].includes(b.kpm_type)?b.kpm_type:'SATUAN_PENDIDIKAN';
  const vehicle=['E 8684 RD','E 8871 RD'].includes(b.vehicle)?b.vehicle:'';if(!vehicle)throw new Error('Kendaraan distribusi tidak valid.');
  const staffId=Number(b.staff_id)||null; if(staffId){const [[st]]=await pool.query("SELECT id FROM staff WHERE id=? AND status='AKTIF' AND position='Tim Distribusi'",[staffId]);if(!st)throw new Error('Kurir distribusi tidak valid.');}
  let ids=b.kpm_ids||[];if(!Array.isArray(ids))ids=[ids];ids=ids.map(Number).filter(Number.isInteger);if(!ids.length)throw new Error('Pilih minimal satu KPM.');
  const [[schedule]]=await pool.query('SELECT * FROM distribution_schedules WHERE id=?',[scheduleId]);if(!schedule)return res.sendStatus(404);await assertScheduleMutable(scheduleId);
  const conn=await pool.getConnection();try{await conn.beginTransaction();
    const [[dup]]=await conn.query('SELECT id FROM distribution_clusters WHERE schedule_id=? AND cluster_no=?',[scheduleId,Number(b.cluster_no)]);if(dup)throw new Error('Nomor kloter sudah digunakan pada tanggal tersebut.');
    const [r]=await conn.query('INSERT INTO distribution_clusters(schedule_id,cluster_no,kpm_type,route_name,staff_id,vehicle,departure_time,return_time,notes) VALUES(?,?,?,?,?,?,?,?,?)',[scheduleId,Number(b.cluster_no),type,clean(b.route_name)||null,staffId,vehicle,clean(b.departure_time)||null,clean(b.return_time)||null,clean(b.notes)||null]);
    const [kpms]=await conn.query(`SELECT k.id,k.type,
      CASE WHEN k.type='POSYANDU' THEN COALESCE(dd.balita_female,0)+COALESCE(dd.balita_male,0) ELSE COALESCE(dd.small_female,0)+COALESCE(dd.small_male,0) END small_portions,
      CASE WHEN k.type='POSYANDU' THEN COALESCE(dd.bumil,0)+COALESCE(dd.busui,0) ELSE COALESCE(dd.large_female,0)+COALESCE(dd.large_male,0)+COALESCE(dd.teacher_female,0)+COALESCE(dd.teacher_male,0)+COALESCE(dd.staff_female,0)+COALESCE(dd.staff_male,0) END large_portions
      FROM kpm k LEFT JOIN kpm_daily_data dd ON dd.id=(SELECT x.id FROM kpm_daily_data x WHERE x.kpm_id=k.id AND x.effective_from<=? ORDER BY x.effective_from DESC,x.id DESC LIMIT 1) WHERE k.id IN (${ids.map(()=>'?').join(',')}) AND k.active=1`,[schedule.distribution_date,...ids]);
    if(kpms.length!==ids.length)throw new Error('Sebagian KPM tidak ditemukan/aktif.');
    for(let i=0;i<kpms.length;i++){const k=kpms[i];if(k.type!==type)throw new Error('Jenis KPM dalam satu kloter harus sama.');await conn.query('INSERT INTO distribution_cluster_kpm(cluster_id,kpm_id,small_portions,large_portions,handover_time,pickup_time,sort_order) VALUES(?,?,?,?,?,?,?)',[r.insertId,k.id,k.small_portions,k.large_portions,clean((b.handover||{})[String(k.id)])||null,clean((b.pickup||{})[String(k.id)])||null,i+1]);}
    await conn.commit();await log(req,'Tambah','DISTRIBUTION_CLUSTER',r.insertId,'Kloter '+b.cluster_no);flash(req,'success','Kloter berhasil dibuat.');res.redirect('/distribution/'+r.insertId);
  }catch(e){await conn.rollback();throw e}finally{conn.release()}
}));

app.get('/distribution/cluster/:id/edit',auth,ar(async(req,res)=>{
  const [[cluster]]=await pool.query('SELECT c.*,ds.distribution_date FROM distribution_clusters c JOIN distribution_schedules ds ON ds.id=c.schedule_id WHERE c.id=?',[req.params.id]);if(!cluster)return res.sendStatus(404);
  const [staff]=await pool.query("SELECT id,name,position FROM staff WHERE status='AKTIF' AND position='Tim Distribusi' ORDER BY name");
  const [kpms]=await pool.query(`SELECT k.id,k.code,k.name,k.type,k.education_level,
    CASE WHEN k.type='POSYANDU' THEN COALESCE(dd.balita_female,0)+COALESCE(dd.balita_male,0) ELSE COALESCE(dd.small_female,0)+COALESCE(dd.small_male,0) END small_portions,
    CASE WHEN k.type='POSYANDU' THEN COALESCE(dd.bumil,0)+COALESCE(dd.busui,0) ELSE COALESCE(dd.large_female,0)+COALESCE(dd.large_male,0)+COALESCE(dd.teacher_female,0)+COALESCE(dd.teacher_male,0)+COALESCE(dd.staff_female,0)+COALESCE(dd.staff_male,0) END large_portions,
    ck.id selected_id,ck.handover_time,ck.pickup_time FROM kpm k LEFT JOIN kpm_daily_data dd ON dd.id=(SELECT x.id FROM kpm_daily_data x WHERE x.kpm_id=k.id AND x.effective_from<=? ORDER BY x.effective_from DESC,x.id DESC LIMIT 1) LEFT JOIN distribution_cluster_kpm ck ON ck.kpm_id=k.id AND ck.cluster_id=? WHERE k.active=1 ORDER BY k.type,k.name`,[cluster.distribution_date,cluster.id]);
  res.render('distribution/cluster-edit',{title:'Edit Kloter Distribusi',cluster,staff,kpms});
}));

app.post('/distribution/cluster/:id/update',auth,requirePermission('distribution.manage'),ar(async(req,res)=>{
  const b=req.body;const [[cluster]]=await pool.query('SELECT c.*,ds.distribution_date FROM distribution_clusters c JOIN distribution_schedules ds ON ds.id=c.schedule_id WHERE c.id=?',[req.params.id]);if(!cluster)return res.sendStatus(404);await assertScheduleMutable(cluster.schedule_id);
  const staffId=Number(b.staff_id)||null;if(staffId){const [[st]]=await pool.query("SELECT id FROM staff WHERE id=? AND status='AKTIF' AND position='Tim Distribusi'",[staffId]);if(!st)throw new Error('Kurir distribusi tidak valid.');}
  const vehicle=['E 8684 RD','E 8871 RD'].includes(b.vehicle)?b.vehicle:'';if(!vehicle)throw new Error('Kendaraan distribusi tidak valid.');
  let ids=b.kpm_ids||[];if(!Array.isArray(ids))ids=[ids];ids=ids.map(Number).filter(Number.isInteger);if(!ids.length)throw new Error('Pilih minimal satu KPM.');
  const conn=await pool.getConnection();try{await conn.beginTransaction();await conn.query('UPDATE distribution_clusters SET route_name=?,staff_id=?,vehicle=?,departure_time=?,return_time=?,notes=? WHERE id=?',[clean(b.route_name)||null,staffId,vehicle,clean(b.departure_time)||null,clean(b.return_time)||null,clean(b.notes)||null,req.params.id]);await conn.query('DELETE FROM distribution_cluster_kpm WHERE cluster_id=?',[req.params.id]);const [kpms]=await conn.query(`SELECT k.id,k.type,CASE WHEN k.type='POSYANDU' THEN COALESCE(dd.balita_female,0)+COALESCE(dd.balita_male,0) ELSE COALESCE(dd.small_female,0)+COALESCE(dd.small_male,0) END small_portions,CASE WHEN k.type='POSYANDU' THEN COALESCE(dd.bumil,0)+COALESCE(dd.busui,0) ELSE COALESCE(dd.large_female,0)+COALESCE(dd.large_male,0)+COALESCE(dd.teacher_female,0)+COALESCE(dd.teacher_male,0)+COALESCE(dd.staff_female,0)+COALESCE(dd.staff_male,0) END large_portions FROM kpm k LEFT JOIN kpm_daily_data dd ON dd.id=(SELECT x.id FROM kpm_daily_data x WHERE x.kpm_id=k.id AND x.effective_from<=? ORDER BY x.effective_from DESC,x.id DESC LIMIT 1) WHERE k.id IN (${ids.map(()=>'?').join(',')}) AND k.active=1`,[cluster.distribution_date,...ids]);if(kpms.length!==ids.length)throw new Error('Sebagian KPM tidak ditemukan/aktif.');for(let i=0;i<kpms.length;i++){if(kpms[i].type!==cluster.kpm_type)throw new Error('Jenis KPM dalam satu kloter harus sama.');await conn.query('INSERT INTO distribution_cluster_kpm(cluster_id,kpm_id,small_portions,large_portions,handover_time,pickup_time,sort_order) VALUES(?,?,?,?,?,?,?)',[req.params.id,kpms[i].id,kpms[i].small_portions,kpms[i].large_portions,clean((b.handover||{})[String(kpms[i].id)])||null,clean((b.pickup||{})[String(kpms[i].id)])||null,i+1]);}await conn.commit();flash(req,'success','Kloter berhasil diperbarui.');res.redirect('/distribution/'+req.params.id)}catch(e){await conn.rollback();throw e}finally{conn.release()}
}));

app.post('/distribution/cluster/:id/remove',auth,requirePermission('distribution.manage'),ar(async(req,res)=>{if(!requireCsrf(req,res))return;const [[c]]=await pool.query('SELECT * FROM distribution_clusters WHERE id=?',[req.params.id]);if(!c)return res.sendStatus(404);await assertScheduleMutable(c.schedule_id);await pool.query(`UPDATE distribution_clusters SET is_active=0,cancelled_by=?,cancelled_at=CURRENT_TIMESTAMP,cancellation_reason=? WHERE id=?`,[req.session.user.id,'Kloter dibatalkan oleh pengguna',req.params.id]);await log(req,'Batalkan','DISTRIBUTION_CLUSTER',req.params.id,'Kloter '+c.cluster_no,c,{is_active:0});flash(req,'success','Kloter dibatalkan dan histori tetap tersimpan.');res.redirect('/distribution');}));

app.get('/staff/schedule',auth,requirePermission('staff.view'),ar(async(req,res)=>{const date=/^\d{4}-\d{2}-\d{2}$/.test(clean(req.query.date))?clean(req.query.date):new Date().toISOString().slice(0,10);const [rows]=await pool.query(`SELECT ss.*,s.name,s.position,t.team_code,t.team_name FROM staff_schedule ss JOIN staff s ON s.id=ss.staff_id LEFT JOIN sppg_teams t ON t.id=ss.team_id WHERE ss.schedule_date=? AND COALESCE(ss.is_active,1)=1 ORDER BY t.team_name,ss.start_time,s.name`,[date]);const [staffRows]=await pool.query(`SELECT id,name,position FROM staff WHERE status='AKTIF' ORDER BY name`);const [teams]=await pool.query(`SELECT id,team_code,team_name FROM sppg_teams WHERE is_active=1 ORDER BY id`);res.render('staff/schedule',{title:'Jadwal Staf',rows,date,staffRows,teams})}));
app.post('/staff/schedule',auth,requirePermission('staff.manage'),ar(async(req,res)=>{if(!requireCsrf(req,res))return;const date=clean(req.body.schedule_date),staffId=Number(req.body.staff_id),teamId=Number(req.body.team_id)||null;const shift=clean(req.body.shift_name)||null,start=clean(req.body.start_time)||null,end=clean(req.body.end_time)||null,notes=clean(req.body.notes)||null;if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isInteger(staffId)||staffId<1)throw new Error('Tanggal atau staf tidak valid.');const [[staff]]=await pool.query(`SELECT id,name,position FROM staff WHERE id=? AND status='AKTIF'`,[staffId]);if(!staff)throw new Error('Staf aktif tidak ditemukan.');if(teamId){const [[team]]=await pool.query('SELECT id FROM sppg_teams WHERE id=? AND is_active=1',[teamId]);if(!team)throw new Error('Tim tidak valid.');}const [[dup]]=await pool.query('SELECT id FROM staff_schedule WHERE schedule_date=? AND staff_id=?',[date,staffId]);if(dup)throw new Error('Staf tersebut sudah memiliki jadwal pada tanggal itu.');const [r]=await pool.query('INSERT INTO staff_schedule(schedule_date,staff_id,team_id,shift_name,start_time,end_time,notes) VALUES(?,?,?,?,?,?,?)',[date,staffId,teamId,shift,start,end,notes]);await log(req,'Tambah','STAFF_SCHEDULE',r.insertId,'Menambahkan jadwal staf',null,{schedule_date:date,staff_id:staffId,team_id:teamId,shift_name:shift,start_time:start,end_time:end,notes});flash(req,'success','Jadwal staf berhasil ditambahkan.');res.redirect('/staff/schedule?date='+encodeURIComponent(date));}));
app.post('/staff/schedule/:id/delete',auth,requirePermission('staff.manage'),ar(async(req,res)=>{if(!requireCsrf(req,res))return;const id=Number(req.params.id);const [[old]]=await pool.query('SELECT * FROM staff_schedule WHERE id=?',[id]);if(!old)return res.sendStatus(404);const reason=clean(req.body.reason)||'Jadwal dibatalkan.';await pool.query('UPDATE staff_schedule SET is_active=0,cancelled_by=?,cancelled_at=CURRENT_TIMESTAMP,cancellation_reason=? WHERE id=?',[req.session.user.id,reason,id]);await log(req,'Edit','STAFF_SCHEDULE',id,'Membatalkan jadwal staf',old,{...old,is_active:0,cancellation_reason:reason});flash(req,'success','Jadwal dibatalkan dan histori tetap tersimpan.');res.redirect('/staff/schedule?date='+encodeURIComponent(sqlDate(old.schedule_date)));}));

const ATTENDANCE_STATUSES=['HADIR','IZIN','SAKIT','ALPA','CUTI','DINAS']; const ATTENDANCE_DISPLAY_STATUSES=['BELUM_DIISI',...ATTENDANCE_STATUSES];
app.get('/staff/attendance',auth,requirePermission('staff.view'),ar(async(req,res)=>{const date=/^\d{4}-\d{2}-\d{2}$/.test(clean(req.query.date))?clean(req.query.date):new Date().toISOString().slice(0,10);const teamId=Number(req.query.team_id)||0;const [teams]=await pool.query(`SELECT id,team_code,team_name FROM sppg_teams WHERE is_active=1 ORDER BY id`);const [staffRows]=await pool.query(`SELECT s.id,s.name,s.position,ss.team_id,ss.shift_name,ss.start_time,ss.end_time,COALESCE(a.status,'BELUM_DIISI') attendance_status,a.check_in,a.check_out,a.note attendance_note,a.id attendance_id FROM staff s LEFT JOIN staff_schedule ss ON ss.staff_id=s.id AND ss.schedule_date=? AND COALESCE(ss.is_active,1)=1 LEFT JOIN staff_attendance a ON a.staff_id=s.id AND a.attendance_date=? WHERE s.status='AKTIF' ${teamId?'AND ss.team_id=?':''} ORDER BY ss.team_id,s.name`,teamId?[date,date,teamId]:[date,date]);const [replacements]=await pool.query(`SELECT ar.*,a.name absent_name,r.name replacement_name,t.team_name FROM attendance_replacements ar JOIN staff a ON a.id=ar.absent_staff_id JOIN staff r ON r.id=ar.replacement_staff_id LEFT JOIN sppg_teams t ON t.id=ar.team_id WHERE ar.replacement_date=? AND ar.is_active=1 ${teamId?'AND ar.team_id=?':''} ORDER BY t.team_name,a.name`,teamId?[date,teamId]:[date]);const summary={BELUM_DIISI:staffRows.filter(x=>x.attendance_status==='BELUM_DIISI').length};for(const st of ATTENDANCE_STATUSES)summary[st]=staffRows.filter(x=>x.attendance_status===st).length;res.render('staff/attendance',{title:'Absensi Staf',date,teams,teamId,staffRows,replacements,summary,statuses:ATTENDANCE_DISPLAY_STATUSES});}));
app.post('/staff/attendance/bulk',auth,requirePermission('staff.manage'),ar(async(req,res)=>{if(!requireCsrf(req,res))return;const date=clean(req.body.attendance_date);if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('Tanggal absensi tidak valid.');let rows=[];try{rows=JSON.parse(String(req.body.rows_json||'[]'));}catch{throw new Error('Data absensi tidak valid.');}if(!Array.isArray(rows))throw new Error('Data absensi tidak valid.');const conn=await pool.getConnection();try{await conn.beginTransaction();for(const row of rows){const staffId=Number(row.staff_id),status=String(row.status||'').toUpperCase(),checkIn=clean(row.check_in)||null,checkOut=clean(row.check_out)||null,note=clean(row.note)||null;if(!Number.isInteger(staffId)||!ATTENDANCE_STATUSES.includes(status))continue;const [[staff]]=await conn.query(`SELECT id,name FROM staff WHERE id=? AND status='AKTIF'`,[staffId]);if(!staff)continue;const [[schedule]]=await conn.query('SELECT team_id FROM staff_schedule WHERE schedule_date=? AND staff_id=? AND COALESCE(is_active,1)=1',[date,staffId]);const [[old]]=await conn.query('SELECT * FROM staff_attendance WHERE attendance_date=? AND staff_id=?',[date,staffId]);await conn.query(`INSERT INTO staff_attendance(attendance_date,staff_id,team_id,status,check_in,check_out,note,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE team_id=VALUES(team_id),status=VALUES(status),check_in=VALUES(check_in),check_out=VALUES(check_out),note=VALUES(note),updated_by=VALUES(updated_by)`,[date,staffId,schedule?.team_id||null,status,checkIn,checkOut,note,req.session.user.id,req.session.user.id]);if(JSON.stringify(old||null)!==JSON.stringify({attendance_date:date,staff_id:staffId,team_id:schedule?.team_id||null,status,check_in:checkIn,check_out:checkOut,note}))await log(req,old?'Edit':'Tambah','STAFF_ATTENDANCE',old?.id||null,'Mencatat absensi staf',old,{attendance_date:date,staff_id:staffId,team_id:schedule?.team_id||null,status,check_in:checkIn,check_out:checkOut,note});}await conn.commit();flash(req,'success','Absensi staf berhasil disimpan.');}catch(e){await conn.rollback();throw e}finally{conn.release()}res.redirect('/staff/attendance?date='+encodeURIComponent(date));}));
app.post('/staff/attendance/replacement',auth,requirePermission('staff.manage'),ar(async(req,res)=>{if(!requireCsrf(req,res))return;const date=clean(req.body.replacement_date),teamId=Number(req.body.team_id)||null,absent=Number(req.body.absent_staff_id),replacement=Number(req.body.replacement_staff_id),scope=clean(req.body.task_scope)||null,reason=clean(req.body.reason)||null,note=clean(req.body.note)||null;if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!absent||!replacement||absent===replacement)throw new Error('Data penggantian tidak valid.');const [[a]]=await pool.query(`SELECT id,name FROM staff WHERE id=?`,[absent]);const [[r]]=await pool.query(`SELECT id,name FROM staff WHERE id=? AND status='AKTIF'`,[replacement]);if(!a||!r)throw new Error('Staf tidak valid.');const [[absSched]]=await pool.query('SELECT team_id FROM staff_schedule WHERE schedule_date=? AND staff_id=? AND COALESCE(is_active,1)=1',[date,absent]);const [[repSched]]=await pool.query('SELECT team_id FROM staff_schedule WHERE schedule_date=? AND staff_id=? AND COALESCE(is_active,1)=1',[date,replacement]);if(!absSched)throw new Error('Staf yang digantikan belum memiliki jadwal pada tanggal tersebut.');if(!repSched)throw new Error('Staf pengganti belum memiliki jadwal pada tanggal tersebut.');if(teamId && Number(absSched.team_id)!==teamId)throw new Error('Tim penggantian tidak sesuai dengan jadwal staf yang tidak hadir.');if(teamId && Number(repSched.team_id)!==teamId)throw new Error('Staf pengganti harus berasal dari tim yang sama.');if(!teamId && Number(absSched.team_id)!==Number(repSched.team_id))throw new Error('Staf pengganti harus berasal dari tim yang sama.');const [[absAtt]]=await pool.query('SELECT status FROM staff_attendance WHERE attendance_date=? AND staff_id=?',[date,absent]);const [[repAtt]]=await pool.query('SELECT status FROM staff_attendance WHERE attendance_date=? AND staff_id=?',[date,replacement]);if(!absAtt||!['IZIN','SAKIT','ALPA','CUTI'].includes(absAtt.status))throw new Error('Staf yang digantikan harus berstatus tidak hadir (Izin/Sakit/Alpa/Cuti).');if(!repAtt||repAtt.status!=='HADIR')throw new Error('Staf pengganti harus berstatus HADIR.');const [x]=await pool.query('INSERT INTO attendance_replacements(replacement_date,team_id,absent_staff_id,replacement_staff_id,task_scope,reason,note,created_by) VALUES(?,?,?,?,?,?,?,?)',[date,teamId,absent,replacement,scope,reason,note,req.session.user.id]);await log(req,'Tambah','ATTENDANCE_REPLACEMENT',x.insertId,'Mencatat penggantian petugas',null,{replacement_date:date,team_id:teamId,absent_staff_id:absent,replacement_staff_id:replacement,task_scope:scope,reason,note});flash(req,'success',`${r.name} tercatat menggantikan ${a.name}.`);res.redirect('/staff/attendance?date='+encodeURIComponent(date)+(teamId?'&team_id='+teamId:''));}));
app.post('/staff/attendance/replacement/:id/cancel',auth,requirePermission('staff.manage'),ar(async(req,res)=>{if(!requireCsrf(req,res))return;const id=Number(req.params.id);const [[old]]=await pool.query('SELECT * FROM attendance_replacements WHERE id=? AND is_active=1',[id]);if(!old)return res.sendStatus(404);const reason=clean(req.body.reason)||'Catatan penggantian dibatalkan.';await pool.query('UPDATE attendance_replacements SET is_active=0,cancelled_by=?,cancelled_at=CURRENT_TIMESTAMP,cancellation_reason=? WHERE id=?',[req.session.user.id,reason,id]);await log(req,'Edit','ATTENDANCE_REPLACEMENT',id,'Membatalkan catatan penggantian petugas',old,{...old,is_active:0,cancellation_reason:reason});flash(req,'success','Catatan penggantian dibatalkan dan tetap tersimpan dalam histori.');res.redirect('/staff/attendance?date='+encodeURIComponent(sqlDate(old.replacement_date)));}));
app.get('/staff/attendance/recap',auth,requirePermission('staff.view'),ar(async(req,res)=>{const month=/^\d{4}-\d{2}$/.test(clean(req.query.month))?clean(req.query.month):new Date().toISOString().slice(0,7);const teamId=Number(req.query.team_id)||0;const start=month+'-01';const endExpr='LAST_DAY(?)';const params=teamId?[start,start,teamId]:[start,start];const [rows]=await pool.query(`SELECT s.id,s.name,s.position,COUNT(DISTINCT ss.schedule_date) hari_dijadwalkan,COUNT(DISTINCT CASE WHEN a.id IS NOT NULL THEN a.attendance_date END) days_with_attendance,SUM(CASE WHEN a.status='HADIR' THEN 1 ELSE 0 END) hadir,SUM(CASE WHEN a.status='IZIN' THEN 1 ELSE 0 END) izin,SUM(CASE WHEN a.status='SAKIT' THEN 1 ELSE 0 END) sakit,SUM(CASE WHEN a.status='ALPA' THEN 1 ELSE 0 END) alpa,SUM(CASE WHEN a.status='CUTI' THEN 1 ELSE 0 END) cuti,SUM(CASE WHEN a.status='DINAS' THEN 1 ELSE 0 END) dinas FROM staff s LEFT JOIN staff_schedule ss ON ss.staff_id=s.id AND ss.schedule_date BETWEEN ? AND LAST_DAY(?) ${teamId?'AND ss.team_id=?':''} LEFT JOIN staff_attendance a ON a.staff_id=s.id AND a.attendance_date=ss.schedule_date WHERE s.status IN ('AKTIF','CUTI','NONAKTIF_SEMENTARA') GROUP BY s.id ORDER BY s.name`,params);const [replacements]=await pool.query(`SELECT ar.replacement_date,a.name absent_name,r.name replacement_name,t.team_name,ar.task_scope,ar.reason FROM attendance_replacements ar JOIN staff a ON a.id=ar.absent_staff_id JOIN staff r ON r.id=ar.replacement_staff_id LEFT JOIN sppg_teams t ON t.id=ar.team_id WHERE ar.replacement_date BETWEEN ? AND LAST_DAY(?) AND ar.is_active=1 ${teamId?'AND ar.team_id=?':''} ORDER BY ar.replacement_date,a.name`,params);const [[total]]=await pool.query(`SELECT COUNT(*) total FROM staff WHERE status='AKTIF'`);const [teams]=await pool.query(`SELECT id,team_code,team_name FROM sppg_teams WHERE is_active=1 ORDER BY id`);res.render('staff/attendance-recap',{title:'Rekap Absensi',month,teamId,teams,rows,replacements,totalStaff:total.total});}));
app.get('/staff/attendance/recap.xlsx',auth,requirePermission('finance.export'),ar(async(req,res)=>{const month=/^\d{4}-\d{2}$/.test(clean(req.query.month))?clean(req.query.month):new Date().toISOString().slice(0,7);const teamId=Number(req.query.team_id)||0;const params=teamId?[month+'-01',month+'-01',teamId]:[month+'-01',month+'-01'];const [rows]=await pool.query(`SELECT s.name 'Nama',s.position 'Jabatan',COUNT(DISTINCT ss.schedule_date) 'Hari Dijadwalkan',SUM(CASE WHEN a.status='HADIR' THEN 1 ELSE 0 END) 'Hadir',SUM(CASE WHEN a.status='IZIN' THEN 1 ELSE 0 END) 'Izin',SUM(CASE WHEN a.status='SAKIT' THEN 1 ELSE 0 END) 'Sakit',SUM(CASE WHEN a.status='ALPA' THEN 1 ELSE 0 END) 'Alpa',SUM(CASE WHEN a.status='CUTI' THEN 1 ELSE 0 END) 'Cuti',SUM(CASE WHEN a.status='DINAS' THEN 1 ELSE 0 END) 'Dinas',COUNT(DISTINCT CASE WHEN a.id IS NOT NULL THEN a.attendance_date END) 'Hari Tercatat' FROM staff s LEFT JOIN staff_schedule ss ON ss.staff_id=s.id AND ss.schedule_date BETWEEN ? AND LAST_DAY(?) ${teamId?'AND ss.team_id=?':''} LEFT JOIN staff_attendance a ON a.staff_id=s.id AND a.attendance_date=ss.schedule_date WHERE s.status IN ('AKTIF','CUTI','NONAKTIF_SEMENTARA') GROUP BY s.id ORDER BY s.name`,params);const ws=XLSX.utils.json_to_sheet(rows);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Rekap Absensi');const buf=XLSX.write(wb,{bookType:'xlsx',type:'buffer'});res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');res.setHeader('Content-Disposition',`attachment; filename=Rekap-Absensi-${month}.xlsx`);res.send(buf);}));
app.get('/documents',auth,requirePermission('documents.view'),ar(async(req,res)=>{const type=['JUKNIS','SURAT_EDARAN','SOP'].includes(clean(req.query.type))?clean(req.query.type):'';const [rows]=await pool.query(`SELECT * FROM bgn_documents WHERE active=1 ${type?'AND doc_type=?':''} ORDER BY document_date DESC,id DESC`,type?[type]:[]);res.render('documents/index',{title:'Dokumen & SOP BGN',rows,type})}));
app.get('/documents/new',auth,requirePermission('documents.manage'),(req,res)=>res.render('module-dashboard',{title:'Tambah Dokumen/SOP',kicker:'DOKUMEN & SOP BGN',heading:'Tambah Dokumen / SOP',description:'Form input dokumen akan dilengkapi bersama upload file dan metadata dokumen.',emptyTitle:'Siap untuk input',emptyText:'Struktur dokumen sudah disiapkan. Detail form menjadi tahap berikutnya.',actionHref:'/documents',actionLabel:'Kembali'}));
app.get('/quick-links',auth,requirePermission('quick_links.view'),ar(async(req,res)=>{const [rows]=await pool.query('SELECT * FROM quick_links WHERE active=1 ORDER BY sort_order,title');res.render('quick-links/index',{title:'Akses Cepat',rows})}));
app.get('/quick-links/new',auth,requirePermission('quick_links.manage'),(req,res)=>res.render('module-dashboard',{title:'Tambah Link',kicker:'AKSES CEPAT',heading:'Tambah Link / Tautan',description:'Tempat untuk menambahkan akses cepat ke sistem yang sering digunakan.',emptyTitle:'Form link belum dibuka',emptyText:'Struktur dashboard sudah siap; form input akan dilanjutkan setelah master kebutuhan link ditetapkan.',actionHref:'/quick-links',actionLabel:'Kembali'}));
async function nextMenuCode(menuDate,conn=pool){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(menuDate||'')) throw new Error('Tanggal menu tidak valid.');
  const [rows]=await conn.query('SELECT menu_code FROM menu_daily WHERE menu_date=? FOR UPDATE',[menuDate]);
  const mm=menuDate.slice(5,7), dd=menuDate.slice(8,10), prefix=`MNU-${dd}${mm}`;
  let max=0;
  for(const r of rows){const m=String(r.menu_code||'').match(new RegExp('^'+prefix+'(\\d{2})$'));if(m)max=Math.max(max,Number(m[1]));}
  const next=max+1;
  if(next>99) throw new Error(`Jumlah menu pada ${menuDate} sudah mencapai batas 99 menu.`);
  return `${prefix}${String(next).padStart(2,'0')}`;
}

app.get('/menus',auth,requirePermission('menu.view'),ar(async(req,res)=>{
  const today=new Date().toISOString().slice(0,10);
  const selected=/^\d{4}-\d{2}-\d{2}$/.test(clean(req.query.date))?clean(req.query.date):today;
  const [[count]] = await pool.query('SELECT COUNT(*) total FROM menu_daily WHERE menu_date=?',[selected]);
  const [rows]=await pool.query('SELECT * FROM menu_daily WHERE menu_date=? ORDER BY kpm_type,menu_name,id',[selected]);
  const [dates]=await pool.query("SELECT DISTINCT DATE_FORMAT(menu_date,'%Y-%m-%d') menu_date FROM menu_daily ORDER BY menu_date DESC");
  const dateOptions=[...new Set([selected,today,...dates.map(x=>sqlDate(x.menu_date))])].sort((a,b)=>b.localeCompare(a));
  res.render('menus/index',{title:'Master Menu',rows,selected,dateOptions,count:Number(count.total||0)});
}));
app.get('/menus/new',auth,requirePermission('menu.manage'),ar(async(req,res)=>{
  const date=/^\d{4}-\d{2}-\d{2}$/.test(clean(req.query.date))?clean(req.query.date):new Date().toISOString().slice(0,10);
  res.render('menus/form',{title:'Tambah Menu',row:null,effectiveDate:date});
}));
app.post('/menus',auth,requirePermission('menu.manage'),upload.fields([{name:'photo_small',maxCount:1},{name:'photo_large',maxCount:1}]),ar(async(req,res)=>{
  try{
    if(!requireCsrf(req,res)){for(const f of Object.values(req.files||{}).flat())await removeUploaded(f);return}
    const b=req.body;
    const menuDate=/^\d{4}-\d{2}-\d{2}$/.test(clean(b.menu_date))?clean(b.menu_date):'';
    if(!menuDate||!clean(b.menu_name)||!['SATUAN_PENDIDIKAN','POSYANDU'].includes(b.kpm_type))throw new Error('Tanggal, nama menu, dan jenis KPM wajib valid.');
    const numeric=['energy_small','protein_small','fat_small','carb_small','fiber_small','energy_large','protein_large','fat_large','carb_large','fiber_large'];
    const vals=numeric.map(k=>clean(b[k])===''?null:Number(b[k]));
    if(vals.some(v=>v!==null&&!Number.isFinite(v)||v!==null&&v<0))throw new Error('Nilai gizi harus berupa angka 0 atau lebih.');
    const small=req.files?.photo_small?.[0]||null,large=req.files?.photo_large?.[0]||null;
    let snapshotSmall=small?.filename||null,snapshotLarge=large?.filename||null;
    const conn=await pool.getConnection();
    try{
      const code=await nextMenuCode(menuDate,conn);
      await conn.beginTransaction();
      const [existing]=await conn.query('SELECT * FROM menus WHERE menu_code=? LIMIT 1',[code]);
      let menuId;
      if(existing[0]){
        const m=existing[0];
        if(m.kpm_type!==b.kpm_type)throw new Error('Kode menu sudah digunakan untuk jenis KPM yang berbeda.');
        menuId=m.id;
        snapshotSmall=snapshotSmall||m.photo_small_path||null;snapshotLarge=snapshotLarge||m.photo_large_path||null;
        await conn.query('UPDATE menus SET menu_name=?,component_name=?,kpm_type=?,energy_small=?,protein_small=?,fat_small=?,carb_small=?,fiber_small=?,energy_large=?,protein_large=?,fat_large=?,carb_large=?,fiber_large=?,photo_small_path=COALESCE(?,photo_small_path),photo_large_path=COALESCE(?,photo_large_path),active=1 WHERE id=?',[clean(b.menu_name),clean(b.component_name)||null,b.kpm_type,...vals,small?.filename||null,large?.filename||null,menuId]);
      }else{
        const [r]=await conn.query('INSERT INTO menus(menu_code,menu_name,component_name,kpm_type,energy_small,protein_small,fat_small,carb_small,fiber_small,energy_large,protein_large,fat_large,carb_large,fiber_large,photo_small_path,photo_large_path,active) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[code,clean(b.menu_name),clean(b.component_name)||null,b.kpm_type,...vals,small?.filename||null,large?.filename||null,1]);
        menuId=r.insertId;
      }
      const [[dup]]=await conn.query('SELECT id FROM menu_daily WHERE menu_date=? AND menu_code=? LIMIT 1',[menuDate,code]);
      if(dup)throw new Error('Menu dengan kode tersebut sudah ada pada tanggal yang dipilih.');
      await conn.query('INSERT INTO menu_daily(menu_date,menu_id,menu_code,menu_name,component_name,kpm_type,energy_small,protein_small,fat_small,carb_small,fiber_small,energy_large,protein_large,fat_large,carb_large,fiber_large,photo_small_path,photo_large_path,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[menuDate,menuId,code,clean(b.menu_name),clean(b.component_name)||null,b.kpm_type,...vals,snapshotSmall,snapshotLarge,req.session.user?.id||null]);
      await conn.commit();
      await log(req,'Tambah','MENU_HARIAN',menuId,clean(b.menu_name),null,{date:menuDate,code});
      flash(req,'success','Menu berhasil ditambahkan untuk '+menuDate+'.');res.redirect('/menus?date='+menuDate);
    }catch(e){await conn.rollback();throw e}finally{conn.release()}
  }catch(e){for(const f of Object.values(req.files||{}).flat())await removeUploaded(f);throw e}
}));
app.get('/menus/:id',auth,ar(async(req,res)=>{const [[row]]=await pool.query('SELECT * FROM menu_daily WHERE id=?',[req.params.id]);if(!row)return res.sendStatus(404);res.render('menus/show',{title:'Detail Menu',row})}));
app.get('/menus/:id([0-9]+)/edit',auth,requirePermission('menu.manage'),ar(async(req,res)=>{const [[row]]=await pool.query('SELECT * FROM menu_daily WHERE id=?',[req.params.id]);if(!row)return res.sendStatus(404);res.render('menus/form',{title:'Edit Menu Harian',row,effectiveDate:sqlDate(row.menu_date)})}));
app.post('/menus/:id/update',auth,requirePermission('menu.manage'),upload.fields([{name:'photo_small',maxCount:1},{name:'photo_large',maxCount:1}]),ar(async(req,res)=>{
  const uploaded=Object.values(req.files||{}).flat();
  let saved=false;
  try{
    if(!requireCsrf(req,res)){for(const f of uploaded)await removeUploaded(f);return}
    for(const f of uploaded){if(!(await verifyUploadedFile(f))){await removeUploaded(f);throw new Error('Foto menu tidak valid atau isi file tidak sesuai.')}}
    const [[old]]=await pool.query('SELECT * FROM menu_daily WHERE id=?',[req.params.id]);if(!old)return res.sendStatus(404);
    const b=req.body;if(!clean(b.menu_name)||!['SATUAN_PENDIDIKAN','POSYANDU'].includes(b.kpm_type))throw new Error('Data menu tidak valid.');
    const numeric=['energy_small','protein_small','fat_small','carb_small','fiber_small','energy_large','protein_large','fat_large','carb_large','fiber_large'];
    const vals=numeric.map(k=>clean(b[k])===''?null:Number(b[k]));
    if(vals.some(v=>v!==null&&!Number.isFinite(v)||v!==null&&v<0))throw new Error('Nilai gizi harus berupa angka 0 atau lebih.');
    const small=req.files?.photo_small?.[0]||null,large=req.files?.photo_large?.[0]||null;
    const sp=small?.filename||old.photo_small_path||null,lp=large?.filename||old.photo_large_path||null;
    const conn=await pool.getConnection();
    try{
      await conn.beginTransaction();
      await conn.query('UPDATE menu_daily SET menu_name=?,component_name=?,kpm_type=?,energy_small=?,protein_small=?,fat_small=?,carb_small=?,fiber_small=?,energy_large=?,protein_large=?,fat_large=?,carb_large=?,fiber_large=?,photo_small_path=?,photo_large_path=? WHERE id=?',[clean(b.menu_name),clean(b.component_name)||null,b.kpm_type,...vals,sp,lp,req.params.id]);
      await conn.commit();saved=true;
    }catch(e){await conn.rollback();throw e}finally{conn.release()}
    // Delete replaced files only after the new DB references are safely committed.
    if(small&&old.photo_small_path&&old.photo_small_path!==sp)await removeUploaded({path:path.join(uploadDir,path.basename(old.photo_small_path))});
    if(large&&old.photo_large_path&&old.photo_large_path!==lp)await removeUploaded({path:path.join(uploadDir,path.basename(old.photo_large_path))});
    await log(req,'Edit','MENU_HARIAN',req.params.id,clean(b.menu_name),old,{...b,photo_small_replaced:!!small,photo_large_replaced:!!large});
    flash(req,'success','Menu tanggal '+sqlDate(old.menu_date)+' berhasil diperbarui.');
    res.redirect('/menus?date='+sqlDate(old.menu_date));
  }catch(e){
    if(!saved)for(const f of uploaded)await removeUploaded(f);
    throw e;
  }
}));
app.post('/menus/:id/remove',auth,requirePermission('menu.manage'),ar(async(req,res)=>{if(!requireCsrf(req,res))return;const [[row]]=await pool.query('SELECT * FROM menu_daily WHERE id=?',[req.params.id]);if(!row)return res.sendStatus(404);await pool.query('DELETE FROM menu_daily WHERE id=?',[req.params.id]);await log(req,'Hapus dari Tanggal','MENU_HARIAN',req.params.id,row.menu_name,row,null);flash(req,'success','Menu dihapus dari tanggal tersebut. Master menu tetap tersimpan untuk penggunaan kembali.');res.redirect('/menus?date='+sqlDate(row.menu_date));}));
app.get('/menus/copy',auth,ar(async(req,res)=>{const today=new Date().toISOString().slice(0,10);const source=/^\d{4}-\d{2}-\d{2}$/.test(clean(req.query.source))?clean(req.query.source):today;const target=/^\d{4}-\d{2}-\d{2}$/.test(clean(req.query.target))?clean(req.query.target):today;const [rows]=await pool.query('SELECT * FROM menu_daily WHERE menu_date=? ORDER BY kpm_type,menu_name,id',[source]);const [dates]=await pool.query("SELECT DISTINCT DATE_FORMAT(menu_date,'%Y-%m-%d') menu_date FROM menu_daily ORDER BY menu_date DESC");const dateOptions=[...new Set([today,source,target,...dates.map(x=>sqlDate(x.menu_date))])].sort((a,b)=>b.localeCompare(a));res.render('menus/copy',{title:'Salin Menu',source,target,rows,dateOptions})}));
app.post('/menus/copy',auth,requirePermission('menu.manage'),ar(async(req,res)=>{if(!requireCsrf(req,res))return;const source=/^\d{4}-\d{2}-\d{2}$/.test(clean(req.body.source))?clean(req.body.source):'';const target=/^\d{4}-\d{2}-\d{2}$/.test(clean(req.body.target))?clean(req.body.target):'';if(!source||!target)throw new Error('Tanggal sumber dan tujuan wajib valid.');if(source===target)throw new Error('Tanggal sumber dan tujuan tidak boleh sama.');let ids=req.body.menu_ids||[];if(!Array.isArray(ids))ids=[ids];ids=ids.map(x=>Number(x)).filter(Number.isInteger);if(!ids.length)throw new Error('Pilih minimal satu menu untuk disalin.');const conn=await pool.getConnection();try{await conn.beginTransaction();const [src]=await conn.query(`SELECT * FROM menu_daily WHERE menu_date=? AND id IN (${ids.map(()=>'?').join(',')}) ORDER BY id`,[source,...ids]);if(src.length!==ids.length)throw new Error('Sebagian menu sumber tidak ditemukan.');let copied=0;for(const r of src){const [[dup]]=await conn.query('SELECT id FROM menu_daily WHERE menu_date=? AND menu_id=? LIMIT 1',[target,r.menu_id]);if(dup)continue;const code=await nextMenuCode(target,conn);await conn.query('INSERT INTO menu_daily(menu_date,menu_id,menu_code,menu_name,component_name,kpm_type,energy_small,protein_small,fat_small,carb_small,fiber_small,energy_large,protein_large,fat_large,carb_large,fiber_large,photo_small_path,photo_large_path,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[target,r.menu_id,code,r.menu_name,r.component_name,r.kpm_type,r.energy_small,r.protein_small,r.fat_small,r.carb_small,r.fiber_small,r.energy_large,r.protein_large,r.fat_large,r.carb_large,r.fiber_large,r.photo_small_path,r.photo_large_path,req.session.user?.id||null]);copied++}await conn.commit();await log(req,'Salin Menu','MENU_HARIAN',0,`${source} → ${target}`,null,{source,target,ids,copied});flash(req,'success',`${copied} menu berhasil disalin ke ${target}.${copied<ids.length?' Menu yang sudah ada dilewati.':''}`);res.redirect('/menus?date='+target)}catch(e){await conn.rollback();throw e}finally{conn.release()}}));

app.get('/foodtray',auth,requirePermission('foodtray.view'),ar(async(req,res)=>{const [[template]]=await pool.query('SELECT * FROM foodtray_templates WHERE id=1');res.render('foodtray/index',{title:'Label Foodtray',template:template||{}})}));
app.post('/foodtray/upload',auth,requirePermission('foodtray.manage'),upload.single('template_file'),ar(async(req,res)=>{try{if(!requireCsrf(req,res)){await removeUploaded(req.file);return}if(!req.file||!(await verifyUploadedFile(req.file))){await removeUploaded(req.file);flash(req,'error','Template tidak valid. Gunakan PDF, JPG, PNG, XLSX, atau DOCX.');return res.redirect('/foodtray')}const [[old]]=await pool.query('SELECT template_path,template_name FROM foodtray_templates WHERE id=1');await pool.query('UPDATE foodtray_templates SET template_path=?,template_name=? WHERE id=1',[req.file.filename,req.file.originalname]);if(old?.template_path)await removeUploaded({path:path.join(uploadDir,path.basename(old.template_path))});await log(req,'Upload Template','LABEL_FOODTRAY',1,'Template Label Foodtray',old,{file:req.file.originalname});flash(req,'success','Template label foodtray berhasil diunggah.');res.redirect('/foodtray')}catch(e){await removeUploaded(req.file);throw e}}));
app.get('/foodtray/edit',auth,requirePermission('foodtray.manage'),(req,res)=>res.render('module-dashboard',{title:'Edit Label Foodtray',kicker:'LABEL FOODTRAY',heading:'Edit Template Label Foodtray',description:'Pengaturan template, ukuran, konten, dan panduan label.',emptyTitle:'Editor template',emptyText:'Editor detail template akan disiapkan pada tahap berikutnya.',actionHref:'/foodtray',actionLabel:'Kembali'}));
app.get('/foodtray/download',auth,ar(async(req,res)=>{const [[t]]=await pool.query('SELECT template_path,template_name FROM foodtray_templates WHERE id=1');if(!t||!t.template_path)return res.status(404).send('Template belum tersedia.');const file=await resolveStoredFile(t.template_path);if(!file)return res.status(404).send('File template tidak ditemukan.');res.download(file,t.template_name||'template-label-foodtray') }));
for(const mod of ['menu','pemorsian','distribusi','pencucian']) app.get('/documentation/'+mod,auth,requirePermission('documentation.view'),ar(async(req,res)=>{const map={menu:'MENU',pemorsian:'PEMORSIAN',distribusi:'DISTRIBUSI',pencucian:'PENCUCIAN'};const module=map[mod];const date=/^\d{4}-\d{2}-\d{2}$/.test(clean(req.query.date))?clean(req.query.date):new Date().toISOString().slice(0,10);const [rows]=await pool.query('SELECT * FROM documentation_records WHERE documentation_date=? AND module=? ORDER BY created_at DESC',[date,module]);res.render('documentation/index',{title:'Dokumentasi '+module.charAt(0)+module.slice(1).toLowerCase(),module,date,rows})}));

async function getClosing(date){const [[r]]=await pool.query('SELECT * FROM daily_closings WHERE work_date=?',[date]);return r||{work_date:date,status:'OPEN'};}
async function assertScheduleMutable(scheduleId){const [[x]]=await pool.query("SELECT id FROM distribution_snapshots WHERE schedule_id=? AND status='LOCKED' LIMIT 1",[scheduleId]);if(x)throw new Error('Jadwal sudah memiliki Snapshot dan terkunci. Perubahan jadwal tidak diperbolehkan agar histori tetap konsisten.');}
async function assertDayWritable(req,date){const c=await getClosing(date);if(c.status==='CLOSED'&&!['ADMIN','ASLAP','KASP'].includes(req.session.user?.role))throw new Error('Tanggal ini sudah Daily Closing dan terkunci. Koreksi harus dilakukan oleh Aslap/KaSPPG/Administrator.');return c;}
async function calculateExceptions(date){
  const out=[];
  const [clusters]=await pool.query(`SELECT c.id,c.cluster_no,COALESCE(c.is_active,1) is_active,c.departure_time,c.return_time FROM distribution_clusters c JOIN distribution_schedules ds ON ds.id=c.schedule_id WHERE ds.distribution_date=? AND COALESCE(c.is_active,1)=1 GROUP BY c.id ORDER BY c.cluster_no`,[date]);
  const [events]=await pool.query('SELECT team,unit_type,unit_id,action FROM operational_task_events WHERE work_date=?',[date]);
  const em=new Set(events.map(e=>`${e.team}|${e.unit_type}|${e.unit_id}|${e.action}`));
  for(const c of clusters){
    if(!em.has(`PEMORSIAN|KLOTER|${c.id}|MULAI`)) out.push({code:'PEMORSIAN_BELUM_MULAI',team:'PEMORSIAN',severity:'PENTING',title:`Pemorsian Kloter ${c.cluster_no} belum dimulai`,detail:'Belum ada event Mulai Pemorsian.',source_type:'CLUSTER',source_id:c.id});
    else if(!em.has(`PEMORSIAN|KLOTER|${c.id}|SELESAI`)) out.push({code:'PEMORSIAN_BELUM_SELESAI',team:'PEMORSIAN',severity:'PENTING',title:`Pemorsian Kloter ${c.cluster_no} belum selesai`,detail:'Konfirmasi selesai Pemorsian belum tercatat.',source_type:'CLUSTER',source_id:c.id});
    if(em.has(`DISTRIBUSI|KLOTER|${c.id}|KEBERANGKATAN`)&&!em.has(`DISTRIBUSI|KLOTER|${c.id}|KEMBALI`)) out.push({code:'DISTRIBUSI_BELUM_KEMBALI',team:'DISTRIBUSI',severity:'PENTING',title:`Kloter ${c.cluster_no} belum kembali`,detail:'Keberangkatan sudah dicatat tetapi Kembali ke SPPG belum dicatat.',source_type:'CLUSTER',source_id:c.id});
  }
  const [[issues]]=await pool.query("SELECT COUNT(*) total FROM operational_issues WHERE work_date=? AND status IN ('BARU','DITINDAKLANJUTI','MENUNGGU')",[date]);
  if(Number(issues.total)) out.push({code:'KENDALA_TERBUKA',team:null,severity:'KRITIS',title:`${issues.total} kendala masih terbuka`,detail:'Ada kendala yang belum selesai.',source_type:'ISSUES',source_id:null});
  const [[feedback]]=await pool.query("SELECT COUNT(*) total FROM operational_feedback WHERE work_date=? AND status IN ('BARU','DITINDAKLANJUTI','MENUNGGU')",[date]);
  if(Number(feedback.total)) out.push({code:'FEEDBACK_TERBUKA',team:null,severity:'PENTING',title:`${feedback.total} feedback masih terbuka`,detail:'Ada feedback yang belum selesai.',source_type:'FEEDBACK',source_id:null});
  const [pickup]=await pool.query("SELECT id,sequence_no FROM operational_pickup_clusters WHERE work_date=? AND status='AKTIF'",[date]);
  for(const p of pickup) out.push({code:'PICKUP_BELUM_CUCI',team:'PENCUCIAN',severity:'PENTING',title:`Kloter Pengambilan #${p.sequence_no} belum selesai dicuci`,detail:'KPM sudah diambil tetapi pencucian belum selesai.',source_type:'PICKUP_CLUSTER',source_id:p.id});
  return out;
}
app.get('/documentation/:mod/upload',auth,requirePermission('documentation.manage'),ar(async(req,res)=>{const map={menu:'MENU',pemorsian:'PEMORSIAN',distribusi:'DISTRIBUSI',pencucian:'PENCUCIAN'};const mod=String(req.params.mod||'').toLowerCase();if(!map[mod])return res.sendStatus(404);const date=/^\d{4}-\d{2}-\d{2}$/.test(clean(req.query.date))?clean(req.query.date):new Date().toISOString().slice(0,10);res.render('documentation/form',{title:'Tambah Dokumentasi',module:map[mod],date});}));
app.post('/documentation/upload',auth,requirePermission('documentation.manage'),upload.single('file'),ar(async(req,res)=>{try{if(!requireCsrf(req,res)){await removeUploaded(req.file);return}const module=clean(req.body.module).toUpperCase(),date=clean(req.body.documentation_date),title=clean(req.body.title)||null,description=clean(req.body.description)||null;if(!['MENU','PEMORSIAN','DISTRIBUSI','PENCUCIAN'].includes(module)||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)||!req.file||!(await verifyUploadedFile(req.file))) {await removeUploaded(req.file);throw new Error('Dokumentasi tidak valid.');}await assertDayWritable(req,date);const [r]=await pool.query('INSERT INTO documentation_records(documentation_date,module,title,description,file_path,original_name,mime_type,created_by) VALUES(?,?,?,?,?,?,?,?)',[date,module,title,description,req.file.filename,req.file.originalname,req.file.mimetype,req.session.user.id]);await log(req,'Upload Dokumentasi','DOCUMENTATION',r.insertId,title,null,{date,module,file:req.file.originalname});flash(req,'success','Dokumentasi berhasil disimpan.');res.redirect('/documentation/'+module.toLowerCase()+'?date='+encodeURIComponent(date));}catch(e){await removeUploaded(req.file);throw e}}));
app.get('/documentation/file/:id',auth,requirePermission('documentation.view'),ar(async(req,res)=>{const [[r]]=await pool.query('SELECT * FROM documentation_records WHERE id=?',[Number(req.params.id)]);if(!r)return res.sendStatus(404);const file=await resolveStoredFile(r.file_path);if(!file)return res.sendStatus(404);res.download(file,r.original_name||'dokumentasi');}));
app.get('/exceptions',auth,requirePermission('dashboard.view'),ar(async(req,res)=>{const date=/^\d{4}-\d{2}-\d{2}$/.test(clean(req.query.date))?clean(req.query.date):new Date().toISOString().slice(0,10);const fresh=await calculateExceptions(date);for(const x of fresh)await pool.query(`INSERT INTO exception_items(work_date,code,team,severity,title,detail,source_type,source_id,status) VALUES(?,?,?,?,?,?,?,?,'OPEN') ON DUPLICATE KEY UPDATE severity=VALUES(severity),title=VALUES(title),detail=VALUES(detail),status='OPEN'`,[date,x.code,x.team,x.severity,x.title,x.detail,x.source_type,x.source_id]);const [rows]=await pool.query('SELECT * FROM exception_items WHERE work_date=? ORDER BY FIELD(status,\'OPEN\',\'RESOLVED\'),FIELD(severity,\'KRITIS\',\'PENTING\',\'INFORMASI\'),created_at DESC',[date]);res.render('exceptions/index',{title:'Exception Engine',date,rows});}));
app.post('/exceptions/:id/resolve',auth,requirePermission('issues.manage'),ar(async(req,res)=>{if(!requireCsrf(req,res))return;await pool.query("UPDATE exception_items SET status='RESOLVED' WHERE id=?",[Number(req.params.id)]);await log(req,'Resolve Exception','EXCEPTION',Number(req.params.id),'Exception diselesaikan',null,{date:clean(req.body.date)});res.redirect('/exceptions?date='+encodeURIComponent(clean(req.body.date)));}));
app.get('/daily-closing',auth,requirePermission('dashboard.view'),ar(async(req,res)=>{const date=/^\d{4}-\d{2}-\d{2}$/.test(clean(req.query.date))?clean(req.query.date):new Date().toISOString().slice(0,10);const closing=await getClosing(date);const exceptions=await calculateExceptions(date);const checks=[{key:'issues',label:'Kendala terbuka',count:exceptions.filter(x=>x.code==='KENDALA_TERBUKA').length},{key:'feedback',label:'Feedback terbuka',count:exceptions.filter(x=>x.code==='FEEDBACK_TERBUKA').length},{key:'pickup',label:'Pengambilan belum selesai dicuci',count:exceptions.filter(x=>x.code==='PICKUP_BELUM_CUCI').length},{key:'work',label:'Pekerjaan operasional belum selesai',count:exceptions.filter(x=>x.code.includes('BELUM_SELESAI')||x.code.includes('BELUM_MULAI')).length}];res.render('daily-closing/index',{title:'Daily Closing',date,closing,checks,canManage:['ADMIN','ASLAP','KASP'].includes(req.session.user?.role)});}));
app.post('/daily-closing/close',auth,requirePermission('issues.manage'),ar(async(req,res)=>{if(!requireCsrf(req,res))return;const date=clean(req.body.date);const ex=await calculateExceptions(date);if(ex.length)throw new Error('Daily Closing ditolak karena masih ada kondisi yang perlu ditindaklanjuti. Buka Exception Engine terlebih dahulu.');await pool.query(`INSERT INTO daily_closings(work_date,status,closed_by,closed_at) VALUES(?,'CLOSED',?,CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE status='CLOSED',closed_by=VALUES(closed_by),closed_at=CURRENT_TIMESTAMP,reopened_by=NULL,reopened_at=NULL,reopen_reason=NULL`,[date,req.session.user.id]);await log(req,'Daily Closing','DAILY_CLOSING',0,date,null,{status:'CLOSED'});flash(req,'success','Daily Closing berhasil. Tanggal dikunci untuk user operasional.');res.redirect('/daily-closing?date='+encodeURIComponent(date));}));
app.post('/daily-closing/reopen',auth,requirePermission('issues.manage'),ar(async(req,res)=>{if(!requireCsrf(req,res))return;const date=clean(req.body.date),reason=clean(req.body.reason);if(reason.length<5)throw new Error('Alasan reopen wajib diisi.');await pool.query(`INSERT INTO daily_closings(work_date,status,reopened_by,reopened_at,reopen_reason) VALUES(?,'REOPENED',?,CURRENT_TIMESTAMP,?) ON DUPLICATE KEY UPDATE status='REOPENED',reopened_by=VALUES(reopened_by),reopened_at=CURRENT_TIMESTAMP,reopen_reason=VALUES(reopen_reason)`,[date,req.session.user.id,reason]);await log(req,'Reopen Daily Closing','DAILY_CLOSING',0,date,null,{status:'REOPENED',reason});flash(req,'success','Daily Closing dibuka kembali dengan alasan.');res.redirect('/daily-closing?date='+encodeURIComponent(date));}));

// Operational issues & feedback — lifecycle is explicit and auditable.
const issueCategories=['BAHAN','ALAT','SDM','KETERLAMBATAN','KEBERSIHAN','SOP','LISTRIK_AIR','LAINNYA'];
const issueImpacts=['TIDAK_BERDAMPAK','SEDIKIT_MENGHAMBAT','MENGHAMBAT_PEKERJAAN','MENGHENTIKAN_PEKERJAAN'];
const issuePriorities=['KRITIS','PENTING','INFORMASI'];
const issueStatuses=['BARU','DITINDAKLANJUTI','MENUNGGU','SELESAI','DITUTUP'];
const feedbackCategories=['SARAN','GOOD','IMPROVEMENT','SOP','EQUIPMENT','WORKFLOW','OTHER'];
app.get('/issues',auth,requirePermission('issues.view'),ar(async(req,res)=>{
  const status=clean(req.query.status),team=clean(req.query.team); const where=[],args=[];
  if(issueStatuses.includes(status)){where.push('i.status=?');args.push(status)} if(operationalTeams.includes(team)){where.push('i.team=?');args.push(team)}
  const [rows]=await pool.query(`SELECT i.*,u.name created_by_name,p.name pic_name FROM operational_issues i LEFT JOIN users u ON u.id=i.created_by LEFT JOIN users p ON p.id=i.pic_user_id ${where.length?'WHERE '+where.join(' AND '):''} ORDER BY FIELD(i.priority,'KRITIS','PENTING','INFORMASI'),i.created_at DESC`,args);
  const [users]=await pool.query("SELECT id,name,role FROM users WHERE role IN ('ADMIN','ASLAP','KASP') ORDER BY name");
  res.render('issues/index',{title:'Kendala Operasional',rows,users,status,team,issueStatuses,operationalTeams,issueCategories,issueImpacts,issuePriorities});
}));
app.get('/issues/new',auth,requirePermission('issues.manage'),ar(async(req,res)=>{
  const qteam=String(req.query.team||'').toUpperCase();
  const team=operationalTeams.includes(qteam)?qteam:'';
  const qdate=clean(req.query.date);
  const workDate=/^\d{4}-\d{2}-\d{2}$/.test(qdate)?qdate:new Date().toISOString().slice(0,10);
  const clusterId=Number(req.query.cluster_id)||null;
  res.render('issues/form',{title:'Laporkan Kendala',team,workDate,clusterId,issueCategories,issueImpacts,issuePriorities});
}));
app.post('/issues',auth,requirePermission('issues.manage'),ar(async(req,res)=>{
  if(!requireCsrf(req,res))return; const team=String(req.body.team||'').toUpperCase(),workDate=clean(req.body.work_date),category=clean(req.body.category),impact=clean(req.body.impact),priority=clean(req.body.priority),description=clean(req.body.description),clusterId=Number(req.body.cluster_id)||null,clusterKpmId=Number(req.body.cluster_kpm_id)||null;
  if(!operationalTeams.includes(team)||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(workDate)||!issueCategories.includes(category)||!issueImpacts.includes(impact)||!issuePriorities.includes(priority)||description.length<3)throw new Error('Data kendala tidak valid.');
  const [r]=await pool.query('INSERT INTO operational_issues(work_date,team,cluster_id,cluster_kpm_id,category,impact,priority,description,status,created_by,last_activity_at) VALUES(?,?,?,?,?,?,?,? ,\'BARU\',?,CURRENT_TIMESTAMP)',[workDate,team,clusterId,clusterKpmId,category,impact,priority,description,req.session.user.id]);
  await log(req,'Tambah','OPERATIONAL_ISSUE',r.insertId,description,null,{work_date:workDate,team,category,impact,priority,status:'BARU'}); flash(req,'success','Kendala berhasil dilaporkan.'); res.redirect('/issues');
}));
app.post('/issues/:id/status',auth,requirePermission('issues.manage'),ar(async(req,res)=>{
  if(!requireCsrf(req,res))return; const id=Number(req.params.id),status=clean(req.body.status),pic=Number(req.body.pic_user_id)||null,note=clean(req.body.resolution_note)||null; if(!issueStatuses.includes(status))throw new Error('Status kendala tidak valid.');
  const [[old]]=await pool.query('SELECT * FROM operational_issues WHERE id=?',[id]); if(!old)return res.sendStatus(404);
  await pool.query('UPDATE operational_issues SET status=?,pic_user_id=?,resolution_note=?,last_activity_at=CURRENT_TIMESTAMP WHERE id=?',[status,pic,note,id]);
  await log(req,'Status','OPERATIONAL_ISSUE',id,`Kendala ${old.status} → ${status}`,old,{status,pic_user_id:pic,resolution_note:note}); flash(req,'success','Status kendala diperbarui.'); res.redirect('/issues');
}));
app.get('/feedback',auth,requirePermission('feedback.view'),ar(async(req,res)=>{const [rows]=await pool.query('SELECT f.*,u.name created_by_name FROM operational_feedback f LEFT JOIN users u ON u.id=f.created_by ORDER BY f.created_at DESC');res.render('feedback/index',{title:'Feedback Operasional',rows,feedbackCategories,operationalTeams})}));
app.post('/feedback',auth,requirePermission('feedback.manage'),ar(async(req,res)=>{if(!requireCsrf(req,res))return;const team=String(req.body.team||'').toUpperCase(),category=clean(req.body.category),description=clean(req.body.description),workDate=clean(req.body.work_date)||new Date().toISOString().slice(0,10);if(!operationalTeams.includes(team)||!feedbackCategories.includes(category)||description.length<3)throw new Error('Data feedback tidak valid.');const [r]=await pool.query('INSERT INTO operational_feedback(work_date,team,cluster_id,cluster_kpm_id,category,description,created_by) VALUES(?,?,?,?,?,?,?)',[workDate,team,Number(req.body.cluster_id)||null,Number(req.body.cluster_kpm_id)||null,category,description,req.session.user.id]);await log(req,'Tambah','OPERATIONAL_FEEDBACK',r.insertId,description,null,{work_date:workDate,team,category});flash(req,'success','Feedback berhasil dikirim.');res.redirect('/feedback')}));

app.post('/feedback/:id/status',auth,requirePermission('feedback.manage'),ar(async(req,res)=>{if(!requireCsrf(req,res))return;const id=Number(req.params.id),status=clean(req.body.status),pic=Number(req.body.pic_user_id)||null,note=clean(req.body.followup_note)||null;if(!['BARU','DITINDAKLANJUTI','MENUNGGU','SELESAI','DITUTUP'].includes(status))throw new Error('Status feedback tidak valid.');const [[old]]=await pool.query('SELECT * FROM operational_feedback WHERE id=?',[id]);if(!old)return res.sendStatus(404);await pool.query('UPDATE operational_feedback SET status=?,pic_user_id=?,followup_note=? WHERE id=?',[status,pic,note,id]);await pool.query('INSERT INTO operational_feedback_updates(feedback_id,status,pic_user_id,note,actor_user_id) VALUES(?,?,?,?,?)',[id,status,pic,note,req.session.user.id]);await log(req,'Status Feedback','OPERATIONAL_FEEDBACK',id,`Feedback ${old.status||'BARU'} → ${status}`,old,{status,pic_user_id:pic,followup_note:note});flash(req,'success','Status feedback diperbarui.');res.redirect('/feedback');}));

// Team scope: operational roles can only view/execute their own team.
const roleTeamMap={PERSIAPAN:'PERSIAPAN',PENGOLAHAN:'PENGOLAHAN',PEMORSIAN:'PEMORSIAN',DISTRIBUSI:'DISTRIBUSI',PENCUCIAN:'PENCUCIAN'};
function assertTeamScope(req,team,execute=false){
  const role=String(req.session.user?.role||'');
  if(['ADMIN','ASLAP','KASP'].includes(role)) return true;
  if(roleTeamMap[role]!==team) throw new Error('Akses tim tidak sesuai dengan role pengguna.');
  return true;
}
async function assertTaskAssignment(req,{date,team,unitType,unitId}){
  const role=String(req.session.user?.role||'');
  if(['ADMIN','ASLAP','KASP'].includes(role)) return;
  const [rows]=await pool.query('SELECT user_id FROM operational_task_assignments WHERE work_date=? AND team=? AND unit_type=? AND unit_id=? AND is_active=1',[date,team,unitType,unitId]);
  if(rows.length && !rows.some(r=>Number(r.user_id)===Number(req.session.user.id))) throw new Error('Tugas ini ditugaskan kepada petugas lain.');
}
app.post('/work/assignment',auth,requirePermission('work.execute'),ar(async(req,res)=>{
  if(!requireCsrf(req,res))return;
  const team=String(req.body.team||'').toUpperCase(),unitType=String(req.body.unit_type||'').toUpperCase(),unitId=Number(req.body.unit_id),userId=Number(req.body.user_id),date=clean(req.body.work_date);
  if(!['ADMIN','ASLAP','KASP'].includes(String(req.session.user?.role||''))) throw new Error('Hanya Administrator, Aslap, atau KaSPPG yang dapat mengatur penugasan.');
  if(!teamConfig[team]||!['KLOTER','KPM'].includes(unitType)||!Number.isInteger(unitId)||unitId<1||!Number.isInteger(userId)||userId<1||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)) throw new Error('Penugasan tidak valid.');
  const [[u]]=await pool.query('SELECT id,role FROM users WHERE id=?',[userId]); if(!u)throw new Error('Petugas tidak ditemukan.');
  const roleTeam=roleTeamMap[String(u.role||'')]; if(roleTeam!==team && !['ADMIN','ASLAP','KASP'].includes(String(u.role||''))) throw new Error('Petugas bukan anggota role tim yang sesuai.');
  await assertDayWritable(req,date);
  await pool.query('UPDATE operational_task_assignments SET is_active=0,unassigned_at=CURRENT_TIMESTAMP WHERE work_date=? AND team=? AND unit_type=? AND unit_id=? AND user_id=? AND is_active=1',[date,team,unitType,unitId,userId]);
  await pool.query('INSERT INTO operational_task_assignments(work_date,team,unit_type,unit_id,user_id,assigned_by,notes) VALUES(?,?,?,?,?,?,?)',[date,team,unitType,unitId,userId,req.session.user.id,clean(req.body.notes)||null]);
  await log(req,'Assign Tugas','OPERATIONAL_TASK_ASSIGNMENT',unitId,`${team} ${unitType} ditugaskan`,null,{work_date:date,team,unit_type:unitType,unit_id:unitId,user_id:userId}); flash(req,'success','Penugasan berhasil disimpan.'); res.redirect('/work/'+team+'?date='+encodeURIComponent(date));
}));
app.post('/work/assignment/remove',auth,requirePermission('work.execute'),ar(async(req,res)=>{
  if(!requireCsrf(req,res))return; if(!['ADMIN','ASLAP','KASP'].includes(String(req.session.user?.role||'')))throw new Error('Tidak berwenang.'); const team=String(req.body.team||'').toUpperCase(),unitType=String(req.body.unit_type||'').toUpperCase(),unitId=Number(req.body.unit_id),userId=Number(req.body.user_id),date=clean(req.body.work_date); await assertDayWritable(req,date); await pool.query('UPDATE operational_task_assignments SET is_active=0,unassigned_at=CURRENT_TIMESTAMP WHERE work_date=? AND team=? AND unit_type=? AND unit_id=? AND user_id=? AND is_active=1',[date,team,unitType,unitId,userId]); await log(req,'Unassign Tugas','OPERATIONAL_TASK_ASSIGNMENT',unitId,'Penugasan dinonaktifkan',null,{work_date:date,team,unit_type:unitType,unit_id:unitId,user_id:userId}); flash(req,'success','Penugasan dinonaktifkan.'); res.redirect('/work/'+team+'?date='+encodeURIComponent(date));
}));

// Team work dashboards — one operational view per team, with full visibility for ADMIN/ASLAP/KASP.
const teamConfig={
  PERSIAPAN:{label:'Persiapan',icon:'package-check',unit:'KLOTER',primary:'MULAI',secondary:'SELESAI',startField:'prep_start',endField:'prep_end'},
  PENGOLAHAN:{label:'Pengolahan',icon:'chef-hat',unit:'KLOTER',primary:'MULAI',secondary:'SELESAI',startField:'processing_start',endField:'processing_end'},
  PEMORSIAN:{label:'Pemorsian',icon:'utensils',unit:'KLOTER',primary:'MULAI',secondary:'SELESAI',startField:'portioning_start',endField:'portioning_end'},
  DISTRIBUSI:{label:'Distribusi',icon:'truck',unit:'KLOTER',primary:'KEBERANGKATAN',secondary:'KEMBALI',startField:'departure_time',endField:'return_time'},
  PENCUCIAN:{label:'Pencucian',icon:'waves',unit:'KPM',primary:'MULAI_CUCI',secondary:'SELESAI_CUCI',startField:null,endField:null}
};
function latestTaskEvents(rows){const map=new Map();for(const r of rows){const k=`${r.team}|${r.unit_type}|${r.unit_id}|${r.action}`;if(!map.has(k))map.set(k,r)}return map}
function workStatusFor(team,unitType,unitId,eventMap){
  if(team==='PENCUCIAN') return eventMap.has(`${team}|${unitType}|${unitId}|SELESAI_CUCI`)?'SELESAI':eventMap.has(`${team}|${unitType}|${unitId}|MULAI_CUCI`)?'SEDANG':'BELUM';
  if(team==='DISTRIBUSI'&&unitType==='KPM') return eventMap.has(`${team}|${unitType}|${unitId}|PENGAMBILAN`)?'SELESAI':eventMap.has(`${team}|${unitType}|${unitId}|SERAH_TERIMA`)?'SEDANG':'BELUM';
  return eventMap.has(`${team}|${unitType}|${unitId}|SELESAI`)?'SELESAI':eventMap.has(`${team}|${unitType}|${unitId}|MULAI`)?'SEDANG':'BELUM';
}
app.get('/work/:team',auth,requirePermission('work.view'),ar(async(req,res)=>{
  const team=String(req.params.team||'').toUpperCase();const cfg=teamConfig[team];if(!cfg)return res.sendStatus(404);
  assertTeamScope(req,team);
  const date=/^\d{4}-\d{2}-\d{2}$/.test(clean(req.query.date))?clean(req.query.date):new Date().toISOString().slice(0,10);
  const [[teamRow]]=await pool.query('SELECT id,team_code,team_name FROM sppg_teams WHERE team_code=? AND is_active=1',[team]);
  const [teamAttendance]=teamRow?await pool.query(`SELECT s.id,s.name,s.position,ss.team_id,COALESCE(a.status,'BELUM_DIISI') status,a.check_in,a.check_out,a.note FROM staff_schedule ss JOIN staff s ON s.id=ss.staff_id LEFT JOIN staff_attendance a ON a.staff_id=s.id AND a.attendance_date=ss.schedule_date WHERE ss.schedule_date=? AND ss.team_id=? AND s.status='AKTIF' ORDER BY s.name`,[date,teamRow.id]):[[]];
  const attendanceSummary={BELUM_DIISI:teamAttendance.filter(x=>x.status==='BELUM_DIISI').length,HADIR:teamAttendance.filter(x=>x.status==='HADIR').length,LAIN:teamAttendance.filter(x=>['IZIN','SAKIT','ALPA','CUTI','DINAS'].includes(x.status)).length};
  const [[schedule]]=await pool.query(`SELECT ds.*,ms.menu_name menu_sp_name,mp.menu_name menu_pos_name FROM distribution_schedules ds LEFT JOIN menu_daily ms ON ms.id=ds.menu_sp_id LEFT JOIN menu_daily mp ON mp.id=ds.menu_pos_id WHERE ds.distribution_date=?`,[date]);
  let clusters=[];let kpmItems=[];
  if(schedule){
    const [crows]=await pool.query(`SELECT c.*,s.name driver_name,COUNT(ck.id) kpm_count,COALESCE(SUM(ck.small_portions),0) small_total,COALESCE(SUM(ck.large_portions),0) large_total,COALESCE(SUM(ck.small_portions+ck.large_portions),0) pm_total FROM distribution_clusters c LEFT JOIN staff s ON s.id=c.staff_id LEFT JOIN distribution_cluster_kpm ck ON ck.cluster_id=c.id WHERE c.schedule_id=? AND COALESCE(c.is_active,1)=1 GROUP BY c.id ORDER BY c.cluster_no`,[schedule.id]);
    clusters=crows;
    if(clusters.length){const ids=clusters.map(x=>x.id);[kpmItems]=await pool.query(`SELECT ck.*,k.code,k.name FROM distribution_cluster_kpm ck JOIN kpm k ON k.id=ck.kpm_id WHERE ck.cluster_id IN (${ids.map(()=>'?').join(',')}) ORDER BY ck.cluster_id,ck.sort_order,k.name`,ids);for(const c of clusters)c.kpm_items=kpmItems.filter(x=>Number(x.cluster_id)===Number(c.id));}
  }
  let pemEvidence=[];
  if(team==='PEMORSIAN' && clusters.length){const ids=clusters.map(x=>x.id);[pemEvidence]=await pool.query(`SELECT * FROM pemorsian_evidence WHERE work_date=? AND cluster_id IN (${ids.map(()=>'?').join(',')}) AND is_current=1 ORDER BY cluster_id,slot,id`,[date,...ids]);for(const c of clusters){c.pemEvidence=pemEvidence.filter(x=>Number(x.cluster_id)===Number(c.id));}}
  const [events]=await pool.query('SELECT * FROM operational_task_events WHERE work_date=? AND team=? ORDER BY created_at DESC,id DESC',[date,team]);
  const eventMap=latestTaskEvents(events);
  if(team==='PENCUCIAN'){
    const [pickupUnits]=await pool.query(`SELECT opc.id unit_id,opc.sequence_no,opc.source_cluster_id,opc.status pickup_status,ck.kpm_id,ck.pickup_time,k.code,k.name,opc.created_at pickup_created_at,c.cluster_no
      FROM operational_pickup_clusters opc JOIN distribution_cluster_kpm ck ON ck.id=opc.cluster_kpm_id JOIN kpm k ON k.id=ck.kpm_id
      JOIN distribution_clusters c ON c.id=opc.source_cluster_id WHERE opc.work_date=? ORDER BY opc.sequence_no`,[date]);
    const units=pickupUnits.map(u=>({cluster:{id:u.source_cluster_id,cluster_no:u.cluster_no},kpm:{id:u.kpm_id,code:u.code,name:u.name},unitType:'KPM',unitId:u.unit_id,status:workStatusFor(team,'KPM',u.unit_id,eventMap),pickup:u.pickup_time||new Date(u.pickup_created_at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}));
    return res.render('team-dashboard',{title:'Dashboard Pencucian',team,config:cfg,date,schedule,clusters,units,eventMap,events,teamAttendance,attendanceSummary,fullAccess:['ADMIN','ASLAP','KASP'].includes(req.session.user?.role)});
  }
  clusters.forEach(c=>c.status=workStatusFor(team,'KLOTER',c.id,eventMap));
  res.render('team-dashboard',{title:'Dashboard '+cfg.label,team,config:cfg,date,schedule,clusters,units:[],eventMap,events,teamAttendance,attendanceSummary,fullAccess:['ADMIN','ASLAP','KASP'].includes(req.session.user?.role)});
}));
for(const [key,cfg] of Object.entries(teamConfig)) app.get('/'+key.toLowerCase(),(req,res)=>res.redirect('/work/'+key));
app.post('/work/pemorsian/:clusterId/evidence',auth,requirePermission('work.execute'),upload.single('photo'),ar(async(req,res)=>{
  try{if(!requireCsrf(req,res)){await removeUploaded(req.file);return}const clusterId=Number(req.params.clusterId),slot=clean(req.body.slot).toUpperCase(),date=clean(req.body.work_date);const slots=['FOODTRAY_TERBUKA_KECIL','FOODTRAY_TERBUKA_BESAR','LABEL_KECIL','LABEL_BESAR','FOODTRAY_SEBELUM_DISTRIBUSI'];
    assertTeamScope(req,'PEMORSIAN',true); await assertTaskAssignment(req,{date,team:'PEMORSIAN',unitType:'KLOTER',unitId:clusterId}); await assertDayWritable(req,date);
    if(!Number.isInteger(clusterId)||!slots.includes(slot)||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)||!req.file||!(await verifyUploadedFile(req.file))){await removeUploaded(req.file);throw new Error('Evidence foto tidak valid.');}
    const [[cluster]]=await pool.query('SELECT id FROM distribution_clusters WHERE id=? AND COALESCE(is_active,1)=1',[clusterId]);if(!cluster){await removeUploaded(req.file);throw new Error('Kloter tidak ditemukan.');}
    const [[started]]=await pool.query("SELECT COUNT(*) total FROM operational_task_events WHERE work_date=? AND team='PEMORSIAN' AND unit_type='KLOTER' AND unit_id=? AND action='MULAI'",[date,clusterId]);if(!Number(started.total)){await removeUploaded(req.file);throw new Error('Pemorsian harus dimulai sebelum evidence diunggah.');}
    const [old]=await pool.query('SELECT * FROM pemorsian_evidence WHERE cluster_id=? AND work_date=? AND slot=? AND is_current=1 ORDER BY id DESC LIMIT 1',[clusterId,date,slot]);
    const [r]=await pool.query('INSERT INTO pemorsian_evidence(work_date,cluster_id,slot,file_path,original_name,mime_type,uploaded_by) VALUES(?,?,?,?,?,?,?)',[date,clusterId,slot,req.file.filename,req.file.originalname,req.file.mimetype,req.session.user.id]);
    if(old[0]){await pool.query('UPDATE pemorsian_evidence SET is_current=0,replaced_by=? WHERE id=?',[r.insertId,old[0].id]);}
    await log(req,old[0]?'Ganti Evidence Pemorsian':'Upload Evidence Pemorsian','PEMORSIAN_EVIDENCE',r.insertId,slot,old[0]||null,{cluster_id:clusterId,slot,file_path:req.file.filename});flash(req,'success',old[0]?'Evidence berhasil diganti dan histori lama dipertahankan.':'Evidence berhasil diunggah.');res.redirect('/work/PEMORSIAN?date='+encodeURIComponent(date));
  }catch(e){await removeUploaded(req.file);throw e}
}));

app.post('/work/action',auth,ar(async(req,res)=>{
  if(!requireCsrf(req,res))return;const team=String(req.body.team||'').toUpperCase();const unitType=String(req.body.unit_type||'').toUpperCase()==='KPM'?'KPM':'KLOTER';const unitId=Number(req.body.unit_id);const action=clean(req.body.action).toUpperCase();const date=/^\d{4}-\d{2}-\d{2}$/.test(clean(req.body.work_date))?clean(req.body.work_date):new Date().toISOString().slice(0,10);
  if(!teamConfig[team]||!Number.isInteger(unitId)||unitId<1)throw new Error('Tugas tidak valid.');
  assertTeamScope(req,team,true);
  await assertTaskAssignment(req,{date,team,unitType,unitId});
  await assertDayWritable(req,date);
  const allowed=team==='PENCUCIAN'?['MULAI_CUCI','SELESAI_CUCI']:team==='DISTRIBUSI'&&unitType==='KPM'?['SERAH_TERIMA','PENGAMBILAN']:team==='DISTRIBUSI'?['KEBERANGKATAN','KEMBALI']:['MULAI','SELESAI'];
  if(!allowed.includes(action))throw new Error('Aksi tugas tidak valid.');
  if(team==='PEMORSIAN' && unitType==='KLOTER'){
    const [[cluster]]=await pool.query('SELECT id FROM distribution_clusters WHERE id=? AND COALESCE(is_active,1)=1',[unitId]);
    if(!cluster)throw new Error('Kloter pemorsian tidak ditemukan atau sudah tidak aktif.');
    if(action==='SELESAI'){const [[cnt]]=await pool.query('SELECT COUNT(DISTINCT slot) total FROM pemorsian_evidence WHERE work_date=? AND cluster_id=? AND is_current=1',[date,unitId]);if(Number(cnt.total)!==5)throw new Error('Pemorsian belum dapat diselesaikan. Lengkapi 5 evidence foto terlebih dahulu.');}
    if(action==='MULAI'){const [[done]]=await pool.query("SELECT COUNT(*) total FROM operational_task_events WHERE work_date=? AND team='PEMORSIAN' AND unit_type='KLOTER' AND unit_id=? AND action='MULAI'",[date,unitId]);if(Number(done.total)>0)throw new Error('Pemorsian kloter ini sudah dimulai.');}
  }
  if(team==='DISTRIBUSI' && unitType==='KPM' && action==='PENGAMBILAN'){
    const [[ck]]=await pool.query(`SELECT ck.id,c.id cluster_id,c.schedule_id FROM distribution_cluster_kpm ck JOIN distribution_clusters c ON c.id=ck.cluster_id WHERE ck.id=? AND COALESCE(c.is_active,1)=1`,[unitId]);
    if(!ck)throw new Error('KPM dalam kloter tidak ditemukan.');
    const [[handover]]=await pool.query("SELECT COUNT(*) total FROM operational_task_events WHERE work_date=? AND team='DISTRIBUSI' AND unit_type='KPM' AND unit_id=? AND action='SERAH_TERIMA'",[date,unitId]);if(!Number(handover.total))throw new Error('Pengambilan hanya dapat dicatat setelah Serah Terima.');
    const [[already]]=await pool.query("SELECT COUNT(*) total FROM operational_task_events WHERE work_date=? AND team='DISTRIBUSI' AND unit_type='KPM' AND unit_id=? AND action='PENGAMBILAN'",[date,unitId]);if(Number(already.total)>0)throw new Error('Pengambilan KPM ini sudah dicatat.');
  }
  if(team==='PENCUCIAN' && unitType==='KPM'){
    const [[pu]]=await pool.query('SELECT * FROM operational_pickup_clusters WHERE id=? AND work_date=?',[unitId,date]);
    if(!pu)throw new Error('Kloter Pengambilan tidak ditemukan.');
    if(action==='MULAI_CUCI'){ const [[x]]=await pool.query("SELECT COUNT(*) total FROM operational_task_events WHERE work_date=? AND team='PENCUCIAN' AND unit_type='KPM' AND unit_id=? AND action='MULAI_CUCI'",[date,unitId]); if(Number(x.total)) throw new Error('Pencucian sudah dimulai.'); }
    if(action==='SELESAI_CUCI'){ const [[x]]=await pool.query("SELECT COUNT(*) total FROM operational_task_events WHERE work_date=? AND team='PENCUCIAN' AND unit_type='KPM' AND unit_id=? AND action='MULAI_CUCI'",[date,unitId]); if(!Number(x.total)) throw new Error('Pencucian harus dimulai terlebih dahulu.'); }
  }
  await pool.query('INSERT INTO operational_task_events(work_date,team,unit_type,unit_id,action,note,created_by) VALUES(?,?,?,?,?,?,?)',[date,team,unitType,unitId,action,clean(req.body.note)||null,req.session.user.id]);
  if(team==='DISTRIBUSI' && unitType==='KPM' && action==='PENGAMBILAN'){
    const [[ck]]=await pool.query(`SELECT ck.id cluster_id,ck.kpm_id,c.id source_cluster_id FROM distribution_cluster_kpm ck JOIN distribution_clusters c ON c.id=ck.cluster_id WHERE ck.id=?`,[unitId]);
    const [[seq]]=await pool.query('SELECT COALESCE(MAX(sequence_no),0)+1 next_no FROM operational_pickup_clusters WHERE work_date=? AND source_cluster_id=?',[date,ck.source_cluster_id]);
    await pool.query('INSERT INTO operational_pickup_events(work_date,source_cluster_id,cluster_kpm_id,event_type,created_by) VALUES(?,?,?,?,?)',[date,ck.source_cluster_id,unitId,'PENGAMBILAN',req.session.user.id]);
    await pool.query('INSERT INTO operational_pickup_clusters(work_date,source_cluster_id,cluster_kpm_id,sequence_no,created_by) VALUES(?,?,?,?,?)',[date,ck.source_cluster_id,unitId,seq.next_no,req.session.user.id]);
    await log(req,'Buat Kloter Pengambilan Otomatis','PICKUP_CLUSTER',unitId,`KPM ${ck.kpm_id} · urutan ${seq.next_no}`,null,{work_date:date,source_cluster_id:ck.source_cluster_id,cluster_kpm_id:unitId,sequence_no:seq.next_no});
  }
  if(team==='PENCUCIAN' && unitType==='KPM' && action==='SELESAI_CUCI') await pool.query("UPDATE operational_pickup_clusters SET status='SELESAI',completed_at=CURRENT_TIMESTAMP WHERE id=?",[unitId]);
  await log(req,'Konfirmasi Pekerjaan','OPERATIONAL_TASK',unitId,`${team} · ${unitType} · ${action}`,null,{work_date:date,team,unit_type:unitType,unit_id:unitId,action});
  flash(req,'success','Konfirmasi pekerjaan berhasil direkam.');res.redirect('/work/'+team+'?date='+encodeURIComponent(date));
}));
app.get('/reports',auth,requirePermission('reports.view'),ar(async(req,res)=>{const date=/^\d{4}-\d{2}-\d{2}$/.test(clean(req.query.date))?clean(req.query.date):new Date().toISOString().slice(0,10);const [[kpm]]=await pool.query("SELECT COUNT(*) total FROM kpm WHERE active=1");const [[clusters]]=await pool.query("SELECT COUNT(*) total FROM distribution_clusters c JOIN distribution_schedules s ON s.id=c.schedule_id WHERE s.distribution_date=? AND COALESCE(c.is_active,1)=1",[date]);const [[issues]]=await pool.query("SELECT COUNT(*) total FROM operational_issues WHERE work_date=?",[date]);const [[openIssues]]=await pool.query("SELECT COUNT(*) total FROM operational_issues WHERE work_date=? AND status IN ('BARU','DITINDAKLANJUTI','MENUNGGU')",[date]);const [[feedback]]=await pool.query("SELECT COUNT(*) total FROM operational_feedback WHERE work_date=?",[date]);const [[pickup]]=await pool.query("SELECT COUNT(*) total FROM operational_pickup_clusters WHERE work_date=?",[date]);const [[washed]]=await pool.query("SELECT COUNT(*) total FROM operational_pickup_clusters WHERE work_date=? AND status='SELESAI'",[date]);res.render('reports/index',{title:'Laporan',date,summary:{kpm:kpm.total,clusters:clusters.total,issues:issues.total,openIssues:openIssues.total,feedback:feedback.total,pickup:pickup.total,washed:washed.total}});}));
app.get('/roles',auth,requireAdmin,ar(async(req,res)=>{
  const [users]=await pool.query('SELECT id,username,email,name,role,created_at FROM users ORDER BY name,username');
  const [teams]=await pool.query('SELECT id,team_code,team_name,is_active FROM sppg_teams ORDER BY id');
  const [permissions]=await pool.query('SELECT * FROM permissions ORDER BY permission_key');
  const [rp]=await pool.query('SELECT role,permission_id FROM role_permissions ORDER BY role,permission_id');
  const matrix={}; for(const r of rp){if(!matrix[r.role])matrix[r.role]=new Set();matrix[r.role].add(Number(r.permission_id));}
  const [staffRows]=await pool.query(`SELECT id,name,position,status FROM staff WHERE status IN ('AKTIF','CUTI','NONAKTIF_SEMENTARA') ORDER BY name`);
  const [teamMembers]=await pool.query(`SELECT tm.id,tm.team_id,tm.user_id,tm.is_active,t.team_code,t.team_name,u.name user_name FROM team_members tm JOIN sppg_teams t ON t.id=tm.team_id JOIN users u ON u.id=tm.user_id ORDER BY t.id,u.name`);
  res.render('roles/index',{title:'Role Pengguna',users,teams,teamMembers,staffRows,permissions,matrix,roles:[...allowedRoles],permissionCatalog,operationalTeams});
}));
app.get('/roles/new',auth,requireAdmin,(req,res)=>res.render('roles/form',{title:'Tambah Pengguna',account:null,roles:[...allowedRoles]}));
app.post('/roles/user',auth,requireAdmin,ar(async(req,res)=>{if(!requireCsrf(req,res))return;const username=clean(req.body.username),email=clean(req.body.email)||null,name=clean(req.body.name),role=clean(req.body.role),password=String(req.body.password||'');if(!username||!name||!allowedRoles.has(role)||password.length<12)throw new Error('Data pengguna tidak valid. Password minimal 12 karakter.');const [dup]=await pool.query('SELECT id FROM users WHERE username=? OR (email IS NOT NULL AND email=?)',[username,email]);if(dup[0])throw new Error('Username atau email sudah digunakan.');const [r]=await pool.query('INSERT INTO users(username,email,password_hash,name,role) VALUES(?,?,?,?,?)',[username,email,await bcrypt.hash(password,12),name,role]);await log(req,'Tambah','USER',r.insertId,'Membuat pengguna baru',null,{username,email,name,role});flash(req,'success','Pengguna berhasil dibuat.');res.redirect('/roles')}));
app.post('/roles/user/:id',auth,requireAdmin,ar(async(req,res)=>{if(!requireCsrf(req,res))return;const id=Number(req.params.id);const [[old]]=await pool.query('SELECT id,username,email,name,role FROM users WHERE id=?',[id]);if(!old)return res.sendStatus(404);const name=clean(req.body.name),email=clean(req.body.email)||null,role=clean(req.body.role);if(!name||!allowedRoles.has(role))throw new Error('Data pengguna tidak valid.');if(id===req.session.user.id&&role!=='ADMIN')throw new Error('Akun yang sedang digunakan tidak boleh menurunkan role dirinya sendiri.');const [dup]=await pool.query('SELECT id FROM users WHERE (username=? OR (email IS NOT NULL AND email=?)) AND id<>?',[clean(req.body.username),email,id]);if(dup[0])throw new Error('Username atau email sudah digunakan.');const username=clean(req.body.username);await pool.query('UPDATE users SET username=?,email=?,name=?,role=? WHERE id=?',[username,email,name,role,id]);if(String(req.body.password||'')){if(String(req.body.password).length<12)throw new Error('Password minimal 12 karakter.');await pool.query('UPDATE users SET password_hash=? WHERE id=?',[await bcrypt.hash(String(req.body.password),12),id]);}if(id===req.session.user.id)req.session.user={...req.session.user,name,role,username};await log(req,'Edit','USER',id,'Memperbarui pengguna',old,{username,email,name,role,password_changed:!!String(req.body.password||'')});flash(req,'success','Pengguna berhasil diperbarui.');res.redirect('/roles')}));
app.post('/roles/user/:id/team',auth,requireAdmin,ar(async(req,res)=>{
  if(!requireCsrf(req,res))return;
  const userId=Number(req.params.id),teamId=Number(req.body.team_id);
  const [[user]]=await pool.query('SELECT id,name,role FROM users WHERE id=?',[userId]);
  const [[team]]=await pool.query('SELECT id,team_code,team_name FROM sppg_teams WHERE id=? AND is_active=1',[teamId]);
  if(!user||!team)throw new Error('Pengguna atau tim tidak valid.');
  if(!operationalTeams.includes(user.role)) throw new Error('Role pengguna harus merupakan role tim operasional.');
  if(user.role!==team.team_code) throw new Error(`Role ${user.role} tidak sesuai dengan tim ${team.team_code}.`);
  const [[existing]]=await pool.query('SELECT id,is_active FROM team_members WHERE team_id=? AND user_id=?',[teamId,userId]);
  if(existing) await pool.query('UPDATE team_members SET is_active=1,left_at=NULL,assigned_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',[req.session.user.id,existing.id]);
  else await pool.query('INSERT INTO team_members(team_id,user_id,assigned_by) VALUES(?,?,?)',[teamId,userId,req.session.user.id]);
  await log(req,'Tambah','TEAM_MEMBER',userId,'Menambahkan pengguna ke tim',{user_id:userId},{team_id:teamId,team_code:team.team_code});
  flash(req,'success',`${user.name} masuk ke tim ${team.team_name}.`);res.redirect('/roles');
}));
app.post('/roles/user/:id/staff',auth,requireAdmin,ar(async(req,res)=>{
  if(!requireCsrf(req,res))return;
  const userId=Number(req.params.id),staffId=Number(req.body.staff_id)||null;
  const [[user]]=await pool.query('SELECT id,name,staff_id FROM users WHERE id=?',[userId]);
  if(!user) return res.sendStatus(404);
  if(staffId){ const [[staff]]=await pool.query('SELECT id,name FROM staff WHERE id=?',[staffId]); if(!staff)throw new Error('Data staf tidak ditemukan.'); const [[dup]]=await pool.query('SELECT id,name FROM users WHERE staff_id=? AND id<>?',[staffId,userId]); if(dup)throw new Error(`Staf tersebut sudah terhubung ke akun ${dup.name}.`);}
  await pool.query('UPDATE users SET staff_id=? WHERE id=?',[staffId,userId]);
  await log(req,'Edit','USER',userId,'Menghubungkan akun dengan data staf',{staff_id:user.staff_id},{staff_id:staffId});
  flash(req,'success','Keterkaitan akun dan data staf diperbarui.');res.redirect('/roles');
}));
app.post('/roles/team-member/:id/remove',auth,requireAdmin,ar(async(req,res)=>{
  if(!requireCsrf(req,res))return; const id=Number(req.params.id); const [[old]]=await pool.query(`SELECT tm.*,t.team_code,t.team_name,u.name user_name FROM team_members tm JOIN sppg_teams t ON t.id=tm.team_id JOIN users u ON u.id=tm.user_id WHERE tm.id=?`,[id]); if(!old)return res.sendStatus(404); await pool.query('UPDATE team_members SET is_active=0,left_at=CURRENT_TIMESTAMP WHERE id=?',[id]); await log(req,'Edit','TEAM_MEMBER',old.user_id,'Menonaktifkan keanggotaan tim',old,{is_active:0}); flash(req,'success',`${old.user_name} dikeluarkan dari tim ${old.team_name}.`);res.redirect('/roles');
}));
app.post('/roles/permissions',auth,requireAdmin,ar(async(req,res)=>{if(!requireCsrf(req,res))return;const role=clean(req.body.role);if(!allowedRoles.has(role))throw new Error('Role tidak valid.');let keys=req.body.permissions||[];if(!Array.isArray(keys))keys=[keys];keys=keys.filter(k=>Object.prototype.hasOwnProperty.call(permissionCatalog,k));const conn=await pool.getConnection();try{await conn.beginTransaction();const [old]=await conn.query('SELECT p.permission_key FROM role_permissions rp JOIN permissions p ON p.id=rp.permission_id WHERE rp.role=?',[role]);await conn.query('DELETE FROM role_permissions WHERE role=?',[role]);for(const key of keys){const [[pr]]=await conn.query('SELECT id FROM permissions WHERE permission_key=?',[key]);if(pr)await conn.query('INSERT INTO role_permissions(role,permission_id) VALUES(?,?)',[role,pr.id]);}await conn.commit();await log(req,'Edit','ROLE_PERMISSION',null,'Memperbarui permission role',old,keys);flash(req,'success',`Permission role ${role} berhasil diperbarui.`);res.redirect('/roles')}catch(e){await conn.rollback();throw e}finally{conn.release()}}));

function validHex(v,fallback){const x=clean(v);return /^#[0-9a-fA-F]{6}$/.test(x)?x:fallback}
app.get('/settings',auth,requirePermission('settings.manage'),ar(async(req,res)=>{
  const [[settings]]=await pool.query('SELECT * FROM app_settings WHERE id=1');
  res.render('settings',{title:'Pengaturan',settings:{...defaultAppSettings,...settings}});
}));
app.post('/settings',auth,requirePermission('settings.manage'),upload.fields([
  {name:'logo',maxCount:1},{name:'opening_logo',maxCount:1},{name:'favicon',maxCount:1},{name:'login_logo',maxCount:1},{name:'portal_header',maxCount:1}
]),ar(async(req,res)=>{
  const uploaded=Object.values(req.files||{}).flat();
  let saved=false;
  try{
    if(!requireCsrf(req,res)){for(const f of uploaded)await removeUploaded(f);return}
    for(const f of uploaded)if(!(await verifyUploadedFile(f))){await removeUploaded(f);throw new Error('File logo tidak valid atau isi file tidak sesuai.');}
    const [[old]]=await pool.query('SELECT * FROM app_settings WHERE id=1');
    const size=(key,fallback,min,max)=>{const n=Number(req.body[key]);return Number.isInteger(n)&&n>=min&&n<=max?n:(old?.[key]??fallback)};
    const color=(key,fallback)=>validHex(req.body[key],old?.[key]||fallback);
    const data={
      app_name:clean(req.body.app_name)||'SPPG Monitoring',sppg_name:clean(req.body.sppg_name)||null,location_name:clean(req.body.location_name)||null,tagline:clean(req.body.tagline)||null,
      primary_color:color('primary_color',defaultAppSettings.primary_color),sidebar_color:color('sidebar_color',defaultAppSettings.sidebar_color),
      sidebar_title_color:color('sidebar_title_color',defaultAppSettings.sidebar_title_color),sidebar_subtitle_color:color('sidebar_subtitle_color',defaultAppSettings.sidebar_subtitle_color),sidebar_caption_color:color('sidebar_caption_color',defaultAppSettings.sidebar_caption_color),sidebar_menu_color:color('sidebar_menu_color',defaultAppSettings.sidebar_menu_color),sidebar_menu_hover_color:color('sidebar_menu_hover_color',defaultAppSettings.sidebar_menu_hover_color),sidebar_menu_active_color:color('sidebar_menu_active_color',defaultAppSettings.sidebar_menu_active_color),sidebar_section_color:color('sidebar_section_color',defaultAppSettings.sidebar_section_color),sidebar_icon_color:color('sidebar_icon_color',defaultAppSettings.sidebar_icon_color),sidebar_icon_active_color:color('sidebar_icon_active_color',defaultAppSettings.sidebar_icon_active_color),
      font_family:['Arial','Inter','Poppins','Roboto','Nunito'].includes(clean(req.body.font_family))?clean(req.body.font_family):(old?.font_family||defaultAppSettings.font_family),
      font_size_title:size('font_size_title',14,10,22),font_size_subtitle:size('font_size_subtitle',12,9,20),font_size_caption:size('font_size_caption',10,8,18),font_size_menu:size('font_size_menu',14,10,22),font_size_section:size('font_size_section',11,9,18),
      logo_path:old?.logo_path||null,logo_name:old?.logo_name||null,opening_logo_path:old?.opening_logo_path||null,opening_logo_name:old?.opening_logo_name||null,favicon_path:old?.favicon_path||null,favicon_name:old?.favicon_name||null,login_logo_path:old?.login_logo_path||null,login_logo_name:old?.login_logo_name||null,portal_header_path:old?.portal_header_path||null,portal_header_name:old?.portal_header_name||null
    };
    for(const key of ['logo','opening_logo','favicon','login_logo','portal_header']){const f=req.files?.[key]?.[0];if(f){data[key+'_path']=f.filename;data[key+'_name']=f.originalname;}}
    await pool.query(`UPDATE app_settings SET app_name=?,sppg_name=?,location_name=?,tagline=?,logo_path=?,logo_name=?,opening_logo_path=?,opening_logo_name=?,favicon_path=?,favicon_name=?,login_logo_path=?,login_logo_name=?,portal_header_path=?,portal_header_name=?,portal_dashboard_title=?,portal_dashboard_subtitle=?,primary_color=?,sidebar_color=?,sidebar_title_color=?,sidebar_subtitle_color=?,sidebar_caption_color=?,sidebar_menu_color=?,sidebar_menu_hover_color=?,sidebar_menu_active_color=?,sidebar_section_color=?,sidebar_icon_color=?,sidebar_icon_active_color=?,font_family=?,font_size_title=?,font_size_subtitle=?,font_size_caption=?,font_size_menu=?,font_size_section=?,updated_by=? WHERE id=1`,[data.app_name,data.sppg_name,data.location_name,data.tagline,data.logo_path,data.logo_name,data.opening_logo_path,data.opening_logo_name,data.favicon_path,data.favicon_name,data.login_logo_path,data.login_logo_name,data.portal_header_path,data.portal_header_name,String(req.body.portal_dashboard_title||'Pusat Data Penerima Manfaat').slice(0,200),String(req.body.portal_dashboard_subtitle||'Kelola dan perbarui data penerima manfaat KPM').slice(0,255),data.primary_color,data.sidebar_color,data.sidebar_title_color,data.sidebar_subtitle_color,data.sidebar_caption_color,data.sidebar_menu_color,data.sidebar_menu_hover_color,data.sidebar_menu_active_color,data.sidebar_section_color,data.sidebar_icon_color,data.sidebar_icon_active_color,data.font_family,data.font_size_title,data.font_size_subtitle,data.font_size_caption,data.font_size_menu,data.font_size_section,req.session.user?.id||null]);
    saved=true;appSettings={...defaultAppSettings,...data};
    for(const key of ['logo','opening_logo','favicon','login_logo','portal_header']){const f=req.files?.[key]?.[0];const oldPath=old?.[key+'_path'];if(f&&oldPath&&oldPath!==f.filename){const oldFile=await resolveStoredFile(oldPath);if(oldFile)await removeUploaded({path:oldFile});}}
    await log(req,'Edit','APP_SETTINGS',1,'Identitas, logo, warna, font, dan tampilan sistem',old,data);flash(req,'success','Pengaturan sistem berhasil disimpan.');res.redirect('/settings');
  }catch(e){if(!saved)for(const f of uploaded)await removeUploaded(f);throw e;}
}));
// Public branding assets: login/opening/favicon must be readable before authentication.
app.get('/branding/:type',ar(async(req,res)=>{
  const map={logo:'logo_path',opening_logo:'opening_logo_path',login_logo:'login_logo_path',portal_header:'portal_header_path',favicon:'favicon_path'};const field=map[req.params.type];
  const [[s]]=await pool.query('SELECT * FROM app_settings WHERE id=1');
  const defaultBgnFile=path.join(__dirname,'public','bgn-logo.png');
  if(!field||!s?.[field]){
    if(['logo','opening_logo','login_logo','favicon'].includes(req.params.type)){
      res.set('Content-Disposition','inline');
      return res.sendFile(defaultBgnFile);
    }
    return res.sendStatus(404);
  }
  const f=await resolveStoredFile(s[field]);
  if(!f){
    if(['logo','opening_logo','login_logo','favicon'].includes(req.params.type)){
      res.set('Content-Disposition','inline');
      return res.sendFile(defaultBgnFile);
    }
    return res.sendStatus(404);
  }
  res.set('Content-Disposition','inline');res.sendFile(f);
}));
app.get('/settings/file/:type',auth,ar(async(req,res)=>{
  const map={logo:'logo_path',favicon:'favicon_path',opening_logo:'opening_logo_path',login_logo:'login_logo_path'};const field=map[req.params.type];
  const [[s]]=await pool.query('SELECT * FROM app_settings WHERE id=1');
  const defaultBgnFile=path.join(__dirname,'public','bgn-logo.png');
  if(!field||!s?.[field]){
    res.set('Content-Disposition','inline');
    return res.sendFile(defaultBgnFile);
  }
  const f=await resolveStoredFile(s[field]);
  if(!f){
    res.set('Content-Disposition','inline');
    return res.sendFile(defaultBgnFile);
  }
  res.set('Content-Disposition','inline');res.sendFile(f);
}));
app.get('/account',auth,ar(async(req,res)=>{const [[account]]=await pool.query('SELECT id,username,email,name,role,created_at FROM users WHERE id=?',[req.session.user.id]);res.render('account',{title:'Profil Saya',account})}));
app.post('/account',auth,ar(async(req,res)=>{if(!requireCsrf(req,res))return;const name=clean(req.body.name),email=clean(req.body.email)||null;if(!name)throw new Error('Nama wajib diisi.');if(email&&!validEmail(email))throw new Error('Email tidak valid.');const [[old]]=await pool.query('SELECT * FROM users WHERE id=?',[req.session.user.id]);const [dup]=await pool.query('SELECT id FROM users WHERE email=? AND id<>?',[email,req.session.user.id]);if(email&&dup[0])throw new Error('Email sudah digunakan pengguna lain.');await pool.query('UPDATE users SET name=?,email=? WHERE id=?',[name,email,req.session.user.id]);req.session.user.name=name;await log(req,'Edit','USER',req.session.user.id,'Profil pengguna',old,{name,email});flash(req,'success','Profil pengguna diperbarui.');res.redirect('/account')}));
app.get('/profile',auth,requirePermission('profile.view'),ar(async(req,res)=>{const [[profile]]=await pool.query('SELECT * FROM sppg_profile WHERE id=1');res.render('profile',{title:'Profil SPPG',profile})}));
app.get('/profile/edit',auth,requirePermission('profile.manage'),ar(async(req,res)=>{const [[profile]]=await pool.query('SELECT * FROM sppg_profile WHERE id=1');res.render('profile-form',{title:'Edit Profil SPPG',profile})}));
app.post('/profile',auth,requirePermission('profile.manage'),ar(async(req,res)=>{const b=req.body;if(!['OPERASIONAL','NONOPERASIONAL'].includes(b.status))throw new Error('Status SPPG tidak valid.');if(!validNik(clean(b.foundation_chair_nik))||!validNik(clean(b.foundation_rep_nik))||!validNik(clean(b.kasp_nik)))throw new Error('NIK harus 16 digit jika diisi.');if(!validPhone(clean(b.foundation_chair_phone))||!validPhone(clean(b.foundation_rep_phone))||!validPhone(clean(b.kasp_phone)))throw new Error('Nomor HP/WhatsApp tidak valid.');const [[old]]=await pool.query('SELECT * FROM sppg_profile WHERE id=1');await pool.query(`UPDATE sppg_profile SET name=?,sppg_id=?,address=?,status=?,bank_name=?,va_number=?,va_name=?,foundation_name=?,foundation_id=?,foundation_address=?,foundation_chair_name=?,foundation_chair_nik=?,foundation_chair_phone=?,foundation_rep_name=?,foundation_rep_nik=?,foundation_rep_phone=?,kasp_name=?,kasp_skep_number=?,kasp_skep_date=?,kasp_nik=?,kasp_nip=?,kasp_phone=?,latitude=?,longitude=? WHERE id=1`,[clean(b.name),clean(b.sppg_id),clean(b.address),b.status,clean(b.bank_name),clean(b.va_number),clean(b.va_name),clean(b.foundation_name),clean(b.foundation_id),clean(b.foundation_address),clean(b.foundation_chair_name),clean(b.foundation_chair_nik),clean(b.foundation_chair_phone),clean(b.foundation_rep_name),clean(b.foundation_rep_nik),clean(b.foundation_rep_phone),clean(b.kasp_name),clean(b.kasp_skep_number),b.kasp_skep_date||null,clean(b.kasp_nik),clean(b.kasp_nip),clean(b.kasp_phone),b.latitude||null,b.longitude||null]);await log(req,'Edit','PROFILE',1,'Profil SPPG diperbarui',old,b);flash(req,'success','Profil SPPG diperbarui.');res.redirect('/profile')}));
app.post('/profile/document',auth,requirePermission('profile.manage'),upload.single('file'),ar(async(req,res)=>{try{if(!requireCsrf(req,res)){await removeUploaded(req.file);return}if(!req.file||!['BA_VERVAL','SKEP'].includes(req.body.doc_type)||!(await verifyUploadedFile(req.file))){await removeUploaded(req.file);flash(req,'error','Dokumen tidak valid atau isi file tidak sesuai.');return res.redirect('/profile')}const [[old]]=await pool.query('SELECT * FROM sppg_profile WHERE id=1');const field=req.body.doc_type==='BA_VERVAL'?['ba_verval_path','ba_verval_name']:['kasp_skep_path','kasp_skep_name'];const oldFile=old[field[0]];await pool.query(`UPDATE sppg_profile SET ${field[0]}=?,${field[1]}=? WHERE id=1`,[req.file.filename,req.file.originalname]);if(oldFile)await removeUploaded({path:path.join(uploadDir,path.basename(oldFile))});await log(req,'Upload Dokumen','PROFILE',1,req.body.doc_type,old,{file:req.file.originalname});flash(req,'success','Dokumen profil berhasil diunggah.');res.redirect('/profile')}catch(e){await removeUploaded(req.file);throw e}}));
app.get('/profile/document/:type',auth,ar(async(req,res)=>{const [[p]]=await pool.query('SELECT * FROM sppg_profile WHERE id=1');const f=req.params.type==='BA_VERVAL'?p.ba_verval_path:req.params.type==='SKEP'?p.kasp_skep_path:null;if(!f)return res.sendStatus(404);const file=await resolveStoredFile(f);if(!file)return res.sendStatus(404);res.set('Content-Disposition','inline');res.sendFile(file)}));
app.get('/search',auth,ar(async(req,res)=>{const q=clean(req.query.q);let staff=[],kpm=[],pm=[];if(q){const like=`%${q}%`;[staff,kpm,pm]=await Promise.all([pool.query('SELECT id,name,nik,position,status FROM staff WHERE name LIKE ? OR nik LIKE ? OR kpj_bpjstk LIKE ? ORDER BY name LIMIT 25',[like,like,like]).then(x=>x[0]),pool.query('SELECT id,code,name,type,education_level,active FROM kpm WHERE name LIKE ? OR code LIKE ? ORDER BY name LIMIT 25',[like,like]).then(x=>x[0]),pool.query('SELECT p.id,p.full_name,p.nik,p.nisn,p.category,p.kpm_id,k.name kpm_name FROM pm p JOIN kpm k ON k.id=p.kpm_id WHERE p.full_name LIKE ? OR p.nik LIKE ? OR p.nisn LIKE ? LIMIT 25',[like,like,like]).then(x=>x[0])])}res.render('search',{title:'Pencarian',q,staff,kpm,pm})}));

app.get('/backup',auth,requirePermission('backup.manage'),ar(async(req,res)=>{
  ensureStorage();
  const [[last]] = await pool.query("SELECT id,backup_type,filename,size_bytes,status,created_at,completed_at,notes FROM backup_runs ORDER BY id DESC LIMIT 1");
  const [[summary]] = await pool.query("SELECT COUNT(*) total,COALESCE(SUM(size_bytes),0) bytes FROM backup_runs WHERE status='SUCCESS'");
  const files=await listPersistentFiles(uploadDir);
  const dbTables=await getBackupTables();
  res.render('backup',{title:'Backup & Data',last,summary:{total:Number(summary.total||0),bytes:Number(summary.bytes||0)},storage:{files:files.length,bytes:files.reduce((n,x)=>n+Number(x.size_bytes||0),0)},dbTables:dbTables.length,backupDir});
}));
app.post('/backup/full',auth,ar(async(req,res)=>{
  if(!requireCsrf(req,res)) return;
  const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
  const provisional=`sppg-monitoring-full-backup-${stamp}.tar.gz`;
  const [ins]=await pool.query("INSERT INTO backup_runs(backup_type,filename,file_path,status,created_by) VALUES('FULL',?,?, 'RUNNING',?)",[provisional,path.join(backupDir,provisional),req.session.user.id]);
  try{
    const b=await buildFullBackup();
    const integrity=await verifyFullBackup(b.filePath);
    await pool.query("UPDATE backup_runs SET filename=?,file_path=?,size_bytes=?,sha256=?,status='SUCCESS',completed_at=CURRENT_TIMESTAMP,notes=? WHERE id=?",[b.filename,b.filePath,b.sizeBytes,integrity.sha256,'Database operasional + persistent files + templates; backup integrity verified.',ins.insertId]);
    await log(req,'Backup Penuh','SYSTEM',ins.insertId,'Membuat full backup SPPG Monitoring',null,{filename:b.filename,size_bytes:b.sizeBytes,file_count:b.manifest.file_count,table_count:b.manifest.database_tables.length});
    res.download(b.filePath,b.filename);
  }catch(e){
    await pool.query("UPDATE backup_runs SET status='FAILED',completed_at=CURRENT_TIMESTAMP,notes=? WHERE id=?",[e.code||e.message,ins.insertId]);
    console.error('[BACKUP_FULL_ERROR]',e); flash(req,'error','Full backup gagal dibuat. Data operasional tidak diubah.'); res.redirect('/backup');
  }
}));
app.post('/backup/verify/:id',auth,requirePermission('backup.manage'),ar(async(req,res)=>{
  if(!requireCsrf(req,res)) return;
  const [[b]]=await pool.query("SELECT * FROM backup_runs WHERE id=? AND status='SUCCESS'",[req.params.id]);
  if(!b)return res.sendStatus(404);
  try{
    const v=await verifyFullBackup(b.file_path);
    const ok=!b.sha256||String(b.sha256)===v.sha256;
    if(!ok)throw new Error('Checksum SHA-256 backup tidak cocok. File backup dianggap rusak/berubah.');
    await log(req,'Verifikasi Backup','SYSTEM',b.id,'Verifikasi integritas backup berhasil',null,v);
    flash(req,'success',`Backup valid. SHA-256 ${v.sha256.slice(0,16)}…; ${v.tableCount} tabel; ${v.fileCount} file.`);
  }catch(e){await log(req,'Verifikasi Backup Gagal','SYSTEM',b.id,e.message,null,{failed:true});flash(req,'error','Verifikasi backup gagal: '+e.message);}
  res.redirect('/backup');
}));

app.get('/backup/download/:id',auth,ar(async(req,res)=>{
  const [[b]]=await pool.query('SELECT * FROM backup_runs WHERE id=? AND status=\'SUCCESS\'',[req.params.id]);
  if(!b)return res.sendStatus(404); const f=path.resolve(b.file_path); const rel=path.relative(backupDir,f); if(rel.startsWith('..'+path.sep)||path.isAbsolute(rel)||!fs.existsSync(f))return res.sendStatus(404); res.download(f,b.filename);
}));

app.get('/activity',auth,requirePermission('activity.view'),ar(async(req,res)=>{const [rows]=await pool.query('SELECT a.*,u.name user_name FROM activity_log a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 200');res.render('activity',{title:'Aktivitas Sistem',rows})}));

// Modular Executive Command Center & Governance Router
const createExecutiveRouter = require('./routes/executive');
app.use('/executive', createExecutiveRouter({ pool, log, clean, requireCsrf, defaultAppSettings, XLSX }));

// Modular KPM Package Submissions Router
const createKpmPackageRouter = require('./routes/kpm-package');
app.use('/', createKpmPackageRouter({ pool, log, logPortal, clean, requireCsrf, defaultAppSettings, XLSX, flash }));

app.use((err,req,res,next)=>{
  console.error('[SPPG ERROR]',err);
  if(res.headersSent)return next(err);
  if(req.path==='/health')return res.status(503).json({status:'error',app:'SPPG Monitoring'});
  let msg='Terjadi kesalahan pada server.';
  if(err instanceof multer.MulterError)msg=err.code==='LIMIT_FILE_SIZE'?'Ukuran file terlalu besar.':'File upload tidak valid.';
  else if(['NIK sudah terdaftar.','Status SPPG tidak valid.','Nomor HP/WhatsApp tidak valid.','Tanggal distribusi tidak valid.','KPM distribusi tidak valid.','KPM tidak ditemukan atau tidak aktif.'].includes(err.message))msg=err.message;
  else if(err && err.message) msg = err.message;

  const isApi = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json')) || req.path.startsWith('/api/') || req.path.includes('/history');
  if(isApi){
    return res.status(err.status||500).json({success:false,error:msg});
  }
  try{
    flash(req,'error',msg);
    return res.redirect(req.get('Referrer')||'/');
  }catch{
    return res.status(500).send(msg);
  }
});

let server;
async function initialize(){
  try {
    await pool.query('SELECT 1');
  } catch (connErr) {
    if (pool && !pool.isMock) {
      console.warn('[AI Studio] Real DB unreachable (' + connErr.message + '), switching to in-memory mock.');
      pool = createMockPool({ defaultAppSettings, operationalTeams, permissionCatalog, defaultRolePermissions });
      sessionStore.pool = pool;
      sessionStore.ready = sessionStore.init();
    }
  }
  await sessionStore.ready;
  await migrate();
  const [[settingsRow]]=await pool.query('SELECT * FROM app_settings WHERE id=1');
  if(settingsRow) appSettings={...defaultAppSettings,...settingsRow};
  const username=String(process.env.ADMIN_USERNAME||'admin').trim();
  const envPw=String(process.env.ADMIN_PASSWORD||'').trim();
  const password=(envPw&&envPw!=='CHANGE_ME_TO_A_STRONG_PASSWORD')?envPw:'12345@';
  const [r]=await pool.query('SELECT id FROM users WHERE username=?',[username]);
  if(!r[0]) await pool.query('INSERT INTO users(username,password_hash,name,role) VALUES(?,?,?,?)',[username,await bcrypt.hash(password,12),'Administrator','ADMIN']);
  await sessionStore.prune();
  console.log('[SPPG] Database ready; schema migration checked.');
}
initPromise=initialize();
initPromise.then(()=>{
  server=app.listen(PORT,'0.0.0.0',()=>console.log('[SPPG] Monitoring v'+APP_VERSION+' running on '+PORT));
  server.on('error',e=>console.error('[SPPG] HTTP server error:',e));
}).catch(e=>{
  console.error('[SPPG] FATAL initialization:',e);
  process.exit(1);
});
setInterval(()=>sessionStore.prune().catch(e=>console.error('[SPPG] Session cleanup:',e.message)),60*60*1000).unref();
process.on('unhandledRejection',e=>console.error('[SPPG] Unhandled rejection:',e));
process.on('uncaughtException',async e=>{console.error('[SPPG] Uncaught exception:',e);try{if(server)server.close(()=>{});await pool.end()}finally{process.exit(1)}});
const shutdown=async()=>{if(server)server.close(()=>{});await pool.end();process.exit(0)};process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
