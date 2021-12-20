'use strict';

import * as vscode from 'vscode';
import { MemFS } from './EncryptFsProvider';

export function activate(context: vscode.ExtensionContext) {
  console.log('MemFS says "Hello"');

  const memFs = new MemFS();

  context.subscriptions.push(
    vscode.workspace.registerFileSystemProvider('memfs', memFs, { isCaseSensitive: true }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('memfs.workspaceInit', async (_) => {
      vscode.workspace.updateWorkspaceFolders(1, 0, {
        uri: vscode.Uri.parse('memfs:/'),
        name: 'MemFS - Sample',
      });
    }),
  );
}
