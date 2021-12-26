import { URL } from 'url';
import { FileType, Uri, workspace } from 'vscode';
import { EncryptFSProvider } from './EncryptFsProvider';

export function parseQuery(query: string) {
  const url = new URL('/?' + query, 'http://xxx.com');

  return url.searchParams;
}

export function getEncryptWorkspace() {
  for (const item of workspace.workspaceFolders || []) {
    if (item.uri.scheme === EncryptFSProvider.scheme) {
      return item;
    }
  }
}

export async function travesDir(
  rootDir: Uri,
  cb: (uri: Uri, fileType: FileType) => any | Promise<any>,
  isExclude?: (uri: Uri) => boolean | Promise<boolean>,
): Promise<void> {
  const files = await workspace.fs.readDirectory(rootDir);

  const tasks: Promise<any>[] = [];

  for (const [filePath, fileType] of files) {
    const uri = Uri.joinPath(rootDir, filePath);

    const excluded = await isExclude?.(uri);

    if (!excluded) {
      tasks.push(cb(uri, fileType));
    }

    if (!excluded && fileType === FileType.Directory) {
      travesDir(uri, cb, isExclude);
    }
  }

  await Promise.all(tasks);
}

export function getTargetUri(uri: Uri) {
  if (uri.scheme !== EncryptFSProvider.scheme) {
    throw new Error('Please use ' + EncryptFSProvider.scheme);
  }

  const origin = Uri.parse(uri.fragment);

  const newUri = Uri.joinPath(origin, '..', uri.path);

  return newUri;
}
