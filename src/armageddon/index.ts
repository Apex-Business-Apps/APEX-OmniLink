/**
 * Armageddon Level 7 - Module Barrel Export
 * 
 * @module armageddon
 * @license Proprietary - APEX Business Systems Ltd.
 */

// Types
export type {
    Level7Config,
    BatteryResult,
    ArmageddonLevel7Result,
    ArmageddonEvent,
} from './types';

export {
    Battery,
    ESCAPE_THRESHOLD,
    DEFAULT_CONFIG,
    HEARTBEAT_INTERVAL,
    LOG_BATCH_INTERVAL,
    BASE_ESCAPE_PROBABILITY,
} from './types';

// Worker
export {
    createArmageddonWorker,
    ARMAGEDDON_TASK_QUEUE,
} from './worker';

// Workflow (for client imports)
export { ArmageddonLevel7Workflow, statusQuery, progressSignal } from './workflows/level7';

// Activities (for worker registration)
export {
    runBattery10GoalHijack,
    runBattery11ToolMisuse,
    runBattery12MemoryPoison,
    runBattery13SupplyChain,
} from './activities/level7';
