import path from 'path';
import { commands, ExtensionContext, scm, Uri, window, workspace } from 'vscode';
import { globalCtx } from './context';
import { decryptAllFiles, reEncryptAllFiles } from './crypto';
import { EncryptFSProvider } from './EncryptFsProvider';
import { promptPassword, promptNewPassword } from './promptPassword';
import { getSetting, setPassword, Setting } from './settings';
import { removeRootPath } from './utils';

export enum Commands {
  InitWorkspace = 'encrypt.initWorkspace',
  SetPassword = 'encrypt.changePassword',
  EncryptAllFiles = 'encrypt.encryptAllFiles',
  DecryptAllFiles = 'encrypt.decryptAllFiles',
  Lock = 'encrypt.lock',
  GitCommit = 'encrypt.git.commit',
  EncryptCurrentFile = 'encrypt.encrypt',
  DecryptCurrentFile = 'encrypt.decrypt',
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
  const current = workspace.workspaceFolders?.[0]?.uri;
  if (!current) return;
  if (current.scheme === EncryptFSProvider.scheme) return;

  const name = path.basename(current.path);

  const uri = Uri.from({
    scheme: EncryptFSProvider.scheme,
    fragment: current.toString(),
    path: '/' + name,
  });

  commands.executeCommand('vscode.openFolder', uri);
}

async function encryptCurrentFileCommand() {
  const uri = window.activeTextEditor?.document.uri;
  if (!uri) return;

  const extensionConf = globalCtx.configuration.conf.extension;
  const filePath = removeRootPath(uri.path);
  const excludeIdx = extensionConf.exclude.indexOf(filePath);

  if (excludeIdx >= 0) {
    extensionConf.exclude.splice(excludeIdx, 1);
  }

  if (globalCtx.configuration.isExclude(uri)) {
    if (!extensionConf.include.includes(filePath)) {
      extensionConf.include.push(filePath);
    }
  }

  await globalCtx.configuration.save();
  // re-save to trigger to encrypt the file.
  await workspace.fs.writeFile(uri, await workspace.fs.readFile(uri));
  updateContextIsEncrypted(uri);
}

async function decryptCurrentFileCommand() {
  const uri = window.activeTextEditor?.document.uri;
  if (!uri) return;

  const extensionConf = globalCtx.configuration.conf.extension;

  const filePath = removeRootPath(uri.path);
  const includeIdx = extensionConf.include.indexOf(filePath);

  if (includeIdx >= 0) {
    extensionConf.include.splice(includeIdx, 1);
  }

  if (!globalCtx.configuration.isExclude(uri)) {
    if (!extensionConf.exclude.includes(filePath)) {
      extensionConf.exclude.push(filePath);
    }
  }

  await globalCtx.configuration.save();
  // re-save to trigger to decrypt the file.
  await workspace.fs.writeFile(uri, await workspace.fs.readFile(uri));
  updateContextIsEncrypted(uri);
}

async function lockCommand() {
  await commands.executeCommand('workbench.action.closeAllEditors');
  globalCtx.configuration.setMasterKey();
}

export function registerCommands(ctx: ExtensionContext) {
  ctx.subscriptions.push(
    window.onDidChangeActiveTextEditor((e) => {
      if (!e) return;
      updateContextIsEncrypted(e.document.uri);
    }),
  );

  ctx.subscriptions.push(
    commands.registerCommand(Commands.EncryptCurrentFile, encryptCurrentFileCommand),
  );
  ctx.subscriptions.push(
    commands.registerCommand(Commands.DecryptCurrentFile, decryptCurrentFileCommand),
  );

  ctx.subscriptions.push(commands.registerCommand(Commands.Lock, lockCommand));
  ctx.subscriptions.push(commands.registerCommand(Commands.InitWorkspace, initWorkspaceCommand));
  ctx.subscriptions.push(commands.registerCommand(Commands.SetPassword, setPasswordCommand));
  ctx.subscriptions.push(
    commands.registerCommand(Commands.EncryptAllFiles, encryptAllFilesCommand),
  );
  ctx.subscriptions.push(
    commands.registerCommand(Commands.DecryptAllFiles, decryptAllFilesCommand),
  );
}

function updateContextIsEncrypted(uri: Uri) {
  const excluded = globalCtx.configuration.isExclude(uri);

  commands.executeCommand('setContext', 'encrypt.currentFileEncrypted', !excluded);
}
