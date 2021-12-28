import { TextDecoder, TextEncoder } from 'util';
import { ConfigurationContext } from './configuration';
import { Git } from './git';

interface GlobalContext {
  configuration: ConfigurationContext;
  enc: TextEncoder;
  dec: TextDecoder;
  git: Git;
}

export const globalCtx = {
  enc: new TextEncoder(),
  dec: new TextDecoder(),
} as GlobalContext;
