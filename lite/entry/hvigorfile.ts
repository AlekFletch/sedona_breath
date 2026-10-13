import { legacyHapTasks } from '@ohos/hvigor-ohos-plugin';
import { execFileSync } from 'child_process';
import * as path from 'path';

/**
 * Minifies the lite bundles between LegacyCompileLiteJS and LegacyGenerateLiteCode, for every
 * build (IDE or command line, debug included). The watch refuses page JS over 48 KB, the SDK
 * minifies only release builds, and DevEco Assistant cannot install a release-format HAP.
 * See tools/minify-lite.mjs.
 */
const minifyLiteJs = {
  pluginId: 'sedona.minifyLiteJs',
  apply(node) {
    node.registerTask({
      name: 'default@SedonaMinifyLiteJS',
      dependencies: ['default@LegacyCompileLiteJS'],
      postDependencies: ['default@LegacyGenerateLiteCode'],
      run() {
        const script = path.resolve(node.getNodePath(), '..', '..', 'tools', 'minify-lite.mjs');
        execFileSync(process.execPath, [script], { stdio: 'inherit' });
      }
    });
  }
};

export default {
  system: legacyHapTasks, /* Built-in plugin of Hvigor. It cannot be modified. */
  plugins: [minifyLiteJs] /* Custom plugin to extend the functionality of Hvigor. */
}
