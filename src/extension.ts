import { commands, ExtensionContext, Uri, window, workspace } from 'vscode';
import { ConfigurationContext } from './configuration';
import { MemFS } from './EncryptFsProvider';
import { parseQuery } from './utils';

export function activate(context: ExtensionContext) {
  console.log('MemFS says "Hello"');

  const configuration = new ConfigurationContext();

  const memFs = new MemFS({
    configuration,
  });

  context.subscriptions.push(memFs);

  context.subscriptions.push(
    workspace.registerFileSystemProvider(MemFS.scheme, memFs, { isCaseSensitive: true }),
  );

  context.subscriptions.push(
    commands.registerCommand('memfs.workspaceInit', async () => {
      const current = workspace.workspaceFolders?.[0];
      if (!current) return;

      const query = parseQuery(current.uri.query);
      query.set('scheme', current.uri.scheme);

      const uri = Uri.from({
        ...current.uri,
        scheme: MemFS.scheme,
        query: query.toString(),
      });

      const yes = await window.showQuickPick(['Yes', 'No'], {
        placeHolder: 'Open it with single root?',
      });

      if (yes === 'Yes') {
        commands.executeCommand('openFolder', uri);
      } else {
        workspace.updateWorkspaceFolders(0, 0, {
          name: `${current.name}[MemFS]`,
          uri,
        });
      }
    }),
  );
}
