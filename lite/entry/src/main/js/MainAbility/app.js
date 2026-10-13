/*
 * Kept empty on purpose: lite has no this.$app.$def, and everything here would stay in the
 * small JS heap for the whole run. Pages keep their state in files (common/store.js).
 */
export default {
  onCreate() {},
  onDestroy() {}
};
