import * as vscode from 'vscode';
import { BayGroup, BayGroupColor, GROUP_COLORS, defaultGroupColor, getGroupLabel } from '../models/BayGroup';
import { GroupCustomizationService } from '../services/ui/GroupCustomizationService';
import { rootColorHex } from '../shared/rootColors';

/**
 * La muestra de cada color en el QuickPick. Un `ThemeIcon` con color no colorea
 * nada en una fila de QuickPick, y un emoji no existe para todos los tonos (no
 * hay círculo verde azulado ni rosa), así que la muestra es un SVG en un `data:`
 * uri: la única vía que una fila admite para pintar un color. Los dos juegos
 * salen de la misma tabla que pinta la cabecera (`rootColorHex`), así que la
 * muestra y el grupo no pueden discrepar; VS Code elige el claro o el oscuro.
 */
function swatch(color: BayGroupColor): { light: vscode.Uri; dark: vscode.Uri } {
  const dot = (hex: string | null) => vscode.Uri.parse(
    `data:image/svg+xml;utf8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><circle cx="8" cy="8" r="5.5" fill="${hex}"/></svg>`,
    )}`,
  );
  return { light: dot(rootColorHex(color, false)), dark: dot(rootColorHex(color, true)) };
}

const COLOR_NAME: Record<BayGroupColor, string> = {
  red     : 'Red',
  orange  : 'Orange',
  yellow  : 'Yellow',
  green   : 'Green',
  teal    : 'Teal',
  blue    : 'Blue',
  violet  : 'Violet',
  pink    : 'Pink',
};

/**
 * Las tres acciones de grupo: renombrar, colorear y bloquear.
 *
 * Cada una es directa — no hay menú previo que las agrupe: la cabecera ya
 * expone un botón por acción. Sólo el color abre un QuickPick, porque elegir
 * entre ocho valores no cabe en un botón.
 *
 * Todas devuelven `true` si tocaron algo, para que el llamante decida cuándo
 * reaplicar la personalización y repintar.
 */
export class GroupActions {
  constructor(private readonly customization: GroupCustomizationService) {}

  /** Pide un nombre nuevo. Vaciar el campo devuelve el nombre por defecto. */
  async rename(group: BayGroup): Promise<boolean> {
    const value = await vscode.window.showInputBox({
      prompt      : `Rename ${group.label}`,
      value       : group.customLabel ?? '',
      placeHolder : `Leave empty to restore "${group.label}"`,
      validateInput: input => input.length > 60 ? 'Name is too long (max 60 characters)' : undefined,
    });

    if (value === undefined) { return false; }

    await this.customization.setLabel(group.id, value);
    return true;
  }

  async pickColor(group: BayGroup): Promise<boolean> {
    const auto   = defaultGroupColor(group.viewColumn);
    const isAuto = this.customization.get(group.id)?.color === undefined;

    // "Auto" no es un color más: borra la elección y devuelve el grupo al color
    // que le toca por columna, que es lo que ve un grupo recién abierto.
    const items: Array<vscode.QuickPickItem & { color?: BayGroupColor }> = [
      {
        label       : 'Auto',
        iconPath    : swatch(auto),
        description : isAuto ? 'current · from group position' : 'from group position',
        color       : undefined,
      },
      { label: '', kind: vscode.QuickPickItemKind.Separator },
      ...GROUP_COLORS.map(color => ({
        label       : COLOR_NAME[color],
        iconPath    : swatch(color),
        description : !isAuto && color === group.color ? 'current' : undefined,
        color,
      })),
    ];

    const pick = await vscode.window.showQuickPick(items, {
      placeHolder: `Color for ${getGroupLabel(group)}`,
    });
    if (!pick) { return false; }

    await this.customization.setColor(group.id, pick.color);
    return true;
  }

  async toggleLock(group: BayGroup): Promise<boolean> {
    await this.customization.setLocked(group.id, !group.isLocked);
    return true;
  }
}
