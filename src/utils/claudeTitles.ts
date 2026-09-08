// Which full conversation title a truncated tab label names, as a PURE RULE.
//
// Claude Code sets its chat tab's title to `title.substring(0, 24) + "…"`, and
// the untruncated one only exists inside its transcripts. Matching them is a
// prefix question with two ways of being wrong, and neither shows: naming the
// WRONG conversation reads exactly like naming the right one, and a tab that
// keeps its truncated label reads like a feature that is off.
//
// Reading the transcripts is I/O and lives in the service. What is decided from
// what they say is this, and on its own it can be pinned down by tests.

/** The label Claude gives a chat that has not been titled yet. */
const UNTITLED = 'Claude Code';

/** The marker Claude appends when it cuts a title down to the tab. */
const TRUNCATION_MARK = '…';

/**
 * The one candidate title the label names, or nothing.
 *
 * Ambiguity resolves to NOTHING, and that is the whole rule: two conversations
 * whose first 24 characters agree are indistinguishable from the label alone, so
 * picking either would be the panel asserting something it cannot know. The
 * caller falls back to the native label, which is at least true.
 *
 * Identical titles count as ONE candidate: the same conversation continued in a
 * second transcript is not an ambiguity, it is one answer written twice.
 */
export function matchConversationTitle(
  titles  : readonly string[],
  tabLabel: string,
): string | undefined {
  const prefix = tabLabel.endsWith(TRUNCATION_MARK) ? tabLabel.slice(0, -1) : tabLabel;

  // A brand-new session shows the generic label, which is a prefix of every
  // title that happens to start with it — matching on it would name whichever
  // conversation was written last.
  if (!prefix || prefix === UNTITLED) { return undefined; }

  const matches = new Set<string>();
  for (const title of titles) {
    if (title.startsWith(prefix)) { matches.add(title); }
  }

  return matches.size === 1 ? [...matches][0] : undefined;
}
