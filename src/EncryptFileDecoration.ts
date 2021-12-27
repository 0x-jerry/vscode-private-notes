import { FSWatcher, watch } from 'fs';
import debounce from 'lodash/debounce';
import path from 'path';

import {
  CancellationToken,
  EventEmitter,
  FileDecoration,
  FileDecorationProvider,
  ThemeColor,
  Uri,
  workspace,
} from 'vscode';
import { globalCtx } from './context';
import { Dispose } from './Disposable';
import { getEncryptWorkspace, run } from './utils';

type Status = 'A' | 'M' | 'D' | 'U';

const gitStatus = createCacheRunner(async (cwd: string) => {
  const std = await run('git status -s', { cwd });
  const files = std.toString().split(/\n/g).filter(Boolean);

  return files.map((n) => {
    let status = n[1] === ' ' ? n[0] : n[1];
    status = status === '?' ? 'U' : status;

    let filePath = n.slice(3);
    // covert `"xx/xx xx.md"` to `xx/xx xx.md`
    filePath = filePath.startsWith('"') ? filePath.slice(1, -1) : filePath;

    // covert octal bytes to string
    filePath = filePath.replace(/(\\\d{3})+/g, (str) => {
      const arr = str.match(/\\\d{3}/g)?.map((octal) => parseInt(octal.slice(1), 8)) || [];

      return globalCtx.dec.decode(Buffer.from(arr));
    });

    return [status, filePath] as [Status, string];
  });
});

function createCacheRunner<Fn extends (...args: any[]) => any>(fn: Fn, cacheTime = 100) {
  const resolvers: Array<(val: unknown) => void> = [];

  const runner = debounce(async (...args: Parameters<Fn>) => {
    const res = await fn(...args);

    resolvers.splice(0).forEach((r) => r(res));
  }, cacheTime);

  return (...args: Parameters<Fn>): Promise<ReturnType<Fn>> => {
    return new Promise<any>((resolve) => {
      resolvers.push(resolve);
      runner(...args);
    });
  };
}

const decorations: Record<Status, FileDecoration> = {
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

  #isGitRepo = false;

  #watcher?: FSWatcher;

  fileStatus = new Map<string, FileDecoration>();

  constructor() {
    super();
    this.#init();
  }

  async #init() {
    const root = getEncryptWorkspace();
    if (!root) return;

    const origin = Uri.parse(root.uri.fragment);
    if (origin.scheme !== 'file') {
      return;
    }

    const cwd = origin.path;

    try {
      await run('git status', { cwd });
    } catch (error) {
      return;
    }

    this.#isGitRepo = true;

    const workspaceWatcher = workspace.createFileSystemWatcher('**');
    this.addDisposable(workspaceWatcher);

    this.addDisposable(
      workspaceWatcher.onDidChange(() => {
        this.updateGitStatus();
      }),
    );

    this.addDisposable(
      workspaceWatcher.onDidCreate(() => {
        this.updateGitStatus();
      }),
    );

    this.addDisposable(
      workspaceWatcher.onDidDelete(() => {
        this.updateGitStatus();
      }),
    );

    this.#watcher = watch(path.join(origin.path, '.git'));

    this.#watcher.addListener('change', (type, filename) => {
      if (filename.toString().endsWith('index.lock')) return;

      this.updateGitStatus();
    });

    this.addDisposable({
      dispose: () => {
        this.#watcher?.close();
      },
    });

    this.updateGitStatus();
  }

  async provideFileDecoration(
    uri: Uri,
    token: CancellationToken,
  ): Promise<FileDecoration | null | undefined> {
    return this.getStatus(uri);
  }

  async getStatus(uri: Uri) {
    return this.fileStatus.get(uri.path);
  }

  updateGitStatus = debounce(async () => {
    const root = getEncryptWorkspace();
    if (!root) return;

    const origin = Uri.parse(root.uri.fragment);
    if (origin.scheme !== 'file') {
      return;
    }

    if (!this.#isGitRepo) return;

    const cwd = origin.path;
    const status = await gitStatus(cwd);
    const newFileStatus = new Map<string, FileDecoration>();

    for (const [type, filePath] of status) {
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
