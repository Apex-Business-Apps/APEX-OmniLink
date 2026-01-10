import fs from 'fs';
import path from 'path';
import { evaluatePrompt } from '../../src/security/promptDefense';

interface FlagRecord {
  prompt: string;
  expected?: 'block' | 'allow';
  label?: 'malicious' | 'benign';
  rule?: string;
}

function parseInput(): string {
  const arg = process.argv.find((a) => a.startsWith('--input='));
  if (!arg) {
    console.error('Usage: npm run prompt-defense:analyze -- --input=path/to/file');
    process.exit(1);
  }
  return arg.split('=')[1];
}

function readRecords(filePath: string): FlagRecord[] {
  const resolved = path.resolve(filePath);
  const content = fs.readFileSync(resolved, 'utf-8').trim();
  return content
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        console.warn('Skipping invalid line', line);
        return null;
      }
    })
    .filter((v): v is FlagRecord => Boolean(v && v.prompt));
}

function main() {
  const input = parseInput();
  const records = readRecords(input);
  const stats: Record<string, number> = {};
  let fp = 0;
  let tn = 0;

  records.forEach((record) => {
    const result = evaluatePrompt(record.prompt);
    const rule = result.triggeredRule || 'no-rule';
    stats[rule] = (stats[rule] || 0) + 1;

    if (record.label) {
      if (record.label === 'benign' && result.decision === 'block') fp += 1;
      if (record.label === 'benign' && result.decision === 'allow') tn += 1;
    }
  });

  const fpRate = fp + tn > 0 ? fp / (fp + tn) : 0;

  const output = {
    totalFlagged: records.length,
    perRule: stats,
    falsePositiveRate: fpRate,
  };

  console.log(JSON.stringify(output, null, 2));
}

main();

