import { Uri, workspace, EventEmitter } from 'vscode';
import { globalCtx } from './context';
import { Dispose } from './Disposable';
import { promptPassword } from './promptPassword';
import { UserConfiguration } from './types';
import { getEncryptWorkspace } from './utils';
import micromatch, { match } from 'micromatch';

export type Configuration = UserConfiguration;

function defaultConf(): Configuration {
  return {
    include: ['**/*.md'],
    exclude: ['.encrypt.json'],
    extension: {
      include: [],
      exclude: [],
    },
  };
}

const confFileName = '.encrypt.json';

export async function configurationExist() {
  const root = workspace.workspaceFolders?.[0];
  if (!root) {
    return false;
  }

  try {
    const confUri = Uri.joinPath(root.uri, confFileName);

    await workspace.fs.stat(confUri);

    return true;
  } catch (error) {
    return false;
  }
}

export class ConfigurationContext extends Dispose {
  conf: Configuration = defaultConf();

  rules = {
    gitignore: [] as string[],
  };

  #masterKey: Uint8Array = Buffer.alloc(0);

  _emitter = new EventEmitter<void>();

  onDidConfigChanged = this._emitter.event;

  constructor() {
    super();
    this.watchConfFile();
    this.load();
  }

  async #load(root: Uri): Promise<Configuration> {
    try {
      const confUri = Uri.joinPath(root, confFileName);

      const confFile = await workspace.fs.readFile(confUri);

      const conf = defaultConf();

      const parsedConf: Partial<UserConfiguration> = JSON.parse(confFile.toString());

      const includeRules = (parsedConf.include || []).filter(Boolean);
      if (includeRules.length) {
        conf.include = includeRules;
      }

      const excludeRules = (parsedConf.exclude || []).filter(Boolean);

      if (excludeRules.length) {
        conf.exclude = excludeRules;
      }

      Object.assign(conf.extension, parsedConf.extension);

      return conf;
    } catch (error) {
      return defaultConf();
    }
  }

  setMasterKey(masterKey = '') {
    this.#masterKey = globalCtx.enc.encode(masterKey);
  }

  async getMasterKey(): Promise<Uint8Array> {
    if (!this.#masterKey.length) {
      const pwd = await promptPassword();
      if (!pwd) throw new Error('Cancel prompt');

      this.setMasterKey(pwd);
    }

    return this.#masterKey;
  }

  private watchConfFile() {
    /**
     * todo: when config changed, excluded files should be decrypt.
     */
    const watcher = workspace.createFileSystemWatcher(`**/{${confFileName},.gitignore}`);

    watcher.onDidChange(() => {
      this.load();
    });

    watcher.onDidDelete(() => {
      this.load();
    });

    watcher.onDidCreate(() => {
      this.load();
    });

    this.disposable.push(watcher);
  }

  async load(): Promise<void> {
    const root = getEncryptWorkspace();
    if (!root) {
      return;
    }

    const conf = await this.#load(root.uri);

    // simple merge config
    Object.assign(this.conf, conf);

    const excludes = await loadGitignore(Uri.joinPath(root.uri, '.gitignore'));
    this.rules.gitignore = excludes;
    this._emitter.fire();
  }

  async save(): Promise<void> {
    const root = getEncryptWorkspace();
    if (!root) {
      return;
    }

    const confUri = Uri.joinPath(root.uri, confFileName);

    const content = Buffer.from(JSON.stringify(this.conf, null, 2));

    await workspace.fs.writeFile(confUri, content);
  }

  isExclude(file: Uri): boolean {
    const root = getEncryptWorkspace();
    if (!root) return true;

    const baseUrl = root.uri.path + '/';
    // relative path
    const filePath = file.path.slice(baseUrl.length);

    // use extension conf first

    if (matchGlob(filePath, this.conf.extension.include)) {
      return false;
    }

    if (matchGlob(filePath, this.conf.extension.exclude)) {
      return true;
    }

    const isInclude = matchGlob(filePath, this.conf.include);

    if (!isInclude) {
      return true;
    }

    const isExclude = matchGlob(filePath, [...this.conf.exclude, ...this.rules.gitignore]);

    return isExclude;
  }

  isIgnored(file: Uri): boolean {
    const root = getEncryptWorkspace();
    if (!root) return true;

    const baseUrl = root.uri.path;
    const filePath = file.path.slice(baseUrl.length);

    const isIgnored = micromatch.isMatch(filePath, this.rules.gitignore, {
      cwd: '/',
      contains: true,
    });

    return isIgnored;
  }
}

async function loadGitignore(uri: Uri): Promise<string[]> {
  try {
    const gitignore = await workspace.fs.readFile(uri);
    const rules = gitignore
      .toString()
      .split(/\n+/g)
      .map((n) => n.trim())
      .filter((n) => Boolean(n) && !n.startsWith('#'));

    return rules;
  } catch (error) {
    return [];
  }
}

function matchGlob(path: string, rules: string[]) {
  return micromatch.isMatch(path, rules, { contains: true });
}
