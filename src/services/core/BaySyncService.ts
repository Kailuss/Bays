import * as vscode from 'vscode';
import { BayStateService } from './BayStateService';
import { GitSyncService } from '../integration/GitSyncService';
import { BayHierarchyService } from './BayHierarchyService';
import { DiffStatsService } from './DiffStatsService';
import { BayEventService } from './bay/BayEventService';
import { BayHeadService } from './bay/BayHeadService';
import { ActiveStateService } from './bay/ActiveStateService';
import { ClaudeConversationService } from '../integration/ClaudeConversationService';
import { Bay } from '../../models/Bay';
import { BayGroup, createTabGroup } from '../../models/BayGroup';
import { convertToBay, demoteOrphanVariant, getDiagnosticSeverity } from './helpers/tabConverter';
import { orderGroup, orphanedVariants, sameShape, type ShapeFacts } from '../../utils/reconcileRules';
import { TIMINGS } from '../../constants/timings';
import { Logger } from '../../platform/logger';

/**
 * Keeps the bay state in agreement with VS Code by RECONCILING, never patching.
 *
 * Every tab change schedules one rebuild of the whole state from
 * `vscode.window.tabGroups`: each native tab is converted afresh, and the result
 * is merged with what is on screen. The native tabs are the only thing that is
 * never wrong about what is open, so a rebuild cannot drift; event-by-event
 * patching did, and nothing ever corrected it until a split happened to force a
 * full sync.
 *
 * What a rebuild keeps from the previous state is only what the PANEL owns
 * (`utils/reconcileRules.ts`): the order a group was dragged into, and the bay
 * OBJECT itself while it is still the same bay — so what other services wrote on
 * it (a measured diff count, a Claude conversation title, a cursor) survives.
 *
 * And it never opens a tab to make the state fit a rule. A variant whose parent
 * is closed is demoted to a root row: the native tabs say the parent is closed,
 * and reopening it is the view fighting the user's own close.
 */
export class BaySyncService {
  private gitSyncService: GitSyncService;
  private hierarchyService: BayHierarchyService;
  private diffStatsService: DiffStatsService;

  private bayEventService: BayEventService;
  private bayHeadService: BayHeadService;
  private activeStateService: ActiveStateService;

  // Coalescing de onDidChangeDiagnostics (evento de alta frecuencia)
  private static readonly DIAGNOSTICS_DEBOUNCE_MS = 100;
  private pendingDiagnosticUris = new Map<string, vscode.Uri>();
  private diagnosticsFlushTimer: ReturnType<typeof setTimeout> | null = null;

  private reconcileTimer: ReturnType<typeof setTimeout> | null = null;
  /** A reconcile was asked for while Bays was driving a close; run it after. */
  private reconcileDeferred = false;

  constructor(private stateService: BayStateService) {
    this.gitSyncService = new GitSyncService(this.stateService);
    this.hierarchyService = new BayHierarchyService(this.stateService);
    this.diffStatsService = new DiffStatsService(this.stateService);

    this.bayHeadService = new BayHeadService(this.gitSyncService);
    this.activeStateService = new ActiveStateService(this.stateService);

    this.bayEventService = new BayEventService(
      this.stateService,
      this.gitSyncService,
      this.hierarchyService,
      this.bayHeadService,
      this.activeStateService,
      () => this.scheduleReconcile(),
      (task) => this.enqueue(task),
    );

    this.stateService.setHierarchyService(this.hierarchyService);
  }

  activate(context: vscode.ExtensionContext): void {
    Logger.log('[BaySync] Activating BaySyncService');

    // The first reconcile goes through the queue like every other one, so a tab
    // event arriving during startup cannot interleave with it.
    void this.enqueue(async () => this.reconcile());

    this.bayEventService.activate();

    // onDidChangeDiagnostics es de alta frecuencia (dispara por cada pasada de
    // cada linter); se coalescen las URIs en una ventana corta y se procesa el
    // lote una sola vez, en vez de git+severity+postMessage por evento.
    context.subscriptions.push(
      vscode.languages.onDidChangeDiagnostics((event) => {
        for (const uri of event.uris) {
          this.pendingDiagnosticUris.set(uri.toString(), uri);
        }
        if (this.diagnosticsFlushTimer) { return; }
        this.diagnosticsFlushTimer = setTimeout(() => {
          this.diagnosticsFlushTimer = null;
          const uris = [...this.pendingDiagnosticUris.values()];
          this.pendingDiagnosticUris.clear();
          for (const uri of uris) {
            this.updateTabDiagnostics(uri);
          }
        }, BaySyncService.DIAGNOSTICS_DEBOUNCE_MS);
      }),
      // A close Bays drove itself has finished cascading: whatever was asked for
      // while it ran is answered now, from the tabs as they settled.
      this.stateService.onDidSettleCloses(() => {
        if (this.reconcileDeferred) { this.scheduleReconcile(); }
      }),
    );

    this.gitSyncService.activate(context);

    context.subscriptions.push(this);

    Logger.log('[BaySync] BaySyncService activated successfully');
  }

  private syncQueue: Promise<void> = Promise.resolve();

  /**
   * Serializa TODO el trabajo de sincronización en una única cola de promesas:
   * dos tareas nunca mutan el estado a la vez. Un fallo se loggea y no rompe la
   * cadena.
   */
  enqueue(task: () => Promise<void>): Promise<void> {
    const run = this.syncQueue.then(task);
    this.syncQueue = run.catch(err => {
      Logger.error('[BaySync] Queued sync task failed', err);
    });
    return run;
  }

  /**
   * One reconcile per burst. Tab events arrive in bursts (a split moving tabs, a
   * diff opening its parent, a terminal retitling while it prints), and every
   * one of them describes the same moment by the time the burst ends.
   *
   * The window is also what lets a rename land first: `onDidRenameFiles` is
   * queued straight away and re-keys the bay into its slot, so the reconcile
   * after it finds the bay under its new id instead of sending it to the end of
   * its group.
   */
  scheduleReconcile(): void {
    if (this.reconcileTimer) { clearTimeout(this.reconcileTimer); }
    this.reconcileTimer = setTimeout(() => {
      this.reconcileTimer = null;
      void this.enqueue(async () => this.reconcile());
    }, TIMINGS.RECONCILE_DEBOUNCE);
  }

  /**
   * Rebuilds the state from the native tabs and notifies through the narrowest
   * channel that says what changed. Synchronous on purpose: with no await in the
   * middle, nothing can move the tabs between reading them and committing.
   */
  private reconcile(): void {
    if (this.stateService.hasIntentionalCloses()) {
      this.reconcileDeferred = true;
      return;
    }
    this.reconcileDeferred = false;
    // Timed only when someone is reading the trace: it is the number that says
    // whether a rebuild per burst stays cheap in a given window.
    const startedAt = Logger.tracing ? performance.now() : 0;

    const previousGroups = this.stateService.getGroups();
    const previousIds = new Map(previousGroups.map(g => [g.id, g.bays.map(b => b.metadata.id)]));

    // Where every bay sat, across groups: ids embed the column, so a split that
    // renumbers columns is matched back by uri.
    const byId = new Map<string, number>();
    const byUri = new Map<string, number>();
    let slot = 0;
    for (const group of previousGroups) {
      for (const bay of group.bays) {
        byId.set(bay.metadata.id, slot);
        const uri = bay.metadata.uri?.toString();
        if (uri && !byUri.has(uri)) { byUri.set(uri, slot); }
        slot++;
      }
    }

    // 1. Convert every native tab afresh.
    const fresh: Array<{ bay: Bay; nativeIndex: number }> = [];
    for (const group of vscode.window.tabGroups.all) {
      group.tabs.forEach((tab, idx) => {
        const bay = convertToBay(tab, this.gitSyncService, idx);
        if (bay) { fresh.push({ bay, nativeIndex: idx }); }
      });
    }

    // 2. A variant whose parent is not open is drawn as a root row.
    const orphans = orphanedVariants(fresh.map(f => ({ id: f.bay.metadata.id, parentId: f.bay.metadata.sourceBayId })));
    for (const entry of fresh) {
      if (orphans.has(entry.bay.metadata.id)) { entry.bay = demoteOrphanVariant(entry.bay); }
    }

    // 3. Merge with what is on screen: keep the object while it is the same bay.
    let structural = false;
    let activeChanged = false;
    const stateChanged: Bay[] = [];
    const labelChanged: string[] = [];
    const merged = new Map<string, { bay: Bay; nativeIndex: number; isNew: boolean }>();

    for (const { bay, nativeIndex } of fresh) {
      // Two tabs composing one id would be one row listed twice; the first wins,
      // which is what the map has always kept.
      if (merged.has(bay.metadata.id)) { continue; }
      const old = this.stateService.getBayById(bay.metadata.id);
      if (old && sameShape(shapeOf(old), shapeOf(bay))) {
        const patch = patchNativeState(old, bay);
        if (patch.structural) { structural = true; }
        if (patch.active) { activeChanged = true; }
        if (patch.state) { stateChanged.push(old); }
        if (patch.label) { labelChanged.push(old.metadata.id); }
        merged.set(old.metadata.id, { bay: old, nativeIndex, isNew: false });
      } else {
        if (old) { carryPanelState(old, bay); }
        merged.set(bay.metadata.id, { bay, nativeIndex, isNew: true });
        structural = true;
      }
    }

    // A new variant inherits from its parent once the parent is final.
    for (const { bay, isNew } of merged.values()) {
      const parentId = bay.metadata.sourceBayId;
      if (!isNew || !parentId) { continue; }
      const parent = merged.get(parentId)?.bay;
      if (parent) { this.hierarchyService.inheritState(bay, parent); }
    }

    // 4. Groups, each in the order the panel keeps.
    const groups: BayGroup[] = [];
    for (const native of vscode.window.tabGroups.all) {
      const group = this.stateService.getGroup(native.viewColumn) ?? createTabGroup(native);
      if (group.isActive !== native.isActive) { activeChanged = true; }
      group.isActive = native.isActive;

      const members = [...merged.values()].filter(m => m.bay.state.groupId === native.viewColumn);
      const order = orderGroup(
        members.map(m => ({ id: m.bay.metadata.id, uriKey: m.bay.metadata.uri?.toString(), nativeIndex: m.nativeIndex })),
        { byId, byUri },
      );
      group.bays = order.map(id => merged.get(id)!.bay);
      group.bays.forEach((bay, idx) => { bay.state.indexInGroup = idx; });

      const before = previousIds.get(group.id);
      if (!before || !sameIds(before, order)) { structural = true; }
      groups.push(group);
    }
    if (groups.length !== previousGroups.length) { structural = true; }

    this.stateService.adoptGroups(groups);

    if (Logger.tracing) {
      Logger.log(`[BaySync] Reconciled ${merged.size} bays in ${(performance.now() - startedAt).toFixed(2)} ms (${structural ? 'rebuild' : 'patch'}): ${groups.map(g => `col ${g.viewColumn}${g.isActive ? '*' : ''} (${g.bays.length})`).join(', ')}`);
    }

    if (structural) {
      this.stateService.notifyChange();
      return;
    }
    for (const bay of stateChanged) { this.stateService.updateBayStateWithAnimation(bay); }
    for (const id of labelChanged) { this.stateService.notifyBayLabelChange(id); }
    if (activeChanged) { this.stateService.notifyActiveChange(); }
  }

  /**
   * Actualiza los diagnósticos y git status de una pestaña específica cuando cambian.
   */
  private updateTabDiagnostics(uri: vscode.Uri): void {
    // The same file can be open in several groups (distinct bays). Diagnostics
    // are per-URI, so every matching bay must be refreshed, not just the first.
    const bays = this.stateService.findBaysByUri(uri);
    if (bays.length === 0) { return; }

    const newDiagnosticSeverity = getDiagnosticSeverity(uri);
    const newGitStatus = this.gitSyncService.getGitStatus(uri);

    for (const bay of bays) {
      if (bay.state.diagnosticSeverity !== newDiagnosticSeverity ||
          bay.state.gitStatus !== newGitStatus) {
        Logger.log(`[BaySync] Updating diagnostics/git for: ${bay.metadata.label}`);
        bay.state.diagnosticSeverity = newDiagnosticSeverity;
        bay.state.gitStatus = newGitStatus;
        this.stateService.updateBayStateWithAnimation(bay);
      }
    }
  }

  dispose(): void {
    Logger.log('[BaySync] Disposing BaySyncService');
    if (this.diagnosticsFlushTimer) {
      clearTimeout(this.diagnosticsFlushTimer);
      this.diagnosticsFlushTimer = null;
    }
    if (this.reconcileTimer) {
      clearTimeout(this.reconcileTimer);
      this.reconcileTimer = null;
    }
    this.bayEventService.dispose();
    this.diffStatsService.dispose();
    this.gitSyncService.dispose();
  }
}

/** What says WHICH bay this is, as strings for `sameShape`. */
function shapeOf(bay: Bay): ShapeFacts {
  const m = bay.metadata;
  return {
    bayType    : m.bayType,
    uri        : m.uri?.toString(),
    originalUri: m.originalUri?.toString(),
    label      : m.label,
    detailLabel: m.detailLabel,
    diffType   : m.diffType,
    parentId   : m.sourceBayId,
    viewType   : m.viewType,
  };
}

/**
 * Copies onto a bay kept from the previous state the flags only VS Code knows,
 * and says which notification each change needs.
 *
 * A pin moves the row, so it is a rebuild; dirty, git and diagnostics are a
 * patch of one row; a retitled panel or terminal is a label patch — except a
 * Claude Code chat, whose label `ClaudeConversationService` owns with the full
 * title, and the native 24-character one would fight it on every event.
 */
function patchNativeState(old: Bay, fresh: Bay): { structural: boolean; active: boolean; state: boolean; label: boolean } {
  const o = old.state;
  const f = fresh.state;
  const result = { structural: false, active: false, state: false, label: false };

  if (o.isPinned !== f.isPinned) { o.isPinned = f.isPinned; result.structural = true; }
  if (o.isActive !== f.isActive) { o.isActive = f.isActive; result.active = true; }
  if (o.isDirty !== f.isDirty) { o.isDirty = f.isDirty; result.state = true; }
  if (o.gitStatus !== f.gitStatus) { o.gitStatus = f.gitStatus; result.state = true; }
  if (o.diagnosticSeverity !== f.diagnosticSeverity) { o.diagnosticSeverity = f.diagnosticSeverity; result.state = true; }
  // isPreview (the italic editor) is drawn nowhere: kept in sync, notifies nothing.
  o.isPreview = f.isPreview;
  o.capabilities = f.capabilities;

  if (old.metadata.label !== fresh.metadata.label && !ClaudeConversationService.isClaudeConversationBay(old)) {
    old.metadata.label = fresh.metadata.label;
    old.metadata.tooltipText = fresh.metadata.tooltipText;
    result.label = true;
  }
  return result;
}

/**
 * Carries onto a REPLACED bay (same id, different shape) what the panel and its
 * services wrote on the old object, which the native tab cannot give back.
 */
function carryPanelState(old: Bay, fresh: Bay): void {
  const o = old.state;
  const f = fresh.state;
  f.viewMode       = o.viewMode;
  f.cursorLine     = o.cursorLine;
  f.cursorColumn   = o.cursorColumn;
  f.integrations   = o.integrations;
  f.lastAccessTime = o.lastAccessTime;
  // A measured count is keyed by id in DiffStatsService, which will not measure
  // the same documents twice, so dropping it here would leave the row blank. A
  // Copilot edit is the exception: its count is in the label it just rewrote.
  if (o.diffStats && fresh.metadata.diffType !== 'edit') { f.diffStats = o.diffStats; }
  if (ClaudeConversationService.isClaudeConversationBay(old)) {
    fresh.metadata.label = old.metadata.label;
    fresh.metadata.tooltipText = old.metadata.tooltipText;
  }
}

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}
