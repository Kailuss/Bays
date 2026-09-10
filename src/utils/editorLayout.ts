/**
 * How many editor groups an editor layout holds, as a PURE RULE over the value
 * that `vscode.getEditorLayout` returns.
 *
 * Why it matters: with a floating window open, the workbench answers that
 * command for the WINDOW THAT HAS OS FOCUS (its `activePart`), and it answers
 * `openEditorAtIndex` the same way. So the layout is the one side-effect-free
 * question that says which window a command is about to act on. Counting its
 * leaves against the number of groups the Tab API reports tells two things
 * apart: one window (the counts agree) and several (the layout is short).
 *
 * The layout is `{ orientation, groups: Node[] }` and a node is either a leaf
 * (`{ size? }`) or a branch (`{ groups: Node[], size? }`). It comes from the
 * platform as untyped JSON, so it is read as `unknown` and every step checks.
 */

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function leavesOf(node: unknown): number {
  const record = asRecord(node);
  if (!record) { return 0; }
  const children = record.groups;
  if (!Array.isArray(children)) { return 1; }
  if (children.length === 0) { return 1; }
  return children.reduce<number>((sum, child) => sum + leavesOf(child), 0);
}

/**
 * The number of groups in the layout; 0 when the value is not a layout at all,
 * so a caller that compares it to the Tab API's count reads the malformed case
 * as "several windows" and takes the careful path instead of the fast one.
 */
export function countLayoutGroups(layout: unknown): number {
  const record = asRecord(layout);
  if (!record || !Array.isArray(record.groups)) { return 0; }
  return record.groups.reduce<number>((sum, child) => sum + leavesOf(child), 0);
}
