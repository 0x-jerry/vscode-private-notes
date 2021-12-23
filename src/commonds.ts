import { commands, ExtensionContext, Uri, window, workspace } from 'vscode';
import { reEncryptAllFiles } from './crypto';
import { EncryptFS } from './EncryptFsProvider';
import { getSetting, isValidPassword, setPassword, Setting } from './settings';
import { parseQuery } from './utils';

enum Commands {
  InitWorkspace = 'encrypt.initWorkspace',
  SetPassword = 'encrypt.changePassword',
  EncryptAllFiles = 'encrypt.encryptAllFiles',
  DecryptAllFiles = 'encrypt.decryptAllFiles',
}

async function promptPassword(placeHolder: string): Promise<string | undefined> {
  const password = await window.showInputBox({
    placeHolder: placeHolder,
    password: true,
  });

  if (!password) return;

  if (isValidPassword(password)) {
    return password;
  }

  window.showErrorMessage('Invalid password, please try again.');

  return promptPassword(placeHolder);
}

async function promptNewPassword(): Promise<string | undefined> {
  const password = await window.showInputBox({
    placeHolder: 'Please input new password',
  });

  if (!password) return;

  const passwordAgain = await window.showInputBox({
    placeHolder: 'Please input new password again',
  });

  if (!passwordAgain) return;

  if (passwordAgain === password) {
    return password;
  }

  window.showErrorMessage('Password not match, please try again.');

  return promptNewPassword();
}

async function setPasswordCommand() {
  const oldPasswordExist = getSetting<string>(Setting.validator);

  if (oldPasswordExist) {
    const oldPassword = await promptPassword('Please input the old password');
    if (!oldPassword) return;
  }

  const newPassword = await promptNewPassword();

  if (!newPassword) return;

  // re-encrypt all files.
  await reEncryptAllFiles();

  await setPassword(newPassword);
}

function encryptAllFiles() {}

function decryptAllFiles() {}

async function initWorkspace() {
  const current = workspace.workspaceFolders?.[0];
  if (!current) return;

  const query = parseQuery(current.uri.query);
  query.set('scheme', current.uri.scheme);

  const uri = Uri.from({
    ...current.uri,
    scheme: EncryptFS.scheme,
    query: query.toString(),
  });

  commands.executeCommand('vscode.openFolder', uri);
}

export function registerCommands(ctx: ExtensionContext) {
  ctx.subscriptions.push(commands.registerCommand(Commands.InitWorkspace, initWorkspace));
  ctx.subscriptions.push(commands.registerCommand(Commands.SetPassword, setPasswordCommand));
  ctx.subscriptions.push(commands.registerCommand(Commands.EncryptAllFiles, encryptAllFiles));
  ctx.subscriptions.push(commands.registerCommand(Commands.DecryptAllFiles, decryptAllFiles));
}
