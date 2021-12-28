import { window } from 'vscode';
import { isValidPassword } from './settings';

export async function promptPassword(
  placeHolder = 'Please input password',
): Promise<string | undefined> {
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

export async function promptNewPassword(): Promise<string | undefined> {
  const password = await window.showInputBox({
    placeHolder: 'Please input new password',
    password: true,
  });

  if (!password) return;

  const passwordAgain = await window.showInputBox({
    placeHolder: 'Please input new password again',
    password: true,
  });

  if (!passwordAgain) return;

  if (passwordAgain === password) {
    return password;
  }

  window.showErrorMessage('Password not match, please try again.');

  return promptNewPassword();
}
