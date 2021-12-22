import { URL } from 'url';
import { workspace } from 'vscode';
import { EncryptFS } from './EncryptFsProvider';

export function parseQuery(query: string) {
  const url = new URL('/?' + query, 'http://xxx.com');

  return url.searchParams;
}

export function getMemWorkspace() {
  for (const item of workspace.workspaceFolders || []) {
    if (item.uri.scheme === EncryptFS.scheme) {
      return item;
    }
  }
}
