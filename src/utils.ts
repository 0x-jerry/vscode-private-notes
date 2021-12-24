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

    tasks.push(cb(uri, fileType));

    if (!isExclude?.(uri) && fileType === FileType.Directory) {
      travesDir(uri, cb, isExclude);
    }
  }

  await Promise.all(tasks);
}

export function getTargetUri(uri: Uri) {
  let scheme = '';
  let query = '';

  for (const item of workspace.workspaceFolders || []) {
    if (item.uri.scheme === EncryptFSProvider.scheme) {
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
