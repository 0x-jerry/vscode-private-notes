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
import { CommitHash } from './git';
import { removeRootPath } from './utils';

class HistoryTreeItem extends TreeItem {
  constructor(commit: CommitHash, previousCommit: CommitHash | undefined, uri: Uri) {
    super(uri, TreeItemCollapsibleState.None);

    const command: Command = {
      title: 'Show changes',
      command: 'vscode.diff',
      arguments: [
        previousCommit
          ? uri.with({
              query: `hash=${previousCommit.hash}`,
            })
          : uri.with({
              query: 'delete=1',
            }),
        uri.with({
          query: `hash=${commit.hash}`,
        }),
        `${previousCommit?.title || 'Empty'} ↔ ${commit.title}`,
      ],
      tooltip: 'Diff your changes',
    };

    this.command = command;

    this.label = `${commit.title}`;
    this.description = `#${commit.hash.slice(0, 8)}`;
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

        let idx = 1;

        for (const commit of commits) {
          items.push(
            new HistoryTreeItem(
              commit,
              commits[idx++],
              Uri.from({
                scheme: EncryptTextDocumentContentProvider.scheme,
                path: uri.path,
                query: `hash=${commit.hash}`,
              }),
            ),
          );
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
