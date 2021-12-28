import {
  CancellationToken,
  Command,
  EventEmitter,
  ExtensionContext,
  ProviderResult,
  QuickDiffProvider,
  scm,
  SourceControlResourceState,
  TextDocumentContentProvider,
  Uri,
  workspace,
} from 'vscode';
import { globalCtx } from './context';
import { getReadContent } from './crypto';
import { Dispose } from './Disposable';
import { GitStatus } from './git';
import { getEncryptWorkspace, removeRootPath } from './utils';

class EncryptTextDocumentContentProvider implements TextDocumentContentProvider {
  static scheme = 'encrypt-git';

  _emitter = new EventEmitter<Uri>();

  onDidChange = this._emitter.event;

  async provideTextDocumentContent(uri: Uri, token: CancellationToken): Promise<string> {
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
    this.sourceControl.quickDiffProvider = new EncryptDiffProvider();

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

  createSourceControlResourceState(docUri: Uri, deleted: boolean): SourceControlResourceState {
    const sourceUri = covertToSourceUri(docUri);

    const relativePath = removeRootPath(docUri.path);
    const command: Command | undefined = !deleted
      ? {
          title: 'Show changes',
          command: 'vscode.diff',
          arguments: [sourceUri, docUri, `${relativePath} ↔ Local changes`],
          tooltip: 'Diff your changes',
        }
      : undefined;

    const resourceState: SourceControlResourceState = {
      resourceUri: docUri.with({
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