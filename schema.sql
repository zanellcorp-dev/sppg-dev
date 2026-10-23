-- SPPG Monitoring v1.8.36.4 - Hostinger safe schema
-- IMPORTANT: Select your target database in phpMyAdmin before importing this file.
-- No CREATE DATABASE / USE statements are included because Hostinger database users
-- normally do not have permission to create or switch databases.

CREATE TABLE IF NOT EXISTS users (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,username VARCHAR(100) NOT NULL UNIQUE,email VARCHAR(190) NULL UNIQUE,password_hash VARCHAR(255) NOT NULL,name VARCHAR(150) NOT NULL,role ENUM('ADMIN','ASLAP','KASP','PENGAWAS_GIZI','PENGAWAS_KEUANGAN','PERSIAPAN','PENGOLAHAN','PEMORSIAN','DISTRIBUSI','PENCUCIAN') NOT NULL DEFAULT 'ADMIN',staff_id INT UNSIGNED NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,UNIQUE KEY uq_users_staff_id(staff_id)) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS sppg_profile (id TINYINT UNSIGNED PRIMARY KEY DEFAULT 1,name VARCHAR(200),sppg_id VARCHAR(100),address TEXT,status ENUM('OPERASIONAL','NONOPERASIONAL') DEFAULT 'OPERASIONAL',ba_verval_path VARCHAR(500),ba_verval_name VARCHAR(255),bank_name VARCHAR(100),va_number VARCHAR(100),va_name VARCHAR(200),foundation_name VARCHAR(200),foundation_id VARCHAR(100),foundation_address TEXT,foundation_chair_name VARCHAR(150),foundation_chair_nik VARCHAR(16),foundation_chair_phone VARCHAR(30),foundation_rep_name VARCHAR(150),foundation_rep_nik VARCHAR(16),foundation_rep_phone VARCHAR(30),kasp_name VARCHAR(150),kasp_skep_number VARCHAR(150),kasp_skep_date DATE,kasp_skep_path VARCHAR(500),kasp_skep_name VARCHAR(255),kasp_nik VARCHAR(16),kasp_nip VARCHAR(50),kasp_phone VARCHAR(30),latitude DECIMAL(10,7),longitude DECIMAL(10,7),updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB;
INSERT IGNORE INTO sppg_profile(id,status) VALUES(1,'OPERASIONAL');
CREATE TABLE IF NOT EXISTS staff (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,name VARCHAR(150) NOT NULL,nik VARCHAR(16) NOT NULL UNIQUE,kpj_bpjstk VARCHAR(50),tanggal_masuk_bekerja DATE,birth_place VARCHAR(100),birth_date DATE,gender ENUM('L','P'),ktp_address TEXT,position ENUM('KaSPPG','Pengawas Gizi','Pengawas Keuangan','Asisten Lapangan','Chef','Tim Persiapan','Tim Pengolahan','Tim Pemorsian','Tim Distribusi','Kebersihan','Satpam') NOT NULL,marital_status ENUM('Lajang','Menikah','Janda/Duda'),phone VARCHAR(30),email VARCHAR(190),domicile_address TEXT,status ENUM('AKTIF','CUTI','NONAKTIF_SEMENTARA','MENGUNDURKAN_DIRI','MENINGGAL_DUNIA','DIBERHENTIKAN','KONTRAK_BERAKHIR','PINDAH_MUTASI') NOT NULL DEFAULT 'AKTIF',tanggal_keluar DATE,alasan_keluar TEXT,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS staff_documents (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,staff_id INT UNSIGNED NOT NULL,doc_type ENUM('E-KTP','NPWP','Pas Foto 4x6','Kartu Keluarga','Kesehatan','SKCK') NOT NULL,file_path VARCHAR(500) NOT NULL,original_name VARCHAR(255) NOT NULL,mime_type VARCHAR(100) NOT NULL,uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,UNIQUE KEY uq_staff_doc(staff_id,doc_type),CONSTRAINT fk_staff_doc_staff FOREIGN KEY(staff_id) REFERENCES staff(id) ON DELETE CASCADE) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS staff_education (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,staff_id INT UNSIGNED NOT NULL,level ENUM('SD/MI','SMP/MTs','SMA/SMK/MA','S1 (Strata I)') NOT NULL,institution VARCHAR(200),major VARCHAR(150),graduation_year SMALLINT,CONSTRAINT fk_staff_edu_staff FOREIGN KEY(staff_id) REFERENCES staff(id) ON DELETE CASCADE) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS staff_history (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,staff_id INT UNSIGNED NOT NULL,action_type VARCHAR(50) NOT NULL,old_status VARCHAR(50),new_status VARCHAR(50),description TEXT,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,CONSTRAINT fk_staff_history_staff FOREIGN KEY(staff_id) REFERENCES staff(id) ON DELETE CASCADE) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS kpm (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,code VARCHAR(30) NOT NULL UNIQUE,name VARCHAR(200) NOT NULL,type ENUM('SATUAN_PENDIDIKAN','POSYANDU') NOT NULL,education_level VARCHAR(120) NULL,address TEXT NOT NULL,npsn VARCHAR(30),head_name VARCHAR(150),head_phone VARCHAR(30),pic_name VARCHAR(150),pic_phone VARCHAR(30),cadre_name VARCHAR(150),cadre_phone VARCHAR(30),latitude DECIMAL(10,7),longitude DECIMAL(10,7),deactivated_at DATETIME NULL,deactivation_reason TEXT NULL,active TINYINT(1) DEFAULT 1,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS kpm_code_history (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,kpm_id INT UNSIGNED NOT NULL,old_code VARCHAR(30) NOT NULL,new_code VARCHAR(30) NOT NULL,reason VARCHAR(255) NULL,changed_by INT UNSIGNED NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,INDEX idx_kpm_code_hist_kpm(kpm_id,created_at),UNIQUE KEY uq_kpm_code_transition(old_code,new_code),CONSTRAINT fk_kpm_code_hist_kpm FOREIGN KEY(kpm_id) REFERENCES kpm(id) ON DELETE CASCADE,CONSTRAINT fk_kpm_code_hist_user FOREIGN KEY(changed_by) REFERENCES users(id) ON DELETE SET NULL) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS kpm_daily_data (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,kpm_id INT UNSIGNED NOT NULL,effective_from DATE NOT NULL,small_female INT UNSIGNED NOT NULL DEFAULT 0,small_male INT UNSIGNED NOT NULL DEFAULT 0,large_female INT UNSIGNED NOT NULL DEFAULT 0,large_male INT UNSIGNED NOT NULL DEFAULT 0,teacher_female INT UNSIGNED NOT NULL DEFAULT 0,teacher_male INT UNSIGNED NOT NULL DEFAULT 0,staff_female INT UNSIGNED NOT NULL DEFAULT 0,staff_male INT UNSIGNED NOT NULL DEFAULT 0,balita_female INT UNSIGNED NOT NULL DEFAULT 0,balita_male INT UNSIGNED NOT NULL DEFAULT 0,bumil INT UNSIGNED NOT NULL DEFAULT 0,busui INT UNSIGNED NOT NULL DEFAULT 0,created_by INT UNSIGNED NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,UNIQUE KEY uq_kpm_effective(kpm_id,effective_from),INDEX idx_kpm_effective(kpm_id,effective_from),CONSTRAINT fk_kpm_daily_kpm FOREIGN KEY(kpm_id) REFERENCES kpm(id) ON DELETE CASCADE,CONSTRAINT fk_kpm_daily_user FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS pm (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,kpm_id INT UNSIGNED NOT NULL,full_name VARCHAR(180) NOT NULL,nik VARCHAR(16),nisn VARCHAR(20),identity_number VARCHAR(50),category ENUM('PESERTA_DIDIK','PENDIDIK','TENAGA_KEPENDIDIKAN','BALITA','BUMIL','BUSUI') NOT NULL,gender ENUM('L','P'),class_group VARCHAR(50),birth_date DATE,phone VARCHAR(30),mother_name VARCHAR(180) NULL,address TEXT NULL,approval_status VARCHAR(30) NOT NULL DEFAULT 'AKTIF',deactivated_at DATETIME NULL,deactivation_reason TEXT NULL,active TINYINT(1) DEFAULT 1,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,INDEX idx_pm_kpm(kpm_id),CONSTRAINT fk_pm_kpm FOREIGN KEY(kpm_id) REFERENCES kpm(id) ON DELETE CASCADE) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS permissions (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,permission_key VARCHAR(100) NOT NULL UNIQUE,label VARCHAR(180) NOT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS role_permissions (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,role ENUM('ADMIN','ASLAP','KASP','PENGAWAS_GIZI','PENGAWAS_KEUANGAN','PERSIAPAN','PENGOLAHAN','PEMORSIAN','DISTRIBUSI','PENCUCIAN') NOT NULL,permission_id INT UNSIGNED NOT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,UNIQUE KEY uq_role_permission(role,permission_id),CONSTRAINT fk_role_perm_permission FOREIGN KEY(permission_id) REFERENCES permissions(id) ON DELETE CASCADE) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS activity_log (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,user_id INT UNSIGNED,action VARCHAR(100) NOT NULL,entity_type VARCHAR(50),entity_id BIGINT UNSIGNED,description TEXT,before_json LONGTEXT NULL,after_json LONGTEXT NULL,ip_address VARCHAR(100),user_agent VARCHAR(500),created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,INDEX idx_activity_date(created_at)) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS distribution (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,distribution_date DATE NOT NULL,kpm_id INT UNSIGNED NOT NULL,small_portions INT UNSIGNED DEFAULT 0,large_portions INT UNSIGNED DEFAULT 0,cluster_name VARCHAR(50),vehicle VARCHAR(100),driver_name VARCHAR(150),route_name VARCHAR(100),status ENUM('BELUM','BERJALAN','SELESAI','BERMASALAH') DEFAULT 'BELUM',notes TEXT,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,CONSTRAINT fk_distribution_kpm FOREIGN KEY(kpm_id) REFERENCES kpm(id)) ENGINE=InnoDB;

-- Persistent production session store for Node.js/Express.
CREATE TABLE IF NOT EXISTS sppg_sessions (sid VARCHAR(255) NOT NULL PRIMARY KEY,sess LONGTEXT NOT NULL,expires_at BIGINT NULL,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB;

-- v1.6 operational/admin modules
CREATE TABLE IF NOT EXISTS sppg_teams (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,team_code VARCHAR(30) NOT NULL UNIQUE,team_name VARCHAR(100) NOT NULL,is_active TINYINT(1) NOT NULL DEFAULT 1,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS team_members (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,team_id INT UNSIGNED NOT NULL,user_id INT UNSIGNED NOT NULL,is_active TINYINT(1) NOT NULL DEFAULT 1,joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,left_at DATETIME NULL,assigned_by INT UNSIGNED NULL,notes TEXT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,UNIQUE KEY uq_team_user(team_id,user_id),INDEX idx_team_members_team(team_id,is_active),INDEX idx_team_members_user(user_id,is_active),CONSTRAINT fk_team_member_team FOREIGN KEY(team_id) REFERENCES sppg_teams(id) ON DELETE CASCADE,CONSTRAINT fk_team_member_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,CONSTRAINT fk_team_member_assigned_by FOREIGN KEY(assigned_by) REFERENCES users(id) ON DELETE SET NULL) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS operational_task_assignments (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,work_date DATE NOT NULL,team ENUM('PERSIAPAN','PENGOLAHAN','PEMORSIAN','DISTRIBUSI','PENCUCIAN') NOT NULL,unit_type ENUM('KLOTER','KPM') NOT NULL,unit_id BIGINT UNSIGNED NOT NULL,user_id INT UNSIGNED NOT NULL,assigned_by INT UNSIGNED NULL,assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,unassigned_at DATETIME NULL,is_active TINYINT(1) NOT NULL DEFAULT 1,notes TEXT NULL,INDEX idx_task_assign(work_date,team,unit_type,unit_id,is_active),INDEX idx_task_assign_user(work_date,user_id,is_active),UNIQUE KEY uq_active_task_user(work_date,team,unit_type,unit_id,user_id,is_active),CONSTRAINT fk_task_assign_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,CONSTRAINT fk_task_assign_by FOREIGN KEY(assigned_by) REFERENCES users(id) ON DELETE SET NULL) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS staff_schedule (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 schedule_date DATE NOT NULL,
 staff_id INT UNSIGNED NOT NULL,
 team_id INT UNSIGNED NULL,
 shift_name VARCHAR(100),
 start_time TIME NULL,
 end_time TIME NULL,
 notes TEXT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 INDEX idx_staff_schedule_date(schedule_date),
 CONSTRAINT fk_staff_schedule_staff FOREIGN KEY(staff_id) REFERENCES staff(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS staff_attendance (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,attendance_date DATE NOT NULL,staff_id INT UNSIGNED NOT NULL,team_id INT UNSIGNED NULL,status ENUM('HADIR','IZIN','SAKIT','ALPA','CUTI','DINAS') NOT NULL DEFAULT 'HADIR',check_in TIME NULL,check_out TIME NULL,note TEXT NULL,created_by INT UNSIGNED NULL,updated_by INT UNSIGNED NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,UNIQUE KEY uq_attendance_date_staff(attendance_date,staff_id),INDEX idx_attendance_date_team(attendance_date,team_id),INDEX idx_attendance_staff(attendance_date,staff_id),CONSTRAINT fk_attendance_staff FOREIGN KEY(staff_id) REFERENCES staff(id) ON DELETE CASCADE,CONSTRAINT fk_attendance_team FOREIGN KEY(team_id) REFERENCES sppg_teams(id) ON DELETE SET NULL,CONSTRAINT fk_attendance_created FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL,CONSTRAINT fk_attendance_updated FOREIGN KEY(updated_by) REFERENCES users(id) ON DELETE SET NULL) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS attendance_replacements (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,replacement_date DATE NOT NULL,team_id INT UNSIGNED NULL,absent_staff_id INT UNSIGNED NOT NULL,replacement_staff_id INT UNSIGNED NOT NULL,task_scope VARCHAR(255) NULL,reason VARCHAR(255) NULL,note TEXT NULL,is_active TINYINT(1) NOT NULL DEFAULT 1,cancelled_by INT UNSIGNED NULL,cancelled_at DATETIME NULL,cancellation_reason VARCHAR(255) NULL,created_by INT UNSIGNED NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,INDEX idx_replacement_date(replacement_date,team_id),INDEX idx_replacement_absent(replacement_date,absent_staff_id),INDEX idx_replacement_staff(replacement_date,replacement_staff_id),CONSTRAINT fk_repl_team FOREIGN KEY(team_id) REFERENCES sppg_teams(id) ON DELETE SET NULL,CONSTRAINT fk_repl_absent FOREIGN KEY(absent_staff_id) REFERENCES staff(id) ON DELETE CASCADE,CONSTRAINT fk_repl_staff FOREIGN KEY(replacement_staff_id) REFERENCES staff(id) ON DELETE CASCADE,CONSTRAINT fk_repl_created FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS bgn_documents (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 title VARCHAR(255) NOT NULL,
 doc_type ENUM('JUKNIS','SURAT_EDARAN','SOP') NOT NULL,
 document_number VARCHAR(150) NULL,
 document_date DATE NULL,
 description TEXT NULL,
 file_path VARCHAR(500) NULL,
 original_name VARCHAR(255) NULL,
 file_name VARCHAR(255) NULL,
 active TINYINT(1) NOT NULL DEFAULT 1,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 INDEX idx_bgn_doc_type(doc_type), INDEX idx_bgn_doc_active(active)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS quick_links (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 title VARCHAR(180) NOT NULL,
 description TEXT NULL,
 url VARCHAR(1000) NOT NULL,
 icon VARCHAR(50) NULL,
 sort_order INT NOT NULL DEFAULT 0,
 active TINYINT(1) NOT NULL DEFAULT 1,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS menus (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 menu_code VARCHAR(40) NOT NULL UNIQUE,
 menu_name VARCHAR(200) NOT NULL,
 component_name VARCHAR(200) NULL,
 kpm_type ENUM('SATUAN_PENDIDIKAN','POSYANDU') NOT NULL,
 energy_small DECIMAL(10,2) NULL, protein_small DECIMAL(10,2) NULL, fat_small DECIMAL(10,2) NULL, carb_small DECIMAL(10,2) NULL, fiber_small DECIMAL(10,2) NULL,
 energy_large DECIMAL(10,2) NULL, protein_large DECIMAL(10,2) NULL, fat_large DECIMAL(10,2) NULL, carb_large DECIMAL(10,2) NULL, fiber_large DECIMAL(10,2) NULL,
 photo_small_path VARCHAR(500) NULL, photo_large_path VARCHAR(500) NULL,
 active TINYINT(1) NOT NULL DEFAULT 1,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 INDEX idx_menus_type(kpm_type), INDEX idx_menus_active(active)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS documentation_records (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 documentation_date DATE NOT NULL,
 module ENUM('MENU','PEMORSIAN','DISTRIBUSI','PENCUCIAN') NOT NULL,
 title VARCHAR(255) NULL,
 description TEXT NULL,
 file_path VARCHAR(500) NOT NULL,
 original_name VARCHAR(255) NOT NULL,
 mime_type VARCHAR(100) NOT NULL,
 created_by INT UNSIGNED NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 INDEX idx_doc_date_module(documentation_date,module),
 CONSTRAINT fk_doc_user FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS foodtray_templates (
 id TINYINT UNSIGNED PRIMARY KEY DEFAULT 1,
 title VARCHAR(200) NOT NULL DEFAULT 'Template Label Foodtray',
 description TEXT NULL,
 template_path VARCHAR(500) NULL,
 template_name VARCHAR(255) NULL,
 guide_text TEXT NULL,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;
INSERT IGNORE INTO foodtray_templates(id,title,guide_text) VALUES(1,'Template Label Foodtray','Template dan panduan label foodtray SPPG.');

CREATE TABLE IF NOT EXISTS app_settings (
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
  sidebar_title_color VARCHAR(20) NULL,
  sidebar_subtitle_color VARCHAR(20) NULL,
  sidebar_caption_color VARCHAR(20) NULL,
  sidebar_menu_color VARCHAR(20) NULL,
  sidebar_menu_hover_color VARCHAR(20) NULL,
  sidebar_menu_active_color VARCHAR(20) NULL,
  sidebar_section_color VARCHAR(20) NULL,
  sidebar_icon_color VARCHAR(20) NULL,
  sidebar_icon_active_color VARCHAR(20) NULL,
  font_family VARCHAR(40) NULL,
  font_size_title TINYINT UNSIGNED NULL,
  font_size_subtitle TINYINT UNSIGNED NULL,
  font_size_caption TINYINT UNSIGNED NULL,
  font_size_menu TINYINT UNSIGNED NULL,
  font_size_section TINYINT UNSIGNED NULL,
  updated_by INT UNSIGNED NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_app_settings_user FOREIGN KEY(updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;
INSERT IGNORE INTO app_settings(id,app_name,sppg_name,location_name,tagline,primary_color,sidebar_color) VALUES(1,'SPPG Monitoring','SPPG Subang Pusakajaya','Kebondanas','Satuan Pelayanan Pemenuhan Gizi','#007a5e','#0b2d61');


CREATE TABLE IF NOT EXISTS pemorsian_evidence (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 work_date DATE NOT NULL, cluster_id BIGINT UNSIGNED NOT NULL, slot ENUM('FOODTRAY_TERBUKA_KECIL','FOODTRAY_TERBUKA_BESAR','LABEL_KECIL','LABEL_BESAR','FOODTRAY_SEBELUM_DISTRIBUSI') NOT NULL,
 file_path VARCHAR(500) NOT NULL, original_name VARCHAR(255) NOT NULL, mime_type VARCHAR(100) NOT NULL,
 is_current TINYINT(1) NOT NULL DEFAULT 1, replaced_by BIGINT UNSIGNED NULL, uploaded_by INT UNSIGNED NULL, uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 INDEX idx_pem_ev_cluster(work_date,cluster_id,slot,is_current),
 CONSTRAINT fk_pem_ev_cluster FOREIGN KEY(cluster_id) REFERENCES distribution_clusters(id) ON DELETE RESTRICT,
 CONSTRAINT fk_pem_ev_user FOREIGN KEY(uploaded_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS operational_task_events (
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
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS operational_issues (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  work_date DATE NOT NULL,
  team VARCHAR(30) NOT NULL,
  cluster_id BIGINT UNSIGNED NULL,
  cluster_kpm_id BIGINT UNSIGNED NULL,
  category VARCHAR(40) NOT NULL,
  impact VARCHAR(40) NOT NULL DEFAULT 'TIDAK_BERDAMPAK',
  priority VARCHAR(20) NOT NULL DEFAULT 'INFORMASI',
  description TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'BARU',
  pic_user_id INT UNSIGNED NULL,
  resolution_note TEXT NULL,
  last_activity_at DATETIME NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_issue_date(work_date,team,status,created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS operational_feedback (
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
) ENGINE=InnoDB;


-- DATA KPM PM: source/submission layer, isolated from operational Master KPM/PM until explicit review + apply.
CREATE TABLE IF NOT EXISTS kpm_pm_submissions (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,kpm_id INT UNSIGNED NOT NULL,submission_type ENUM('MANUAL','EXCEL') NOT NULL DEFAULT 'MANUAL',effective_from DATE NOT NULL,status ENUM('DRAFT','DIAJUKAN','DITINJAU','DISETUJUI','DITOLAK','DITERAPKAN') NOT NULL DEFAULT 'DRAFT',submitted_by INT UNSIGNED NULL,reviewed_by INT UNSIGNED NULL,reviewed_at DATETIME NULL,review_note TEXT NULL,applied_at DATETIME NULL,applied_by INT UNSIGNED NULL,source_filename VARCHAR(255) NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,INDEX idx_kpm_pm_sub_status(status),INDEX idx_kpm_pm_sub_kpm(kpm_id,effective_from),CONSTRAINT fk_kpm_pm_sub_kpm FOREIGN KEY(kpm_id) REFERENCES kpm(id) ON DELETE RESTRICT,CONSTRAINT fk_kpm_pm_sub_submitter FOREIGN KEY(submitted_by) REFERENCES users(id) ON DELETE SET NULL,CONSTRAINT fk_kpm_pm_sub_reviewer FOREIGN KEY(reviewed_by) REFERENCES users(id) ON DELETE SET NULL,CONSTRAINT fk_kpm_pm_sub_applied FOREIGN KEY(applied_by) REFERENCES users(id) ON DELETE SET NULL) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS kpm_pm_submission_rows (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,submission_id BIGINT UNSIGNED NOT NULL,row_no INT UNSIGNED NOT NULL,pm_id INT UNSIGNED NULL,full_name VARCHAR(200) NOT NULL,nik VARCHAR(30) NULL,nisn VARCHAR(30) NULL,gender ENUM('L','P') NULL,class_group VARCHAR(80) NULL,category ENUM('PESERTA_DIDIK','PENDIDIK','TENAGA_KEPENDIDIKAN','BALITA','BUMIL','BUSUI') NULL,phone VARCHAR(30) NULL,address TEXT NULL,status ENUM('VALID','TIDAK_LENGKAP','DUPLIKAT','TIDAK_VALID') NOT NULL DEFAULT 'VALID',validation_note TEXT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,INDEX idx_kpm_pm_sub_rows_submission(submission_id),INDEX idx_kpm_pm_sub_rows_identity(nik,nisn),CONSTRAINT fk_kpm_pm_sub_rows_submission FOREIGN KEY(submission_id) REFERENCES kpm_pm_submissions(id) ON DELETE CASCADE,CONSTRAINT fk_kpm_pm_sub_rows_pm FOREIGN KEY(pm_id) REFERENCES pm(id) ON DELETE SET NULL) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS kpm_pm_submission_history (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,submission_id BIGINT UNSIGNED NOT NULL,action VARCHAR(40) NOT NULL,from_status VARCHAR(30) NULL,to_status VARCHAR(30) NULL,note TEXT NULL,actor_id INT UNSIGNED NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,INDEX idx_kpm_pm_sub_hist(submission_id,created_at),CONSTRAINT fk_kpm_pm_sub_hist_submission FOREIGN KEY(submission_id) REFERENCES kpm_pm_submissions(id) ON DELETE CASCADE,CONSTRAINT fk_kpm_pm_sub_hist_actor FOREIGN KEY(actor_id) REFERENCES users(id) ON DELETE SET NULL) ENGINE=InnoDB;

-- PM effective-date history and KPM portal access
CREATE TABLE IF NOT EXISTS pm_change_history (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,pm_id INT UNSIGNED NOT NULL,effective_from DATE NOT NULL,action ENUM('CREATE','UPDATE','DEACTIVATE','REACTIVATE') NOT NULL,before_data JSON NULL,after_data JSON NULL,reason VARCHAR(255) NULL,actor_id INT UNSIGNED NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,INDEX idx_pm_hist(pm_id,effective_from,created_at),CONSTRAINT fk_pm_hist_pm FOREIGN KEY(pm_id) REFERENCES pm(id) ON DELETE RESTRICT,CONSTRAINT fk_pm_hist_user FOREIGN KEY(actor_id) REFERENCES users(id) ON DELETE SET NULL) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS kpm_portal_tokens (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,kpm_id INT UNSIGNED NOT NULL,token_hash CHAR(64) NOT NULL UNIQUE,expires_at DATETIME NULL,active TINYINT(1) NOT NULL DEFAULT 1,last_used_at DATETIME NULL,created_by INT UNSIGNED NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,INDEX idx_kpm_portal_token_kpm(kpm_id,active),CONSTRAINT fk_kpm_portal_kpm FOREIGN KEY(kpm_id) REFERENCES kpm(id) ON DELETE CASCADE,CONSTRAINT fk_kpm_portal_user FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL) ENGINE=InnoDB;

-- v1.8.36.4 — automatic actual pickup clusters for progressive washing
CREATE TABLE IF NOT EXISTS operational_pickup_clusters (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  work_date DATE NOT NULL,
  source_cluster_id BIGINT UNSIGNED NOT NULL,
  cluster_kpm_id BIGINT UNSIGNED NOT NULL,
  sequence_no INT UNSIGNED NOT NULL,
  status ENUM('AKTIF','SELESAI') NOT NULL DEFAULT 'AKTIF',
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME NULL,
  UNIQUE KEY uq_pickup_sequence(source_cluster_id,sequence_no),
  UNIQUE KEY uq_pickup_kpm(work_date,cluster_kpm_id),
  INDEX idx_pickup_wash(work_date,status),
  CONSTRAINT fk_opc_source FOREIGN KEY(source_cluster_id) REFERENCES distribution_clusters(id) ON DELETE RESTRICT,
  CONSTRAINT fk_opc_ck FOREIGN KEY(cluster_kpm_id) REFERENCES distribution_cluster_kpm(id) ON DELETE RESTRICT,
  CONSTRAINT fk_opc_user FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;


-- v1.8.36.4 distribution snapshot: frozen historical copy of planned schedule/cluster/KPM.
CREATE TABLE IF NOT EXISTS distribution_snapshots (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 schedule_id BIGINT UNSIGNED NOT NULL,
 snapshot_date DATE NOT NULL,
 status ENUM('LOCKED','CANCELLED') NOT NULL DEFAULT 'LOCKED',
 created_by INT UNSIGNED NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uq_snapshot_schedule(schedule_id), INDEX idx_snapshot_date(snapshot_date),
 CONSTRAINT fk_snapshot_schedule FOREIGN KEY(schedule_id) REFERENCES distribution_schedules(id) ON DELETE RESTRICT,
 CONSTRAINT fk_snapshot_user FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS distribution_snapshot_clusters (
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
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS distribution_snapshot_kpm (
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
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS daily_closings (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,work_date DATE NOT NULL UNIQUE,status ENUM('OPEN','CLOSED','REOPENED') NOT NULL DEFAULT 'OPEN',closed_by INT UNSIGNED NULL,closed_at DATETIME NULL,reopened_by INT UNSIGNED NULL,reopened_at DATETIME NULL,reopen_reason TEXT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS exception_items (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,work_date DATE NOT NULL,code VARCHAR(80) NOT NULL,team VARCHAR(50) NULL,severity ENUM('KRITIS','PENTING','INFORMASI') NOT NULL DEFAULT 'PENTING',title VARCHAR(255) NOT NULL,detail TEXT NULL,source_type VARCHAR(80) NULL,source_id BIGINT UNSIGNED NULL,status ENUM('OPEN','RESOLVED') NOT NULL DEFAULT 'OPEN',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,UNIQUE KEY uq_exception(work_date,code,source_type,source_id),INDEX idx_exception_date(work_date,status,severity)) ENGINE=InnoDB;
ALTER TABLE operational_feedback ADD COLUMN IF NOT EXISTS status ENUM('BARU','DITINDAKLANJUTI','MENUNGGU','SELESAI','DITUTUP') NOT NULL DEFAULT 'BARU';
ALTER TABLE operational_feedback ADD COLUMN IF NOT EXISTS pic_user_id INT UNSIGNED NULL;
ALTER TABLE operational_feedback ADD COLUMN IF NOT EXISTS followup_note TEXT NULL;
ALTER TABLE operational_feedback ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- v1.8.36.4 backup integrity
CREATE TABLE IF NOT EXISTS backup_runs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  backup_type VARCHAR(40) NOT NULL,
  filename VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  size_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
  sha256 CHAR(64) NULL,
  status ENUM('RUNNING','SUCCESS','FAILED') NOT NULL DEFAULT 'RUNNING',
  notes TEXT NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  INDEX idx_backup_created(created_at)
) ENGINE=InnoDB;


-- KPM Portal: Surat Pernyataan
CREATE TABLE IF NOT EXISTS kpm_portal_statements (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,kpm_id INT UNSIGNED NOT NULL,statement_type VARCHAR(50) NOT NULL DEFAULT 'SURAT_PERNYATAAN',file_path VARCHAR(500) NOT NULL,original_name VARCHAR(255) NOT NULL,mime_type VARCHAR(100) NOT NULL,file_size BIGINT UNSIGNED NOT NULL DEFAULT 0,uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,uploaded_by_user INT UNSIGNED NULL,portal_token_id BIGINT UNSIGNED NULL,is_current TINYINT(1) NOT NULL DEFAULT 1,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,INDEX idx_kpm_statement_kpm(kpm_id,is_current,uploaded_at),CONSTRAINT fk_kpm_statement_kpm FOREIGN KEY(kpm_id) REFERENCES kpm(id) ON DELETE RESTRICT,CONSTRAINT fk_kpm_statement_user FOREIGN KEY(uploaded_by_user) REFERENCES users(id) ON DELETE SET NULL) ENGINE=InnoDB;

-- KPM Portal: Pengajuan Perbaikan Identitas KPM
CREATE TABLE IF NOT EXISTS kpm_portal_profile_submissions (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,kpm_id INT UNSIGNED NOT NULL,status ENUM('DIAJUKAN','DITINJAU','DISETUJUI','DITOLAK','DITERAPKAN') NOT NULL DEFAULT 'DIAJUKAN',before_data LONGTEXT NULL,after_data LONGTEXT NOT NULL,submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,reviewed_by INT UNSIGNED NULL,reviewed_at DATETIME NULL,review_note TEXT NULL,applied_by INT UNSIGNED NULL,applied_at DATETIME NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,INDEX idx_kpm_profile_sub_kpm(kpm_id,status,created_at),CONSTRAINT fk_kpm_profile_sub_kpm FOREIGN KEY(kpm_id) REFERENCES kpm(id) ON DELETE RESTRICT,CONSTRAINT fk_kpm_profile_sub_reviewer FOREIGN KEY(reviewed_by) REFERENCES users(id) ON DELETE SET NULL,CONSTRAINT fk_kpm_profile_sub_applier FOREIGN KEY(applied_by) REFERENCES users(id) ON DELETE SET NULL) ENGINE=InnoDB;
