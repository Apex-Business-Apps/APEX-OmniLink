import fs from 'node:fs';
import path from 'node:path';
import { recordAuditEvent } from '../../src/security/auditLog';

function checksum(filePath: string): string {
  const hash = crypto.createHash('sha256');
  const data = fs.readFileSync(filePath);
  hash.update(data);
  return hash.digest('hex');
}

function main() {
  const arg = process.argv.find((a) => a.startsWith('--backup='));
  if (!arg) {
    console.error('Usage: tsx scripts/backup/verify_backup.ts --backup=./path/to/backup.tar');
    process.exit(1);
  }

  const target = path.resolve(arg.split('=')[1]);
  if (!fs.existsSync(target)) {
    console.error('Backup not found at', target);
    process.exit(1);
  }

  const stats = fs.statSync(target);
  const digest = checksum(target);
  const result = {
    backup: target,
    sizeBytes: stats.size,
    checksum: digest,
  };

  recordAuditEvent({
    actionType: 'backup_verification',
    resourceType: 'backup',
    resourceId: path.basename(target),
    metadata: result,
  });

  console.log(JSON.stringify(result, null, 2));
}

main();

