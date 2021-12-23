import { Uri, workspace } from 'vscode';
import { Dispose } from './Disposable';
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

  get root() {
    return getEncryptWorkspace();
  }

  async #load(root: Uri): Promise<Configuration> {
    try {
      const confUri = Uri.joinPath(root, confFileName);

      const confFile = await workspace.fs.readFile(confUri);

      const conf = defaultConf();

      const parsedConf: UserConfiguration = JSON.parse(confFile.toString());

      for (const exclude of parsedConf.exclude || []) {
        conf.exclude.push(new RegExp(exclude));
      }

      return conf;
    } catch (error) {
      console.error(error);
      return defaultConf();
    }
  }

  constructor() {
    super();
    this.watchConfFile();
    this.load();
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
    if (!this.root) {
      return;
    }

    const conf = await this.#load(this.root.uri);
    this.conf = conf;
  }

  isExclude(file: Uri): boolean {
    const baseUrl = this.root?.uri.path || '';

    const match = !!this.conf.exclude.find((n) => n.test(file.path.slice(baseUrl.length)));

    return match;
  }
}
