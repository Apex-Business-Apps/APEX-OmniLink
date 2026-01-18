import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ReportBundle } from '../types';

function renderResultRow(name: string, status: string, score: number): string {
  return `| ${name} | ${status} | ${score.toFixed(1)} |`;
}

export async function writeMarkdownReport(reportDir: string, report: ReportBundle): Promise<string> {
  const filePath = path.join(reportDir, 'report.md');
  const header = ['# Worldwide Wildcard Tests Report', '', '## Summary', ''];
  header.push(
    `- Total: ${report.summary.total}`,
    `- Passed: ${report.summary.passed}`,
    `- Failed: ${report.summary.failed}`,
    `- Blocked: ${report.summary.blocked}`,
    `- Score: ${report.summary.score.toFixed(1)}`
  );
  header.push('');
  header.push('## Scenario Results');
  header.push('');
  header.push('| Scenario | Status | Score |');
  header.push('| --- | --- | --- |');

  const rows = report.results.map(result =>
    renderResultRow(result.scenario.name, result.status, result.metrics.finalScore)
  );

  const body = header.concat(rows).join('\n');
  await writeFile(filePath, body);
  return filePath;
}
