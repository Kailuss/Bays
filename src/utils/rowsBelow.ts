/**
 * Which rows "Close Below" closes: every row drawn after this one in its group,
 * in BAYS' order and never in the native tab strip's.
 *
 * The two orders part as soon as a row is dragged, and the menu is read off the
 * list: closing by tab index would close rows the user sees ABOVE the one they
 * clicked. The row's own variants are left alone, because they hang from it —
 * they are part of the row that was clicked, not rows below it.
 */
export function rowsBelow<T extends { id: string; parentId?: string }>(rows: readonly T[], id: string): T[] {
  const at = rows.findIndex(r => r.id === id);
  if (at < 0) { return []; }
  return rows.slice(at + 1).filter(r => r.parentId !== id);
}
