import path from 'path';
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
import { removeRootPath } from './utils';

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
    const item = Uri.from({
      path: uri.path,
      scheme: EncryptTextDocumentContentProvider.scheme,
    });

    return item;
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

        for (const s of status) {
          resources.push(
            this.createSourceControlResourceState(
              Uri.from({
                path: s[0],
                scheme: EncryptTextDocumentContentProvider.scheme,
              }),
              false,
            ),
          );
        }

        this.changeGroup.resourceStates = resources;
        this.sourceControl.count = resources.length;
      }),
    );
  }

  createSourceControlResourceState(docUri: Uri, deleted: boolean): SourceControlResourceState {
    const sourceUri = docUri;

    const command: Command | undefined = !deleted
      ? {
          title: 'Show changes',
          command: 'vscode.diff',
          arguments: [sourceUri, docUri, `#${docUri.path} ↔ Local changes`],
          tooltip: 'Diff your changes',
        }
      : undefined;

    const resourceState: SourceControlResourceState = {
      resourceUri: docUri,
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
