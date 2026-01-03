#!/usr/bin/env tsx
/**
 * CHAOS SIMULATION CLI
 *
 * Main entry point for running chaos simulations.
 *
 * USAGE:
 *   npm run sim:chaos       # Full chaos simulation
 *   npm run sim:dry         # Dry run (CI-safe)
 *   npm run sim:quick       # Quick test
 *   npm run sim:burst       # Burst mode
 */

import { runSimulation, quickTest } from './runner';
import { assertGuardRails } from './guard-rails';
import { DEFAULT_CHAOS_CONFIG, LIGHT_CHAOS_CONFIG, HEAVY_CHAOS_CONFIG, NO_CHAOS_CONFIG } from './chaos-engine';
import type { Beat } from './runner';
import type { CallReceivedPayload, CallCompletedPayload, AppointmentScheduledPayload, AppName } from './contracts';
import fs from 'fs';
import path from 'path';

// ============================================================================
// CLI CONFIGURATION
// ============================================================================

interface CLIOptions {
  mode: 'chaos' | 'dry' | 'quick' | 'burst' | 'custom';
  seed?: number;
  chaos?: 'light' | 'default' | 'heavy' | 'none';
  beats?: number;
  scenario?: string;
  rate?: number;
  duration?: number;
  validate?: boolean;
}

function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = {
    mode: 'chaos',
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--mode') {
      options.mode = args[++i] as any;
    } else if (arg === '--seed') {
      options.seed = parseInt(args[++i]);
    } else if (arg === '--chaos') {
      options.chaos = args[++i] as any;
    } else if (arg === '--beats') {
      options.beats = parseInt(args[++i]);
    } else if (arg === '--scenario') {
      options.scenario = args[++i];
    } else if (arg === '--rate') {
      options.rate = parseInt(args[++i]);
    } else if (arg === '--duration') {
      options.duration = parseInt(args[++i]);
    } else if (arg === '--validate') {
      options.validate = true;
    }
  }

  return options;
}

// ============================================================================
// CHAOS SIMULATION BEATS (Full Story)
// ============================================================================

function getFullStoryBeats(): Beat[] {
  return [
    {
      number: 1,
      name: 'TradeLine - Emergency Call',
      app: 'tradeline247',
      eventType: 'tradeline247:call.received',
      payload: {
        callId: 'call-001',
        from: '+1-555-0123',
        to: '+1-555-BOUTIQUE',
        timestamp: new Date().toISOString(),
      } as CallReceivedPayload,
      target: ['omnihub', 'jubeelove'],
      expectedOutcome: 'Call logged despite duplicate',
      observability: 'agent_runs table',
    },
    {
      number: 2,
      name: 'AutoRepAi - Repair Estimate',
      app: 'autorepai',
      eventType: 'autorepai:repair.estimated',
      payload: {
        estimateId: 'est-001',
        vehicleInfo: { make: 'Garment', model: 'Designer Jacket', year: 2024 },
        issues: ['Broken zipper', 'Torn lining'],
        estimatedCost: 75.00,
        estimatedDuration: '2 days',
      },
      target: 'flowbills',
      expectedOutcome: 'Estimate created after retry',
      observability: 'estimates table',
    },
    {
      number: 3,
      name: 'KeepSafe - Safety Check',
      app: 'keepsafe',
      eventType: 'keepsafe:safety_check.completed',
      payload: {
        checkId: 'safety-001',
        facility: 'Sarahs Boutique Main St',
        inspector: 'Fire Marshal Johnson',
        items: [
          { category: 'Fire Extinguishers', status: 'pass', notes: 'All operational' },
          { category: 'Emergency Exits', status: 'pass', notes: 'Clear and marked' },
        ],
        overallStatus: 'compliant',
        completedAt: new Date().toISOString(),
      },
      target: ['omnihub', 'careconnect'],
      expectedOutcome: 'Check logged despite delay',
      observability: 'safety_checks table',
    },
    {
      number: 4,
      name: 'FLOWBills - Invoice Created',
      app: 'flowbills',
      eventType: 'flowbills:invoice.created',
      payload: {
        invoiceId: 'inv-001',
        clientId: 'client-123',
        amount: 75.00,
        currency: 'USD',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        lineItems: [
          { description: 'Zipper repair', quantity: 1, unitPrice: 45.00, total: 45.00 },
          { description: 'Lining repair', quantity: 1, unitPrice: 30.00, total: 30.00 },
        ],
        taxRate: 0.08,
        totalAmount: 81.00,
      },
      target: ['flowc', 'omnihub'],
      expectedOutcome: 'Invoice + compliance check',
      observability: 'invoices table',
    },
    {
      number: 5,
      name: 'FlowC - Compliance Validation',
      app: 'flowc',
      eventType: 'flowc:compliance.validated',
      payload: {
        checkId: 'compliance-001',
        invoiceId: 'inv-001',
        status: 'passed',
        violations: [],
        validatedAt: new Date().toISOString(),
      },
      target: 'flowbills',
      expectedOutcome: 'Passed after retry',
      observability: 'audit_logs table',
    },
    {
      number: 13,
      name: 'TradeLine - Appointment Scheduled',
      app: 'tradeline247',
      eventType: 'tradeline247:appointment.scheduled',
      payload: {
        appointmentId: 'appt-001',
        callId: 'call-002',
        clientName: 'John Doe',
        scheduledFor: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        serviceType: 'Pickup - Repaired Jacket',
        notes: 'Zipper and lining repair completed',
      } as AppointmentScheduledPayload,
      target: ['omnihub', 'aspiral'],
      expectedOutcome: 'Appointment booked',
      observability: 'appointments table',
    },
  ];
}

// ============================================================================
// MODE HANDLERS
// ============================================================================

async function runChaosMode(options: CLIOptions): Promise<void> {
  console.log('🌀 Starting FULL CHAOS simulation...\n');

  const chaosConfig = options.chaos === 'light' ? LIGHT_CHAOS_CONFIG
    : options.chaos === 'heavy' ? HEAVY_CHAOS_CONFIG
    : options.chaos === 'none' ? NO_CHAOS_CONFIG
    : DEFAULT_CHAOS_CONFIG;

  const allBeats = getFullStoryBeats();
  const beats = options.beats ? allBeats.slice(0, options.beats) : allBeats;

  const result = await runSimulation({
    scenario: "Sarah's Terrible Day - Full Chaos",
    tenantId: process.env.SANDBOX_TENANT || 'sandbox-test',
    seed: options.seed || 42,
    chaos: chaosConfig,
    beats,
    dryRun: false,
  });

  await saveEvidence(result);
  printFinalSummary(result);
}

async function runDryMode(options: CLIOptions): Promise<void> {
  console.log('🧪 Starting DRY RUN simulation (CI-safe)...\n');

  const result = await runSimulation({
    scenario: "Sarah's Terrible Day - Dry Run",
    tenantId: process.env.SANDBOX_TENANT || 'ci-test',
    seed: options.seed || 42,
    chaos: DEFAULT_CHAOS_CONFIG,
    beats: getFullStoryBeats(),
    dryRun: true,
  });

  await saveEvidence(result);
  printFinalSummary(result);
}

async function runQuickMode(): Promise<void> {
  console.log('⚡ Starting QUICK TEST...\n');

  const result = await quickTest();

  await saveEvidence(result);
  printFinalSummary(result);
}

async function runBurstMode(options: CLIOptions): Promise<void> {
  console.log('💥 Starting BURST MODE (load testing)...\n');

  const rate = options.rate || 100; // events per second
  const duration = options.duration || 10; // seconds
  const totalEvents = rate * duration;

  console.log(`📊 Load Test Configuration:`);
  console.log(`   Rate: ${rate} events/sec`);
  console.log(`   Duration: ${duration} seconds`);
  console.log(`   Total Events: ${totalEvents}`);
  console.log(`   Concurrency: Auto-scaled\n`);

  const startTime = Date.now();
  const results: any[] = [];
  const errors: any[] = [];

  // Generate burst beats (simplified events for load testing)
  const burstBeats: Beat[] = [];
  const apps: AppName[] = ['tradeline247', 'autorepai', 'keepsafe', 'flowbills', 'flowc', 'omnihub'];

  for (let i = 0; i < totalEvents; i++) {
    const app = apps[i % apps.length];
    burstBeats.push({
      number: i + 1,
      name: `Burst Event ${i + 1}`,
      app,
      eventType: `${app}:burst.test` as any,
      payload: {
        burstId: i + 1,
        timestamp: Date.now(),
        data: `load-test-${i}`
      },
      target: 'omnihub',
      expectedOutcome: 'Processed under load',
      observability: 'metrics',
    });
  }

  console.log('🚀 Starting load generation...\n');

  // Run simulation with burst beats
  try {
    const result = await runSimulation({
      scenario: `Burst Load Test - ${totalEvents} events`,
      tenantId: process.env.SANDBOX_TENANT || `burst-${Date.now()}`,
      seed: options.seed || 42,
      chaos: options.chaos === 'none' ? NO_CHAOS_CONFIG :
             options.chaos === 'light' ? LIGHT_CHAOS_CONFIG :
             options.chaos === 'heavy' ? HEAVY_CHAOS_CONFIG :
             DEFAULT_CHAOS_CONFIG,
      beats: burstBeats,
      dryRun: true, // Dry run for load testing (no real backend calls)
    });

    const endTime = Date.now();
    const totalDuration = endTime - startTime;
    const actualRate = (totalEvents / totalDuration) * 1000;

    console.log('\n' + '═'.repeat(64));
    console.log('BURST MODE RESULTS');
    console.log('═'.repeat(64));
    console.log(`\n📊 Performance Metrics:`);
    console.log(`   Total Events: ${totalEvents}`);
    console.log(`   Total Duration: ${totalDuration}ms (${(totalDuration / 1000).toFixed(2)}s)`);
    console.log(`   Actual Rate: ${actualRate.toFixed(2)} events/sec`);
    console.log(`   Target Rate: ${rate} events/sec`);
    console.log(`   Success Rate: ${result.scorecard.system.errors ? '✅' : '❌'}`);
    console.log(`   Overall Score: ${result.scorecard.overallScore}/100`);

    // Calculate throughput
    const throughput = totalEvents / (totalDuration / 1000);
    console.log(`\n⚡ Throughput: ${throughput.toFixed(2)} events/second`);

    if (result.scorecard.passed) {
      console.log('\n✅ Load test PASSED');
    } else {
      console.log('\n❌ Load test FAILED');
      console.log('\nIssues:');
      result.scorecard.issues.forEach((issue: string) => console.log(`   • ${issue}`));
    }

    await saveEvidence(result);
    console.log(`\n📄 Full report: evidence/${result.runId}/scorecard.json`);

  } catch (error) {
    console.error('\n❌ Burst mode failed:', error);
    throw error;
  }
}

// ============================================================================
// EVIDENCE SAVING
// ============================================================================

async function saveEvidence(result: any): Promise<void> {
  const evidenceDir = path.join(process.cwd(), 'evidence', result.runId);

  if (!fs.existsSync(evidenceDir)) {
    fs.mkdirSync(evidenceDir, { recursive: true });
  }

  // Save scorecard
  fs.writeFileSync(
    path.join(evidenceDir, 'scorecard.json'),
    JSON.stringify(result.scorecard, null, 2)
  );

  // Save full result
  fs.writeFileSync(
    path.join(evidenceDir, 'result.json'),
    JSON.stringify(result, null, 2)
  );

  // Save logs
  fs.writeFileSync(
    path.join(evidenceDir, 'logs.txt'),
    result.logs.join('\n')
  );

  // Create latest symlink
  const latestLink = path.join(process.cwd(), 'evidence', 'latest');
  if (fs.existsSync(latestLink)) {
    fs.unlinkSync(latestLink);
  }
  fs.symlinkSync(evidenceDir, latestLink);

  console.log(`\n📁 Evidence saved to: ${evidenceDir}`);
}

// ============================================================================
// OUTPUT FORMATTING
// ============================================================================

function printFinalSummary(result: any): void {
  console.log('\n' + '═'.repeat(64));
  console.log('FINAL SUMMARY');
  console.log('═'.repeat(64));

  const score = result.scorecard.overallScore;
  const emoji = score >= 90 ? '🌟' : score >= 70 ? '✅' : score >= 50 ? '⚠️' : '❌';

  console.log(`\n${emoji} Overall Score: ${score.toFixed(1)}/100`);
  console.log(`   Status: ${result.passed ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`   Duration: ${result.durationMs}ms`);
  console.log(`   Beats: ${result.beats.length}`);

  if (result.scorecard.issues.length > 0) {
    console.log('\n⚠️  Issues:');
    result.scorecard.issues.forEach((issue: string) => console.log(`   - ${issue}`));
  }

  console.log(`\n📄 Full report: evidence/${result.runId}/scorecard.json\n`);

  process.exit(result.passed ? 0 : 1);
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const options = parseArgs();

  // Validate mode
  if (options.validate) {
    console.log('🛡️  Validating environment...\n');
    try {
      assertGuardRails();
      console.log('✅ Environment is valid\n');
      process.exit(0);
    } catch (error) {
      console.error(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }

  // Run selected mode
  try {
    switch (options.mode) {
      case 'chaos':
        await runChaosMode(options);
        break;

      case 'dry':
        await runDryMode(options);
        break;

      case 'quick':
        await runQuickMode();
        break;

      case 'burst':
        await runBurstMode(options);
        break;

      case 'custom':
        console.log('⚠️  Custom mode not yet implemented');
        break;

      default:
        console.error(`Unknown mode: ${options.mode}`);
        process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Simulation failed:');
    console.error(error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
