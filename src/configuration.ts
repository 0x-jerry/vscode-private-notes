import { Disposable, Uri, workspace } from 'vscode';
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

export class ConfigurationContext implements Disposable {
  conf: Configuration = defaultConf();

  _disposable: Disposable[] = [];

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

    this._disposable.push(watcher);

    this.load();
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

  dispose() {
    this._disposable.forEach((n) => n.dispose());
  }
}
