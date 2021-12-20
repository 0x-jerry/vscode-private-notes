import vscode from 'vscode';
import { MemFS } from './EncryptFsProvider';
import { parseQuery } from './utils';

export function activate(context: vscode.ExtensionContext) {
  console.log('MemFS says "Hello"');

  const memFs = new MemFS();

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
