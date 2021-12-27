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
import { Dispose } from './Disposable';
import { EncryptFSProvider } from './EncryptFsProvider';
import { getEncryptWorkspace, run } from './utils';

type Status = 'A' | 'M' | 'D' | 'AM' | '??';

const cacheRunner = createCacheRunner(async (cwd: string) => {
  const std = await run('git status -s', { cwd });
  const files = std.toString().trim().split(/\n/g);

  return files.map((n) => n.trim().split(/\s+/)) as [Status, string][];
});

async function getFileStatus(uri: Uri) {
  const origin = Uri.parse(uri.fragment);
  if (origin.scheme !== 'file') {
    return;
  }

  const cwd = origin.path;

  const root = '/' + path.basename(cwd) + '/';

  try {
    const files = await cacheRunner(cwd);
    const filePath = uri.path.slice(root.length);

    const hit = files.find((f) => f[1] === filePath);
    return hit?.[0];
  } catch (error) {
    console.log('error', error);
  }
}

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
  AM: new FileDecoration(
    'M',
    'Modified',
    new ThemeColor('gitDecoration.modifiedResourceForeground'),
  ),
  M: new FileDecoration(
    'M',
    'Modified',
    new ThemeColor('gitDecoration.modifiedResourceForeground'),
  ),
  D: new FileDecoration('D', 'Deleted', new ThemeColor('gitDecoration.deletedResourceForeground')),
  '??': new FileDecoration(
    'U',
    'Untracked',
    new ThemeColor('gitDecoration.untrackedResourceForeground'),
  ),
};

export class EncryptFileDecorationProvider extends Dispose implements FileDecorationProvider {
  _emitter = new EventEmitter<Uri | Uri[]>();

  onDidChangeFileDecorations = this._emitter.event;

  #isGitRepo = false;

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
    this.addDisposable(
      workspace.onDidSaveTextDocument((e) => {
        // const status = await this.getStatus(e.uri)
        // if (status) {
        // }
        this._emitter.fire(e.uri);
      }),
    );
  }

  async provideFileDecoration(
    uri: Uri,
    token: CancellationToken,
  ): Promise<FileDecoration | null | undefined> {
    return this.getStatus(uri);
  }

  async getStatus(uri: Uri) {
    if (uri.scheme !== EncryptFSProvider.scheme) {
      return;
    }

    if (!this.#isGitRepo) return;

    const status = await getFileStatus(uri);

    if (!status) return;

    return decorations[status];
  }
}
