import {
  CancellationToken,
  ProviderResult,
  TerminalProfile,
  TerminalProfileProvider,
} from 'vscode';
import { getEncryptWorkspace, getTargetUri } from './utils';

export class EncryptTerminalProvider implements TerminalProfileProvider {
  provideTerminalProfile(token: CancellationToken): ProviderResult<TerminalProfile> {
    const encryptWs = getEncryptWorkspace();

    if (!encryptWs) return;

    const target = getTargetUri(encryptWs.uri);

    return new TerminalProfile({
      name: 'Encrypt Terminal',
      cwd: target,
    });
  }
}
