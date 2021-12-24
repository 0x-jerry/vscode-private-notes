import { commands, ExtensionContext, Uri, window, workspace } from 'vscode';
import { globalCtx } from './context';
import { decryptAllFiles, reEncryptAllFiles } from './crypto';
import { EncryptFSProvider } from './EncryptFsProvider';
import { promptPassword, promptNewPassword } from './promptPassword';
import { getSetting, setPassword, Setting } from './settings';
import { parseQuery } from './utils';

enum Commands {
  InitWorkspace = 'encrypt.initWorkspace',
  SetPassword = 'encrypt.changePassword',
  EncryptAllFiles = 'encrypt.encryptAllFiles',
  DecryptAllFiles = 'encrypt.decryptAllFiles',
}

async function setPasswordCommand() {
  const oldPasswordExist = getSetting<string>(Setting.password);

  let oldPassword: string | undefined;

  if (oldPasswordExist) {
    oldPassword = await promptPassword('Please input the old password');
    if (!oldPassword) {
      window.showInformationMessage('Reset password canceled');
      return;
    }
  }

  const newPassword = await promptNewPassword();

  if (!newPassword) {
    window.showInformationMessage('Set password canceled');
    return;
  }

  await setPassword(newPassword);

  // update master key
  globalCtx.configuration.setMasterKey(newPassword);

  // re-encrypt all files.
  await reEncryptAllFiles(globalCtx.enc.encode(newPassword), globalCtx.enc.encode(oldPassword));
}

async function encryptAllFilesCommand() {
  const password = await promptPassword('Please input password');
  if (!password) return;

  await reEncryptAllFiles(globalCtx.enc.encode(password), globalCtx.enc.encode(password));
}

async function decryptAllFilesCommand() {
  const res = await window.showQuickPick(['Yes', 'No'], {
    placeHolder: `This action will clear password, are you sure ?`,
  });

  if (res !== 'Yes') return;

  const oldMasterKey = await globalCtx.configuration.getMasterKey();
  if (!oldMasterKey) return;

  await setPassword();
  await decryptAllFiles(oldMasterKey);

  globalCtx.configuration.setMasterKey();
}

async function initWorkspaceCommand() {
  const current = workspace.workspaceFolders?.[0];
  if (!current) return;

  const query = parseQuery(current.uri.query);
  query.set('scheme', current.uri.scheme);

  const uri = Uri.from({
    ...current.uri,
    scheme: EncryptFSProvider.scheme,
    query: query.toString(),
  });

  commands.executeCommand('vscode.openFolder', uri);
}

export function registerCommands(ctx: ExtensionContext) {
  ctx.subscriptions.push(commands.registerCommand(Commands.InitWorkspace, initWorkspaceCommand));
  ctx.subscriptions.push(commands.registerCommand(Commands.SetPassword, setPasswordCommand));
  ctx.subscriptions.push(
    commands.registerCommand(Commands.EncryptAllFiles, encryptAllFilesCommand),
  );
  ctx.subscriptions.push(
    commands.registerCommand(Commands.DecryptAllFiles, decryptAllFilesCommand),
  );
}
