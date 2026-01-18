import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ReportBundle } from '../types';

export async function writeJsonReport(reportDir: string, report: ReportBundle): Promise<string> {
  const filePath = path.join(reportDir, 'report.json');
  await writeFile(filePath, JSON.stringify(report, null, 2));
  return filePath;
}
