# BASELINE — Full Static Audit v1.8.36.4

## Scope
Audit terhadap release source saat ini: Node.js/Express/EJS/MySQL, migration, route order, permission gates, attendance foundation, team dashboards, distribution, storage safety, schema consistency, and unfinished modules.

## P0 — Blockers found and fixed in this release
1. Legacy permission migration could attempt a destructive/blocked `permission_id` ALTER. Fixed: existing `role_permissions.permission_id` is never modified; only missing columns are added, legacy values are mapped, and role ENUM is widened only when required.
2. `/distribution` contained an accidental reference to an undefined `team` variable and attendance block. Removed.
3. `/staff/:id` matched `/staff/schedule` and `/staff/attendance` before their dedicated routes. Fixed with numeric route constraint `/staff/:id([0-9]+)`.
4. Runtime/package version was inconsistent. Canonical version is now `1.8.36.4` and server log uses `APP_VERSION`.
5. `distribution_clusters` fresh schema did not include process-time columns used by the integrated schedule UI. Compatibility migration now ensures all eight fields exist.

## P1 — Data integrity/security hardening
1. Staff schedule deletion changed to non-destructive cancellation with reason, actor, and timestamp.
2. Attendance replacement now requires both staff to have an active schedule that day, the absent person to have an absence status, the replacement person to be HADIR, and same-team consistency.
3. Mutation-entry GET routes for staff/KPM/distribution/menu are protected by the relevant manage permission.
4. `schema.sql` and `schema-hostinger.sql` are synchronized.
5. Persistent upload/storage directories remain outside the release package.

## Attendance/payroll foundation status
Implemented:
- Staff schedule per date/team/shift/time.
- Attendance: HADIR, IZIN, SAKIT, ALPA, CUTI, DINAS, with BELUM_DIISI represented in UI.
- Replacement records without changing permanent team membership.
- Monthly recap based on scheduled days.
- Excel export for finance.
- Activity log for important changes.

Not implemented yet:
- Payroll formula/rules engine. No automatic deduction/addition is assumed.
- Payroll approval/locking workflow.

## Known incomplete modules (not hidden)
- Documents/SOP: dashboard/list exists; add/edit/upload workflow is incomplete.
- Quick Links: dashboard exists; add/edit workflow is incomplete.
- Foodtray: upload/download exists; full editor/configuration is incomplete.
- Documentation: dashboard/list exists; evidence upload/workflow is incomplete.
- Operational issues: database foundation exists; full lifecycle UI is incomplete.
- Feedback: database foundation exists; full lifecycle UI is incomplete.
- Messages/instructions and Notification Center: not implemented.
- Web Push/sound/WhatsApp provider integration: not implemented.
- Full Monitoring Distribusi realization/exception engine/daily closing: incomplete.
- Reports: placeholder.
- Finance module: role/permissions exist; finance transactions/payroll engine are not yet implemented.
- Recovery/rollback/read-only recovery/maintenance workflow: not implemented.
- Task assignment table exists; work-card assignment UI is not yet wired.

## Deployment rule
Do not deploy a release if runtime log still reports an older app version or if initialization reports a schema error. Never delete production database/storage to solve a migration problem.

## Additional hardening completed in this working revision

- Operational Kendala lifecycle UI + status/PIC/tindak lanjut.
- Operational Feedback capture + history UI.
- Explicit issue/feedback permissions for relevant roles.
- Distribution cluster cancellation changed to non-destructive archive semantics.
- Explicit mutation permission gates added to staff/KPM/PM/menu/distribution/foodtray mutations.
- Corrected operational task enum casing to `KLOTER`.

## Next engineering phase
After this audit/hardening release is verified in runtime, implement remaining modules in controlled batches. Do not combine unrelated large feature batches with database compatibility fixes.


## NEXT22 — Dashboard KPM Master Integration
- Dashboard KPM membaca identitas langsung dari Master KPM.
- Field yang belum lengkap ditandai di dashboard.
- KPM dapat mengajukan perbaikan identitas dari portal.
- Pengajuan tidak langsung menimpa Master KPM; reviewer SPPG menyetujui lalu menerapkan.
- Preview internal dan portal KPM menggunakan view dashboard yang sama.
