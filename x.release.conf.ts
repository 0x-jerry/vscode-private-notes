import { defineConfig } from '@0x-jerry/x-release';

export default defineConfig({
  sequence: [
    'npm:test',
    'pkg.update.version',
    'npm:changelog',
    'git.commit',
    'git.tag',
    'git.push',
    'npm:publish',
  ],
});
