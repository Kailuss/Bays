// Which editor group holds the FOREGROUND tab.
//
// It is asked of the platform at the moment of reporting and never carried in
// our own model, because the two facts around it are easy to mistake for it:
//
//  - `Tab.isActive` means active IN ITS GROUP, so with the editor area split
//    every group has one. A list of active tabs says nothing about which group
//    is being worked in.
//  - `BayGroup.isActive` is a copy of this answer taken when a group event last
//    arrived. It is correct right after that event and can only go stale between
//    them, and there is nothing to gain by risking it: this is one property read.

import * as vscode from 'vscode';

/**
 * The view column of the group whose tab is in the foreground, or `null` when
 * there is no group at all (a window with the editor area empty).
 *
 * A group's id in this extension IS its view column (`createTabGroup`), so the
 * number needs no translation on the way to a header.
 */
export function activeGroupId(): number | null {
  return vscode.window.tabGroups.activeTabGroup?.viewColumn ?? null;
}
