import { commands, ExtensionContext, Uri, window, workspace } from 'vscode';
import { ConfigurationContext } from './configuration';
import { EncryptFS } from './EncryptFsProvider';
import { parseQuery } from './utils';

export function activate(context: ExtensionContext) {
  console.log('EncryptFS says "Hello"');

  const configuration = new ConfigurationContext();

  const encryptFs = new EncryptFS({
    configuration,
  });

  context.subscriptions.push(encryptFs);

  context.subscriptions.push(
    workspace.registerFileSystemProvider(EncryptFS.scheme, encryptFs, { isCaseSensitive: true }),
  );

  context.subscriptions.push(
    commands.registerCommand('encrypt.workspaceInit', async () => {
      const current = workspace.workspaceFolders?.[0];
      if (!current) return;

      const query = parseQuery(current.uri.query);
      query.set('scheme', current.uri.scheme);

      const uri = Uri.from({
        ...current.uri,
        scheme: EncryptFS.scheme,
        query: query.toString(),
      });

      const yes = await window.showQuickPick(['Yes', 'No'], {
        placeHolder: 'Open it with single root?',
      });

      if (yes === 'Yes') {
        commands.executeCommand('vscode.openFolder', uri);
      } else {
        workspace.updateWorkspaceFolders(0, 0, {
          name: `${current.name}[${EncryptFS.scheme}]`,
          uri,
        });
      }
    }),
  );
}
