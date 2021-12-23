import { FileType, ProgressLocation, Uri, window, workspace } from 'vscode';
import { decrypt, encrypt, isEncryptedFile, reEncrypt } from './aes';
import { globalCtx } from './context';
import { hasPassword } from './settings';
import { getEncryptWorkspace, travesDir } from './utils';

export async function reEncryptAllFiles(newMasterKey: Uint8Array, oldMasterKey?: Uint8Array) {
  const current = getEncryptWorkspace();
  if (!current) return;

  await window.withProgress(
    {
      location: ProgressLocation.Notification,
      cancellable: false,
      title: 'encrypting all files. Do not close vscode now, or the files may not decrypt forever.',
    },
    async () => {
      await travesDir(
        current.uri,
        async (uri) => {
          const content = await workspace.fs.readFile(uri);
          const isEncrypt = isEncryptedFile(content);

          const encryptedContent = isEncrypt
            ? reEncryptContent(content, newMasterKey, oldMasterKey)
            : encrypt(content, newMasterKey);

          await workspace.fs.writeFile(uri, encryptedContent);
        },
        (uri, fileType) => {
          return globalCtx.configuration.isExclude(uri) || fileType !== FileType.File;
        },
      );
    },
  );
}

function reEncryptContent(
  content: Uint8Array,
  newMasterKey: Uint8Array,
  oldMasterKey?: Uint8Array,
) {
  if (oldMasterKey) {
    return reEncrypt(content, oldMasterKey, newMasterKey);
  }

  return encrypt(content, newMasterKey);
}

export async function getSavedContent(uri: Uri, content: Uint8Array): Promise<Uint8Array> {
  if (!hasPassword()) {
    return content;
  }

  const isExclude = globalCtx.configuration.isExclude(uri);
  if (isExclude) return content;

  return encrypt(content, await globalCtx.configuration.getMasterKey());
}

export async function getReadContent(uri: Uri, content: Uint8Array): Promise<Uint8Array> {
  if (!hasPassword()) {
    return content;
  }

  if (!isEncryptedFile(content)) {
    return content;
  }

  const isExclude = globalCtx.configuration.isExclude(uri);
  if (isExclude) {
    return content;
  }

  return decrypt(content, await globalCtx.configuration.getMasterKey());
}
