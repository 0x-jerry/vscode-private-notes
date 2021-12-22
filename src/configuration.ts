import { Uri, workspace } from 'vscode';
import { Dispose } from './Disposable';
import { getMemWorkspace } from './utils';

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
    exclude: [/\.encrypt\.json/],
  };
}

const confFileName = '.encrypt.json';

export class ConfigurationContext extends Dispose {
  conf: Configuration = defaultConf();

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
    const ws = getMemWorkspace();
    if (!ws?.uri) {
      return;
    }

    const conf = await this.#load(ws.uri);
    this.conf = conf;
  }

  isExclude(file: Uri): boolean {
    const match = !!this.conf.exclude.find((n) => n.test(file.path));

    return match;
  }
}
