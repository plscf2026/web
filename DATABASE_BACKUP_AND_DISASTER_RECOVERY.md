# Database Backup & Disaster Recovery Runbook
## Police Lines High School & College, Faridpur Reunion 2027

### 1. Executive Summary & RPO / RTO Objectives
- **Target System**: Supabase PostgreSQL Cluster (Managed Instance `bwlenuxlpesnwnegrbgx`)
- **Recovery Point Objective (RPO)**: <= 1 Hour (Maximum acceptable data loss window)
- **Recovery Time Objective (RTO)**: <= 15 Minutes (Maximum acceptable downtime window)
- **Key Tables**: `registrations_2027`, `registrations_2026`, `donations_2027`, `financial_ledger`, `admin_audit_logs`, `rms_*` modules.

---

### 2. Multi-Tier Backup Architecture

#### Tier 1: Automated Continuous Write-Ahead Logging (WAL) & Point-in-Time Recovery (PITR)
- Supabase Cloud automatically captures physical PostgreSQL WAL records every few seconds.
- Allows rolling back the entire database to any specific second in the preceding 7 to 30 days without manual intervention.

#### Tier 2: Automated Daily Logical Backups
- Automated daily logical pg_dump snapshot generated at 00:00 UTC.
- Retained offsite in isolated cloud storage with encryption.

#### Tier 3: Pre-Deployment & Administrative Manual Snapshot
- Before applying database schema migrations or major batch updates, administrators can trigger on-demand backups directly via:
  1. **Admin Panel UI**: Settings / Audit Tab -> "Export Complete Database Snapshot"
  2. **Automated CLI Script**: `./scripts/backup_database.sh 2027`

---

### 3. Tested Disaster Recovery & Restoration Procedure

#### Step 1: Pre-Restoration Safety Check
1. Put the registration gateway in maintenance mode if necessary (`registrationOpen: false` in `feeSettings`).
2. Identify the target timestamp or backup archive:
   ```bash
   ls -la backups/
   shasum -a 256 -c backups/plscf_reunion_2027_*.sha256
   ```

#### Step 2: Decrypt Archive (If encrypted)
```bash
openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 \
  -in backups/plscf_reunion_2027_20261111_060000Z.sql.enc \
  -out /tmp/restore_target.sql \
  -k "${BACKUP_ENCRYPTION_KEY}"
```

#### Step 3: Dry-Run / Staging Environment Verification
Always verify restoration into a non-production staging database before touching the primary instance:
```bash
# Connect to staging instance
psql "${STAGING_SUPABASE_DB_URL}" < /tmp/restore_target.sql
```
Verify row counts and integrity:
```sql
SELECT count(*) FROM public.registrations_2027;
SELECT count(*) FROM public.financial_ledger;
SELECT count(*) FROM public.admin_audit_logs;
```

#### Step 4: Primary Instance Restoration
Once staging verification passes, execute on target database:
```bash
psql "${SUPABASE_DB_URL}" --single-transaction < /tmp/restore_target.sql
```

#### Step 5: Post-Restoration Verification & Audit Recording
1. Verify latest transaction ID matches payment gateway records:
   ```sql
   SELECT id, full_name, transaction_id, payment_status, total_paid, registered_at
   FROM public.registrations_2027
   ORDER BY registered_at DESC
   LIMIT 10;
   ```
2. Verify financial ledger reconciliation:
   ```sql
   SELECT transaction_type, sum(amount)
   FROM public.financial_ledger
   GROUP BY transaction_type;
   ```
3. Record administrative audit event in `admin_audit_logs`:
   ```sql
   INSERT INTO public.admin_audit_logs (
     admin_id, admin_username, admin_role, action, target_type, target_id, details
   ) VALUES (
     'SYS_RECOVERY', 'recovery_admin', 'super_admin', 'DATABASE_RESTORE_COMPLETED',
     'database', 'all_tables',
     jsonb_build_object('restored_from', 'plscf_reunion_2027_backup', 'timestamp', now())
   );
   ```
4. Re-open public registration.

---

### 4. Backup Integrity & Periodic Drill Schedule
- **Weekly Automated Drill**: Weekly cron job restores the latest daily dump into an ephemeral test schema and verifies table checksums.
- **Access Control**: Database connection strings (`SUPABASE_DB_URL`) and encryption keys are strictly restricted to the Super Administrator and Lead Database Architect.

