import * as vscode from 'vscode';
import type { Bay } from '../../models/Bay';
import type { BayStateService } from './BayStateService';
import { countLineChanges } from '../../utils/lineDiff';
import { Logger } from '../../platform/logger';

/**
 * The `+N -M` a diff variant writes next to its name, MEASURED.
 *
 * It read `+0 -0` for every working tree and staged diff: the stats were a
 * placeholder written at link time, and nothing ever replaced them. The two
 * sides of a diff tab are documents VS Code already holds open — the file, and
 * what the `git:` / snapshot / Claude providers serve for the other side — so
 * the count is a read of both and a line diff (`utils/lineDiff.ts`, pure and
 * tested). No process is spawned.
 *
 * When it runs is a SWEEP over the variants in state, and the sweep is what
 * keeps it from looping: it hangs off the state change event, whose firing is
 * what writing a count does, so each variant remembers the document VERSIONS
 * it was measured at and a sweep that finds them unchanged writes nothing.
 * The other trigger is a document changing, debounced: the file under a
 * working tree diff moves with every keystroke, and the index side of a staged
 * diff is a document the git provider rewrites on stage and unstage.
 *
 * Previews are not diffs and have nothing to count; Copilot edits carry their
 * count in the label and keep it.
 */
export class DiffStatsService {
  private readonly disposables: vscode.Disposable[] = [];
  /** The document versions each variant was last measured at, by bay id. */
  private measuredAt = new Map<string, string>();
  private sweepTimer: ReturnType<typeof setTimeout> | null = null;
  private sweeping = false;
  private sweepAgain = false;

  private static readonly DEBOUNCE_MS = 250;

  constructor(private readonly stateService: BayStateService) {
    this.disposables.push(
      stateService.onDidChangeState(() => this.schedule()),
      vscode.workspace.onDidChangeTextDocument(() => this.schedule()),
    );
  }

  private schedule(): void {
    if (this.sweepTimer) { clearTimeout(this.sweepTimer); }
    this.sweepTimer = setTimeout(() => {
      this.sweepTimer = null;
      void this.sweep();
    }, DiffStatsService.DEBOUNCE_MS);
  }

  /** One sweep at a time; a request that lands mid-sweep runs it once more. */
  private async sweep(): Promise<void> {
    if (this.sweeping) { this.sweepAgain = true; return; }
    this.sweeping = true;
    try {
      const alive = new Set<string>();
      for (const bay of [...this.stateService.eachBay()]) {
        if (!countable(bay)) { continue; }
        alive.add(bay.metadata.id);
        await this.measure(bay);
      }
      // A closed variant would otherwise keep its versions for the window.
      for (const id of this.measuredAt.keys()) {
        if (!alive.has(id)) { this.measuredAt.delete(id); }
      }
    } finally {
      this.sweeping = false;
      if (this.sweepAgain) { this.sweepAgain = false; this.schedule(); }
    }
  }

  private async measure(bay: Bay): Promise<void> {
    const original = bay.metadata.originalUri;
    const modified = bay.metadata.uri;
    if (!original || !modified) { return; }

    let left: vscode.TextDocument;
    let right: vscode.TextDocument;
    try {
      [left, right] = await Promise.all([
        vscode.workspace.openTextDocument(original),
        vscode.workspace.openTextDocument(modified),
      ]);
    } catch (error) {
      // A side that cannot be read — a provider gone, a file deleted under the
      // diff — leaves the row without a count rather than with a wrong one.
      Logger.log(`[DiffStats] Cannot read a side of ${bay.metadata.label}: ${error}`);
      return;
    }

    const stamp = `${left.version}:${right.version}`;
    if (this.measuredAt.get(bay.metadata.id) === stamp) { return; }
    this.measuredAt.set(bay.metadata.id, stamp);

    const { added, removed } = countLineChanges(left.getText(), right.getText());
    const current = bay.state.diffStats;
    if (current?.linesAdded === added && current?.linesRemoved === removed) { return; }

    // The bay may have been replaced by a resync while the documents were
    // read: the count is written on whatever now carries that id.
    const live = this.stateService.getBayById(bay.metadata.id);
    if (!live) { return; }
    live.state.diffStats = { linesAdded: added, linesRemoved: removed };
    this.stateService.updateBay(live);
  }

  dispose(): void {
    if (this.sweepTimer) { clearTimeout(this.sweepTimer); this.sweepTimer = null; }
    for (const d of this.disposables) { d.dispose(); }
    this.disposables.length = 0;
  }
}

/** A variant whose two sides are text: a diff, and not a preview or an edit. */
function countable(bay: Bay): boolean {
  const kind = bay.metadata.diffType;
  if (!bay.metadata.sourceBayId || !kind) { return false; }
  // Copilot writes its count in the label, and a preview has no sides.
  return kind !== 'preview' && kind !== 'edit';
}
