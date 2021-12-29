import {
  CancellationToken,
  Command,
  commands,
  EventEmitter,
  ExtensionContext,
  ProviderResult,
  QuickDiffProvider,
  scm,
  SourceControlResourceState,
  TextDocumentContentProvider,
  Uri,
  window,
  workspace,
} from 'vscode';
import { Commands } from './commands';
import { globalCtx } from './context';
import { getReadContent } from './crypto';
import { Dispose } from './Disposable';
import { GitStatus } from './git';
import { getEncryptWorkspace, parseQuery, removeRootPath } from './utils';

export class EncryptTextDocumentContentProvider implements TextDocumentContentProvider {
  static scheme = 'encrypt-git';

  _emitter = new EventEmitter<Uri>();

  onDidChange = this._emitter.event;

  async provideTextDocumentContent(uri: Uri, token: CancellationToken): Promise<string> {
    const query = parseQuery(uri.query);

    if (query.get('delete') === '1') {
      return '';
    }

    const hasHash = query.get('hash');

    if (hasHash) {
      const res = await globalCtx.git.getFileVersion(hasHash, removeRootPath(uri.path));
      const decode = await getReadContent(res);

      return decode.toString();
    }

    if (query.get('proxy') === '1') {
      const realUri = Uri.parse(uri.path);
      const res = await workspace.fs.readFile(realUri);

      return res.toString();
    }

    const res = await globalCtx.git.getLatestVersion(removeRootPath(uri.path));

    const decode = await getReadContent(res);

    return decode.toString();
  }
}

class EncryptDiffProvider implements QuickDiffProvider {
  provideOriginalResource(uri: Uri, token: CancellationToken): ProviderResult<Uri> {
    return covertToSourceUri(uri);
  }
}

class EncryptSourceControl extends Dispose {
  sourceControl = scm.createSourceControl('encrypt-git', 'Encrypted Git');

  changeGroup = this.sourceControl.createResourceGroup('Source', 'Changes');

  constructor() {
    super();
    this.disposable.push(
      commands.registerCommand(Commands.GitCommit, () => this.gitCommitCommand()),
    );

    this.sourceControl.quickDiffProvider = new EncryptDiffProvider();

    this.sourceControl.inputBox.placeholder = 'Message (meta+Enter to commit)';

    this.sourceControl.acceptInputCommand = {
      title: 'Commit to git',
      command: Commands.GitCommit,
    };

    this.disposable.push(this.sourceControl, this.changeGroup);

    this.disposable.push(
      globalCtx.git.onDidChangeGitStatus(([status]) => {
        const resources = [];

        const root = getEncryptWorkspace();

        if (root) {
          for (const s of status) {
            const uri = Uri.joinPath(root.uri, s[0]);

            const deleted = s[1] === GitStatus.Deleted;

            resources.push(this.createSourceControlResourceState(uri, deleted));
          }
        }

        this.changeGroup.resourceStates = resources;
        this.sourceControl.count = resources.length;
      }),
    );
  }

  async gitCommitCommand() {
    const msg = this.sourceControl.inputBox.value;

    if (!msg) return;

    await globalCtx.git.run('git add .');
    await globalCtx.git.run(`git commit -m ${JSON.stringify(msg)}`);

    this.sourceControl.inputBox.value = '';
  }

  createSourceControlResourceState(uri: Uri, deleted: boolean): SourceControlResourceState {
    const sourceUri = covertToSourceUri(uri);

    const query = parseQuery('');
    query.set('delete', deleted ? '1' : '0');
    query.set('proxy', '1');

    const currentUri = sourceUri.with({
      query: query.toString(),
      path: uri.toString(),
    });

    const relativePath = removeRootPath(uri.path);

    const command: Command = {
      title: 'Show changes',
      command: 'vscode.diff',
      arguments: [sourceUri, currentUri, `${relativePath} ↔ Local changes`],
      tooltip: 'Diff your changes',
    };

    const resourceState: SourceControlResourceState = {
      resourceUri: sourceUri.with({
        path: relativePath,
      }),
      command: command,
      decorations: {
        strikeThrough: deleted,
        tooltip: 'File was locally deleted.',
      },
    };

    return resourceState;
  }
}

export function activeEncryptGitPanel(ctx: ExtensionContext) {
  ctx.subscriptions.push(
    workspace.registerTextDocumentContentProvider(
      EncryptTextDocumentContentProvider.scheme,
      new EncryptTextDocumentContentProvider(),
    ),
  );

  ctx.subscriptions.push(new EncryptSourceControl());
}

function covertToSourceUri(uri: Uri) {
  return Uri.from({
    path: uri.path,
    scheme: EncryptTextDocumentContentProvider.scheme,
  });
}
