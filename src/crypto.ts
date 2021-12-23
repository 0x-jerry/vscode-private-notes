import { FileType, ProgressLocation, Uri, window, workspace } from 'vscode';
import { globalCtx } from './context';
import { getEncryptWorkspace, travesDir } from './utils';

export async function reEncryptAllFiles() {
  const current = getEncryptWorkspace();
  if (!current) return;

  await window.withProgress(
    {
      location: ProgressLocation.Window,
      cancellable: false,
      title: 'encrypting all files. Do not close vscode now, or the files may not decrypt forever.',
    },
    async (progress) => {
      await travesDir(
        current.uri,
        (uri) => {
          console.log(uri);
        },
        globalCtx.configuration.isExclude,
      );
    },
  );
}
