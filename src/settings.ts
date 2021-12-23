import { TextEncoder } from 'util';
import { workspace } from 'vscode';
import { decrypt, encrypt } from './aes';

export enum Setting {
  validator = 'encrypt.password',
}

const confSection = 'writing';

const enc = new TextEncoder();

export function getSetting<T = string>(key: Setting) {
  return workspace.getConfiguration(confSection).get<T>(key);
}

export function setSetting<T = string>(key: Setting, value: T) {
  return workspace.getConfiguration(confSection).update(key, value);
}

export function isValidPassword(pwd: string) {
  const raw = getSetting(Setting.validator);

  if (!raw) {
    return true;
  }

  const buf = Buffer.from(raw, 'base64');

  try {
    decrypt(buf, enc.encode(pwd));
    return true;
  } catch {
    return false;
  }
}

export async function setPassword(password: string) {
  const res = encrypt(enc.encode(password), enc.encode(password));

  const text = Buffer.from(res).toString('base64');

  await setSetting(Setting.validator, text);
}
