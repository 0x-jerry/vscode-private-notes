import path from 'path';
import { TextEncoder } from 'util';
import {
  Disposable,
  Event,
  EventEmitter,
  FileChangeEvent,
  FileChangeType,
  FileStat,
  FileSystemError,
  FileSystemProvider,
  FileType,
  Uri,
  workspace,
} from 'vscode';
import { decrypt, encrypt, isEncryptFile } from './aes';
import { parseQuery } from './utils';
import { ConfigurationContext } from './configuration';
import { Dispose } from './Disposable';

interface EncryptFSContext {
  configuration: ConfigurationContext;
}

export class EncryptFS extends Dispose implements FileSystemProvider {
  static scheme = 'encrypt';

  constructor(private ctx: EncryptFSContext) {
    super();
    this.addDisposable(ctx.configuration);
  }

  private _getTargetUrl(uri: Uri) {
    let scheme = '';
    let query = '';

    for (const item of workspace.workspaceFolders || []) {
      if (item.uri.scheme === EncryptFS.scheme) {
        const qs = parseQuery(item.uri.query);
        scheme = qs.get('scheme') || '';
        qs.delete('scheme');
        query = qs.toString();
      }
    }

    const newUri = Uri.from({
      ...uri,
      scheme,
      query,
    });

    return newUri;
  }

  // --- manage file metadata

  async stat(uri: Uri): Promise<FileStat> {
    const newUri = this._getTargetUrl(uri);

    return workspace.fs.stat(newUri);
  }

  async readDirectory(uri: Uri): Promise<[string, FileType][]> {
    const newUri = this._getTargetUrl(uri);

    const result = await workspace.fs.readDirectory(newUri);

    return result;
  }

  // --- manage file contents

  async readFile(uri: Uri): Promise<Uint8Array> {
    const newUri = this._getTargetUrl(uri);

    const result = await workspace.fs.readFile(newUri);

    return this.#getReadContent(result);
  }

  async #getReadContent(content: Uint8Array): Promise<Uint8Array> {
    if (!isEncryptFile(content)) {
      return content;
    }

    try {
      const decryptContent = decrypt(content, new TextEncoder().encode('test'));

      return decryptContent;
    } catch (error) {
      console.error('decrypt error:', error);
      return content;
    }
  }

  async writeFile(
    uri: Uri,
    content: Uint8Array,
    options: { create: boolean; overwrite: boolean },
  ): Promise<void> {
    const entry = await this._lookup(uri, true);

    if (entry?.type === FileType.Directory) {
      throw FileSystemError.FileIsADirectory(uri);
    }

    if (!entry && !options.create) {
      throw FileSystemError.FileNotFound(uri);
    }

    if (entry && options.create && !options.overwrite) {
      throw FileSystemError.FileExists(uri);
    }

    const newUri = this._getTargetUrl(uri);

    const encryptContent = await this.#getSaveContent(uri, content);

    await workspace.fs.writeFile(newUri, encryptContent);

    if (!entry) {
      this._fireSoon({ type: FileChangeType.Created, uri });
    } else {
      this._fireSoon({ type: FileChangeType.Changed, uri });
    }
  }

  async #getSaveContent(uri: Uri, content: Uint8Array): Promise<Uint8Array> {
    if (this.ctx.configuration.isExclude(uri)) {
      return content;
    }

    return encrypt(content, new TextEncoder().encode('test'));
  }

  // --- manage files/folders

  async rename(oldUri: Uri, newUri: Uri, options: { overwrite: boolean }): Promise<void> {
    const newOldUri = this._getTargetUrl(oldUri);
    const newNewUri = this._getTargetUrl(newUri);

    // await workspace.fs.rename(newOldUri, newNewUri, options);

    await workspace.fs.copy(newOldUri, newNewUri, options);
    await workspace.fs.delete(newOldUri);

    this._fireSoon(
      { type: FileChangeType.Deleted, uri: oldUri },
      { type: FileChangeType.Created, uri: newUri },
    );
  }

  async copy(source: Uri, destination: Uri, options: { overwrite: boolean }): Promise<void> {
    await workspace.fs.copy(this._getTargetUrl(source), this._getTargetUrl(destination), options);

    this._fireSoon({ type: FileChangeType.Created, uri: destination });
  }

  async delete(uri: Uri, options: { recursive: boolean }): Promise<void> {
    await workspace.fs.delete(this._getTargetUrl(uri), options);

    const dirname = uri.with({ path: path.dirname(uri.path) });

    this._fireSoon(
      { type: FileChangeType.Changed, uri: dirname },
      { uri, type: FileChangeType.Deleted },
    );
  }

  async createDirectory(uri: Uri): Promise<void> {
    await workspace.fs.createDirectory(this._getTargetUrl(uri));

    const dirname = uri.with({ path: path.dirname(uri.path) });

    this._fireSoon(
      { type: FileChangeType.Changed, uri: dirname },
      { type: FileChangeType.Created, uri },
    );
  }

  // --- lookup

  private async _lookup(uri: Uri, silent: boolean): Promise<FileStat | undefined> {
    const newUri = this._getTargetUrl(uri);

    if (!silent) {
      return workspace.fs.stat(newUri);
    }

    try {
      return await workspace.fs.stat(newUri);
    } catch (error) {
      //
    }
  }

  // --- manage file events

  private _emitter = new EventEmitter<FileChangeEvent[]>();
  private _bufferedEvents: FileChangeEvent[] = [];
  private _fireSoonHandle?: NodeJS.Timeout;

  readonly onDidChangeFile: Event<FileChangeEvent[]> = this._emitter.event;

  watch(): Disposable {
    // ignore, fires for all changes...
    return new Disposable(() => undefined);
  }

  private _fireSoon(...events: FileChangeEvent[]): void {
    this._bufferedEvents.push(...events);

    if (this._fireSoonHandle) {
      clearTimeout(this._fireSoonHandle);
    }

    this._fireSoonHandle = setTimeout(() => {
      this._emitter.fire(this._bufferedEvents);
      this._bufferedEvents.length = 0;
    }, 5);
  }
}
