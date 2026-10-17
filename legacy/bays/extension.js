// The last Lovervoid.bays: an empty shell.
//
// The extension now ships as Lovervoid.sidetabs, and `workspaceState` is keyed
// by extension id, so what a Bays user stored (group names, colours, locks, the
// per-project view preferences) is reachable only from HERE. This shell
// contributes nothing (no command or view to collide with the real one),
// depends on sidetabs (so updating installs it) and pushes that state over.
//
// It pushes instead of being pulled: VS Code activates a dependency first, so
// sidetabs is already up when this runs, and sidetabs awaiting this shell from
// its own `activate` would deadlock.

const vscode = require('vscode');

const TARGET = 'Lovervoid.sidetabs';

async function activate(context) {
  const target = vscode.extensions.getExtension(TARGET);
  const api    = target && (target.isActive ? target.exports : await target.activate());
  if (!api || api.handoffVersion !== 1 || typeof api.adoptBaysState !== 'function') { return; }

  const offered = {};
  for (const key of context.workspaceState.keys()) {
    offered[key] = context.workspaceState.get(key);
  }
  console.log(`[Bays] offering ${Object.keys(offered).length} stored keys to SideTabs`);
  try {
    await api.adoptBaysState(offered);
  } catch (error) {
    console.warn('[Bays] handoff to SideTabs failed', error);
  }
}

function deactivate() {}

module.exports = { activate, deactivate };
