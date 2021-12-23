import { TextEncoder } from 'util';
import { decrypt, encrypt } from '../aes';

const enc = new TextEncoder();

describe('aes ', () => {
  const key = enc.encode('master key');
  const content = enc.encode('Secret content.');

  it('encrypt and decrypt', () => {
    const encrypted = encrypt(content, key);

    expect(Buffer.from(content).equals(encrypted)).toBe(false);

    const decrypted = decrypt(encrypted, key);

    expect(Buffer.from(content).equals(decrypted)).toBe(true);
  });
});
