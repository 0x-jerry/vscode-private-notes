import { FileType, ProgressLocation, Uri, window, workspace } from 'vscode';
import { decrypt, encrypt, isEncryptedFile, reEncrypt } from './aes';
import { globalCtx } from './context';
import { hasPassword } from './settings';
import { getEncryptWorkspace, getTargetUri, travesDir } from './utils';

export async function reEncryptAllFiles(newMasterKey: Uint8Array, oldMasterKey: Uint8Array) {
  const current = getEncryptWorkspace();
  if (!current) return;

  await window.withProgress(
    {
      location: ProgressLocation.Notification,
      cancellable: false,
      title: 'Encrypting all files. Do not close vscode now, or the files may not decrypt forever.',
    },
    async () => {
      await travesDir(
        current.uri,
        async (uri, fileType) => {
          if (fileType !== FileType.File) return;

          // use realUri to avoid effect by EncryptFSProvider.
          const realUri = getTargetUri(uri);

          const content = await workspace.fs.readFile(realUri);
          const isEncrypt = isEncryptedFile(content);

          const encryptedContent = isEncrypt
            ? reEncrypt(content, newMasterKey, oldMasterKey)
            : encrypt(content, newMasterKey);

          await workspace.fs.writeFile(realUri, encryptedContent);
        },
        (uri) => {
          return globalCtx.configuration.isExclude(uri);
        },
      );
    },
  );
}

export async function decryptAllFiles(masterKey: Uint8Array) {
  const current = getEncryptWorkspace();
  if (!current) return;

  await window.withProgress(
    {
      location: ProgressLocation.Notification,
      cancellable: false,
      title: 'Decrypting all files. Do not close vscode now, or the files may not decrypt forever.',
    },
    async () => {
      await travesDir(
        current.uri,
        async (uri, fileType) => {
          if (fileType !== FileType.File) return;
          // use realUri to avoid effect by EncryptFSProvider.
          const realUri = getTargetUri(uri);

          const content = await workspace.fs.readFile(realUri);
          const isEncrypt = isEncryptedFile(content);
          if (!isEncrypt) return;

          const decryptContent = decrypt(content, masterKey);

          await workspace.fs.writeFile(realUri, decryptContent);
        },
        (uri) => {
          return globalCtx.configuration.isExclude(uri);
        },
      );
    },
  );
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
