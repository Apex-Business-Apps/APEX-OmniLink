import path from 'node:path';
import { runWWWCT } from '../../tests/worldwide-wildcard/runner/index';

function getArgValue(flag: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

async function main(): Promise<void> {
  const mode = (getArgValue('--mode', 'mock') || 'mock') as 'mock' | 'sandbox';
  const scenarioDir = getArgValue(
    '--scenarios',
    path.join(process.cwd(), 'tests/worldwide-wildcard/scenarios')
  );
  const reportDir = getArgValue(
    '--report-dir',
    path.join(process.cwd(), 'tests/worldwide-wildcard/reports')
  );

  const omnilinkPortUrl = process.env.OMNILINK_PORT_URL;

  await runWWWCT({
    mode,
    scenarioDir: scenarioDir || path.join(process.cwd(), 'tests/worldwide-wildcard/scenarios'),
    reportDir: reportDir || path.join(process.cwd(), 'tests/worldwide-wildcard/reports'),
    omnilinkPortUrl,
  });
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
