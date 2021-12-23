import { URL } from 'url';
import { FileType, Uri, workspace } from 'vscode';
import { EncryptFS } from './EncryptFsProvider';

export function parseQuery(query: string) {
  const url = new URL('/?' + query, 'http://xxx.com');

  return url.searchParams;
}

export function getEncryptWorkspace() {
  for (const item of workspace.workspaceFolders || []) {
    if (item.uri.scheme === EncryptFS.scheme) {
      return item;
    }
  }
}

export async function travesDir(
  rootDir: Uri,
  cb: (uri: Uri) => any | Promise<any>,
  isExclude?: (uri: Uri, fileType: FileType) => boolean | Promise<boolean>,
): Promise<void> {
  const files = await workspace.fs.readDirectory(rootDir);

  const tasks: Promise<any>[] = [];

  for (const [filePath, fileType] of files) {
    const uri = Uri.joinPath(rootDir, filePath);

    if (!isExclude?.(uri, fileType)) {
      tasks.push(cb(uri));

      if (fileType === FileType.Directory) {
        travesDir(uri, cb, isExclude);
      }
    }
  }

  await Promise.all(tasks);
}
