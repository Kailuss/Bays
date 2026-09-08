import * as vscode from 'vscode';

/**
 * The central logger, writing to the "Bays" output channel.
 *
 * `log` is GATED behind `bays.trace`, off by default, and that gate is not
 * hygiene. There are over a hundred call sites and several of them sit inside
 * per-tab loops on the sync path, so every one of them costs a `Date`, an ISO
 * format and a round trip to the channel — for a line nobody is reading unless
 * something is being debugged. The flag is cached and only re-read when the
 * setting moves, so the hot path costs one boolean.
 *
 * `warn` and `error` are NOT gated: a warning is something that went wrong, and
 * one that only shows up for whoever already suspected it is a warning nobody
 * ever reads. They are also rare by construction.
 */
export class Logger {
  private static outputChannel: vscode.OutputChannel;
  private static traceEnabled = false;
  private static configListener: vscode.Disposable | undefined;

  /** Creates the output channel. Call once from `activate()`. */
  static initialize(): void {
    this.outputChannel = vscode.window.createOutputChannel('Bays');
    this.readTrace();
    this.configListener?.dispose();
    this.configListener = vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('bays.trace')) { this.readTrace(); }
    });
  }

  private static readTrace(): void {
    this.traceEnabled = vscode.workspace.getConfiguration('bays').get<boolean>('trace', false);
  }

  /** Whether a trace line would be written. Read it before building an expensive one. */
  static get tracing(): boolean {
    return this.traceEnabled;
  }

  /** A trace line. Silent unless `bays.trace` is on. */
  static log(message: string): void {
    if (!this.traceEnabled) { return; }
    this.write(message);
  }

  /** A warning. Always written: nobody turns tracing on to find out it happened. */
  static warn(message: string): void {
    this.write(`WARN: ${message}`);
  }

  /** An error; with an Error object, its stack too. Always written. */
  static error(message: string, error?: unknown): void {
    this.write(`ERROR: ${message}`);
    if (error instanceof Error) {
      this.write(error.message);
      if (error.stack) {
        this.write(error.stack);
      }
    }
  }

  private static write(message: string): void {
    // Never on the way to the channel from a path that runs before `initialize`
    // (a module-level throw during activation): losing a line beats losing the
    // activation.
    this.outputChannel?.appendLine(`[${new Date().toISOString()}] ${message}`);
  }

  /** Shows the output channel in the UI. */
  static show(): void {
    this.outputChannel?.show();
  }

  static dispose(): void {
    this.configListener?.dispose();
    this.configListener = undefined;
  }
}
