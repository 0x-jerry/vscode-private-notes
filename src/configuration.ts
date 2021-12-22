import { Uri, workspace } from 'vscode';

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

export class ConfigurationContext {
  conf: Configuration = defaultConf();

  async #load(root: Uri): Promise<Configuration> {
    try {
      const confUri = Uri.joinPath(root, '.encrypt.json');

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

  async load(root: Uri): Promise<Configuration> {
    const conf = await this.#load(root);

    this.conf = conf;

    return conf;
  }

  isExclude(file: Uri): boolean {
    const match = !!this.conf.exclude.find((n) => n.test(file.path));

    return match;
  }
}
