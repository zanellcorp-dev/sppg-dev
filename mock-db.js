const bcrypt = require('bcryptjs');

function createMockPool(opts = {}) {
  const {
    defaultAppSettings = {
      app_name: 'SPPG Monitoring',
      sppg_name: 'SPPG Subang Pusakajaya',
      location_name: 'Kebondanas',
      tagline: 'Satuan Pelayanan Pemenuhan Gizi',
      primary_color: '#007a5e',
      sidebar_color: '#0b2d61'
    },
    operationalTeams = ['PERSIAPAN', 'PENGOLAHAN', 'PEMORSIAN', 'DISTRIBUSI', 'PENCUCIAN'],
    permissionCatalog = {},
    defaultRolePermissions = {}
  } = opts;

  // In-memory tables
  const tables = {
    users: [],
    sppg_profile: [
      {
        id: 1,
        name: 'SPPG Subang Pusakajaya',
        sppg_id: 'SPPG-001',
        address: 'Kebondanas, Pusakajaya, Subang, Jawa Barat',
        status: 'OPERASIONAL',
        latitude: -6.321,
        longitude: 107.821,
        bank_name: 'Bank BNI',
        va_number: '9880012345678901',
        va_name: 'SPPG PUSAKAJAYA',
        kasp_name: 'Ahmad Fauzi',
        kasp_nik: '3213010101900001',
        kasp_phone: '081234567890',
        foundation_name: 'Yayasan Gizi Bangsa Mandiri',
        foundation_id: 'YGBM-2024-001',
        updated_at: new Date()
      }
    ],
    app_settings: [
      {
        id: 1,
        ...defaultAppSettings
      }
    ],
    permissions: [],
    role_permissions: [],
    sppg_teams: operationalTeams.map((code, idx) => ({
      id: idx + 1,
      team_code: code,
      team_name: code.charAt(0) + code.slice(1).toLowerCase(),
      is_active: 1,
      created_at: new Date()
    })),
    team_members: [],
    staff: [
      {
        id: 1,
        name: 'Ahmad Fauzi',
        nik: '3213010101900001',
        kpj_bpjstk: '19000012345',
        tanggal_masuk_bekerja: '2024-01-02',
        birth_place: 'Subang',
        birth_date: '1990-05-15',
        gender: 'L',
        ktp_address: 'Jl. Raya Kebondanas No. 12, Pusakajaya, Subang',
        position: 'KaSPPG',
        marital_status: 'Menikah',
        phone: '081234567890',
        email: 'ahmad.fauzi@sppg.local',
        domicile_address: 'Jl. Raya Kebondanas No. 12, Subang',
        status: 'AKTIF',
        created_at: new Date()
      },
      {
        id: 2,
        name: 'Siti Rahayu, S.Gz',
        nik: '3213010202920002',
        kpj_bpjstk: '19000012346',
        tanggal_masuk_bekerja: '2024-01-02',
        birth_place: 'Bandung',
        birth_date: '1992-08-20',
        gender: 'P',
        ktp_address: 'Dusun Sukamaju RT 03/01, Pusakajaya, Subang',
        position: 'Pengawas Gizi',
        marital_status: 'Menikah',
        phone: '081298765432',
        email: 'siti.rahayu@sppg.local',
        domicile_address: 'Dusun Sukamaju RT 03/01, Subang',
        status: 'AKTIF',
        created_at: new Date()
      }
    ],
    staff_documents: [],
    staff_education: [
      { id: 1, staff_id: 1, level: 'S1 (Strata I)', institution: 'Universitas Indonesia', major: 'Manajemen', graduation_year: 2012 },
      { id: 2, staff_id: 2, level: 'S1 (Strata I)', institution: 'Institut Pertanian Bogor', major: 'Ilmu Gizi', graduation_year: 2014 }
    ],
    staff_history: [],
    staff_schedule: [],
    staff_attendance: [],
    kpm: [
      {
        id: 1,
        code: 'KPM-SP-001',
        name: 'SD Negeri Kebondanas 01',
        type: 'SATUAN_PENDIDIKAN',
        education_level: 'SD',
        address: 'Jl. Raya Kebondanas No. 45, Pusakajaya, Subang',
        npsn: '20233451',
        head_name: 'Drs. H. Mulyadi, M.Pd',
        head_phone: '08123456001',
        pic_name: 'Budi Santoso, S.Pd',
        pic_phone: '08123456002',
        latitude: -6.3225,
        longitude: 107.8220,
        active: 1,
        kpm_status: 'AKTIF',
        created_at: new Date()
      },
      {
        id: 2,
        code: 'KPM-POS-001',
        name: 'Posyandu Melati 01',
        type: 'POSYANDU',
        education_level: null,
        address: 'Dusun Sukamaju RT 02/01, Pusakajaya, Subang',
        npsn: null,
        cadre_name: 'Ibu Ningsih',
        cadre_phone: '08139876001',
        email: 'posyandu.melati01@gmail.com',
        latitude: -6.3240,
        longitude: 107.8245,
        active: 1,
        kpm_status: 'AKTIF',
        created_at: new Date()
      },
      {
        id: 3,
        code: 'KPM-POS-002',
        name: 'Posyandu Melati 02',
        type: 'POSYANDU',
        education_level: null,
        address: 'Dusun Sukamaju RT 05/02, Pusakajaya, Subang',
        npsn: null,
        cadre_name: 'Ibu Rosmalia',
        cadre_phone: '08139876002',
        email: 'posyandu.melati02@gmail.com',
        latitude: -6.3265,
        longitude: 107.8260,
        active: 1,
        kpm_status: 'AKTIF',
        created_at: new Date()
      }
    ],
    kpm_code_history: [],
    kpm_daily_data: [
      {
        id: 1,
        kpm_id: 1,
        effective_from: '2024-01-01',
        small_female: 120,
        small_male: 110,
        large_female: 130,
        large_male: 125,
        teacher_female: 14,
        teacher_male: 6,
        staff_female: 4,
        staff_male: 2,
        balita_female: 0,
        balita_male: 0,
        bumil: 0,
        busui: 0
      },
      {
        id: 2,
        kpm_id: 2,
        effective_from: '2024-01-01',
        small_female: 0,
        small_male: 0,
        large_female: 0,
        large_male: 0,
        teacher_female: 0,
        teacher_male: 0,
        staff_female: 0,
        staff_male: 0,
        balita_female: 45,
        balita_male: 40,
        bumil: 12,
        busui: 15
      },
      {
        id: 3,
        kpm_id: 3,
        effective_from: '2024-01-01',
        small_female: 0,
        small_male: 0,
        large_female: 0,
        large_male: 0,
        teacher_female: 0,
        teacher_male: 0,
        staff_female: 0,
        staff_male: 0,
        balita_female: 25,
        balita_male: 20,
        bumil: 6,
        busui: 8
      }
    ],
    pm: [
      // KPM 1: SD Negeri Kebondanas 01 (Satuan Pendidikan)
      { id: 1, kpm_id: 1, full_name: 'Aditya Pratama', nik: '3213011505160001', nisn: '0165432101', category: 'PESERTA_DIDIK', gender: 'L', class_group: 'Kelas 1', active: 1, approval_status: 'AKTIF', created_at: new Date('2024-01-10') },
      { id: 2, kpm_id: 1, full_name: 'Annisa Fitriani', nik: '3213015508160002', nisn: '0165432102', category: 'PESERTA_DIDIK', gender: 'P', class_group: 'Kelas 1', active: 1, approval_status: 'AKTIF', created_at: new Date('2024-01-10') },
      { id: 3, kpm_id: 1, full_name: 'Budi Santoso, S.Pd', nik: '3213011002850003', nisn: null, category: 'PENDIDIK', gender: 'L', class_group: 'Guru Kelas', active: 1, approval_status: 'AKTIF', created_at: new Date('2024-01-10') },
      { id: 4, kpm_id: 1, full_name: 'Siti Rahmawati, S.Pd', nik: '3213014804880004', nisn: null, category: 'PENDIDIK', gender: 'P', class_group: 'Guru Olahraga', active: 1, approval_status: 'AKTIF', created_at: new Date('2024-01-10') },
      { id: 5, kpm_id: 1, full_name: 'Slamet Riyadi', nik: '3213012010830005', nisn: null, category: 'TENAGA_KEPENDIDIKAN', gender: 'L', class_group: 'Tenaga Administrasi', active: 1, approval_status: 'AKTIF', created_at: new Date('2024-01-10') },

      // KPM 2: Posyandu Melati 01 (Balita, Bumil, Busui)
      { id: 6, kpm_id: 2, full_name: 'Kenzo Alfarizi', nik: '3213012201230004', nisn: null, category: 'BALITA', gender: 'L', class_group: '6-23 Bulan (Baduta)', active: 1, approval_status: 'AKTIF', created_at: new Date('2024-01-12') },
      { id: 7, kpm_id: 2, full_name: 'Aisyah Putri Azzahra', nik: '3213015503230007', nisn: null, category: 'BALITA', gender: 'P', class_group: '0-5 Bulan (Bayi)', active: 1, approval_status: 'AKTIF', created_at: new Date('2024-01-12') },
      { id: 8, kpm_id: 2, full_name: 'Rafka Aditya Ramadhan', nik: '3213011808220008', nisn: null, category: 'BALITA', gender: 'L', class_group: '24-59 Bulan (Balita)', active: 1, approval_status: 'AKTIF', created_at: new Date('2024-01-12') },
      { id: 9, kpm_id: 2, full_name: 'Muhammad Rayyan', nik: '3213010511220009', nisn: null, category: 'BALITA', gender: 'L', class_group: '6-23 Bulan (Baduta)', active: 1, approval_status: 'AKTIF', created_at: new Date('2024-01-12') },
      { id: 10, kpm_id: 2, full_name: 'Siti Zulaikha', nik: '3213016202230010', nisn: null, category: 'BALITA', gender: 'P', class_group: '24-59 Bulan (Balita)', active: 1, approval_status: 'AKTIF', created_at: new Date('2024-01-12') },
      { id: 11, kpm_id: 2, full_name: 'Ibu Ratna Dewi', nik: '3213014506980005', nisn: null, category: 'BUMIL', gender: 'P', class_group: 'Trimester 2 (13–27 Minggu)', active: 1, approval_status: 'AKTIF', created_at: new Date('2024-01-15') },
      { id: 12, kpm_id: 2, full_name: 'Ibu Siti Maryam', nik: '3213015208960012', nisn: null, category: 'BUMIL', gender: 'P', class_group: 'Trimester 3 (28–40 Minggu)', active: 1, approval_status: 'AKTIF', created_at: new Date('2024-01-15') },
      { id: 13, kpm_id: 2, full_name: 'Ibu Dewi Lestari', nik: '3213016511990013', nisn: null, category: 'BUMIL', gender: 'P', class_group: 'Trimester 1 (1–12 Minggu)', active: 1, approval_status: 'AKTIF', created_at: new Date('2024-01-15') },
      { id: 14, kpm_id: 2, full_name: 'Ibu Nur Halimah', nik: '3213014304950014', nisn: null, category: 'BUSUI', gender: 'P', class_group: 'Bayi 0–6 Bulan (ASI Eksklusif)', active: 1, approval_status: 'AKTIF', created_at: new Date('2024-01-15') },
      { id: 15, kpm_id: 2, full_name: 'Ibu Fitri Handayani', nik: '3213015907940015', nisn: null, category: 'BUSUI', gender: 'P', class_group: 'Bayi 7–12 Bulan', active: 1, approval_status: 'AKTIF', created_at: new Date('2024-01-15') },
      { id: 16, kpm_id: 2, full_name: 'Ibu Maya Anggraeni', nik: '3213016709970016', nisn: null, category: 'BUSUI', gender: 'P', class_group: 'Bayi 13–24 Bulan', active: 1, approval_status: 'AKTIF', created_at: new Date('2024-01-15') },
      // Contoh PM nonaktif di Melati 01: satu menunggu verifikasi BGN, satu sudah disetujui BGN
      { id: 17, kpm_id: 2, full_name: 'Arka Danendra Pratama', nik: '3213011402190017', nisn: null, category: 'BALITA', gender: 'L', class_group: 'Posyandu Melati 01', active: 0, approval_status: 'NONAKTIF_DISETUJUI', deactivation_reason: 'Melewati Batas Usia Balita (> 5 Tahun)', deactivated_at: new Date('2024-02-01'), created_at: new Date('2024-01-12') },
      { id: 18, kpm_id: 2, full_name: 'Ibu Maya Safitri', nik: '3213016805950018', nisn: null, category: 'BUMIL', gender: 'P', class_group: 'Trimester 3', active: 0, approval_status: 'MENUNGGU_VERIFIKASI_BGN', deactivation_reason: 'Pindah Domisili ke Luar Wilayah', deactivated_at: new Date('2024-02-10'), created_at: new Date('2024-01-15') },

      // KPM 3: Posyandu Melati 02 (Ruang Privat Terpisah)
      { id: 19, kpm_id: 3, full_name: 'Bilal Al Habsyi', nik: '3213012903230019', nisn: null, category: 'BALITA', gender: 'L', class_group: 'Posyandu Melati 02', active: 1, approval_status: 'AKTIF', created_at: new Date('2024-01-15') },
      { id: 20, kpm_id: 3, full_name: 'Syifa Nuraini', nik: '3213015407230020', nisn: null, category: 'BALITA', gender: 'P', class_group: 'Posyandu Melati 02', active: 1, approval_status: 'AKTIF', created_at: new Date('2024-01-15') },
      { id: 21, kpm_id: 3, full_name: 'Ibu Rina Kurnia', nik: '3213014101960021', nisn: null, category: 'BUMIL', gender: 'P', class_group: 'Trimester 2', active: 1, approval_status: 'AKTIF', created_at: new Date('2024-01-15') },
      { id: 22, kpm_id: 3, full_name: 'Ibu Indah Puspita', nik: '3213016309930022', nisn: null, category: 'BUSUI', gender: 'P', class_group: 'Bayi 2 Bulan', active: 1, approval_status: 'AKTIF', created_at: new Date('2024-01-15') }
    ],
    pm_change_history: [
      { id: 1, pm_id: 17, effective_from: '2024-02-01', action: 'DEACTIVATE', before_data: JSON.stringify({ active: 1 }), after_data: JSON.stringify({ active: 0 }), reason: 'Melewati Batas Usia Balita (> 5 Tahun) · Disetujui Kepala BGN', actor_id: 1, created_at: new Date('2024-02-01') },
      { id: 2, pm_id: 18, effective_from: '2024-02-10', action: 'DEACTIVATE', before_data: JSON.stringify({ active: 1 }), after_data: JSON.stringify({ active: 0 }), reason: 'Pindah Domisili ke Luar Wilayah (Diajukan oleh Kader, Menunggu Otorisasi Kepala BGN)', actor_id: null, created_at: new Date('2024-02-10') }
    ],
    kpm_portal_tokens: [],
    kpm_portal_statements: [],
    kpm_portal_profile_submissions: [],
    kpm_pm_submissions: [],
    kpm_pm_submission_rows: [],
    kpm_pm_submission_history: [],
    menus: [
      {
        id: 1,
        menu_code: 'MN-SP-001',
        menu_name: 'Nasi Putih, Ayam Bakar Madu, Sayur Sop Jagung Wortel, Buah Semangka',
        component_name: 'Nasi, Ayam, Sop Jagung Wortel, Buah',
        kpm_type: 'SATUAN_PENDIDIKAN',
        energy_small: 450,
        protein_small: 18,
        fat_small: 12,
        carb_small: 65,
        fiber_small: 4,
        energy_large: 650,
        protein_large: 26,
        fat_large: 18,
        carb_large: 92,
        fiber_large: 6,
        active: 1,
        created_at: new Date()
      },
      {
        id: 2,
        menu_code: 'MN-POS-001',
        menu_name: 'Bubur Ayam Sehat Wortel Bayam Telur Puyuh (Balita) & Nasi Bento Gizi Ibu Hamil',
        component_name: 'Bubur Balita & Bento Bumil',
        kpm_type: 'POSYANDU',
        energy_small: 280,
        protein_small: 12,
        fat_small: 8,
        carb_small: 38,
        fiber_small: 3,
        energy_large: 700,
        protein_large: 28,
        fat_large: 20,
        carb_large: 98,
        fiber_large: 7,
        active: 1,
        created_at: new Date()
      }
    ],
    menu_daily: [],
    distribution_schedules: [],
    distribution_clusters: [],
    distribution_cluster_kpm: [],
    distribution: [],
    bgn_documents: [
      {
        id: 1,
        title: 'Petunjuk Teknis Penyelenggaraan Satuan Pelayanan Pemenuhan Gizi (SPPG)',
        doc_type: 'JUKNIS',
        document_number: 'BGN/JUKNIS/2024/001',
        document_date: '2024-01-15',
        description: 'Pedoman standar operasional penyediaan makanan bergizi gratis.',
        active: 1,
        created_at: new Date()
      },
      {
        id: 2,
        title: 'Standar Operasional Prosedur (SOP) Higiene dan Sanitasi Dapur SPPG',
        doc_type: 'SOP',
        document_number: 'SOP-SPPG-HS-01',
        document_date: '2024-01-20',
        description: 'Standar kebersihan ruang persiapan, pengolahan, pemorsian, dan pencucian foodtray.',
        active: 1,
        created_at: new Date()
      }
    ],
    quick_links: [
      {
        id: 1,
        title: 'Badan Gizi Nasional (BGN)',
        description: 'Portal resmi Badan Gizi Nasional Republik Indonesia',
        url: 'https://bgn.go.id',
        icon: 'portal',
        sort_order: 1,
        active: 1,
        created_at: new Date()
      },
      {
        id: 2,
        title: 'Kementerian Kesehatan RI',
        description: 'Data dan standar angka kecukupan gizi (AKG)',
        url: 'https://kemkes.go.id',
        icon: 'health',
        sort_order: 2,
        active: 1,
        created_at: new Date()
      }
    ],
    operational_task_assignments: [],
    operational_task_events: [],
    operational_issues: [],
    operational_feedback: [],
    operational_issue_updates: [],
    operational_feedback_updates: [],
    foodtray_templates: [
      { id: 1, sppg_name: 'SPPG Subang Pusakajaya', title_line: 'MAKANAN BERGIZI GRATIS', footer_line: 'Diproduksi Higienis oleh SPPG Badan Gizi Nasional', show_qr: 1 }
    ],
    daily_closings: [
      {
        id: 1,
        work_date: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
        status: 'CLOSED',
        closed_by: 1,
        closed_at: new Date(Date.now() - 86400000),
        reopened_by: null,
        reopened_at: null,
        reopen_reason: null,
        created_at: new Date(Date.now() - 86400000)
      }
    ],
    kpm_pm_submissions: [
      {
        id: 1,
        kpm_id: 1,
        submission_type: 'MANUAL',
        effective_from: new Date().toISOString().slice(0, 10),
        status: 'DIAJUKAN',
        submitted_by: null,
        reviewed_by: null,
        reviewed_at: null,
        review_note: null,
        applied_at: null,
        applied_by: null,
        source_filename: null,
        created_at: new Date()
      },
      {
        id: 2,
        kpm_id: 2,
        submission_type: 'MANUAL',
        effective_from: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
        status: 'DISETUJUI',
        submitted_by: null,
        reviewed_by: 1,
        reviewed_at: new Date(Date.now() - 43200000),
        review_note: 'Disetujui sesuai koordinasi kader Posyandu Melati',
        applied_at: new Date(Date.now() - 43200000),
        applied_by: 1,
        source_filename: null,
        created_at: new Date(Date.now() - 86400000)
      }
    ],
    kpm_pm_submission_rows: [
      {
        id: 1,
        submission_id: 1,
        row_no: 1,
        pm_id: null,
        full_name: 'Daffa Rizky Ramadhan',
        nik: '3213011208160009',
        nisn: '0165432199',
        gender: 'L',
        class_group: 'Kelas 1-B',
        category: 'PESERTA_DIDIK',
        phone: '081299998888',
        address: 'Dusun Kebondanas RT 04/02',
        status: 'VALID',
        validation_note: 'Peserta didik pindahan baru',
        created_at: new Date()
      },
      {
        id: 2,
        submission_id: 2,
        row_no: 1,
        pm_id: 4,
        full_name: 'Kenzo Alfarizi',
        nik: '3213012201230004',
        nisn: null,
        gender: 'L',
        class_group: 'Posyandu Melati',
        category: 'BALITA',
        phone: '08139876001',
        address: 'Dusun Sukamaju RT 02/01',
        status: 'VALID',
        validation_note: 'Pembaruan data balita',
        created_at: new Date(Date.now() - 86400000)
      }
    ],
    activity_log: [
      {
        id: 1,
        user_id: 1,
        action: 'Sertifikasi & Kunci Operasional',
        entity_type: 'EXECUTIVE_LOCK',
        entity_id: 0,
        description: 'Pimpinan mengunci buku operasional SPPG kemarin. Data dibekukan dari modifikasi.',
        before_json: null,
        after_json: JSON.stringify({ status: 'CLOSED', date: new Date(Date.now() - 86400000).toISOString().slice(0, 10) }),
        ip_address: '127.0.0.1',
        user_agent: 'SPPG Enterprise Client',
        created_at: new Date(Date.now() - 86400000)
      },
      {
        id: 2,
        user_id: 1,
        action: 'Persetujuan Perubahan Data',
        entity_type: 'EXECUTIVE_APPROVAL',
        entity_id: 2,
        description: 'Pimpinan menyetujui pengajuan pembaruan PM #2 Posyandu Melati 01',
        before_json: null,
        after_json: JSON.stringify({ status: 'DISETUJUI', review_note: 'Disetujui sesuai koordinasi kader' }),
        ip_address: '127.0.0.1',
        user_agent: 'SPPG Enterprise Client',
        created_at: new Date(Date.now() - 43200000)
      },
      {
        id: 3,
        user_id: 1,
        action: 'Login',
        entity_type: 'AUTH',
        entity_id: 1,
        description: 'Login Administrator sah ke sistem SPPG',
        before_json: null,
        after_json: null,
        ip_address: '127.0.0.1',
        user_agent: 'SPPG Enterprise Client',
        created_at: new Date(Date.now() - 7200000)
      }
    ],
    schema_migrations: [
      { version: '1.8.36.4-backup-integrity', applied_at: new Date() },
      { version: '1.8.36.4-kpm-portal-statement', applied_at: new Date() },
      { version: '1.8.36.4-kpm-portal-profile-edit', applied_at: new Date() }
    ]
  };

  // Seed default admin user synchronously
  const adminEnvPw = String(process.env.ADMIN_PASSWORD || '').trim();
  const adminPwToHash = (adminEnvPw && adminEnvPw !== 'CHANGE_ME_TO_A_STRONG_PASSWORD') ? adminEnvPw : '12345@';
  const defaultAdminPwHash = bcrypt.hashSync(adminPwToHash, 10);
  tables.users.push({
    id: 1,
    username: process.env.ADMIN_USERNAME || 'admin',
    email: 'admin@sppg.local',
    password_hash: defaultAdminPwHash,
    name: 'Administrator',
    role: 'ADMIN',
    staff_id: null,
    created_at: new Date()
  });

  // Populate permissions from catalog
  let permIdCounter = 1;
  for (const [key, label] of Object.entries(permissionCatalog)) {
    tables.permissions.push({ id: permIdCounter++, permission_key: key, label, created_at: new Date() });
  }

  // Populate role permissions
  let rolePermIdCounter = 1;
  for (const [role, keys] of Object.entries(defaultRolePermissions)) {
    for (const key of keys) {
      const p = tables.permissions.find(x => x.permission_key === key);
      if (p) {
        tables.role_permissions.push({
          id: rolePermIdCounter++,
          role,
          permission_id: p.id,
          created_at: new Date()
        });
      }
    }
  }

  // Sessions map for MySQLSessionStore
  const sessionStoreMap = new Map();

  let autoId = 100;

  async function handleQuery(sql, params = []) {
    const rawSql = String(sql || '').trim();
    const cleanSql = rawSql.replace(/\s+/g, ' ');
    const lowerSql = cleanSql.toLowerCase();

    // DDL & migrations - harmless no-ops
    if (
      lowerSql.startsWith('create table') ||
      lowerSql.startsWith('alter table') ||
      lowerSql.startsWith('create unique index') ||
      lowerSql.startsWith('create index') ||
      lowerSql.startsWith('drop table')
    ) {
      return [{ affectedRows: 0, insertId: 0 }, []];
    }

    // information_schema queries
    if (lowerSql.includes('from information_schema.columns')) {
      if (lowerSql.includes("column_name='role'")) {
        return [[{ COLUMN_TYPE: "enum('ADMIN','ASLAP','KASP','PENGAWAS_GIZI','PENGAWAS_KEUANGAN','PERSIAPAN','PENGOLAHAN','PEMORSIAN','DISTRIBUSI','PENCUCIAN')" }], []];
      }
      if (lowerSql.includes('table_name=?') || lowerSql.includes("table_name='permissions'")) {
        return [[{ COLUMN_NAME: 'id' }, { COLUMN_NAME: 'permission_key' }, { COLUMN_NAME: 'label' }], []];
      }
      return [[{ count: 1 }], []];
    }

    if (lowerSql.includes('from information_schema.statistics')) {
      return [[{ c: 1 }], []];
    }

    // Ping / health check
    if (lowerSql === 'select 1' || lowerSql.startsWith('select 1')) {
      return [[{ '1': 1 }], []];
    }

    // Session store queries
    if (lowerSql.includes('sppg_sessions')) {
      if (lowerSql.startsWith('select sess,expires_at from sppg_sessions where sid=?')) {
        const sid = String(params[0] || '');
        const entry = sessionStoreMap.get(sid);
        if (entry) {
          return [[{ sess: entry.sess, expires_at: entry.expires_at }], []];
        }
        return [[], []];
      }
      if (lowerSql.startsWith('insert into sppg_sessions')) {
        const sid = String(params[0] || '');
        const sess = String(params[1] || '');
        const expires_at = params[2] ?? null;
        sessionStoreMap.set(sid, { sess, expires_at, updated_at: Date.now() });
        return [{ affectedRows: 1 }, []];
      }
      if (lowerSql.startsWith('delete from sppg_sessions where sid=?')) {
        const sid = String(params[0] || '');
        sessionStoreMap.delete(sid);
        return [{ affectedRows: 1 }, []];
      }
      if (lowerSql.startsWith('update sppg_sessions set expires_at=? where sid=?')) {
        const expires_at = params[0];
        const sid = String(params[1] || '');
        const entry = sessionStoreMap.get(sid);
        if (entry) entry.expires_at = expires_at;
        return [{ affectedRows: entry ? 1 : 0 }, []];
      }
      if (lowerSql.startsWith('select count(*) count from sppg_sessions')) {
        return [[{ count: sessionStoreMap.size }], []];
      }
      if (lowerSql.startsWith('delete from sppg_sessions where expires_at is not null and expires_at<=?')) {
        const now = Number(params[0] || Date.now());
        for (const [sid, entry] of sessionStoreMap.entries()) {
          if (entry.expires_at && Number(entry.expires_at) <= now) {
            sessionStoreMap.delete(sid);
          }
        }
        return [{ affectedRows: 0 }, []];
      }
    }

    // Role permissions check
    if (lowerSql.includes('from role_permissions rp join permissions p')) {
      const role = params[0];
      const permKey = params[1];
      if (role === 'ADMIN') return [[{ id: 1 }], []];
      const p = tables.permissions.find(x => x.permission_key === permKey);
      if (p && tables.role_permissions.some(x => x.role === role && x.permission_id === p.id)) {
        return [[{ id: 1 }], []];
      }
      return [[], []];
    }

    // Users
    if (lowerSql.includes('from users')) {
      if (lowerSql.includes('where username=?')) {
        const username = String(params[0] || '').trim();
        const found = tables.users.filter(u => u.username === username);
        return [found, []];
      }
      if (lowerSql.includes('where id=?')) {
        const id = Number(params[0]);
        const found = tables.users.filter(u => u.id === id);
        return [found, []];
      }
      if (lowerSql.startsWith('select') && !lowerSql.includes('count(*)')) {
        return [tables.users, []];
      }
    }

    if (lowerSql.startsWith('insert into users')) {
      const username = params[0];
      const password_hash = params[1];
      const name = params[2];
      const role = params[3] || 'ADMIN';
      const existing = tables.users.find(u => u.username === username);
      if (existing) {
        existing.password_hash = password_hash;
        existing.name = name;
        existing.role = role;
        return [{ insertId: existing.id, affectedRows: 1 }, []];
      }
      const newId = ++autoId;
      tables.users.push({ id: newId, username, password_hash, name, role, created_at: new Date() });
      return [{ insertId: newId, affectedRows: 1 }, []];
    }

    // App settings
    if (lowerSql.includes('from app_settings')) {
      return [tables.app_settings, []];
    }

    // Profile
    if (lowerSql.includes('from sppg_profile')) {
      return [tables.sppg_profile, []];
    }

    // Permissions
    if (lowerSql.includes('from permissions where permission_key=?')) {
      const key = params[0];
      const found = tables.permissions.filter(p => p.permission_key === key);
      return [found, []];
    }
    if (lowerSql.startsWith('insert into permissions') || lowerSql.startsWith('insert ignore into permissions')) {
      const key = params[0], label = params[1];
      let p = tables.permissions.find(x => x.permission_key === key);
      if (!p) {
        p = { id: tables.permissions.length + 1, permission_key: key, label };
        tables.permissions.push(p);
      } else {
        p.label = label;
      }
      return [{ insertId: p.id, affectedRows: 1 }, []];
    }

    // Role permissions insert / delete
    if (lowerSql.startsWith('insert ignore into role_permissions')) {
      const role = params[0], permission_id = params[1];
      if (!tables.role_permissions.some(x => x.role === role && x.permission_id === permission_id)) {
        tables.role_permissions.push({ id: ++autoId, role, permission_id });
      }
      return [{ affectedRows: 1 }, []];
    }
    if (lowerSql.startsWith('delete from role_permissions where role=?')) {
      const role = params[0];
      tables.role_permissions = tables.role_permissions.filter(x => x.role !== role);
      return [{ affectedRows: 1 }, []];
    }

    // Counts for dashboard & lists
    if (lowerSql.includes('count(*)')) {
      let count = 0;
      if (lowerSql.includes('from staff')) {
        if (lowerSql.includes("status='aktif'")) count = tables.staff.filter(s => s.status === 'AKTIF').length;
        else if (lowerSql.includes('status in')) count = 0;
        else count = tables.staff.length;
        return [[{ count, total: count }], []];
      }
      if (lowerSql.includes('from pm')) {
        count = tables.pm.filter(p => p.active === 1).length;
        return [[{ count, total: count, pm_count: count }], []];
      }
      if (lowerSql.includes('from kpm')) {
        count = tables.kpm.filter(k => k.active === 1).length;
        return [[{ count, total: count, kpm: count, pm: tables.pm.length }], []];
      }
      if (lowerSql.includes('from distribution')) {
        return [[{ count: 0, total: 0 }], []];
      }
      return [[{ count: 0, total: 0, c: 0, pm_count: 0, kpm: 0, pm: 0 }], []];
    }

    // Staff
    if (lowerSql.includes('from staff')) {
      if (lowerSql.includes('where id=?')) {
        const id = Number(params[0]);
        return [tables.staff.filter(s => s.id === id), []];
      }
      if (lowerSql.includes('where nik=?')) {
        const nik = String(params[0]);
        return [tables.staff.filter(s => s.nik === nik), []];
      }
      return [tables.staff, []];
    }
    if (lowerSql.startsWith('insert into staff(')) {
      const newId = ++autoId;
      const newStaff = { id: newId, name: params[0], nik: params[1], position: params[8] || 'Chef', status: params[13] || 'AKTIF', created_at: new Date() };
      tables.staff.push(newStaff);
      return [{ insertId: newId, affectedRows: 1 }, []];
    }
    if (lowerSql.startsWith('update staff set')) {
      const id = Number(params[params.length - 1]);
      const st = tables.staff.find(x => x.id === id);
      if (st) {
        st.name = params[0] || st.name;
        st.nik = params[1] || st.nik;
      }
      return [{ affectedRows: 1 }, []];
    }

    // KPM
    if (lowerSql.includes('from kpm')) {
      if (lowerSql.includes('where id=?')) {
        const id = Number(params[0]);
        return [tables.kpm.filter(k => k.id === id).map(k => ({
          ...k,
          kpm_id: k.id,
          kpm_name: k.name,
          kpm_code: k.code,
          kpm_type: k.type
        })), []];
      }
      if (lowerSql.includes('where code=?')) {
        const code = String(params[0]);
        return [tables.kpm.filter(k => k.code === code), []];
      }
      if (lowerSql.includes('where type=?')) {
        const type = String(params[0]);
        return [tables.kpm.filter(k => k.type === type), []];
      }
      return [tables.kpm, []];
    }
    if (lowerSql.startsWith('insert into kpm(')) {
      const newId = ++autoId;
      const k = { id: newId, code: params[0], name: params[1], type: params[2], address: params[4], active: 1, created_at: new Date() };
      tables.kpm.push(k);
      return [{ insertId: newId, affectedRows: 1 }, []];
    }

    // PM Change History
    if (lowerSql.includes('from pm_change_history')) {
      if (lowerSql.includes('where h.pm_id=?') || lowerSql.includes('where pm_id=?')) {
        const pmId = Number(params[0]);
        const rows = tables.pm_change_history.filter(h => Number(h.pm_id) === pmId).map(h => {
          const u = tables.users.find(x => x.id === h.actor_id) || {};
          return { ...h, actor_name: u.name || 'Admin SPPG' };
        });
        return [rows, []];
      }
      return [tables.pm_change_history, []];
    }
    if (lowerSql.startsWith('insert into pm_change_history')) {
      const newId = tables.pm_change_history.length + 1;
      tables.pm_change_history.unshift({
        id: newId,
        pm_id: Number(params[0]),
        effective_from: params[1],
        action: params[2],
        before_data: params[3],
        after_data: params[4],
        reason: params[5],
        actor_id: params[6],
        created_at: new Date()
      });
      return [{ insertId: newId, affectedRows: 1 }, []];
    }
    if (lowerSql.includes('from kpm_pm_submission_rows')) {
      if (lowerSql.includes('where r.pm_id=?') || lowerSql.includes('where pm_id=?')) {
        const pmId = Number(params[0]);
        const rows = (tables.kpm_pm_submission_rows || []).filter(r => Number(r.pm_id) === pmId);
        return [rows, []];
      }
      return [tables.kpm_pm_submission_rows || [], []];
    }

    // PM
    if (lowerSql.match(/\bfrom pm\b/)) {
      if (lowerSql.includes('where p.id=? and p.kpm_id=?') || lowerSql.includes('where id=? and kpm_id=?')) {
        const id = Number(params[0]);
        const kpmId = Number(params[1]);
        const found = tables.pm.filter(p => p.id === id && p.kpm_id === kpmId).map(p => {
          const k = tables.kpm.find(x => x.id === p.kpm_id) || {};
          return { ...p, kpm_name: k.name, kpm_type: k.type };
        });
        return [found, []];
      }
      if (lowerSql.includes('where p.id=?')) {
        const id = Number(params[0]);
        const found = tables.pm.filter(p => p.id === id).map(p => {
          const k = tables.kpm.find(x => x.id === p.kpm_id) || {};
          return { ...p, kpm_name: k.name, kpm_type: k.type };
        });
        return [found, []];
      }
      if (lowerSql.includes('where id=?')) {
        const id = Number(params[0]);
        return [tables.pm.filter(p => p.id === id), []];
      }
      const kpmMatch = lowerSql.match(/where\s+kpm_id\s*=\s*(\?|\d+)/);
      if (kpmMatch) {
        const kpmId = kpmMatch[1] === '?' ? Number(params[0]) : Number(kpmMatch[1]);
        return [tables.pm.filter(p => p.kpm_id === kpmId), []];
      }
      return [tables.pm, []];
    }
    if (lowerSql.startsWith('update pm set')) {
      const pmId = Number(params[params.length - 1]);
      const p = tables.pm.find(x => x.id === pmId);
      if (p) {
        if (lowerSql.includes('approval_status=?')) {
          const actIdx = lowerSql.indexOf('active=?');
          if (actIdx !== -1) p.active = Number(params[0]);
          p.deactivated_at = params[1] || null;
          p.deactivation_reason = params[2] || null;
          p.approval_status = params[3] || 'AKTIF';
        } else if (lowerSql.includes('active=?')) {
          p.active = Number(params[0]);
          p.deactivated_at = params[1] || null;
          p.deactivation_reason = params[2] || null;
          p.approval_status = p.active ? 'AKTIF' : (p.approval_status || 'NONAKTIF_DISETUJUI');
        }
      }
      return [{ affectedRows: 1 }, []];
    }

    // Menus
    if (lowerSql.includes('from menus')) {
      if (lowerSql.includes('where id=?')) {
        const id = Number(params[0]);
        return [tables.menus.filter(m => m.id === id), []];
      }
      return [tables.menus, []];
    }
    if (lowerSql.includes('from menu_daily')) {
      return [tables.menu_daily, []];
    }

    // Quick links
    if (lowerSql.includes('from quick_links')) {
      return [tables.quick_links, []];
    }

    // BGN Documents
    if (lowerSql.includes('from bgn_documents')) {
      return [tables.bgn_documents, []];
    }

    // Daily closings
    if (lowerSql.includes('from daily_closings')) {
      if (lowerSql.includes('where work_date=?')) {
        const date = String(params[0]);
        const found = tables.daily_closings.filter(c => c.work_date === date);
        return [found, []];
      }
      const mapped = tables.daily_closings.map(c => {
        const u = tables.users.find(x => x.id === c.closed_by);
        const ru = tables.users.find(x => x.id === c.reopened_by);
        return {
          ...c,
          closed_by_name: u ? u.name : null,
          reopened_by_name: ru ? ru.name : null
        };
      });
      return [mapped, []];
    }
    if (lowerSql.startsWith('insert into daily_closings')) {
      const date = params[0];
      const status = params[1] || 'CLOSED';
      const userId = params[2] || 1;
      const existing = tables.daily_closings.find(c => c.work_date === date);
      if (existing) {
        existing.status = status;
        if (status === 'CLOSED') {
          existing.closed_by = userId;
          existing.closed_at = new Date();
          existing.reopened_by = null;
          existing.reopened_at = null;
          existing.reopen_reason = null;
        } else {
          existing.reopened_by = userId;
          existing.reopened_at = new Date();
          existing.reopen_reason = params[3] || 'Reopened by executive';
        }
      } else {
        tables.daily_closings.push({
          id: ++autoId,
          work_date: date,
          status,
          closed_by: userId,
          closed_at: new Date(),
          reopened_by: null,
          reopened_at: null,
          reopen_reason: null,
          created_at: new Date()
        });
      }
      return [{ insertId: autoId, affectedRows: 1 }, []];
    }

    // Submissions: kpm_pm_submissions
    if (lowerSql.includes('from kpm_pm_submissions')) {
      if (lowerSql.includes('where id = ?') || lowerSql.includes('where id=?')) {
        const id = Number(params[0]);
        return [tables.kpm_pm_submissions.filter(s => s.id === id), []];
      }
      let list = tables.kpm_pm_submissions.map(s => {
        const k = tables.kpm.find(x => x.id === s.kpm_id) || {};
        const u = tables.users.find(x => x.id === s.submitted_by);
        const r = tables.users.find(x => x.id === s.reviewed_by);
        return {
          ...s,
          kpm_name: k.name || `KPM #${s.kpm_id}`,
          kpm_code: k.code || `KPM-${s.kpm_id}`,
          kpm_type: k.type || 'SATUAN_PENDIDIKAN',
          submitter_name: u ? u.name : 'Portal Lapangan / Sekolah',
          reviewer_name: r ? r.name : null
        };
      });
      if (lowerSql.includes('where s.status = ?')) {
        const st = String(params[0]);
        list = list.filter(s => s.status === st);
      }
      return [list, []];
    }

    // Submissions rows: kpm_pm_submission_rows
    if (lowerSql.includes('from kpm_pm_submission_rows')) {
      if (lowerSql.includes('where submission_id = ?') || lowerSql.includes('where submission_id=?')) {
        const subId = Number(params[0]);
        return [tables.kpm_pm_submission_rows.filter(r => r.submission_id === subId), []];
      }
      return [tables.kpm_pm_submission_rows, []];
    }

    // Activity log
    if (lowerSql.includes('from activity_log')) {
      let list = tables.activity_log.map(a => {
        const u = tables.users.find(x => x.id === a.user_id);
        return {
          ...a,
          user_name: u ? u.name : 'Portal Lapangan / Publik',
          user_role: u ? u.role : null
        };
      });
      return [list, []];
    }
    if (lowerSql.startsWith('insert into activity_log')) {
      tables.activity_log.unshift({
        id: ++autoId,
        user_id: params[0] || null,
        action: params[1],
        entity_type: params[2],
        entity_id: params[3],
        description: params[4],
        before_json: params[5] || null,
        after_json: params[6] || null,
        ip_address: params[7] || '127.0.0.1',
        user_agent: params[8] || 'SPPG Enterprise Client',
        created_at: new Date()
      });
      return [{ insertId: autoId, affectedRows: 1 }, []];
    }

    // Operational teams & issues & feedback
    if (lowerSql.includes('from sppg_teams')) {
      return [tables.sppg_teams, []];
    }
    if (lowerSql.includes('from operational_issues')) {
      return [tables.operational_issues, []];
    }
    if (lowerSql.includes('from operational_feedback')) {
      return [tables.operational_feedback, []];
    }

    // Generic inserts
    if (lowerSql.startsWith('insert into')) {
      const newId = ++autoId;
      return [{ insertId: newId, affectedRows: 1 }, []];
    }

    // Generic updates / deletes
    if (lowerSql.startsWith('update') || lowerSql.startsWith('delete')) {
      return [{ affectedRows: 1 }, []];
    }

    // Catch-all query: return empty set
    return [[], []];
  }

  const mockConn = {
    query: handleQuery,
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {}
  };

  const pool = {
    isMock: true,
    tables,
    sessionStoreMap,
    query: handleQuery,
    getConnection: async () => mockConn,
    end: async () => {}
  };

  return pool;
}

module.exports = { createMockPool };
