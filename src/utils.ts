import { exec, ExecOptions } from 'child_process';
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

    if (uri.fsPath.startsWith('.')) {
      continue;
    }

    if (fileType === FileType.Directory) {
      await travesDir(uri, cb, isExclude);
    } else {
      const excluded = await isExclude?.(uri);

      if (excluded) {
        continue;
      }

      tasks.push(cb(uri, fileType));
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

export async function run(cmd: string, opt?: ExecOptions) {
  // console.log('run cmd:', cmd);

  return new Promise<Buffer>((resolve, reject) => {
    exec(
      cmd,
      {
        ...opt,
        encoding: 'buffer',
      },
      (err, stdout, stderr) => {
        const error = err || stderr.toString().trim();

        if (error) {
          reject(error);
        } else {
          resolve(stdout);
        }
      },
    );
  });
}

export function removeRootPath(str: string) {
  const splited = str.split(/\//).filter(Boolean);

  return splited.slice(1).join('/');
}
