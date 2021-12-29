import { commands, ExtensionContext, Uri, window, workspace } from 'vscode';
import { Commands, registerCommands } from './commands';
import { ConfigurationContext, configurationExist } from './configuration';
import { globalCtx } from './context';
import { EncryptFileDecorationProvider } from './EncryptFileDecoration';
import { EncryptFSProvider } from './EncryptFsProvider';
import { activeEncryptGitPanel } from './EncryptGitPanel';
import { HistoryTreeProvider } from './EncryptHistoryPanel';
import { EncryptTerminalProvider } from './EncryptTerminalProvider';
import { Git } from './git';
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

  globalCtx.git = new Git(Uri.parse(encryptWs.uri.fragment));
  await globalCtx.git.init();

  globalCtx.configuration = new ConfigurationContext();
  context.subscriptions.push(globalCtx.configuration, globalCtx.git);

  const encryptFs = new EncryptFSProvider();

  context.subscriptions.push(
    workspace.registerFileSystemProvider(EncryptFSProvider.scheme, encryptFs, {
      isCaseSensitive: true,
    }),
  );

  const encryptFileDecorationProvider = new EncryptFileDecorationProvider();
  context.subscriptions.push(encryptFileDecorationProvider);
  context.subscriptions.push(window.registerFileDecorationProvider(encryptFileDecorationProvider));

  context.subscriptions.push(
    window.registerTerminalProfileProvider(
      'terminal.encrypt-profile',
      new EncryptTerminalProvider(),
    ),
  );

  activeEncryptGitPanel(context);
  context.subscriptions.push(
    window.registerTreeDataProvider(HistoryTreeProvider.id, new HistoryTreeProvider()),
  );
}

export function deactivate() {
  Object.keys(globalCtx).forEach((key) => {
    delete (globalCtx as any)[key];
  });
}
