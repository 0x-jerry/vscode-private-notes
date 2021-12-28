import { Uri, workspace } from 'vscode';
import { globalCtx } from './context';
import { Dispose } from './Disposable';
import { promptPassword } from './promptPassword';
import { UserConfiguration } from './types';
import { getEncryptWorkspace } from './utils';
import micromatch from 'micromatch';

export type Configuration = UserConfiguration;

function defaultConf(): Configuration {
  return {
    include: ['**/*.md'],
    exclude: [],
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

  #masterKey: Uint8Array = Buffer.alloc(0);

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

      const parsedConf: UserConfiguration = JSON.parse(confFile.toString());

      const includeRules = (parsedConf.include || []).filter(Boolean);
      if (includeRules.length) {
        conf.include = includeRules;
      }

      const excludeRules = (parsedConf.exclude || []).filter(Boolean);

      if (excludeRules.length) {
        conf.exclude = excludeRules;
      }

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
    const watcher = workspace.createFileSystemWatcher('**/' + confFileName);

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
    this.conf = conf;
  }

  isExclude(file: Uri): boolean {
    const root = getEncryptWorkspace();
    if (!root) return true;

    const baseUrl = root.uri.path || '';
    const filePath = file.path.slice(baseUrl.length);

    const rules = [...this.conf.include, ...this.conf.exclude.map((n) => '!' + n)];

    const isInclude = micromatch.isMatch(filePath, rules);

    return !isInclude;
  }
}
