import * as vscode from 'vscode';
import { Bay } from '../../models/Bay';
import { BayGroup } from '../../models/BayGroup';
import { Logger }       from '../../platform/logger';
import type { BayHierarchyService } from './BayHierarchyService';
import type { GroupCustomizationService } from '../ui/GroupCustomizationService';

/**
 * In-memory store for Bays and groups — the "source of truth" for the UI.
 * - `onDidChangeState`: structural changes (open/close/move bays).
 * - `onDidChangeStateSilent`: lightweight changes (e.g. only `isActive`) that don't need
 *   a full webview rebuild.
 *
 */
export class BayStateService {
  private bays   : Map<string, Bay>      = new Map();
  private groups : Map<number, BayGroup> = new Map();
  private _onDidChangeState                  = new vscode.EventEmitter<void>();
  readonly onDidChangeState                  = this._onDidChangeState.event;
  private _onDidChangeStateSilent            = new vscode.EventEmitter<void>();
  readonly onDidChangeStateSilent            = this._onDidChangeStateSilent.event;
  private _onDidChangeBayState               = new vscode.EventEmitter<string>();
  readonly onDidChangeBayState               = this._onDidChangeBayState.event;
  private _onDidChangeBayLabel               = new vscode.EventEmitter<string>();
  readonly onDidChangeBayLabel               = this._onDidChangeBayLabel.event;
  // Fires when the last intentional-close marker is dropped: the reconcile waits
  // out a close Bays itself is driving, and this is what tells it to run.
  private _onDidSettleCloses                 = new vscode.EventEmitter<void>();
  readonly onDidSettleCloses                 = this._onDidSettleCloses.event;

  // Hierarchy service (injected to avoid circular dependency)
  private hierarchyService?: BayHierarchyService;

  // Group customizations (name/color/lock) — injected from extension.ts, which
  // owns the ExtensionContext the service persists to.
  private groupCustomization?: GroupCustomizationService;

  /**
   * Tracking de cierres intencionales con contador de referencias.
   * Cuando cerramos variants programáticamente, marcamos el ID aquí.
   * - markAsIntentionalClose: incrementa el contador (varios variants pueden marcar el mismo parent)
   * - clearIntentionalClose: decrementa; solo se elimina cuando llega a 0
   * - hasIntentionalCloses: true mientras quede alguno (el reconcile espera)
   * Esto evita que el primer timeout limpie el marcador antes de que llegue
   * el evento de VS Code del segundo cierre.
   */
  private intentionalCloses = new Map<string, number>();

  /**
   * Marca un bay ID como cierre intencional.
   * Usado cuando cerramos una bay programáticamente para evitar
   * procesar el evento de cierre que VS Code disparará después.
   */
  markAsIntentionalClose(bayId: string): void {
    const current = this.intentionalCloses.get(bayId) ?? 0;
    this.intentionalCloses.set(bayId, current + 1);
    Logger.log(`[BayState] Marked as intentional close: ${bayId} (count: ${current + 1})`);
  }

  /**
   * True while any close Bays drives itself is still cascading. The reconcile
   * defers until then: mid-cascade the native tabs briefly lack a parent that is
   * about to be reopened, and rebuilding from that would drop it and send it to
   * the end of its group when it comes back.
   */
  hasIntentionalCloses(): boolean {
    return this.intentionalCloses.size > 0;
  }

  /**
   * Remueve un bay ID del tracking de cierres intencionales.
   * Debe llamarse después de procesar el cierre para limpiar el estado.
   */
  clearIntentionalClose(bayId: string): void {
    const current = this.intentionalCloses.get(bayId) ?? 0;
    if (current <= 1) {
      this.intentionalCloses.delete(bayId);
      Logger.log(`[BayState] Cleared intentional close: ${bayId}`);
      if (this.intentionalCloses.size === 0) { this._onDidSettleCloses.fire(); }
    } else {
      this.intentionalCloses.set(bayId, current - 1);
      Logger.log(`[BayState] Decremented intentional close: ${bayId} (count: ${current - 1})`);
    }
  }

  /**
   * Notifica cambios estructurales en el estado.
   * Usado por servicios especializados para disparar actualización de UI.
   */
  notifyChange(): void {
    this._onDidChangeState.fire();
  }

  /**
   * Notifica un cambio ligero de solo estado activo (isActive).
   * Dispara el emisor "silent" para que el provider haga una actualización
   * parcial por postMessage (toggle de la clase .active) en lugar de
   * reconstruir todo el HTML del webview.
   */
  notifyActiveChange(): void {
    this._onDidChangeStateSilent.fire();
  }

  /**
   * Inyecta el hierarchy service para evitar dependencia circular.
   * Llamado desde BaySyncService después de crear BayHierarchyService.
   */
  setHierarchyService(service: BayHierarchyService): void {
    this.hierarchyService = service;
  }

  /**
   * Obtiene el hierarchy service.
   * Retorna undefined si aún no ha sido inyectado.
   */
  getHierarchyService(): BayHierarchyService | undefined {
    return this.hierarchyService;
  }

  /**
   * Inyecta el servicio de personalización de grupos y lo aplica a los grupos
   * ya presentes (la inyección ocurre antes del primer sync, pero también puede
   * llegar después si el orden de arranque cambia).
   */
  setGroupCustomizationService(service: GroupCustomizationService): void {
    this.groupCustomization = service;
    this.applyGroupCustomizations();
  }

  getGroupCustomizationService(): GroupCustomizationService | undefined {
    return this.groupCustomization;
  }

  /**
   * Reaplica nombre, color y bloqueo sobre TODOS los grupos del mapa.
   * Necesario tras cada sync (los grupos se reconstruyen desde la API nativa,
   * que no sabe nada de la personalización) y tras cada cambio del usuario.
   */
  applyGroupCustomizations(): void {
    if (!this.groupCustomization) { return; }
    for (const group of this.groups.values()) { this.groupCustomization.apply(group); }
  }

  /**
   * Reaplica la personalización y repinta. Nombre, color y bloqueo cambian el
   * markup de la cabecera y de los botones de cierre, así que es un cambio
   * estructural: rebuild completo, no parche por postMessage.
   */
  refreshGroupCustomizations(): void {
    this.applyGroupCustomizations();
    this.notifyChange();
  }

  //- Bay management

  /**
   * Remueve una bay del estado sin procesar jerarquía.
   * SOLO usar cuando la jerarquía ya fue actualizada manualmente.
   */
  removeBayFromState(id: string): void {
    this.removeBayInternal(id);
  }

  /**
   * Re-key a bay after its backing file was renamed or moved. The bay id embeds the
   * URI (`${uri}-${viewColumn}`), so a rename changes the id: the bay must move under
   * the new key both in the map and in its group array — kept at the SAME position so
   * manual drag order survives.
   *
   * `newBay` must be freshly converted from the post-rename native tab so every derived
   * field (label, path parts, language, git status) is already correct.
   *
   * Scope: a ROOT file bay. Its variants keep pointing at the old id until the
   * reconcile that always follows a rename recomputes their parent link from the
   * native tabs — this swap only has to keep the parent in its slot.
   *
   * @returns true if the bay was found and re-keyed; false otherwise (caller should resync).
   */
  rekeyBay(oldId: string, newBay: Bay): boolean {
    const oldBay = this.bays.get(oldId);
    if (!oldBay) { return false; }

    const newId = newBay.metadata.id;
    // Nothing to do if the id didn't actually change.
    if (newId === oldId) { return false; }
    // Never clobber a distinct existing bay (e.g. the rename target already open here).
    if (this.bays.has(newId)) { return false; }

    // Capture the position BEFORE removal so the fresh bay lands in the same slot.
    const group = this.groups.get(oldBay.state.groupId);
    const idx = group ? group.bays.findIndex(b => b.metadata.id === oldId) : -1;

    // removeBayInternal drops the map key, filters it out of the group and fires
    // onDidChangeState. It does NOT cascade to children — this path only handles
    // bays that have none.
    this.removeBayInternal(oldId);

    // Insert the fresh bay at the captured slot (preserves manual drag order).
    newBay.state.indexInGroup = oldBay.state.indexInGroup;
    this.bays.set(newId, newBay);
    if (group) {
      if (idx >= 0 && idx <= group.bays.length) { group.bays.splice(idx, 0, newBay); }
      else { group.bays.push(newBay); }
    }

    this._onDidChangeState.fire();
    Logger.log(`[BayState] Rekeyed bay ${oldId} → ${newId}`);
    return true;
  }

  // Método interno para eliminar sin lógica de jerarquía (evita recursión)
  private removeBayInternal(id: string): void {
    const bay = this.bays.get(id);
    if (bay) {

      const group = this.groups.get(bay.state.groupId);

      if (group) { group.bays = group.bays.filter(t => t.metadata.id !== id); }

      this.bays.delete(id);
      this._onDidChangeState.fire();
    }
  }

  // Update a bay in-place (both the map and its group array).
  updateBay(bay: Bay): void {
    this.bays.set(bay.metadata.id, bay);

    const group = this.groups.get(bay.state.groupId);
    if (group) {
      const index = group.bays.findIndex(t => t.metadata.id === bay.metadata.id);
      if (index !== -1) {
        group.bays[index] = bay;
      }
    }

    this._onDidChangeState.fire();
  }

  // Update a bay's diagnostic/git state and notify for animation.
  updateBayStateWithAnimation(bay: Bay): void {
    this.bays.set(bay.metadata.id, bay);

    const group = this.groups.get(bay.state.groupId);
    if (group) {
      const index = group.bays.findIndex(t => t.metadata.id === bay.metadata.id);
      if (index !== -1) {
        group.bays[index] = bay;
      }
    }
    
    // Solo dispara el evento de cambio de estado para la animación
    // NO dispara _onDidChangeState para evitar rebuild completo
    this._onDidChangeBayState.fire(bay.metadata.id);
  }

  /**
   * Notifica que el NOMBRE de una bay ha cambiado (título de webview reescrito en
   * runtime, p.ej. Claude Code mostrando la sesión actual). Actualización parcial
   * por postMessage: solo se reemplaza el texto de `.bay-name`, sin rebuild ni
   * cambio de id (el id del webview deriva del viewType estable, no del label).
   */
  notifyBayLabelChange(bayId: string): void {
    this._onDidChangeBayLabel.fire(bayId);
  }

  /**
   * Get a bay by ID (canonical method name per AGENT.md).
   * @returns Bay instance or undefined if not found
   */
  getBayById(id: string): Bay | undefined {
    return this.bays.get(id);
  }

  getAllBays(): Bay[] {
    return Array.from(this.bays.values());
  }

  /**
   * Every bay, WITHOUT copying the map.
   *
   * For passes that only READ and finish before anything mutates: a scan for
   * one bay's variants, or for which of them are active. `getAllBays` allocates
   * the whole list to be walked once and thrown away, and those passes run on
   * every close and on every tab switch. A pass that MUTATES takes the array
   * instead — iterating a Map while deleting from it is where that costs more
   * than it saves.
   */
  eachBay(): IterableIterator<Bay> {
    return this.bays.values();
  }

  getBaysByGroupId(groupId: number): Bay[] {
    const group = this.groups.get(groupId);
    return group ? [...group.bays] : [];
  }

  /**
   * Adopts a whole rebuilt state in one swap, WITHOUT firing anything: the
   * reconcile knows what actually changed and notifies through the narrowest
   * channel that says it (a rebuild, a state patch, a label, the active row).
   *
   * The groups arrive with their bays already in display order; the map is
   * derived from them, so the two can never hold different objects for one id.
   */
  adoptGroups(groups: BayGroup[]): void {
    this.groups.clear();
    this.bays.clear();
    for (const group of groups) {
      this.groupCustomization?.apply(group);
      this.groups.set(group.id, group);
      for (const bay of group.bays) { this.bays.set(bay.metadata.id, bay); }
    }
  }

  //- Group management

  getGroup(id: number): BayGroup | undefined {
    return this.groups.get(id);
  }

  // Sorted by column and never in insertion order: a list that read 1 3 2 4
  // would put a split opened at runtime after groups with a higher column.
  getGroups(): BayGroup[] {
    return Array.from(this.groups.values()).sort((a, b) => a.viewColumn - b.viewColumn);
  }

  //- Search

  // Buscar una bay por su URI; opcionalmente limitar al grupo indicado.
  findBayByUri(uri: vscode.Uri, groupId?: number): Bay | undefined {
    const uriString = uri.toString();

    for (const bay of this.bays.values()) {
      if (bay.metadata.uri?.toString() === uriString) {
        if (groupId === undefined || bay.state.groupId === groupId) {
          return bay;
        }
      }
    }

    return undefined;
  }

  // Todas las bays que comparten una URI (el mismo archivo abierto en varios
  // grupos son bays distintas). Diagnósticos y git status son por-URI, no
  // por-grupo, así que cambios de estado deben aplicarse a todas.
  findBaysByUri(uri: vscode.Uri): Bay[] {
    const uriString = uri.toString();
    const matches: Bay[] = [];
    for (const bay of this.bays.values()) {
      if (bay.metadata.uri?.toString() === uriString) { matches.push(bay); }
    }
    return matches;
  }

  //- Pin / unpin reordering

  /**
   * Reordena una bay después de pin/unpin.
   * Mueve la bay justo después de la última bay pinneada en su grupo.
   */
  private reorderAfterPinChange(bayId: string): void {
    const bay = this.bays.get(bayId);
    if (!bay) { return; }

    const group = this.groups.get(bay.state.groupId);
    if (!group) { return; }

    // Remove the bay from its current position
    const idx = group.bays.findIndex(t => t.metadata.id === bayId);
    if (idx === -1) { return; }
    group.bays.splice(idx, 1);

    // Find the insertion point: after the last pinned bay
    let insertAt = 0;
    for (let i = 0; i < group.bays.length; i++) {
      if (group.bays[i].state.isPinned) { insertAt = i + 1; }
    }

    group.bays.splice(insertAt, 0, bay);
    this._onDidChangeState.fire();
  }

  /**
   * Moves a bay to just after the last pinned bay in its group.
   * Called after the bay is pinned so it visually moves up.
   */
  reorderOnPin(bayId: string): void {
    this.reorderAfterPinChange(bayId);
  }

  /**
   * Moves a bay to the first position among non-pinned bays in its group.
   * Called after the bay is unpinned.
   */
  reorderOnUnpin(bayId: string): void {
    this.reorderAfterPinChange(bayId);
  }

  dispose(): void {
    this._onDidChangeState.dispose();
    this._onDidChangeStateSilent.dispose();
    this._onDidChangeBayState.dispose();
    this._onDidChangeBayLabel.dispose();
    this._onDidSettleCloses.dispose();
  }
}
