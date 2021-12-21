import { randomBytes, pbkdf2Sync, createCipheriv, createDecipheriv } from 'crypto';

export function encrypt(content: Uint8Array, masterKey: Uint8Array) {
  // random initialization vector
  const iv = randomBytes(16);

  // random salt
  const salt = randomBytes(64);

  // generate key
  const key = pbkdf2Sync(masterKey, salt, 2145, 32, 'sha512');

  // AES 256 GCM Mode
  const cipher = createCipheriv('aes-256-gcm', key, iv);

  // encrypt the given text
  const encrypted = Buffer.concat([cipher.update(content), cipher.final()]);

  // extract the auth tag
  const tag = cipher.getAuthTag();

  // generate output
  return Buffer.concat([salt, iv, tag, encrypted]);
}

export function decrypt(encData: Uint8Array, masterKey: Uint8Array) {
  // base64 decoding
  const bData = encData;

  // convert data to buffers
  const salt = bData.slice(0, 64);
  const iv = bData.slice(64, 80);
  const tag = bData.slice(80, 96);
  const content = bData.slice(96);

  // derive key using; 32 byte key length
  const key = pbkdf2Sync(masterKey, salt, 2145, 32, 'sha512');

  // AES 256 GCM Mode
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  // decrypt the given text
  const decrypted = Buffer.concat([decipher.update(content), decipher.final()]);

  return decrypted;
}
