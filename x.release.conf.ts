import { defineConfig } from '@0x-jerry/x-release';

export default defineConfig({
  sequence: [
    'npm:test',
    'npm:changelog',
    'pkg.update.version',
    'git.commit',
    'git.tag',
    'git.push',
    'run:vsce publish --yarn',
  ],
});
