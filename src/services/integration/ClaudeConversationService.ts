import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as fssync from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Bay } from '../../models/Bay';
import { BayHelpers } from '../../models/BayHelpers';
import { Logger } from '../../platform/logger';
import { matchConversationTitle } from '../../utils/claudeTitles';
import { mergeTitles, pickTitle, scanAppended, scanTail, type FoundTitles, type RangeReader } from '../../utils/transcriptScan';

/**
 * Reads Claude Code's conversation title from its on-disk transcripts and uses it
 * as the bay's display name.
 *
 * Why this exists: a Claude Code chat tab is a webview whose title VS Code exposes
 * (`Tab.label`) is deliberately truncated by Claude to `summary.substring(0,24)+"…"`.
 * The FULL untruncated title lives in the session transcript at
 * `~/.claude/projects/<workspace-slug>/<sessionId>.jsonl` as the last `ai-title`
 * line: `{type:"ai-title", aiTitle:"…", sessionId:"…"}`. There's no VS Code API to
 * read another extension's webview state, so we go to the transcript directly.
 *
 * Coupling warning: this depends on Claude Code's `~/.claude` layout and JSONL
 * format (verified on v2.1.218) and degrades cleanly — if nothing matches, the bay
 * keeps the native (truncated) tab label.
 */

// Lowercased substring of the chat panel's viewType (`mainThreadWebview-claudeVSCodePanel`).
const CLAUDE_PANEL_VIEWTYPE = 'claudevscodepanel';
// The first read of a transcript walks back from its end this much at a time…
const TAIL_CHUNK = 256 * 1024;
// …and gives up past this: a title farther back than that is not worth a read
// this large, and the tab keeps its native label until a new title is written.
const TAIL_BUDGET = 32 * 1024 * 1024;
// Cap on transcripts scanned per project dir (newest first) when matching a tab.
const MAX_TRANSCRIPTS = 24;
// A transcript whose last turn line says "working" but that has not been written
// for this long is a session that died mid-turn (a closed window, a crash): a
// running turn writes far more often than this.
const STALE_TURN_MS = 10 * 60 * 1000;

/** What one transcript says right now. */
type TranscriptState = { title: string; working: boolean };

export class ClaudeConversationService {
  private readonly projectsRoot = path.join(os.homedir(), '.claude', 'projects');
  // transcript path → the newest titles in it and how far it has been read.
  // A transcript only grows at its end, so a later pass reads the appended bytes
  // and nothing else (`utils/transcriptScan.ts`).
  private readonly scans = new Map<string, { found: FoundTitles; scannedTo: number; size: number; mtimeMs: number }>();
  private watchers: fssync.FSWatcher[] = [];
  private disposed = false;

  /** True for Claude Code conversation (chat) webview tabs. */
  static isClaudeConversationBay(bay: Bay): boolean {
    return bay.metadata.bayType === 'webview'
      && (bay.metadata.viewType ?? '').toLowerCase().includes(CLAUDE_PANEL_VIEWTYPE);
  }

  /** Workspace fsPath → Claude project-dir slug: `c:\A\B` → `c--A-B`. */
  private slugFor(fsPath: string): string {
    return fsPath.replace(/[:\\/]/g, '-');
  }

  /** Existing `projects/<slug>` dirs for the open workspace folders (case-insensitive). */
  private async projectDirs(): Promise<string[]> {
    const folders = vscode.workspace.workspaceFolders ?? [];
    if (folders.length === 0) { return []; }

    let entries: string[];
    try { entries = await fs.readdir(this.projectsRoot); }
    catch { return []; }

    const byLower = new Map(entries.map(e => [e.toLowerCase(), e]));
    const dirs: string[] = [];
    for (const folder of folders) {
      const slug = this.slugFor(folder.uri.fsPath);
      const real = byLower.get(slug.toLowerCase());
      if (real) { dirs.push(path.join(this.projectsRoot, real)); }
      else { Logger.log(`[ClaudeConv] no transcript dir for workspace "${folder.uri.fsPath}" (slug "${slug}")`); }
    }
    return dirs;
  }

  /**
   * The title a transcript shows now. The first read walks back from the end;
   * every later one reads only what was appended since — the file grows the
   * whole time Claude works, by whole tool outputs, so re-reading a tail (and a
   * full file when the tail held no title) was a multi-megabyte parse on every
   * pass of the watcher while a turn ran.
   */
  private async lastFound(file: string, size: number, mtimeMs: number): Promise<FoundTitles | undefined> {
    const prev = this.scans.get(file);
    if (prev && prev.size === size && prev.mtimeMs === mtimeMs) { return prev.found; }

    let fh: fs.FileHandle | undefined;
    try {
      fh = await fs.open(file, 'r');
      const handle = fh;
      const read: RangeReader = async (start, end) => {
        const buf = Buffer.alloc(end - start);
        const { bytesRead } = await handle.read(buf, 0, buf.length, start);
        return buf.subarray(0, bytesRead);
      };

      // A file that shrank was rewritten, not appended to: read it afresh.
      const scan = prev && size >= prev.scannedTo
        ? await scanAppended(prev.scannedTo, size, read)
        : await scanTail(size, read, { chunk: TAIL_CHUNK, maxBytes: TAIL_BUDGET });
      const found = prev && size >= prev.scannedTo ? mergeTitles(scan.found, prev.found) : scan.found;

      this.scans.set(file, { found, scannedTo: scan.scannedTo, size, mtimeMs });
      return found;
    } catch {
      return prev?.found;
    } finally {
      await fh?.close();
    }
  }

  /**
   * The latest title of each of the newest transcripts in the workspace's
   * project dirs.
   *
   * Resolved ONCE per pass and not once per bay: the candidate set is the same
   * for every Claude tab in the window, and building it is a `readdir` plus a
   * `stat` per transcript — hundreds of filesystem calls in a directory that has
   * been in use for a while. Per bay, that is that whole scan multiplied by the
   * open chats, on a path that runs whenever a tab opens or closes.
   *
   * `lastFound` reads only what each transcript gained since the last pass, so
   * what a repeat pass costs is the stats and the appended bytes.
   */
  private async candidateTitles(): Promise<TranscriptState[]> {
    const titles: TranscriptState[] = [];
    const now = Date.now();

    for (const dir of await this.projectDirs()) {
      let files: string[];
      try { files = (await fs.readdir(dir)).filter(f => f.endsWith('.jsonl')); }
      catch { continue; }

      const stated = await Promise.all(files.map(async f => {
        const p = path.join(dir, f);
        try { const st = await fs.stat(p); return { p, m: st.mtimeMs, size: st.size }; }
        catch { return { p, m: 0, size: -1 }; }
      }));
      stated.sort((a, b) => b.m - a.m);

      for (const { p, m, size } of stated.slice(0, MAX_TRANSCRIPTS)) {
        if (size < 0) { continue; }
        // The stat above already answered size and mtime: asking again per file
        // was a second round of filesystem calls for the same two numbers.
        const found = await this.lastFound(p, size, m);
        const title = found && pickTitle(found);
        if (!found || !title) { continue; }
        titles.push({ title, working: found.working === true && now - m < STALE_TURN_MS });
      }
    }

    return titles;
  }

  /**
   * Resolves the best display name for each Claude bay (full title when found,
   * else the current native tab label) and mutates `metadata.label` in place.
   * Returns the ids whose label actually changed, for a partial webview patch,
   * and the ids whose turn state moved — a spinner on the row, which is a
   * rebuild of that block.
   *
   * The turn state is only claimed through a MATCHED title: a tab whose
   * transcript cannot be named unambiguously draws no spinner, which is the
   * safe direction (a spinner on the wrong chat would be a lie).
   *
   * Mutating metadata.label is safe here: a webview bay's identity derives from the
   * stable viewType, never the label (see tabConverter.generateId).
   */
  async enrichLabels(bays: Bay[]): Promise<{ labels: string[]; working: string[] }> {
    const changed: string[] = [];
    const turned: string[] = [];
    if (bays.length === 0) { return { labels: changed, working: turned }; }

    const states = await this.candidateTitles();
    const titles = states.map(s => s.title);

    for (const bay of bays) {
      const full   = matchConversationTitle(titles, bay.metadata.label);
      // The same conversation can span two transcripts: working if either is.
      const working = full !== undefined && states.some(s => s.title === full && s.working);
      if ((bay.state.integrations.claude?.working ?? false) !== working) {
        bay.state.integrations = { ...bay.state.integrations, claude: { working } };
        turned.push(bay.metadata.id);
      }
      const native = BayHelpers.findNativeTab(bay.metadata, bay.state)?.label;
      const desired = full ?? native ?? bay.metadata.label;

      if (desired && desired !== bay.metadata.label) {
        Logger.log(`[ClaudeConv] "${bay.metadata.label}" -> "${desired}"${full ? '' : ' (native fallback - no transcript match)'}`);
        bay.metadata.label = desired;
        bay.metadata.tooltipText = full ?? desired;
        changed.push(bay.metadata.id);
      }
    }
    return { labels: changed, working: turned };
  }

  /**
   * Watches the workspace transcript dirs; fires `onChange` at most every 800 ms
   * while they are written.
   *
   * THROTTLED and not debounced: a running turn writes without pause, and a
   * debounce that restarts on every write would only fire once Claude goes
   * quiet — so the spinner would appear when the turn was nearly over. The
   * trailing pass is what catches the turn ending.
   */
  watch(onChange: () => void): void {
    void this.projectDirs().then(dirs => {
      if (this.disposed) { return; }
      let timer: NodeJS.Timeout | undefined;
      const fire = () => {
        if (timer) { return; }
        timer = setTimeout(() => { timer = undefined; onChange(); }, 800);
      };
      for (const dir of dirs) {
        try {
          this.watchers.push(fssync.watch(dir, { persistent: false }, () => fire()));
          Logger.log(`[ClaudeConv] Watching transcripts: ${dir}`);
        } catch (err) {
          Logger.warn(`[ClaudeConv] watch failed for ${dir}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    });
  }

  dispose(): void {
    this.disposed = true;
    for (const w of this.watchers) { try { w.close(); } catch { /* already gone */ } }
    this.watchers = [];
  }
}
