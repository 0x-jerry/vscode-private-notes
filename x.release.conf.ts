import { defineConfig, InternalReleaseTask } from '@0x-jerry/x-release';

export default defineConfig({
  sequence: [
    'test',
    'build',
    'changelog',
    InternalReleaseTask.updatePkg,
    InternalReleaseTask.commit,
    InternalReleaseTask.tag,
    InternalReleaseTask.push,
    async (ctx) => {
      ctx.run(`vsce publish --yarn`);
    },
  ],
});
