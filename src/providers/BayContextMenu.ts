import * as vscode from 'vscode';
import { Bay } from '../models/Bay';
import { BayStateService } from '../services/core/BayStateService';
import { CopilotService } from '../services/integration/CopilotService';
import { ClaudeConversationService } from '../services/integration/ClaudeConversationService';
import type { MenuItem } from '../shared/protocol';
import { ICONS } from '../shared/icons';

// El modelo del menú vive en el protocolo compartido (cruza postMessage y el
// cliente lo consume con los MISMOS tipos). Re-exportado por conveniencia.
export type { MenuItem } from '../shared/protocol';

/**
 * The Claude Code session orders, each a command of that extension. All three
 * act on its ACTIVE session tab and take no argument (read off its bundle), so
 * the bay is put in front before any of them runs.
 */
const CLAUDE_SESSION_COMMANDS: Record<string, string> = {
  renameSession : 'claude-vscode.renameSessionTab',
  markUnread    : 'claude-vscode.markSessionUnread',
  sessionGroup  : 'claude-vscode.addSessionTabToGroup',
};

/**
 * Menú contextual de las bays.
 *
 * Sólo construye el modelo y ejecuta la acción elegida: el menú lo dibuja el
 * webview (`BaysContextMenu`, réplica del nativo) porque un QuickPick aparece
 * centrado arriba y no bajo el cursor, que es donde se espera un menú
 * contextual. El host sigue siendo la única fuente de verdad de qué items hay.
 */
export class BayContextMenu {
  constructor(
    private readonly stateService: BayStateService,
    private readonly copilotService: CopilotService
  ) {}

  /** Items para esta bay, en el orden en que se pintan. */
  build(bay: Bay): MenuItem[] {
    const t = vscode.l10n.t;
    const hasUri = !!bay.metadata.uri;
    const hasMultipleGroups = this.stateService.getGroups().length > 1;
    const isClaude = ClaudeConversationService.isClaudeConversationBay(bay);

    // Un grupo bloqueado no ofrece cerrar por ninguna vía: si el menú siguiera
    // listando "Close", el candado sólo escondería el botón, no protegería nada.
    const locked = this.stateService.getGroup(bay.state.groupId)?.isLocked ?? false;

    const items: MenuItem[] = locked ? [] : [
      { id: 'close',       label: t('Close'),        icon: ICONS.menu.close     },
      { id: 'closeOthers', label: t('Close Others'), icon: ICONS.menu.closeMany },
      // The list runs DOWN, so what the tab strip calls "to the right" is the
      // rows below — and only offered when there is one.
      ...(this.stateService.baysBelow(bay).length > 0
        ? [{ id: 'closeBelow', label: t('Close Below'), icon: ICONS.menu.closeMany }]
        : []),
      { type: 'separator' },
    ];

    items.push(
      bay.state.isPinned
        ? { id: 'unpin', label: t('Unpin'), icon: ICONS.menu.unpin }
        : { id: 'pin',   label: t('Pin'),   icon: ICONS.menu.pin   }
    );

    if (hasMultipleGroups && !locked) {
      items.push(
        { type: 'separator' },
        { id: 'closeGroup', label: t('Close Group'), icon: ICONS.menu.closeMany },
      );
    }

    if (isClaude) {
      items.push(
        { type: 'separator' },
        { id: 'renameSession', label: t('Rename Session…'),        icon: ICONS.menu.rename       },
        { id: 'markUnread',    label: t('Mark as Unread'),         icon: ICONS.menu.unread       },
        { id: 'sessionGroup',  label: t('Add to Session Group…'),  icon: ICONS.menu.sessionGroup },
        { type: 'separator' },
        { id: 'newChat',       label: t('New Conversation'),       icon: ICONS.menu.newChat      },
      );
    }

    if (hasUri) {
      items.push(
        { type: 'separator' },
        { id: 'revealInExplorer',     label: t('Reveal in Explorer View'),    icon: ICONS.menu.revealInView },
        { id: 'revealInFileExplorer', label: t('Reveal in File Explorer'),    icon: ICONS.menu.revealInOs   },
        { id: 'openTimeline',         label: t('Open Timeline'),              icon: ICONS.menu.timeline     },
        { type: 'separator' },
        { id: 'copyRelativePath',     label: t('Copy Relative Path'),         icon: ICONS.menu.copyRelative },
        { id: 'copyPath',             label: t('Copy Path'),                  icon: ICONS.menu.copyPath     },
        { id: 'copyFileContents',     label: t('Copy File Contents'),         icon: ICONS.menu.copyPath     },
        { id: 'duplicateFile',        label: t('Duplicate File'),             icon: ICONS.menu.duplicate    },
        { type: 'separator' },
        { id: 'compareWithActive',    label: t('Compare with Active Editor'), icon: ICONS.menu.compare      },
        { id: 'openChanges',          label: t('Open Changes'),               icon: ICONS.menu.changes      },
        { id: 'splitRight',           label: t('Split Right'),                icon: ICONS.menu.split        },
      );
    }

    // Any tab can leave for a window of its own, and a chat is the one most
    // often wanted beside the editor rather than inside it.
    items.push(
      ...(hasUri ? [] : [{ type: 'separator' } as const]),
      { id: 'moveToNewWindow', label: t('Move to New Window'), icon: ICONS.menu.newWindow },
    );

    if (hasUri && this.copilotService.isAvailable()) {
      items.push(
        { type: 'separator' },
        { id: 'addToChat', label: t('Add to Copilot Chat'), icon: ICONS.menu.chat },
      );
    }

    return items;
  }

  /** Ejecuta el item elegido en el webview. Ignora los ids desconocidos. */
  async execute(actionId: string, bay: Bay): Promise<void> {
    const sessionCommand = CLAUDE_SESSION_COMMANDS[actionId];
    if (sessionCommand) {
      await bay.activate();
      await vscode.commands.executeCommand(sessionCommand);
      return;
    }
    switch (actionId) {
      case 'close'                : await (this.stateService.getHierarchyService()?.closeBayWithVariants(bay) ?? bay.close()); break;
      case 'closeOthers'          : await bay.closeOthers();           break;
      case 'closeBelow'           : await bay.closeBelow(this.stateService.baysBelow(bay)); break;
      case 'closeGroup'           : await bay.closeGroup();            break;
      case 'pin'                  : await bay.pin();   this.stateService.reorderOnPin(bay.metadata.id);   break;
      case 'unpin'                : await bay.unpin(); this.stateService.reorderOnUnpin(bay.metadata.id); break;
      // A new chat opens in the group this one lives in, not wherever the focus was.
      case 'newChat'              : await bay.activate(); await vscode.commands.executeCommand('claude-vscode.editor.open'); break;
      case 'revealInExplorer'     : await bay.revealInExplorer();      break;
      case 'revealInFileExplorer' : await bay.revealInFileExplorer();  break;
      case 'openTimeline'         : await bay.openTimeline();          break;
      case 'copyRelativePath'     : await bay.copyRelativePath();      break;
      case 'copyPath'             : await bay.copyPath();              break;
      case 'copyFileContents'     : await bay.copyFileContents();      break;
      case 'duplicateFile'        : await bay.duplicateFile();         break;
      case 'compareWithActive'    : await bay.compareWithActive();     break;
      case 'openChanges'          : await bay.openChanges();           break;
      case 'splitRight'           : await bay.splitRight();            break;
      case 'moveToNewWindow'      : await bay.moveToNewWindow();       break;
      case 'addToChat'            : await this.copilotService.addFileToChat(bay); break;
    }
  }
}
