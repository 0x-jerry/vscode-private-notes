import path from 'path';
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
  window,
  workspace,
} from 'vscode';
import { getTargetUri } from './utils';
import { getReadContent, getSavedContent } from './crypto';

export class EncryptFSProvider implements FileSystemProvider {
  static scheme = 'encrypt';

  // --- manage file metadata

  async stat(uri: Uri): Promise<FileStat> {
    const newUri = getTargetUri(uri);

    return workspace.fs.stat(newUri);
  }

  async readDirectory(uri: Uri): Promise<[string, FileType][]> {
    const newUri = getTargetUri(uri);

    const result = await workspace.fs.readDirectory(newUri);

    return result;
  }

  // --- manage file contents

  async readFile(uri: Uri): Promise<Uint8Array> {
    const newUri = getTargetUri(uri);

    const result = await workspace.fs.readFile(newUri);

    try {
      return getReadContent(result);
    } catch (error) {
      window.showErrorMessage(`Decrypt file [${uri.toString()}] failed: ${String(error)}`);
      return result;
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

    const encryptContent = await getSavedContent(uri, content);

    const newUri = getTargetUri(uri);
    await workspace.fs.writeFile(newUri, encryptContent);

    if (!entry) {
      this._fireSoon({ type: FileChangeType.Created, uri });
    } else {
      this._fireSoon({ type: FileChangeType.Changed, uri });
    }
  }

  // --- manage files/folders

  async rename(oldUri: Uri, newUri: Uri, options: { overwrite: boolean }): Promise<void> {
    const newOldUri = getTargetUri(oldUri);
    const newNewUri = getTargetUri(newUri);

    if ((await workspace.fs.stat(newOldUri)).type === FileType.Directory) {
      await workspace.fs.rename(newOldUri, newNewUri, options);
    } else {
      await workspace.fs.copy(newOldUri, newNewUri, options);
      await workspace.fs.delete(newOldUri);
    }

    this._fireSoon(
      { type: FileChangeType.Deleted, uri: oldUri },
      { type: FileChangeType.Created, uri: newUri },
    );
  }

  async delete(uri: Uri, options: { recursive: boolean }): Promise<void> {
    await workspace.fs.delete(getTargetUri(uri), options);

    const dirname = uri.with({ path: path.dirname(uri.path) });

    this._fireSoon(
      { type: FileChangeType.Changed, uri: dirname },
      { type: FileChangeType.Deleted, uri },
    );
  }

  async createDirectory(uri: Uri): Promise<void> {
    await workspace.fs.createDirectory(getTargetUri(uri));

    const dirname = uri.with({ path: path.dirname(uri.path) });

    this._fireSoon(
      { type: FileChangeType.Changed, uri: dirname },
      { type: FileChangeType.Created, uri },
    );
  }

  // --- lookup

  private async _lookup(uri: Uri, silent: boolean): Promise<FileStat | undefined> {
    const newUri = getTargetUri(uri);

    if (!silent) {
      return workspace.fs.stat(newUri);
    }

    try {
      return await workspace.fs.stat(newUri);
    } catch (error) {
      console.error(error, newUri);
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
