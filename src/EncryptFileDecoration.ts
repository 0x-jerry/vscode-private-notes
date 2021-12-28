import debounce from 'lodash/debounce';
import path from 'path';

import {
  CancellationToken,
  EventEmitter,
  FileDecoration,
  FileDecorationProvider,
  ThemeColor,
  Uri,
} from 'vscode';
import { globalCtx } from './context';
import { Dispose } from './Disposable';
import { EncryptFSProvider } from './EncryptFsProvider';
import { GitStatus, GitStatusMap } from './git';
import { getEncryptWorkspace } from './utils';

const decorations: Record<GitStatus, FileDecoration> = {
  A: new FileDecoration('A', 'Added', new ThemeColor('gitDecoration.addedResourceForeground')),
  M: new FileDecoration(
    'M',
    'Modified',
    new ThemeColor('gitDecoration.modifiedResourceForeground'),
  ),
  D: new FileDecoration('D', 'Deleted', new ThemeColor('gitDecoration.deletedResourceForeground')),
  U: new FileDecoration(
    'U',
    'Untracked',
    new ThemeColor('gitDecoration.untrackedResourceForeground'),
  ),
};

export class EncryptFileDecorationProvider extends Dispose implements FileDecorationProvider {
  _emitter = new EventEmitter<Uri | Uri[]>();

  onDidChangeFileDecorations = this._emitter.event;

  fileStatus = new Map<string, FileDecoration>();

  constructor() {
    super();
    this.#init();
  }

  async #init() {
    this.disposable.push(
      globalCtx.git.onDidChangeGitStatus(([newStatus]) => {
        this.updateGitStatus(newStatus);
      }),
    );

    globalCtx.git.updateGitStatus();
  }

  async provideFileDecoration(
    uri: Uri,
    token: CancellationToken,
  ): Promise<FileDecoration | null | undefined> {
    if (uri.scheme !== EncryptFSProvider.scheme) return;

    return this.fileStatus.get(uri.path);
  }

  updateGitStatus = debounce(async (newStatus: GitStatusMap) => {
    const newFileStatus = new Map<string, FileDecoration>();

    const root = getEncryptWorkspace()!;

    for (const [filePath, type] of newStatus.entries()) {
      let folder = filePath;
      while (((folder = path.dirname(folder)), folder !== '.')) {
        const folderUri = path.join(root.uri.path, folder);
        newFileStatus.set(folderUri, decorations[type]);
      }

      const fileUri = path.join(root.uri.path, filePath);
      newFileStatus.set(fileUri, decorations[type]);
    }

    const uris = [...new Set([...this.fileStatus.keys(), ...newFileStatus.keys()])].map((s) =>
      root.uri.with({ path: s }),
    );

    this.fileStatus = newFileStatus;

    this._emitter.fire(uris);
  }, 100);
}
