import { ExecOptions } from 'child_process';
import { watch } from 'fs';
import fs from 'fs/promises';
import debounce from 'lodash/debounce';
import path from 'path';
import { EventEmitter, Uri, workspace } from 'vscode';
import { globalCtx } from './context';
import { Dispose } from './Disposable';
import { run as exec } from './utils';

export enum GitStatus {
  Added = 'A',
  Modified = 'M',
  Deleted = 'D',
  Untracked = 'U',
}

export type GitStatusMap = Map<string, GitStatus>;

const getGitStatus = async (cwd: string) => {
  const std = await exec('git status -s', { cwd });
  const files = std.toString().split(/\n/g).filter(Boolean);

  const result: GitStatusMap = new Map();

  files.forEach((n) => {
    //  use the secondary status
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

  async getLatestVersion(filePath: string): Promise<Uint8Array> {
    if (!filePath) {
      throw new Error('Wrong file path: ' + filePath);
    }

    const hashStr = await this.run(`git log --pretty="%H" -- ${JSON.stringify(filePath)}`);

    const hash = hashStr.toString().trim().split(/\n/)?.[0];

    if (!hash) {
      return Buffer.alloc(0);
    }

    return this.getFileVersion(hash, filePath);
  }

  async getFileVersion(hash: string, filePath: string): Promise<Uint8Array> {
    const hashKey = `${hash}:${JSON.stringify(filePath)}`;

    const fileContent = await this.run(`git cat-file blob ${hashKey}`);
    const content = fileContent.toString();

    const lfsSign = 'oid sha256:';
    const isLfs = content.includes(lfsSign);

    if (!isLfs) {
      return fileContent;
    }

    try {
      await this.run(`git lfs fsck ${hashKey}`);
    } catch (error) {
      await this.run(`git cat-file blob ${hashKey} | git lfs smudge`);
    }

    const sha = content.match(/^oid sha256:[a-z0-9]+$/m);
    const oid = sha?.[0].slice(lfsSign.length);

    if (!oid) return Buffer.alloc(0);

    const lfsContent = await fs.readFile(
      path.join(this.cwd, '.git', 'lfs', 'objects', oid.slice(0, 2), oid.slice(2, 4), oid),
    );

    return lfsContent;
  }

  /**
   *
   * @param filePath
   * @returns [hash, commit msg][]
   */
  async getFileHistory(filePath: string): Promise<[string, string][]> {
    const hashStr = await this.run(`git log --pretty="%H %s" -- ${JSON.stringify(filePath)}`);

    const commits = hashStr
      .toString()
      .trim()
      .split(/\n+/g)
      .map((n) => {
        const strs = n.trim().split(/\s/);

        return [strs[0], strs.slice(1).join(' ')] as [string, string];
      });

    return commits;
  }
}
