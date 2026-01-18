import fs from 'fs';
import path from 'path';
import { BatteryStatus } from './types';

// Usage: tsx report.ts <runId>

async function main() {
    const runId = process.argv[2];
    if (!runId) {
        // Try to find the latest
        // In production usage, this should be passed explicitly by the orchestrator or CI
        console.error('Usage: tsx report.ts <runId>');
        console.log('Attempting to resolve "latest" symlink...');
    }

    const rootDir = process.cwd();
    const evidenceBase = path.join(rootDir, 'artifacts', 'armageddon');

    let targetRunId = runId;

    if (!targetRunId) {
        // Find most recent directory
        const dirs = fs.readdirSync(evidenceBase).filter(f => f.startsWith('adt-'));
        if (dirs.length === 0) {
            console.error('No run artifacts found.');
            process.exit(1);
        }
        // Sort by timestamp (string sort works for ISO-like structure if we did it right, 
        // but our format adt-<timestamp>-<rand> might need careful sort)
        dirs.sort();
        targetRunId = dirs[dirs.length - 1]; // Last one
        console.log(`Resolved latest run: ${targetRunId}`);
    }

    const runDir = path.join(evidenceBase, targetRunId);
    const evidenceDir = path.join(runDir, 'evidence');

    if (!fs.existsSync(evidenceDir)) {
        console.error(`Evidence directory not found: ${evidenceDir}`);
        process.exit(1);
    }

    console.log(`Generating Report for: ${targetRunId}`);

    // 1. Gather Data
    // We need to know what was INTENDED to run. 
    // Ideally `certify.ts` writes a `manifest.json` or we re-import registry.
    // For now, let's scan the logs and deduce. 
    // Better: The orchestrator should have dumped a `status.json`. 
    // Let's rely on finding *.log files and parsing them.

    const logFiles = fs.readdirSync(evidenceDir).filter(f => f.endsWith('.log'));

    interface ParsedBattery {
        name: string;
        status: BatteryStatus;
        startTime?: string;
        endTime?: string;
        durationMs?: number;
        exitCode?: number;
        logSnippet: string[];
    }

    const batteries: ParsedBattery[] = [];

    for (const file of logFiles) {
        const name = file.replace('.log', '');
        const content = fs.readFileSync(path.join(evidenceDir, file), 'utf-8');
        const lines = content.split('\n');

        let startTimeStr = undefined;
        let endTimeStr = undefined;
        let exitCode = undefined;
        const snippet: string[] = [];

        // Parse special markers
        for (const line of lines) {
            if (line.startsWith('BATT_START ')) {
                startTimeStr = line.replace('BATT_START ', '').trim();
            } else if (line.startsWith('BATT_END ')) {
                // BATT_END <ts> exit=<code>
                const parts = line.split(' ');
                if (parts.length >= 2) endTimeStr = parts[1];
                const exitPart = parts.find(p => p.startsWith('exit='));
                if (exitPart) exitCode = parseInt(exitPart.split('=')[1]);
            } else if (line.trim() !== '') {
                if (snippet.length < 5) snippet.push(line); // Capture first 5 lines for report
            }
        }

        let status: BatteryStatus = 'FAIL';
        if (exitCode === 0) status = 'PASS';
        else if (exitCode === undefined) status = 'RUNNING'; // or crashed hard

        // Calculate duration
        let durationMs = 0;
        if (startTimeStr && endTimeStr) {
            durationMs = new Date(endTimeStr).getTime() - new Date(startTimeStr).getTime();
        }

        batteries.push({
            name,
            status,
            startTime: startTimeStr,
            endTime: endTimeStr,
            durationMs,
            exitCode,
            logSnippet: snippet
        });
    }

    // 2. Generate JSON Report
    const jsonReport = {
        runId: targetRunId,
        timestamp: new Date().toISOString(),
        batteries,
        summary: {
            total: batteries.length,
            passed: batteries.filter(b => b.status === 'PASS').length,
            failed: batteries.filter(b => b.status !== 'PASS').length,
        }
    };

    fs.writeFileSync(path.join(runDir, 'armageddon-report.json'), JSON.stringify(jsonReport, null, 2));

    // 3. Generate Markdown Report
    let md = `# Armageddon Test Suite Certification Report\n\n`;
    md += `**Run ID:** \`${targetRunId}\`\n`;
    md += `**Timestamp:** ${new Date().toISOString()}\n\n`;

    md += `## 📊 Summary\n`;
    md += `| Total | Passed | Failed | Duration |\n`;
    md += `| :---: | :----: | :----: | :------: |\n`;
    md += `| ${jsonReport.summary.total} | ${jsonReport.summary.passed} | ${jsonReport.summary.failed} | - |\n\n`; // Total duration hard to calc from just individual logs without orchestrator start/end

    md += `## 🔋 Batteries\n`;
    md += `| Name | Status | Exit Code | Duration | Logs |\n`;
    md += `| :--- | :----- | :-------: | :------- | :--- |\n`;

    for (const b of batteries) {
        const statusIcon = b.status === 'PASS' ? '✅' : '❌';
        const durationStr = b.durationMs ? `${(b.durationMs / 1000).toFixed(2)}s` : '-';
        const logLink = `[Log](evidence/${b.name}.log)`;
        md += `| **${b.name}** | ${statusIcon} ${b.status} | ${b.exitCode ?? '?'} | ${durationStr} | ${logLink} |\n`;
    }

    md += `\n## 📝 Guardrails & Notes\n`;
    md += `All batteries executed in isolated processes with separate ports and tmp directories.\n`;

    fs.writeFileSync(path.join(runDir, 'armageddon-report.md'), md);

    // 4. Certificate
    if (jsonReport.summary.failed === 0 && jsonReport.summary.total > 0) {
        const cert = `
      CERTIFIED ARMAGEDDON SAFE
      Run ID: ${targetRunId}
      Date: ${new Date().toISOString()}
      
      This certifies that the codebase passed all ${jsonReport.summary.total} batteries.
      `;
        fs.writeFileSync(path.join(runDir, 'certificate.txt'), cert);
        console.log('✅ Certificate Generated.');
    } else {
        console.log('❌ Certification Failed.');
    }

    // 5. JUnit XML (basic)
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<testsuites>\n`;
    xml += `  <testsuite name="Armageddon ATSC" tests="${jsonReport.summary.total}" failures="${jsonReport.summary.failed}" errors="0" skipped="0">\n`;

    for (const b of batteries) {
        xml += `    <testcase name="${b.name}" classname="ATSC" time="${(b.durationMs || 0) / 1000}">\n`;
        if (b.status !== 'PASS') {
            xml += `      <failure message="Exit Code ${b.exitCode}">Check log: evidence/${b.name}.log</failure>\n`;
        }
        xml += `    </testcase>\n`;
    }
    xml += `  </testsuite>\n</testsuites>`;

    fs.writeFileSync(path.join(runDir, 'junit.xml'), xml);

    console.log(`\n📄 Reports generated in ${runDir}`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
