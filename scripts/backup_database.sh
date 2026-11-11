#!/usr/bin/env bash
# ==============================================================================
# Police Lines School & College Faridpur — Reunion 2027
# Enterprise Database Automated Backup Script
# Usage: ./scripts/backup_database.sh [year] [output_dir]
# ==============================================================================

set -euo pipefail

YEAR="${1:-2027}"
OUTPUT_DIR="${2:-./backups}"
TIMESTAMP="$(date -u +"%Y%m%d_%H%M%SZ")"
BACKUP_FILE="${OUTPUT_DIR}/plscf_reunion_${YEAR}_${TIMESTAMP}.sql"
ENCRYPTED_FILE="${BACKUP_FILE}.enc"

mkdir -p "${OUTPUT_DIR}"

echo "========================================================================"
echo " Starting Automated Database Backup for Reunion ${YEAR}"
echo " Timestamp: ${TIMESTAMP}"
echo "========================================================================"

if [ -z "${DB_URL:-}" ]; then
  if [ -n "${SUPABASE_DB_URL:-}" ]; then
    DB_URL="${SUPABASE_DB_URL}"
  else
    echo "[-] Notice: SUPABASE_DB_URL or DB_URL environment variable is required for direct pg_dump."
    echo "[-] Falling back to Supabase CLI dump if available..."
  fi
fi

if command -v supabase &> /dev/null; then
  echo "[+] Executing Supabase DB dump..."
  supabase db dump -f "${BACKUP_FILE}" --schema public
elif [ -n "${DB_URL:-}" ]; then
  echo "[+] Executing pg_dump with custom compression..."
  pg_dump "${DB_URL}" \
    --schema=public \
    --table="public.registrations_${YEAR}" \
    --table="public.donations_${YEAR}" \
    --table="public.registrations_2026" \
    --table="public.admin_accounts" \
    --table="public.staff_accounts" \
    --table="public.admin_audit_logs" \
    --table="public.food_distributions" \
    --table="public.dress_distributions" \
    --table="public.gate_events" \
    --table="public.financial_ledger" \
    --table="public.rms_*" \
    --clean --if-exists --no-owner --no-privileges \
    -f "${BACKUP_FILE}"
else
  echo "[!] Error: Neither supabase CLI nor pg_dump DB_URL is accessible."
  echo "    Please set SUPABASE_DB_URL=\"postgres://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres\""
  exit 1
fi

# Compute SHA-256 Checksum for tamper evidence
CHECKSUM=$(shasum -a 256 "${BACKUP_FILE}" | awk '{print $1}')
echo "${CHECKSUM}  $(basename "${BACKUP_FILE}")" > "${BACKUP_FILE}.sha256"

echo "[+] Backup successfully completed:"
echo "    File:     ${BACKUP_FILE}"
echo "    Size:     $(du -h "${BACKUP_FILE}" | awk '{print $1}')"
echo "    SHA-256:  ${CHECKSUM}"

# Optional GPG/OpenSSL Encryption if BACKUP_ENCRYPTION_KEY is present
if [ -n "${BACKUP_ENCRYPTION_KEY:-}" ]; then
  echo "[+] Encrypting backup with AES-256-CBC..."
  openssl enc -aes-256-cbc -salt -pbkdf2 -iter 100000 \
    -in "${BACKUP_FILE}" \
    -out "${ENCRYPTED_FILE}" \
    -k "${BACKUP_ENCRYPTION_KEY}"
  rm -f "${BACKUP_FILE}"
  echo "[+] Encrypted file: ${ENCRYPTED_FILE}"
fi

echo "========================================================================"
echo " Backup finished successfully."
echo "========================================================================"

