import { commands, ExtensionContext, window, workspace } from 'vscode';
import { Commands, registerCommands } from './commands';
import { ConfigurationContext, configurationExist } from './configuration';
import { globalCtx } from './context';
import { EncryptFileDecorationProvider } from './EncryptFileDecoration';
import { EncryptFSProvider } from './EncryptFsProvider';
import { EncryptTerminalProvider } from './EncryptTerminalProvider';
import { Status } from './statusbar';
import { getEncryptWorkspace } from './utils';

export async function activate(context: ExtensionContext) {
  registerCommands(context);

  const encryptWs = getEncryptWorkspace();

  if (!encryptWs) {
    if (await configurationExist()) {
      commands.executeCommand(Commands.InitWorkspace);
    }
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

  const encryptFileDecorationProvider = new EncryptFileDecorationProvider();
  context.subscriptions.push(encryptFileDecorationProvider);
  context.subscriptions.push(window.registerFileDecorationProvider(encryptFileDecorationProvider));

  context.subscriptions.push(
    window.registerTerminalProfileProvider(
      'terminal.encrypt-profile',
      new EncryptTerminalProvider(),
    ),
  );
}

export function deactivate() {
  Object.keys(globalCtx).forEach((key) => {
    delete (globalCtx as any)[key];
  });
}
