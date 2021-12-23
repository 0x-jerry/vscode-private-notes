import { workspace } from 'vscode';
import { decrypt, encrypt } from './aes';
import { globalCtx } from './context';

export enum Setting {
  password = 'encrypt.password',
}

const confSection = 'writing';

export function getSetting<T = string>(key: Setting) {
  return workspace.getConfiguration(confSection).get<T>(key);
}

export function setSetting<T = string>(key: Setting, value: T) {
  return workspace.getConfiguration(confSection).update(key, value);
}

export function isValidPassword(pwd: string): boolean {
  const raw = getSetting(Setting.password) || '';

  const buf = Buffer.from(raw, 'base64');

  try {
    decrypt(buf, globalCtx.enc.encode(pwd));
    return true;
  } catch {
    return false;
  }
}

export async function setPassword(password = '') {
  // clear password
  if (!password) {
    await setSetting(Setting.password, '');
    return;
  }

  const res = encrypt(globalCtx.enc.encode(password), globalCtx.enc.encode(password));

  const text = Buffer.from(res).toString('base64');

  await setSetting(Setting.password, text);
}

export function hasPassword() {
  return !!getSetting(Setting.password);
}
