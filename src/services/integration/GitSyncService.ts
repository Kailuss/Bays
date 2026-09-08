import * as vscode         from 'vscode';
import { BayStateService } from '../core/BayStateService';
import type { GitStatus }  from '../../models/Bay';
import type { GitApi, GitExtensionExports, GitRepository } from './gitApiTypes';
import { buildGitIndex, isPathInsideRepo, normalizeFsPath } from '../../utils/gitIndex';
import type { GitStatus as IndexedStatus } from '../../models/BayTypes';

/**
 * Encapsula toda la sincronización con Git (status + listeners de repositorio).
 */
export class GitSyncService {
  private disposables                  : vscode.Disposable[] = [];
  private _gitApi                      : GitApi | null = null;
  private _gitRepoListeners            = new Map<string, vscode.Disposable>();
  private _gitOpenRepoListenerAttached = false;

  /**
   * Each repository's state indexed by path, keyed by normalised root.
   *
   * Built LAZILY, on the first question that arrives after that repository
   * reports, and dropped when it reports again. Its freshness is exactly that of
   * the event the repaint already hangs off (`repo.state.onDidChange`): an index
   * staler than that would be a badge staler than that, and the badge would
   * already be so.
   */
  private _indexByRepo = new Map<string, ReadonlyMap<string, IndexedStatus>>();

  constructor(private stateService: BayStateService) {}

  activate(context: vscode.ExtensionContext): void {
    this._gitApi = this.resolveGitApi();

    // Extension change listener (for when Git extension is installed/enabled)
    this.disposables.push(
      vscode.extensions.onDidChange(() => {
        const oldApi = this._gitApi;
        this._gitApi = this.resolveGitApi();
        if (!oldApi && this._gitApi) {
          this.setupGitListeners();
          this.refreshAllGitStatuses();
        }
      }),
    );

    // Try to initialize immediately if Git is ready
    if (this._gitApi && this._gitApi.repositories.length > 0) {
      this.setupGitListeners();
      this.refreshAllGitStatuses();
    } else {

      // Setup listener for when Git opens a repository
      const setupOnRepoOpen = () => {
        const gitApi = this.resolveGitApi();
        if (gitApi && !this._gitOpenRepoListenerAttached) {
          this._gitApi = gitApi;
          this.attachRepoLifecycleListeners(gitApi);

          // If repositories already exist, setup listeners now
          if (gitApi.repositories.length > 0) {
            this.setupGitListeners();
            this.refreshAllGitStatuses();
          }
        }
      };

      // Try immediately
      setupOnRepoOpen();

      // Retry after delays
      setTimeout(() => {
        if (!this._gitApi || this._gitApi.repositories.length === 0) {
          setupOnRepoOpen();
        }
      }, 500);

      setTimeout(() => {
        if (!this._gitApi || this._gitApi.repositories.length === 0) {
          setupOnRepoOpen();
        }
      }, 2000);

      // The timed retries above only help if vscode.git is already active.
      // extensions.onDidChange does NOT fire on activation (only install/enable),
      // so on a slow workspace where git activates after 2s the retries would all
      // resolve to null and live git badge updates would be lost for the session.
      // Proactively activate the git extension and wire listeners once its API is up.
      const gitExt = vscode.extensions.getExtension<GitExtensionExports>('vscode.git');
      if (gitExt) {
        const wireWhenReady = () => {
          const api = this.resolveGitApi();
          if (api) {
            this._gitApi = api;
            this.setupGitListeners();       // idempotent: guarded per-repo + single lifecycle listener
            this.refreshAllGitStatuses();
          }
        };
        if (gitExt.isActive) {
          wireWhenReady();
        } else {
          gitExt.activate().then(wireWhenReady, () => { /* ignore activation failure */ });
        }
      }
    }

    context.subscriptions.push(...this.disposables);
  }

  /**
   * A file's git state: one lookup in the index of the repository holding it.
   *
   * The call is one per tab — converting a native tab, and once more per bay
   * whenever the repository reports — so what it costs has to stay flat in the
   * number of changes. The scan over the three lists lives in `buildGitIndex`,
   * which runs once per repository event instead.
   */
  getGitStatus(uri: vscode.Uri): GitStatus {
    try {
      const targetPath = normalizeFsPath(uri.fsPath);
      if (!targetPath) { return null; }

      const repo = this.repoFor(targetPath);
      if (!repo) { return null; }

      return this.indexFor(repo)?.get(targetPath) ?? null;
    } catch {
      // Silently fail if git is not available
      return null;
    }
  }

  /**
   * The MOST SPECIFIC repository containing the path.
   *
   * A file inside a submodule is prefix-"inside" both the parent and the inner
   * root, and the parent's change lists never contain inner files: returning
   * from the first prefix match would report that file as clean forever. The
   * longest matching root is the repo that actually tracks it. This walks
   * REPOSITORIES, of which there are a handful, never changes.
   */
  private repoFor(targetPath: string): GitRepository | null {
    if (!this._gitApi) { this._gitApi = this.resolveGitApi(); }
    if (!this._gitApi || this._gitApi.repositories.length === 0) { return null; }

    let best: GitRepository | null = null;
    let bestRootLen = -1;
    for (const repo of this._gitApi.repositories) {
      const repoRoot = normalizeFsPath(repo?.rootUri?.fsPath);
      if (!repoRoot || !isPathInsideRepo(targetPath, repoRoot)) { continue; }
      if (repoRoot.length > bestRootLen) {
        bestRootLen = repoRoot.length;
        best = repo;
      }
    }
    return best;
  }

  /** A repository's index, built the first time it is asked for. */
  private indexFor(repo: GitRepository): ReadonlyMap<string, IndexedStatus> | null {
    const repoRoot = normalizeFsPath(repo?.rootUri?.fsPath);
    if (!repoRoot) { return null; }

    const cached = this._indexByRepo.get(repoRoot);
    if (cached) { return cached; }

    const built = buildGitIndex(repo.state);
    this._indexByRepo.set(repoRoot, built);
    return built;
  }

  /** A repository reporting invalidates its own index, and only its own. */
  private invalidateIndex(repoRoot: string | null): void {
    if (repoRoot) { this._indexByRepo.delete(repoRoot); }
  }

  dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
    this._gitRepoListeners.forEach(sub => sub.dispose());
    this._gitRepoListeners.clear();
    this._indexByRepo.clear();
    this._gitOpenRepoListenerAttached = false;
  }

  private resolveGitApi(): GitApi | null {
    try {
      const ext = vscode.extensions.getExtension<GitExtensionExports>('vscode.git');
      return ext?.isActive ? ext.exports?.getAPI(1) ?? null : null;
    } catch {
      return null;
    }
  }

  private setupGitListeners(): void {
    try {
      if (!this._gitApi) { this._gitApi = this.resolveGitApi(); }
      const gitApi = this._gitApi;
      if (!gitApi) {
        return;
      }

      for (const repo of gitApi.repositories) {
        this.attachGitRepoListener(repo);
      }

      this.attachRepoLifecycleListeners(gitApi);
    } catch {
      // Silently fail if git setup fails
    }
  }

  private attachGitRepoListener(repo: GitRepository): void {
    const repoRoot = normalizeFsPath(repo?.rootUri?.fsPath);
    if (!repoRoot) {
      return;
    }
    if (this._gitRepoListeners.has(repoRoot)) {
      return;
    }

    const sub = repo.state.onDidChange(() => {
      // The index is dropped BEFORE the repaint: the other way round, every bay
      // would read the stale index and the repaint would change nothing.
      this.invalidateIndex(repoRoot);
      this.updateGitStatusForRepo(repo);
    });
    this._gitRepoListeners.set(repoRoot, sub);
    this.disposables.push(sub);
  }

  /**
   * Detaches the state listener for a closed repository so that reopening it
   * (which delivers a brand-new repo object) re-attaches a fresh subscription.
   * Without this, the root stays in the map forever and the reopened repo's
   * stage/unstage/commit events never refresh git badges until a full restart.
   */
  private detachGitRepoListener(repo: GitRepository): void {
    const repoRoot = normalizeFsPath(repo?.rootUri?.fsPath);
    if (!repoRoot) { return; }
    const sub = this._gitRepoListeners.get(repoRoot);
    if (sub) {
      sub.dispose();
      this._gitRepoListeners.delete(repoRoot);
    }
    // Reopening it hands back a NEW object, so an index kept under that root
    // would be the previous repository's, with nothing left to drop it.
    this.invalidateIndex(repoRoot);
  }

  /**
   * Subscribes to repository open/close lifecycle events exactly once. Kept in a
   * helper so both bootstrap paths (immediate setup and the delayed retry) wire
   * the same listeners under a single guard.
   */
  private attachRepoLifecycleListeners(gitApi: GitApi): void {
    if (this._gitOpenRepoListenerAttached) { return; }
    this._gitOpenRepoListenerAttached = true;

    this.disposables.push(
      gitApi.onDidOpenRepository(repo => {
        this.attachGitRepoListener(repo);
        this.updateGitStatusForRepo(repo);
      }),
    );
    this.disposables.push(
      gitApi.onDidCloseRepository(repo => {
        this.detachGitRepoListener(repo);
      }),
    );
  }

  private refreshAllGitStatuses(): void {
    // Called by bootstrap and by an extension change, neither of which goes
    // through any repository's event: without this, whatever was indexed before
    // git finished scanning would stay put.
    this._indexByRepo.clear();

    for (const bay of this.stateService.getAllBays()) {
      const uri = bay.metadata.uri;
      if (!uri) { continue; }

      const newGitStatus = this.getGitStatus(uri);
      if (bay.state.gitStatus !== newGitStatus) {
        bay.state.gitStatus = newGitStatus;
        this.stateService.updateBayStateWithAnimation(bay);
      }
    }
  }

  private updateGitStatusForRepo(repo: GitRepository): void {
    const repoRoot = normalizeFsPath(repo?.rootUri?.fsPath);
    if (!repoRoot) { return; }

    for (const bay of this.stateService.getAllBays()) {
      const uri = bay.metadata.uri;
      if (!uri) { continue; }
      const targetPath = normalizeFsPath(uri.fsPath);
      if (!targetPath || !isPathInsideRepo(targetPath, repoRoot)) { continue; }

      const newGitStatus = this.getGitStatus(uri);

      if (bay.state.gitStatus !== newGitStatus) {
        bay.state.gitStatus = newGitStatus;
        this.stateService.updateBayStateWithAnimation(bay);
      }
    }
  }
}
