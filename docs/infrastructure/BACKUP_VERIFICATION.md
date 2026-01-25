# Backup Verification

## Concept
- Backups must be integrity-checked before being trusted.
- Verification computes a checksum and validates basic readability.

## How to Run
```bash
tsx scripts/backup/verify_backup.ts --backup=./backups/daily.tar
```
- Outputs JSON with size and SHA-256 checksum.
- Records an audit log entry tagged `backup_verification`.

## Pass/Fail Criteria
- **Pass**: File exists, checksum produced, size > 0.
- **Fail**: Missing file, unreadable archive, or checksum generation error.

## Notes
- Store generated checksums with the backup artifact for later comparison.
- Extend the script to perform test restores when a staging environment is available.

