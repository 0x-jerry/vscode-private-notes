import vscode from 'vscode';
import { ConfigurationContext } from './configuration';
import { MemFS } from './EncryptFsProvider';
import { getMemWorkspace, parseQuery } from './utils';

export function activate(context: vscode.ExtensionContext) {
  console.log('MemFS says "Hello"');

  const configuration = new ConfigurationContext();

  const memFsWorkspace = getMemWorkspace();

  if (memFsWorkspace?.uri) {
    configuration.load(memFsWorkspace.uri);
  }

  const memFs = new MemFS({
    configuration,
  });

  context.subscriptions.push(
    vscode.workspace.registerFileSystemProvider(MemFS.scheme, memFs, { isCaseSensitive: true }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('memfs.workspaceInit', async () => {
      const current = vscode.workspace.workspaceFolders?.[0];
      if (!current) return;

      const query = parseQuery(current.uri.query);
      query.set('scheme', current.uri.scheme);

      const uri = vscode.Uri.from({
        ...current.uri,
        scheme: MemFS.scheme,
        query: query.toString(),
      });

      const yes = await vscode.window.showQuickPick(['Yes', 'No'], {
        placeHolder: 'Open it with single root?',
      });

      if (yes === 'Yes') {
        vscode.commands.executeCommand('vscode.openFolder', uri);
      } else {
        vscode.workspace.updateWorkspaceFolders(0, 0, {
          name: 'Test',
          uri,
        });
      }
    }),
  );
}
