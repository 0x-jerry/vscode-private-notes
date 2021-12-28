import {
  Command,
  EventEmitter,
  ProviderResult,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
  Uri,
  window,
} from 'vscode';
import { globalCtx } from './context';
import { Dispose } from './Disposable';
import { EncryptFSProvider } from './EncryptFsProvider';
import { EncryptTextDocumentContentProvider } from './EncryptGitPanel';
import { removeRootPath } from './utils';

class HistoryTreeItem extends TreeItem {
  constructor(previousCommit: [string, string] | undefined, commit: [string, string], uri: Uri) {
    super(uri, TreeItemCollapsibleState.None);

    const command: Command = {
      title: 'Show changes',
      command: 'vscode.diff',
      arguments: [
        previousCommit
          ? uri.with({
              query: `hash=${previousCommit[0]}`,
            })
          : uri.with({
              query: 'delete=1',
            }),
        uri.with({
          query: `hash=${commit[0]}`,
        }),
        `${previousCommit?.[1] || 'Local Changes'} ↔ ${commit[1]}`,
      ],
      tooltip: 'Diff your changes',
    };

    this.command = command;

    this.label = `${commit[1]}#${commit[0].slice(0, 8)}`;
  }
}

export class HistoryTreeProvider extends Dispose implements TreeDataProvider<HistoryTreeItem> {
  static id = 'encrypt.single.history';

  items: HistoryTreeItem[] = [];

  constructor() {
    super();

    this.disposable.push(
      window.onDidChangeActiveTextEditor(async (e) => {
        if (!e) return;
        const uri = e.document.uri;
        if (uri.scheme !== EncryptFSProvider.scheme) return;

        const commits = await globalCtx.git.getFileHistory(removeRootPath(uri.path));
        const items: HistoryTreeItem[] = [];

        let previousCommit: [string, string] | undefined;
        for (const commit of commits) {
          items.push(
            new HistoryTreeItem(
              previousCommit,
              commit,
              Uri.from({
                scheme: EncryptTextDocumentContentProvider.scheme,
                path: uri.path,
                query: `hash=${commit[0]}`,
              }),
            ),
          );

          previousCommit = commit;
        }

        this.items = items;

        this._emitter.fire();
      }),
    );
  }

  _emitter = new EventEmitter<HistoryTreeItem | void>();

  onDidChangeTreeData = this._emitter.event;

  getChildren(): ProviderResult<HistoryTreeItem[]> {
    return this.items;
  }

  getTreeItem(element: HistoryTreeItem): TreeItem {
    return element;
  }
}
