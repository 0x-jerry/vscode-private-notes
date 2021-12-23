import { TextEncoder } from 'util';
import { ConfigurationContext } from './configuration';

interface GlobalContext {
  configuration: ConfigurationContext;
  enc: TextEncoder;
}

export const globalCtx = {
  enc: new TextEncoder(),
} as GlobalContext;
