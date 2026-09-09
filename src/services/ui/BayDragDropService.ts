import { BayStateService } from '../core/BayStateService';
import { Bay }    from '../../models/Bay';
import { Logger }          from '../../platform/logger';

/**
 * Por qué NO se ha movido una bay a otro grupo.
 *
 * Se devuelve el motivo y no un `false`, porque un drop que no mueve nada tiene
 * que poder decir por qué: los cuatro rechazos de política se veían todos igual
 * —el bloque animándose de vuelta a su sitio— y uno de ellos, el grupo de origen
 * BLOQUEADO, es asimétrico por dirección, así que se lee como que el arrastre
 * funciona hacia un lado y está roto hacia el otro.
 *
 * `null` es que se movió, que es la respuesta que no lleva motivo.
 */
export type MoveRefusal = 'no-bay' | 'variant' | 'pinned' | 'locked' | 'no-group' | 'failed';

/**
 * Service dedicated to drag & drop management of bays.
 * Handles reordering logic respecting restrictions:
 * - Pinned bays cannot be moved
 * - Pinned bays always stay at the top
 * - Cannot drag an unpinned bay over the pinned section
 * - Child bays (variants) cannot be dragged independently
 * 
 * @see services/ui/AGENT.md for detailed patterns
 */
export class BayDragDropService {
  constructor(private readonly stateService: BayStateService) {}

  /**
   * Reorders a bay within the same group.
   * @param sourceBayId - ID of the bay being moved
   * @param targetBayId - ID of the bay being dropped on
   * @param insertPosition - 'before' to insert before, 'after' to insert after
   * @returns true if reordering was successful, false if blocked by restrictions
   */
  reorderWithinGroup(
    sourceBayId: string,
    targetBayId: string,
    insertPosition: 'before' | 'after',
  ): boolean {
    const sourceBay = this.stateService.getBayById(sourceBayId);
    const targetBay = this.stateService.getBayById(targetBayId);

    if (!sourceBay || !targetBay) { return false; }
    if (sourceBay.state.groupId !== targetBay.state.groupId) { return false; }

    // Restriction: child bays cannot be moved (linked to their parent)
    if (sourceBay.metadata.sourceBayId) {
      Logger.log('[DragDrop] Blocked: Child bays cannot be dragged independently');
      return false;
    }

    // Restriction: pinned bays cannot be moved
    if (sourceBay.state.isPinned) { return false; }

    const group = this.stateService.getGroup(sourceBay.state.groupId);
    if (!group) { return false; }

    // Calculate index of last pinned bay
    const lastPinnedIndex = this.findLastPinnedIndex(group.bays);

    // Find current indices
    const sourceIndex = group.bays.findIndex(t => t.metadata.id === sourceBayId);
    const targetIndex = group.bays.findIndex(t => t.metadata.id === targetBayId);

    if (sourceIndex === -1 || targetIndex === -1) { return false; }

    // Calculate final insertion position
    let insertIndex = insertPosition === 'before' ? targetIndex : targetIndex + 1;

    // Restriction: don't allow unpinned bay to move over pinned section
    if (!sourceBay.state.isPinned && insertIndex <= lastPinnedIndex) {
      return false;
    }

    // If target bay is pinned, also block
    if (targetBay.state.isPinned && !sourceBay.state.isPinned) {
      return false;
    }

    // If moving to same position, do nothing
    if (sourceIndex === insertIndex || sourceIndex === insertIndex - 1) {
      return false;
    }

    // Perform reordering
    group.bays.splice(sourceIndex, 1);

    // Adjust insertIndex if needed (if we removed before insertion point)
    if (sourceIndex < insertIndex) {
      insertIndex--;
    }

    group.bays.splice(insertIndex, 0, sourceBay);

    // Update indexInGroup for all bays in the group
    group.bays.forEach((bay, idx) => {
      bay.state.indexInGroup = idx;
    });

    // No UI notification here: the webview commits the DOM move client-side as
    // part of the drop animation, so firing a full rebuild would only fight it.
    // The in-memory order is already updated above. If this reorder is rejected
    // (returns false), the caller refreshes to restore the authoritative order.
    return true;
  }

  /**
   * Moves a bay from one group to another.
   * @param sourceBayId - ID of the bay being moved
   * @param targetGroupId - ID of target group
   * @param targetBayId - ID of the bay being dropped on (optional)
   * @param insertPosition - 'before' or 'after' if targetBayId specified
   * @returns true if move was successful
   */
  async moveBetweenGroups(
    sourceBayId: string,
    targetGroupId: number,
    targetBayId?: string,
    //insertPosition?: 'before' | 'after',
  ): Promise<MoveRefusal | null> {
    const sourceBay = this.stateService.getBayById(sourceBayId);
    // Los dos rechazos de este metodo que no decian nada, dichos: un drop que no
    // mueve nada se ve igual que uno que no ha ocurrido, y los otros dos motivos
    // —una variante, un grupo bloqueado— ya se leen en el canal.
    if (!sourceBay) {
      Logger.warn('[DragDrop] Blocked: no bay with id ' + sourceBayId);
      return 'no-bay';
    }

    // Restriction: child bays (variants) follow their parent — never move alone.
    // Mirrors reorderWithinGroup; without it a variant could be torn off its group.
    if (sourceBay.metadata.sourceBayId) {
      Logger.log('[DragDrop] Blocked: variant bays cannot be moved between groups');
      return 'variant';
    }

    // Restriction: pinned bays cannot be moved
    if (sourceBay.state.isPinned) {
      Logger.log('[DragDrop] Blocked: bay is pinned');
      return 'pinned';
    }

    // Restriction: a locked group doesn't let its bays leave, which is what the
    // lock says and all it has to say. It used to be argued from the mechanics —
    // a move closed the bay in the source and reopened it in the target, so it
    // was a back door to the close button the lock takes away — and that stopped
    // being true when the move became a relocation of the live tab. The
    // restriction did not: taking a bay out of a locked group is taking it out.
    // Reordering INSIDE the group stays allowed; nothing leaves there.
    const sourceGroup = this.stateService.getGroup(sourceBay.state.groupId);
    if (sourceGroup?.isLocked) {
      Logger.log('[DragDrop] Blocked: source group is locked');
      return 'locked';
    }

    const targetGroup = this.stateService.getGroup(targetGroupId);
    if (!targetGroup) {
      Logger.warn('[DragDrop] Blocked: no group ' + targetGroupId
        + ' (open: ' + this.stateService.getGroups().map(g => g.id).join(', ') + ')');
      return 'no-group';
    }

    // If there's a specific target, check restrictions
    if (targetBayId) {
      const targetBay = this.stateService.getBayById(targetBayId);
      if (targetBay && targetBay.state.isPinned) {
        Logger.log('[DragDrop] Blocked: target bay is pinned');
        return 'pinned';
      }
    }

    // Relocate to the destination group, VARIANTS INCLUDED. What travels is the
    // block — a bay with its diffs and its preview under it — so the move is
    // composed by the hierarchy service, the same way closing is: the model does
    // not reach the hierarchy, and a bay is its row plus what hangs off it.
    //
    // Without that, dragging a bay to another group left its variants under the
    // header it came from: orphan rows there, and the bay offering the button
    // that opens them again because as far as it knows none ever appeared.
    //
    // Every row relocates as a live tab, so the bay IDs change (they embed the
    // viewColumn) and native tab events rebuild the view.
    try {
      const hierarchy = this.stateService.getHierarchyService();
      await (hierarchy?.moveBayWithVariants(sourceBay, targetGroupId)
             ?? sourceBay.moveToGroup(targetGroupId));
      return null;
    } catch (error) {
      Logger.error('[BayDragDrop] Failed to move bay between groups:', error);
      return 'failed';
    }
  }

  /**
   * Checks if a drop is valid.
   * @param sourceBayId - Bay being dragged
   * @param targetBayId - Bay being dropped on
   * @returns true if drop is valid
   */
  canDrop(sourceBayId: string, targetBayId: string): boolean {
    const sourceBay = this.stateService.getBayById(sourceBayId);
    const targetBay = this.stateService.getBayById(targetBayId);

    if (!sourceBay || !targetBay) { return false; }

    // Pinned bays cannot be moved
    if (sourceBay.state.isPinned) { return false; }

    // Cannot drop over pinned bays
    if (targetBay.state.isPinned) { return false; }

    return true;
  }

  /**
   * Finds the index of the last pinned bay in an array of bays.
   * @returns Index of last pinned bay, or -1 if no pinned bays
   */
  private findLastPinnedIndex(bays: Bay[]): number {
    let lastIndex = -1;
    for (let i = 0; i < bays.length; i++) {
      if (bays[i].state.isPinned) {
        lastIndex = i;
      }
    }
    return lastIndex;
  }
}
