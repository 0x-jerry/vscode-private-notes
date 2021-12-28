import { ExecOptions } from 'child_process';
import { watch } from 'fs';
import debounce from 'lodash/debounce';
import path from 'path';
import { EventEmitter, Uri, workspace } from 'vscode';
import { globalCtx } from './context';
import { Dispose } from './Disposable';
import { run as exec } from './utils';

export type GitStatus = 'A' | 'M' | 'D' | 'U';

export type GitStatusMap = Map<string, GitStatus>;

const getGitStatus = async (cwd: string) => {
  const std = await exec('git status -s', { cwd });
  const files = std.toString().split(/\n/g).filter(Boolean);

  const result: GitStatusMap = new Map();

  files.forEach((n) => {
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

    result.set(filePath, status as GitStatus);
  });

  return result;
};

export class Git extends Dispose {
  get cwd() {
    return this.root.path;
  }

  /**
   * file status
   */
  status: GitStatusMap = new Map();

  /**
   * is git repo?
   */
  exist = false;

  _emitter = new EventEmitter<[GitStatusMap, GitStatusMap]>();

  /**
   * new status, old status
   */
  onDidChangeGitStatus = this._emitter.event;

  constructor(public readonly root: Uri) {
    super();
  }

  async #initWatcher() {
    const workspaceWatcher = workspace.createFileSystemWatcher('**');

    this.disposable.push(
      workspaceWatcher,
      workspaceWatcher.onDidChange(() => {
        this.updateGitStatus();
      }),
      workspaceWatcher.onDidCreate(() => {
        this.updateGitStatus();
      }),
      workspaceWatcher.onDidDelete(() => {
        this.updateGitStatus();
      }),
    );

    const watcher = watch(path.join(this.cwd, '.git'));

    watcher.addListener('change', (type, filename) => {
      if (filename.toString().endsWith('index.lock')) return;

      this.updateGitStatus();
    });

    this.disposable.push({
      dispose: () => {
        watcher.close();
      },
    });
  }

  async init() {
    try {
      await this.run('git status');
      this.exist = true;
    } catch (error) {
      this.exist = false;
    }

    if (this.exist) {
      this.#initWatcher();
    }
  }

  run(cmd: string, options?: ExecOptions) {
    return exec(cmd, { ...options, cwd: this.cwd });
  }

  updateGitStatus = debounce(async () => {
    const newStatus = await getGitStatus(this.cwd);

    this._emitter.fire([newStatus, this.status]);

    this.status = newStatus;
  }, 100);
}
