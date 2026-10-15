/**
 * One run of an async job at a time, shared by everyone who asks while it is in
 * flight.
 *
 * Made for the icon map: building it reads and parses the theme JSON, and the
 * first render asks for it once per icon that missed the cache, all before the
 * first build has landed — so without this each of them started its own build
 * (six parallel reads and parses of the same file, measured at startup).
 *
 * A FORCED run never joins the one in flight, because that one is reading
 * something that just changed (a theme switch). The job receives `isCurrent` so
 * a run that a forced one overtook can tell, and not write its stale result over
 * the newer one.
 */
export function singleFlight(
  job: (isCurrent: () => boolean) => Promise<void>,
): { run(opts?: { force?: boolean }): Promise<void> } {
  let inFlight: Promise<void> | null = null;
  let generation = 0;

  return {
    run(opts = {}) {
      if (inFlight && !opts.force) { return inFlight; }
      const mine = ++generation;
      const current = job(() => mine === generation).finally(() => {
        // Only the newest run clears the slot: an overtaken one settling late
        // must not drop the run that replaced it.
        if (mine === generation) { inFlight = null; }
      });
      inFlight = current;
      return current;
    },
  };
}
