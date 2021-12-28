import {
  CancellationToken,
  Command,
  Event,
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
import { Dispose } from './Disposable';

class EncryptTextDocumentContentProvider implements TextDocumentContentProvider {
  static scheme = 'encrypt-git';

  onDidChange?: Event<Uri> | undefined;

  provideTextDocumentContent(uri: Uri, token: CancellationToken): ProviderResult<string> {
    throw new Error('Method not implemented.');
  }
}

class EncryptDiffProvider implements QuickDiffProvider {
  provideOriginalResource(uri: Uri, token: CancellationToken): ProviderResult<Uri> {
    return uri.with({
      scheme: EncryptTextDocumentContentProvider.scheme,
    });
  }
}

class EncryptSourceControl extends Dispose {
  sourceControl = scm.createSourceControl('encrypt-git', 'Encrypted Git');

  changeGroup = this.sourceControl.createResourceGroup('Source', 'Changes');

  constructor() {
    super();
    this.sourceControl.quickDiffProvider = new EncryptDiffProvider();

    this.disposable.push(this.sourceControl, this.changeGroup);
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

export function active(ctx: ExtensionContext) {
  ctx.subscriptions.push(
    workspace.registerTextDocumentContentProvider(
      EncryptTextDocumentContentProvider.scheme,
      new EncryptTextDocumentContentProvider(),
    ),
  );

  ctx.subscriptions.push(new EncryptSourceControl());
}
