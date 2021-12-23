import { commands, ExtensionContext, Uri, workspace } from 'vscode';
import { globalCtx } from './context';
import { reEncryptAllFiles } from './crypto';
import { EncryptFS } from './EncryptFsProvider';
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
    if (!oldPassword) return;
  }

  const newPassword = await promptNewPassword();

  if (!newPassword) return;

  await setPassword(newPassword);

  // update master key
  globalCtx.configuration.setMasterKey(newPassword);

  // re-encrypt all files.
  await reEncryptAllFiles(globalCtx.enc.encode(newPassword), globalCtx.enc.encode(oldPassword));
}

async function encryptAllFiles() {
  const password = await promptPassword('Please input password');
  if (!password) return;

  await reEncryptAllFiles(globalCtx.enc.encode(password));
}

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
