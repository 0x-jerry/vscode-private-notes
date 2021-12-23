import { ExtensionContext, workspace } from 'vscode';
import { registerCommands } from './commonds';
import { ConfigurationContext } from './configuration';
import { globalCtx } from './context';
import { EncryptFS } from './EncryptFsProvider';
import { getEncryptWorkspace } from './utils';

export function activate(context: ExtensionContext) {
  registerCommands(context);

  const encryptWs = getEncryptWorkspace();

  if (!encryptWs) {
    return;
  }

  globalCtx.configuration = new ConfigurationContext();

  const encryptFs = new EncryptFS({
    configuration: globalCtx.configuration,
  });

  context.subscriptions.push(encryptFs);

  context.subscriptions.push(
    workspace.registerFileSystemProvider(EncryptFS.scheme, encryptFs, { isCaseSensitive: true }),
  );
}

export function deactivate() {
  Object.keys(globalCtx).forEach((key) => {
    delete (globalCtx as any)[key];
  });
}
