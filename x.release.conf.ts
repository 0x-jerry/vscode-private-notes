import { defineConfig, InternalReleaseTask } from '@0x-jerry/x-release';

export default defineConfig({
  sequence: [
    'test',
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
