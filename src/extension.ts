import { ExtensionContext, workspace } from 'vscode';
import { registerCommands } from './commands';
import { ConfigurationContext } from './configuration';
import { globalCtx } from './context';
import { EncryptFSProvider } from './EncryptFsProvider';
import { Status } from './statusbar';
import { getEncryptWorkspace } from './utils';

export function activate(context: ExtensionContext) {
  registerCommands(context);

  const encryptWs = getEncryptWorkspace();

  if (!encryptWs) {
    return;
  }

  globalCtx.configuration = new ConfigurationContext();
  context.subscriptions.push(globalCtx.configuration);

  const encryptFs = new EncryptFSProvider();

  context.subscriptions.push(
    workspace.registerFileSystemProvider(EncryptFSProvider.scheme, encryptFs, {
      isCaseSensitive: true,
    }),
  );

  const status = new Status();
  context.subscriptions.push(status);
}

export function deactivate() {
  Object.keys(globalCtx).forEach((key) => {
    delete (globalCtx as any)[key];
  });
}
