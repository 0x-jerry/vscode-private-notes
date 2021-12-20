import vscode from 'vscode';
import { MemFS } from './EncryptFsProvider';

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

      const uri = vscode.Uri.parse(`${MemFS.scheme}:/${current.uri.toString()}`);
      vscode.commands.executeCommand('vscode.openFolder', uri);
    }),
  );
}
