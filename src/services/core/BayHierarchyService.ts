import { syncCursorPosition as syncCursorPositionUtil } from './BayCursorSyncUtils';
import type { Bay } from '../../models/Bay';
import type { BayStateService } from './BayStateService';
import { Logger } from '../../platform/logger';

/**
 * Manages hierarchical parent-child relationships between Bays.
 *
 * Responsibilities:
 * - Register/unregister children under parents
 * - Keep hasVariant and variantCount synchronized
 * - Inherit state from parent to child (only viewMode for Markdown)
 * - Recalculate counters when necessary
 *
 * IMPORTANT:
 * - Markdown children inherit ONLY viewMode from parent
 * - gitStatus, diagnosticSeverity and state icons are NOT inherited
 * - Children have NO bay-actions (only close button)
 * - When a child is active, parent maintains active appearance
 *
 * @see services/core/AGENT.md
 */
export class BayHierarchyService {
  // --- Constructor y dependencias ---
  constructor(
    private stateService: BayStateService
  ) {}

  // --- MÉTODOS PÚBLICOS DE JERARQUÍA ---

  /**
   * Registers a child bay under its parent.
   * Updates hasChildren and childrenCount of the parent.
   *
   * @param variantBayId Child bay ID
   * @param sourceBayId Parent bay ID
   */
  linkVariantToParentBay(variantBayId: string, sourceBayId: string): void {

    const sourceBay = this.stateService.getBayById(sourceBayId);

    // Si el sourceBay no existe, no podemos registrar variantBay.
    // Esto puede pasar si el evento de creación del sourceBay aún no se ha procesado.
    if (!sourceBay) {
      Logger.log(`[BayHierarchy] Cannot register child: sourceBay not found (${sourceBayId})`);
      return;
    }

    // Verificar que el variantBay existe antes de registrarlo en la jerarquía.
    const bayVariant = this.stateService.getBayById(variantBayId);
    if (!bayVariant) {
      Logger.log(`[BayHierarchy] Cannot register variant: variantBay not found (${variantBayId})`);
      return;
    }

    // Update sourceBay state
    sourceBay.state.hasVariant = true;
    sourceBay.state.variantCount++;
    // Note: canExpand computed on-demand, not stored in capabilities

    this.stateService.updateBay(sourceBay);

    Logger.log(`[BayHierarchy] Registered child: ${bayVariant.metadata.label} → ${sourceBay.metadata.label} (count: ${sourceBay.state.variantCount})`);
  }

  /**
   * Unregisters a variant bay from its source bay.
   * Updates hasChildren and childrenCount of the source bay.
   *
   * @param variantBayId Variant bay ID
   * @param sourceBayId Source bay ID
   */
  detachVariantFromParentBay(_variantBayId: string, sourceBayId: string): void {
    const sourceBay = this.stateService.getBayById(sourceBayId);
    if (!sourceBay) {
      Logger.log(`[BayHierarchy] Cannot unregister variant: sourceBay not found (${sourceBayId})`);
      return;
    }

    // Decrement counter
    sourceBay.state.variantCount = Math.max(0, sourceBay.state.variantCount - 1);

    // Update hasVariant if no more variants
    if (sourceBay.state.variantCount === 0) {
      sourceBay.state.hasVariant = false;
      // Note: canExpand computed on-demand from hasVariant
    }

    this.stateService.updateBay(sourceBay);

    Logger.log(`[BayHierarchy] Unregistered child from ${sourceBay.metadata.label} (remaining: ${sourceBay.state.variantCount})`);
  }

  /**
   * Gets all children of a parent bay.
   *
   * @param sourceBayId Parent bay ID
   * @returns Array of variant bays
   */
  fetchVariants(sourceBayId: string): Bay[] {
    const variants: Bay[] = [];
    // Iterated and not `getAllBays().filter(...)`: that copies every bay into an
    // array to walk it once, and this runs on every close, cascaded per variant.
    for (const bay of this.stateService.eachBay()) {
      if (bay.metadata.sourceBayId === sourceBayId) { variants.push(bay); }
    }
    return variants;
  }

  /**
   * Cierra una bay Y sus variantes (diffs, previews) en las tabs nativas.
   *
   * Es la semántica de "cerrar" desde la UI de Bays: cerrar el padre arrastra
   * a sus variantes. Cerrar la tab nativa directamente (tab bar de VS Code) NO
   * pasa por aquí — ahí VS Code deja vivas las previews y BayEventService
   * dispara un resync que reabre el source (una variante nunca vive sin parent).
   *
   * Las variantes se cierran primero: sus eventos de cierre desregistran cada
   * una del padre antes de que el padre desaparezca del estado.
   */
  async closeBayWithVariants(bay: Bay): Promise<void> {
    if (bay.state.hasVariant) {
      for (const variant of this.fetchVariants(bay.metadata.id)) {
        await variant.close();
      }
    }
    await bay.close();
  }

  /**
   * Mueve una bay Y sus variantes al grupo destino.
   *
   * Es el gemelo de `closeBayWithVariants`, y por lo mismo: una bay ES su fila
   * más sus variantes, así que las dos órdenes que actúan sobre el bloque entero
   * se componen aquí y no en el modelo, que no alcanza la jerarquía.
   *
   * Y es la ley de *una variante NACE EN EL GRUPO DE SU PADRE* impuesta en el
   * único sitio donde faltaba. Se cumplía al NACER y no al MOVERSE, así que
   * arrastrar una bay a otro grupo dejaba sus diffs y su previa colgando bajo la
   * cabecera de la que se iba: filas huérfanas allí, y el padre ofreciendo otra
   * vez el botón que las abre porque para él no ha aparecido ninguna. Que era
   * exactamente lo que la ley existe para que no se vea.
   *
   * **Las variantes se recogen ANTES de mover nada.** El id de una bay lleva
   * dentro su columna, así que en cuanto el padre aterriza el suyo ha cambiado y
   * `fetchVariants` no encontraría a nadie. Lo recogido son objetos del modelo,
   * pero lo que la mudanza usa de ellos es dónde está su tab NATIVA, así que un
   * resync que aterrice en medio puede dejarlos desenganchados del estado sin
   * dejar de moverlos.
   *
   * **Y el padre va PRIMERO**, al revés que en el cierre —donde el orden lo
   * decide quién desregistra a quién—: así el grupo destino nunca enseña una
   * variante sin la fila de la que cuelga, que es la fila huérfana que esto
   * viene a quitar. Lo que se ve en medio es la misma huérfana en el grupo del
   * que se va, y ésa está a punto de irse.
   *
   * @param target La columna de destino.
   */
  async moveBayWithVariants(bay: Bay, target: number): Promise<void> {
    const variants = bay.state.hasVariant ? this.fetchVariants(bay.metadata.id) : [];

    await bay.moveToGroup(target);

    // En serie y nunca a la vez: cada mudanza pone su tab DELANTE y mueve la
    // activa, así que dos solapadas se pisarían el foco la una a la otra.
    for (const variant of variants) {
      await variant.moveToGroup(target);
    }
  }

  /**
   * Recalculates children count for all parents.
   * Useful after full synchronization or when inconsistencies exist.
   */
  recalculateAllCounts(): void {
    const allBays = this.stateService.getAllBays();

    // Counted in ONE pass instead of re-filtering the whole list per parent: a
    // scan per parent is quadratic in the open tabs, and it allocates an array
    // for each of them to read a length off.
    const counts = new Map<string, number>();
    for (const bay of allBays) {
      const sourceId = bay.metadata.sourceBayId;
      if (sourceId) { counts.set(sourceId, (counts.get(sourceId) ?? 0) + 1); }
    }

    let updated = 0;
    for (const parent of allBays) {
      if (parent.metadata.sourceBayId) { continue; }

      const actualCount = counts.get(parent.metadata.id) ?? 0;

      if (parent.state.variantCount !== actualCount ||
          parent.state.hasVariant !== (actualCount > 0)) {
        parent.state.variantCount = actualCount;
        parent.state.hasVariant = actualCount > 0;
        // Note: canExpand computed on-demand from hasChildren state

        this.stateService.updateBay(parent);
        updated++;
      }
    }

    if (updated > 0) {
      Logger.log(`[BayHierarchy] Recalculated counts for ${updated} parents`);
    }
  }

  // --- HERENCIA Y SINCRONIZACIÓN DE ESTADO ---

  /**
   * Inherits state from parent to child bay.
   *
   * IMPORTANT:
   * - Only Markdown children inherit viewMode
   * - gitStatus, diagnosticSeverity and icons are NOT inherited
   * - This is by design to keep children simple
   *
   * @param variantBay Child bay that inherits
   * @param sourceBay Parent bay to inherit from
   */
  inheritState(variantBay: Bay, sourceBay: Bay): void {
    // Only Markdown children inherit viewMode
    if (sourceBay.metadata.fileExtension === '.md' && variantBay.metadata.diffType) {
      variantBay.state.viewMode = sourceBay.state.viewMode;
      Logger.log(`[BayHierarchy] Child inherited viewMode: ${variantBay.metadata.label} ← ${sourceBay.state.viewMode}`);
    }

    // Calculate diff stats for the child
    if (variantBay.metadata.diffType) {
      this.calculateDiffStats(variantBay);
    }
  }

  /**
   * Synchronizes cursor position (line and column) between a parent bay and all its children.
   * If syncCursorPosition config is enabled, updates all related editors.
   *
   * @param bayId Bay ID that changed cursor position
   * @param line Cursor line (1-based)
   * @param column Cursor column (1-based)
   */
  async syncCursorPosition(bayId: string, line: number, column: number): Promise<void> {
    await syncCursorPositionUtil(
      this.stateService,
      bayId,
      line,
      column,
      this.fetchVariants.bind(this)
    );
  }

  // --- MÉTODOS PRIVADOS Y HELPERS ---

  /**
   * Calculates diff statistics for a child bay based on its type.
   *
   * For working-tree/staged/edit: placeholder or label-derived stats.
   * For snapshots and commits: timestamp information.
   *
   * @param childBay Child bay to calculate stats
   */
  private calculateDiffStats(childBay: Bay): void {
    if (!childBay.metadata.diffType) { return; }

    const diffType = childBay.metadata.diffType;

    // If already has diffStats (e.g. extracted in tabConverter), don't overwrite
    if (childBay.state.diffStats) { return; }

    this.calculateLocalDiffStats(childBay, diffType);
  }

  /**
   * Calculates stats from locally available information.
   *
   * @param childBay Child bay
   * @param diffType Diff type
   */
  private calculateLocalDiffStats(childBay: Bay, diffType: string): void {
    // For working-tree, staged and edits, set placeholder stats
    // In real implementation, you would parse diff content
    if (diffType === 'working-tree' || diffType === 'staged' || diffType === 'edit') {
      // For Copilot edits, try extracting stats from label
      if (diffType === 'edit') {
        const statsMatch = childBay.metadata.label.match(/[+](\d+)[-](\d+)/);
        if (statsMatch) {
          childBay.state.diffStats = {
            linesAdded: parseInt(statsMatch[1], 10),
            linesRemoved: parseInt(statsMatch[2], 10),
          };
          return;
        }
      }
      // TODO: Implement real diff parsing when VS Code API supports it
      // For now, show placeholder stats
      childBay.state.diffStats = {
        linesAdded: 0,
        linesRemoved: 0,
      };
    } else if (diffType === 'snapshot' || diffType === 'commit') {
      // For snapshots and commits, use current time as placeholder
      childBay.state.diffStats = {
        timestamp: Date.now(),
        snapshotName: childBay.metadata.label,
      };
    } else if (diffType === 'merge-conflict') {
      // For merge conflicts, count would need file parsing
      childBay.state.diffStats = {
        conflictSections: 0, // Placeholder
      };
    }
  }
}
