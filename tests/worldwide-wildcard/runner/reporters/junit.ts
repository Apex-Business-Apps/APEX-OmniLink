import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ReportBundle, ScenarioRunResult } from '../types';

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function renderTestCase(result: ScenarioRunResult): string {
  const durationSeconds = Math.max(0.001, result.metrics.p95Ms / 1000).toFixed(3);
  const failureDetails = result.status !== 'passed'
    ? `<failure message="${escapeXml(result.status)}">${escapeXml(
      JSON.stringify(result.assertions, null, 2)
    )}</failure>`
    : '';

  return [
    `<testcase classname="WWWCT" name="${escapeXml(result.scenario.name)}" time="${durationSeconds}">`,
    failureDetails,
    '</testcase>',
  ].join('');
}

export async function writeJUnitReport(reportDir: string, report: ReportBundle): Promise<string> {
  const filePath = path.join(reportDir, 'junit.xml');
  const testCases = report.results.map(renderTestCase).join('');
  const suite = `<testsuite name="WWWCT" tests="${report.summary.total}" failures="${report.summary.failed}" errors="0" skipped="${report.summary.blocked}">${testCases}</testsuite>`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>${suite}`;
  await writeFile(filePath, xml);
  return filePath;
}
