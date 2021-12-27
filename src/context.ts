import { TextDecoder, TextEncoder } from 'util';
import { ConfigurationContext } from './configuration';

interface GlobalContext {
  configuration: ConfigurationContext;
  enc: TextEncoder;
  dec: TextDecoder;
}

export const globalCtx = {
  enc: new TextEncoder(),
  dec: new TextDecoder(),
} as GlobalContext;
