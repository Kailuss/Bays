import { syncCursorPosition as syncCursorPositionUtil } from './BayCursorSyncUtils';
import type { Bay } from '../../models/Bay';
import type { BayStateService } from './BayStateService';
import { Logger } from '../../platform/logger';

/**
 * Manages hierarchical parent-child relationships between Bays.
 *
 * Responsibilities:
 * - Answer which bays are a parent's variants
 * - Inherit state from parent to child (only viewMode for Markdown)
 *
 * The relation lives in ONE place: the variant's `sourceBayId`. The parent keeps
 * no count of its variants, on purpose. A count is a second copy of that fact,
 * maintained by a register call that ran on the variant's open event, and it
 * silently stayed at zero when the parent was not in state yet at that moment,
 * with nothing to retry it. Every path that acts on "a bay and its variants"
 * gated on the count before scanning, so a parent whose count was wrong moved
 * or closed alone and left a Working Tree diff under the header it had left.
 * Scanning `sourceBayId` cannot disagree with itself.
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
   * Gets all children of a parent bay.
   *
   * @param sourceBayId Parent bay ID
   * @returns Array of variant bays
   */
  fetchVariants(sourceBayId: string): Bay[] {
    const variants: Bay[] = [];
    // Iterated and not `getAllBays().filter(...)`: that copies every bay into an
    // array to walk it once, and this runs on every close, cascaded per variant.
    // Always scanned, never short-circuited on a stored count: see the header.
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
    for (const variant of this.fetchVariants(bay.metadata.id)) {
      await variant.close();
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
    const variants = this.fetchVariants(bay.metadata.id);

    await bay.moveToGroup(target);

    // En serie y nunca a la vez: cada mudanza pone su tab DELANTE y mueve la
    // activa, así que dos solapadas se pisarían el foco la una a la otra.
    for (const variant of variants) {
      await variant.moveToGroup(target);
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
   * For edits: the count in the label. For snapshots and commits: timestamp
   * information. Working tree and staged diffs are measured (`DiffStatsService`).
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
    // A Copilot edit carries its count in the label. Every other diff is
    // MEASURED from its two documents by `DiffStatsService`, and until that
    // lands the row writes nothing: a `+0 -0` placeholder here read as a
    // measured answer, and it was never replaced.
    if (diffType === 'edit') {
      const statsMatch = childBay.metadata.label.match(/[+](\d+)[-](\d+)/);
      if (statsMatch) {
        childBay.state.diffStats = {
          linesAdded: parseInt(statsMatch[1], 10),
          linesRemoved: parseInt(statsMatch[2], 10),
        };
      }
    } else if (diffType === 'working-tree' || diffType === 'staged') {
      return;
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
