/**
 * Only the newest of overlapping runs may act.
 *
 * Made for tab activation: it awaits several round trips to the workbench
 * (focus the group, read the layout, wait for another window) before the one
 * command that changes the active tab. Two clicks in quick succession run two
 * activations side by side, and without this whichever finishes LAST wins — with
 * a floating window, the slower wait is easily the FIRST click's, which leaves
 * active the row the user did not click last.
 *
 * `begin()` hands each run its own `isCurrent`, asked right before the step
 * that acts: a superseded run stops there and changes nothing.
 */
export function latestWins(): { begin(): () => boolean } {
  let generation = 0;
  return {
    begin() {
      const mine = ++generation;
      return () => mine === generation;
    },
  };
}
