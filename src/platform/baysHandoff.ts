import * as vscode from 'vscode';
import { Logger } from './logger';
import { adoptableEntries, HANDOFF_MARK } from '../utils/handoffRules';

/**
 * What `activate` returns: the door the `Lovervoid.bays` shell walks through.
 *
 * The handoff is PUSHED by the shell and never pulled from here. The shell
 * declares this extension as a dependency, so VS Code activates us first; an
 * `activate` that awaited the shell would wait for an extension that is itself
 * waiting for us. Pushed, the shell calls in once both are up.
 */
export interface SideTabsApi {
  /** Bumped if the shape of the offer ever changes. */
  readonly handoffVersion: 1;
  /** Takes over the old id's `workspaceState`; `true` when anything was written. */
  adoptBaysState(offered: unknown): Promise<boolean>;
}

export function createSideTabsApi(context: vscode.ExtensionContext, onAdopted: () => void): SideTabsApi {
  return {
    handoffVersion: 1,
    async adoptBaysState(offered) {
      const state = context.workspaceState;
      if (state.get<boolean>(HANDOFF_MARK)) { return false; }

      const entries = adoptableEntries(offered, state.keys());
      try {
        for (const [key, value] of entries) { await state.update(key, value); }
        await state.update(HANDOFF_MARK, true);
      } catch (error) {
        // Unmarked on purpose: the next window tries again.
        Logger.error('Could not take over the state of Lovervoid.bays', error);
        return false;
      }

      if (entries.length === 0) { return false; }
      Logger.log(`Took over ${entries.length} stored entries from Lovervoid.bays`);
      onAdopted();
      return true;
    },
  };
}
