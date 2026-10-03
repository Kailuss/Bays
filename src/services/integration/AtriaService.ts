// Lo que Atria sabe y esta vista no puede saber de otra forma: cómo se llama
// la VENTANA aquí.
//
// Es lo único que cruza por `exports`, y tiene que cruzar por ahí: ese nombre lo
// elige quien usa Atria y vive en SU `workspaceState`, que es por extensión. El
// resto de lo que las dos comparten son AJUSTES, y un ajuste se lee de la
// configuración sin pedirle nada a nadie (`platform/twinSettings.ts`).
//
// Y es el nombre de la ventana y no el de un proyecto, que es la pregunta que
// esta extensión de verdad hace: sus rutas no nombran la carpeta del workspace
// —`asRelativePath` se llama sin incluirla— así que lo único que aquí se NOMBRA
// es la ventana, en el título del panel.
//
// La forma del API se escribe aquí ESTRUCTURALMENTE y no se importa de Atria:
// los dos repositorios no comparten más que el fichero de workspace, y un tipo
// copiado a mano es lo que mantiene esto compilando cuando Atria no está al
// lado. Sin Atria —no instalada, no activa todavía, o una versión que no exporta
// la pregunta— la respuesta es `null` y el título es el de siempre.

import * as vscode from 'vscode';
import { Logger } from '../../platform/logger';

const ATRIA = 'Lovervoid.atria';

/** La pregunta que se le hace a Atria: una respuesta y cuándo se mueve. */
type Question = {
  readonly get         : () => unknown;
  readonly onDidChange : vscode.Event<void>;
};

/** La parte de los exports de Atria que esto lee (su `src/api.ts`). */
type AtriaExports = {
  readonly workspaceAlias? : Question;
};

export class AtriaService implements vscode.Disposable {
  private readonly changed = new vscode.EventEmitter<void>();
  /** El nombre de la ventana se movió en Atria, o Atria misma vino o se fue. */
  readonly onDidChange = this.changed.event;

  private alias: Question | null = null;
  private listening: vscode.Disposable[] = [];
  private readonly subscriptions: vscode.Disposable[] = [];

  constructor() {
    // Instalada o activada después: lo que se mueve entonces es la lista de
    // extensiones, que no recarga la ventana.
    this.subscriptions.push(vscode.extensions.onDidChange(() => { void this.attach(); }));
    void this.attach();
  }

  /**
   * Cómo se llama la ventana en Atria, o `null` sin ella y donde la ventana va
   * por su propio nombre.
   *
   * `null` es una respuesta y no un fallo: quien llama tiene el nombre que
   * siempre ha puesto, y lo usa.
   */
  windowName(): string | null {
    if (!this.alias) { return null; }
    try {
      const name = this.alias.get();
      return typeof name === 'string' && name.trim() !== '' ? name : null;
    } catch (e) {
      Logger.warn(`atria: the workspace alias API threw: ${String(e)}`);
      return null;
    }
  }

  private async attach(): Promise<void> {
    const extension = vscode.extensions.getExtension<AtriaExports>(ATRIA);
    if (!extension) {
      if (this.alias) { this.detach(); this.changed.fire(); }
      return;
    }
    try {
      const exports = extension.isActive ? extension.exports : await extension.activate();
      const alias = exports?.workspaceAlias ?? null;
      if (alias === this.alias) { return; }
      this.detach();
      this.alias = alias;
      if (alias) { this.listening.push(alias.onDidChange(() => this.changed.fire())); }
      Logger.log(`atria: window name ${alias ? 'read' : 'not exported'}`);
      this.changed.fire();
    } catch (e) {
      Logger.warn(`atria: could not reach it: ${String(e)}`);
    }
  }

  private detach(): void {
    for (const listening of this.listening) { listening.dispose(); }
    this.listening = [];
    this.alias = null;
  }

  dispose(): void {
    this.detach();
    for (const subscription of this.subscriptions) { subscription.dispose(); }
    this.changed.dispose();
  }
}
