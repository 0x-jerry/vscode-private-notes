import { URL } from 'url';
import { workspace } from 'vscode';
import { MemFS } from './EncryptFsProvider';

export function parseQuery(query: string) {
  const url = new URL('/?' + query, 'http://xxx.com');

  return url.searchParams;
}

export function getMemWorkspace() {
  for (const item of workspace.workspaceFolders || []) {
    if (item.uri.scheme === MemFS.scheme) {
      return item;
    }
  }
}
