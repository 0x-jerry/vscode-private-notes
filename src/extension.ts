import { ExtensionContext, workspace } from 'vscode';
import { registerCommands } from './commands';
import { ConfigurationContext } from './configuration';
import { globalCtx } from './context';
import { EncryptFSProvider } from './EncryptFsProvider';
import { getEncryptWorkspace } from './utils';

export function activate(context: ExtensionContext) {
  registerCommands(context);

  const encryptWs = getEncryptWorkspace();

  if (!encryptWs) {
    return;
  }

  globalCtx.configuration = new ConfigurationContext();

  const encryptFs = new EncryptFSProvider({
    configuration: globalCtx.configuration,
  });

  context.subscriptions.push(encryptFs);

  context.subscriptions.push(
    workspace.registerFileSystemProvider(EncryptFSProvider.scheme, encryptFs, {
      isCaseSensitive: true,
    }),
  );
}

export function deactivate() {
  Object.keys(globalCtx).forEach((key) => {
    delete (globalCtx as any)[key];
  });
}
