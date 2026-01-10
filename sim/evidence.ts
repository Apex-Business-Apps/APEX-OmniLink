/**
 * EVIDENCE BUNDLER
 *
 * Packages simulation results into evidence bundles for audit trails.
 */

import fs from 'fs';
import path from 'path';

export interface EvidenceManifest {
  runId: string;
  scenario: string;
  timestamp: string;
  files: {
    scorecard: string;
    result: string;
    logs: string;
  };
}

/**
 * Create evidence bundle from simulation result
 */
export async function createEvidenceBundle(
  runId: string,
  result: unknown
): Promise<string> {
  const evidenceDir = path.join(process.cwd(), 'evidence', runId);

  if (!fs.existsSync(evidenceDir)) {
    fs.mkdirSync(evidenceDir, { recursive: true });
  }

  // Cast result to Record<string, unknown> for access to properties
  // This satisfies strict typing while acknowledging dynamic nature of result object
  const r = result as Record<string, unknown>;

  // Save scorecard
  const scorecardPath = path.join(evidenceDir, 'scorecard.json');
  fs.writeFileSync(scorecardPath, JSON.stringify(r.scorecard, null, 2));

  // Save full result
  const resultPath = path.join(evidenceDir, 'result.json');
  fs.writeFileSync(resultPath, JSON.stringify(r, null, 2));

  // Save logs
  const logsPath = path.join(evidenceDir, 'logs.txt');
  const logs = Array.isArray(r.logs) ? r.logs : [];
  fs.writeFileSync(logsPath, logs.join('\n'));

  // Create manifest
  const manifest: EvidenceManifest = {
    runId,
    scenario: typeof r.scenario === 'string' ? r.scenario : 'unknown',
    timestamp: new Date().toISOString(),
    files: {
      scorecard: 'scorecard.json',
      result: 'result.json',
      logs: 'logs.txt',
    },
  };

  const manifestPath = path.join(evidenceDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  return evidenceDir;
}

/**
 * Generate HTML report from evidence
 */
export async function generateHTMLReport(runId: string): Promise<string> {
  const evidenceDir = path.join(process.cwd(), 'evidence', runId);
  const scorecardPath = path.join(evidenceDir, 'scorecard.json');

  if (!fs.existsSync(scorecardPath)) {
    throw new Error(`Evidence not found: ${runId}`);
  }

  const scorecard = JSON.parse(fs.readFileSync(scorecardPath, 'utf-8'));

  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Chaos Simulation Report - ${scorecard.scenario}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 1200px; margin: 40px auto; padding: 0 20px; }
    h1 { color: #333; }
    .score { font-size: 3em; font-weight: bold; margin: 20px 0; }
    .pass { color: #22c55e; }
    .fail { color: #ef4444; }
    .metric { background: #f3f4f6; padding: 15px; margin: 10px 0; border-radius: 8px; }
    .metric h3 { margin-top: 0; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f9fafb; font-weight: 600; }
  </style>
</head>
<body>
  <h1>Chaos Simulation Report</h1>
  <p><strong>Scenario:</strong> ${scorecard.scenario}</p>
  <p><strong>Run ID:</strong> ${scorecard.runId}</p>
  <p><strong>Timestamp:</strong> ${new Date(scorecard.timestamp).toLocaleString()}</p>
  <p><strong>Tenant:</strong> ${scorecard.tenant}</p>
  <p><strong>Seed:</strong> ${scorecard.seed}</p>

  <div class="score ${scorecard.passed ? 'pass' : 'fail'}">
    ${scorecard.overallScore.toFixed(1)}/100 ${scorecard.passed ? '✅' : '❌'}
  </div>

  <div class="metric">
    <h3>System Metrics</h3>
    <p>Latency: ${scorecard.system.latency ? '✅ PASS' : '❌ FAIL'} (p95 < 500ms)</p>
    <p>Errors: ${scorecard.system.errors ? '✅ PASS' : '❌ FAIL'} (< 10%)</p>
    <p>Resilience: ${scorecard.system.resilience ? '✅ PASS' : '❌ FAIL'} (recovery working)</p>
    <p>Idempotency: ${scorecard.system.idempotency ? '✅ PASS' : '❌ FAIL'} (deduplication working)</p>
  </div>

  <h2>App Scores</h2>
  <table>
    <thead>
      <tr>
        <th>App</th>
        <th>Score</th>
        <th>Events</th>
        <th>Success Rate</th>
        <th>Avg Latency</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
  ${Object.entries(scorecard.apps).map(([app, score]: [string, unknown]) => {
        const s = score as Record<string, any>;
        return `
        <tr>
          <td>${app}</td>
          <td>${s.score.toFixed(1)}</td>
          <td>${s.eventsProcessed}</td>
          <td>${(s.successRate * 100).toFixed(1)}%</td>
          <td>${s.avgLatencyMs.toFixed(0)}ms</td>
          <td>${s.passed ? '✅' : '❌'}</td>
        </tr>
      `;}).join('')}
    </tbody>
  </table>

  ${scorecard.issues.length > 0 ? `
    <h2>Issues</h2>
    <ul>
      ${scorecard.issues.map((issue: string) => `<li>${issue}</li>`).join('')}
    </ul>
  ` : ''}

  ${scorecard.warnings.length > 0 ? `
    <h2>Warnings</h2>
    <ul>
      ${scorecard.warnings.map((warning: string) => `<li>${warning}</li>`).join('')}
    </ul>
  ` : ''}

  <p><small>Generated: ${new Date().toLocaleString()}</small></p>
</body>
</html>
  `;

  const reportPath = path.join(evidenceDir, 'report.html');
  fs.writeFileSync(reportPath, html);

  return reportPath;
}

export default {
  createEvidenceBundle,
  generateHTMLReport,
};
