import { Uri, workspace } from 'vscode';
import { globalCtx } from './context';
import { Dispose } from './Disposable';
import { promptPassword } from './promptPassword';
import { getEncryptWorkspace } from './utils';

export interface Configuration {
  /**
   * Regexp pattern
   */
  exclude: RegExp[];
}

export interface UserConfiguration {
  /**
   * Regexp pattern
   */
  exclude: string[];
}

function defaultConf(): Configuration {
  return {
    exclude: [
      //
      /\.encrypt\.json/,
      /^\.vscode/,
      /^\/\./,
    ],
  };
}

const confFileName = '.encrypt.json';

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

      for (const exclude of parsedConf.exclude || []) {
        // Ignore empty rule.
        if (exclude) {
          conf.exclude.push(new RegExp(exclude));
        }
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

    this.addDisposable(watcher);
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

    const match = !!this.conf.exclude.find((n) => n.test(file.path.slice(baseUrl.length)));

    return match;
  }
}
