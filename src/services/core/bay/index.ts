/**
 * Bay/ Folder - Specialized Services for Bay Synchronization
 *
 * Services:
 * - BayEventService: Event listener registration and handling
 * - BayHeadService: opens the parent of a diff the user just opened
 * - ActiveStateService: the active-row fast path between reconciles
 *
 * These services are composed together by BaySyncService as a thin orchestrator.
 *
 * @see src/services/core/AGENT.md
 */

export { BayEventService    } from './BayEventService';
export { BayHeadService     } from './BayHeadService';
export { ActiveStateService } from './ActiveStateService';
