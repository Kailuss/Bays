import * as vscode from 'vscode';
import { Bay } from '../../../models/Bay';
import { BayHelpers } from '../../../models/BayHelpers';
import { BayStateService } from '../BayStateService';
import { Logger } from '../../../platform/logger';

/**
 * Closing a variant without taking its parent with it.
 *
 * Closing a diff tab is not one operation: VS Code may close the SOURCE editor
 * as a side effect of closing its diff, and it delivers the close events for
 * both afterwards, out of our hands. So the sequence is: mark both as
 * intentional so the event layer ignores the echo, update our own state first,
 * close the tab, check whether the parent survived and reopen it if it did not,
 * and only drop the markers once VS Code has settled.
 *
 * It lives in its own file because none of that is dispatch. It hung off the
 * webview provider, whose job is to answer a message and get out of the way, and
 * it was a third of that file.
 */

/** How the close ended, as far as the caller has to care. */
export type CloseOutcome =
  /** The state is in step with the editors; whatever changed already notified. */
  | 'settled'
  /** The model and the editors disagree: repaint from the truth. */
  | 'resync';

/** Interval between checks that VS Code has finished cascading. */
const POLL_INTERVAL = 150;
/** Ceiling on that wait: the markers come off either way. */
const MAX_WAIT = 3000;
/** Grace for VS Code to process the close before the parent is looked for. */
const SETTLE_DELAY = 100;

export class VariantCloser {
  constructor(private readonly stateService: BayStateService) {}

  async close(variant: Bay): Promise<CloseOutcome> {
    Logger.log(`[VariantCloser] === CLOSE VARIANT START: ${variant.metadata.label} ===`);

    // Not a variant at all: nothing to keep alive, so a plain close.
    if (!variant.metadata.sourceBayId) {
      Logger.warn(`[VariantCloser] Not a variant (no parentId), closing normally: ${variant.metadata.id}`);
      await variant.close();
      return 'settled';
    }

    // The parent is read BEFORE anything moves: every phase below is about it.
    const parent = this.stateService.getBayById(variant.metadata.sourceBayId);
    if (!parent) {
      Logger.warn(`[VariantCloser] Parent bay not found: ${variant.metadata.sourceBayId}`);
      await variant.close();
      return 'settled';
    }

    const variantNativeTab = BayHelpers.findNativeTab(variant.metadata, variant.state);
    if (!variantNativeTab) {
      Logger.warn('[VariantCloser] Variant native tab not found');
      return 'resync';
    }

    if (!(variantNativeTab.input instanceof vscode.TabInputTextDiff)) {
      Logger.warn('[VariantCloser] Not a diff tab, closing normally');
      await variant.close();
      return 'settled';
    }

    // Both are marked so the event layer skips the closes VS Code is about to
    // deliver for them: those describe what is being done here, on purpose, and
    // processing them again would remove the parent this is putting back.
    this.stateService.markAsIntentionalClose(variant.metadata.id);
    this.stateService.markAsIntentionalClose(parent.metadata.id);

    try {
      // Our own state first, and by hand: the events that would normally do it
      // are the ones just marked to be ignored.
      this.stateService.removeBayFromState(variant.metadata.id);

      await vscode.window.tabGroups.close(variantNativeTab, true);

      await new Promise(resolve => setTimeout(resolve, SETTLE_DELAY));

      // Closing a diff can close its source with it. Whether it did is a fact
      // about the native tabs, so it is asked of them and not of our model.
      const parentStillOpen = BayHelpers.findNativeTab(parent.metadata, parent.state);
      if (!parentStillOpen && parent.metadata.uri) {
        Logger.log(`[VariantCloser] Parent was closed by VS Code, reopening: ${parent.metadata.label}`);
        await vscode.window.showTextDocument(parent.metadata.uri, {
          viewColumn   : parent.state.viewColumn,
          preview      : false,
          preserveFocus: true,
        });
      }
    } catch (error) {
      Logger.error(`[VariantCloser] Close variant failed for ${variant.metadata.label}`, error);
    } finally {
      // ALWAYS, including after a failure: a rejected `showTextDocument` used to
      // leave the markers stuck, and from then on every external close of these
      // two bays was ignored in silence.
      this.releaseWhenSettled(variant, parent);
      this.stateService.notifyChange();
    }

    Logger.log(`[VariantCloser] === CLOSE VARIANT END: ${variant.metadata.label} ===`);
    return 'settled';
  }

  /**
   * Drops the intentional-close markers once VS Code has stopped cascading.
   *
   * Polled and not hung off `onDidChangeTabs`, because what is being waited for
   * is the ABSENCE of further events: the parent being back as a native tab is
   * the observable that says the cascade finished, and no event announces that
   * nothing more is coming. The ceiling is the safety net — markers left on are
   * worse than markers dropped early.
   */
  private releaseWhenSettled(variant: Bay, parent: Bay): void {
    let elapsed = 0;
    const parentMeta  = parent.metadata;
    const parentState = parent.state;

    const poll = setInterval(() => {
      elapsed += POLL_INTERVAL;
      const parentNativeTab = BayHelpers.findNativeTab(parentMeta, parentState);
      const settled = !!parentNativeTab || elapsed >= MAX_WAIT;
      if (!settled) { return; }

      clearInterval(poll);
      this.stateService.clearIntentionalClose(variant.metadata.id);
      this.stateService.clearIntentionalClose(parent.metadata.id);
      Logger.log(`[VariantCloser] Markers cleared after ${elapsed}ms (native tab ${parentNativeTab ? 'confirmed open' : 'not found — max wait reached'})`);
    }, POLL_INTERVAL);
  }
}
