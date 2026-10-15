import * as vscode from 'vscode';
import { remapFileBayUri } from '../helpers/tabConverter';
import { BayStateService } from '../BayStateService';
import { GitSyncService } from '../../integration/GitSyncService';
import { BayHierarchyService } from '../BayHierarchyService';
import { BayHeadService } from './BayHeadService';
import { ActiveStateService } from './ActiveStateService';
import type { Bay } from '../../../models/Bay';
import { Logger } from '../../../platform/logger';

/**
 * BayEventService - the VS Code events, turned into reconciles.
 *
 * No handler here patches the bay state from an event's delta: a tab change, a
 * delete and a split all just schedule a reconcile (`BaySyncService`), which
 * rebuilds the state from the native tabs. The two that do more do it because
 * the event carries something the tabs cannot say: a rename says which old file
 * the new one IS (so the bay keeps its slot), and an opened diff is the moment
 * to open its parent.
 */
export class BayEventService {
  private disposables: vscode.Disposable[] = [];
  // Cached so the high-frequency selection handler doesn't read configuration
  // (nor scan bays) on every keystroke when cursor sync is off (the default).
  private syncCursorEnabled = false;

  constructor(
    private stateService: BayStateService,
    private gitSyncService: GitSyncService,
    private hierarchyService: BayHierarchyService,
    private bayHeadService: BayHeadService,
    private activeStateService: ActiveStateService,
    /** One state rebuild from the native tabs, coalesced per burst. */
    private scheduleReconcile: () => void,
    /**
     * Cola de serialización compartida de BaySyncService. Todo lo que mute el
     * estado o abra tabs pasa por aquí: VS Code NO espera a los listeners async.
     */
    private enqueue: (task: () => Promise<void>) => Promise<void>
  ) {}

  /**
   * Registra todos los event listeners necesarios.
   */
  activate(): void {
    Logger.log('[BayEvent] Activating event listeners');

    // Cache the cursor-sync flag; refresh it only when the setting changes.
    const readSyncCursor = () => {
      this.syncCursorEnabled = vscode.workspace
        .getConfiguration('bays')
        .get<boolean>('syncCursorPosition', false);
    };
    readSyncCursor();
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('bays.syncCursorPosition')) { readSyncCursor(); }
      })
    );

    this.disposables.push(
      vscode.window.tabGroups.onDidChangeTabs((event) => {
        // A diff opened with its file closed opens the file first; the
        // reconcile, queued behind it, then sees both.
        for (const tab of event.opened) {
          void this.enqueue(() => this.bayHeadService.openMissingParent(tab));
        }
        this.scheduleReconcile();
      })
    );

    // Filesystem-level events. On a rename/move VS Code updates the open editor in
    // place, but onDidChangeTabs only reports it as a `changed` flag event whose
    // recomputed id no longer matches the stored bay (the id embeds the URI) — so the
    // bay would keep its stale URI/label/path/git forever. Handle the rename (and the
    // matching delete cleanup) explicitly against the filesystem events.
    this.disposables.push(
      vscode.workspace.onDidRenameFiles((event) => {
        void this.enqueue(async () => this.handleFilesRenamed(event));
      })
    );

    this.disposables.push(
      // VS Code closes the editors of a deleted file, or keeps one open when it
      // holds unsaved changes. Either way the tabs say which, so: reconcile.
      vscode.workspace.onDidDeleteFiles(() => this.scheduleReconcile())
    );

    this.disposables.push(
      vscode.window.tabGroups.onDidChangeTabGroups((event) => {
        void this.enqueue(async () => this.handleGroupChanges(event));
      })
    );

    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(() => {
        // Active-only change → partial update (toggle .active), no full rebuild
        const { hasChanges } = this.activeStateService.syncActiveState();
        if (hasChanges) {
          this.stateService.notifyActiveChange();
        }
      })
    );

    this.disposables.push(
      vscode.window.onDidChangeTextEditorSelection((event) => {
        // Fast path: cursor sync disabled → skip the per-event bay lookup entirely
        if (!this.syncCursorEnabled) { return; }

        const uri = event.textEditor.document.uri;
        const bay = this.stateService.findBayByUri(uri);
        if (!bay || !event.selections[0]) { return; }

        const selection = event.selections[0];
        const line = selection.active.line + 1;
        const column = selection.active.character + 1;

        void this.hierarchyService.syncCursorPosition(bay.metadata.id, line, column);
      })
    );

    Logger.log('[BayEvent] Event listeners activated');
  }

  /**
   * VS Code renamed/moved one or more files (or whole folders). The open editors follow
   * to the new URIs, but a bay's id embeds its URI, so a rebuild alone would read the
   * renamed file as a NEW bay and send it to the end of its group.
   *
   * This is the one fact the tabs cannot give back — which new file the old one IS —
   * so root file bays are re-keyed in place, keeping their slot, and the reconcile that
   * follows does everything else: variants re-link to the new parent id on their own,
   * since their parent link is recomputed from the native tabs.
   *
   * The remap is derived from the event's newUri (not the native tab), so it does NOT
   * depend on VS Code having already propagated the tab-model update to the extension
   * host by the time this event fires.
   */
  private handleFilesRenamed(event: vscode.FileRenameEvent): void {
    const affected: Array<{ bay: Bay; newUri: vscode.Uri }> = [];
    // Snapshotted ONCE: `getAllBays` copies the whole map, and renaming a folder
    // delivers one event entry per file inside it.
    const bays = this.stateService.getAllBays();
    for (const { oldUri, newUri } of event.files) {
      for (const bay of bays) {
        const u = bay.metadata.uri;
        if (!u || !this.isSameOrUnder(u, oldUri)) { continue; }
        if (u.path === oldUri.path) {
          affected.push({ bay, newUri });
        } else {
          // Descendant of a renamed folder: swap the folder prefix, keep the suffix.
          const suffix = u.path.slice(oldUri.path.length); // includes leading '/'
          affected.push({ bay, newUri: newUri.with({ path: newUri.path + suffix }) });
        }
      }
    }
    for (const { bay, newUri } of affected) {
      // A variant's own uri is a diff side, not the file: the reconcile rebuilds it.
      if (bay.metadata.sourceBayId) { continue; }
      const fresh = remapFileBayUri(bay, newUri, this.gitSyncService);
      // Only fails on an id collision (the rename overwrote another open file):
      // the reconcile below settles which tab is which.
      if (this.stateService.rekeyBay(bay.metadata.id, fresh)) {
        Logger.log(`[BayEvent] Rekeyed bay after rename: ${bay.metadata.label} → ${newUri.fsPath}`);
      }
    }
    this.scheduleReconcile();
  }

  /** True if `u` is `base` itself or lives under it (same scheme/authority). */
  private isSameOrUnder(u: vscode.Uri, base: vscode.Uri): boolean {
    if (u.scheme !== base.scheme || u.authority !== base.authority) { return false; }
    return u.path === base.path || u.path.startsWith(base.path + '/');
  }

  /**
   * Maneja cambios en grupos de editores.
   */
  private handleGroupChanges(event: vscode.TabGroupChangeEvent): void {
    // STRUCTURAL: a split was created or closed. VS Code renumbers viewColumns,
    // which renames every bay id in those groups (they embed the column); the
    // reconcile matches them back by uri, so the manual order survives.
    if (event.opened.length > 0 || event.closed.length > 0) {
      this.scheduleReconcile();
      return;
    }

    // NON-STRUCTURAL (event.changed): active group moved and/or group flags.
    // The group holding the FOREGROUND tab, straight from the platform.
    const nativeActive = vscode.window.tabGroups.activeTabGroup?.viewColumn;
    let groupMoved = false;
    for (const group of this.stateService.getGroups()) {
      const active = group.id === nativeActive;
      if (group.isActive !== active) { groupMoved = true; }
      group.isActive = active;
    }

    // The group moving is a change of its own, and it has to be said out loud:
    // `Tab.isActive` means active IN ITS GROUP, so moving the focus from one
    // group to another leaves every one of those flags exactly where it was and
    // `syncActiveState` reports nothing. Asked of the bays alone, the header of
    // the group being worked in would stay on the one left behind until
    // something else happened to trigger a rebuild.
    const { hasChanges } = this.activeStateService.syncActiveState();
    if (hasChanges || groupMoved) {
      this.stateService.notifyActiveChange();
    }
  }

  /**
   * Limpia todos los event listeners.
   */
  dispose(): void {
    Logger.log('[BayEvent] Disposing event listeners');
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}
