/*
 * What every page needs for the watch: the background, crown scrolling, leaving a page and
 * the swipe-back gesture. No dependencies, so the session pages stay small.
 */
import router from '@system.router';

/*
 * Full-screen background for the 408x480 screen of Watch Fit 4 / Fit 4 Pro. The lite build stores
 * every bitmap as raw ARGB (783 KB for this one) and the package travels over Bluetooth, so the
 * round variant (assets-src/bg_round.webp) is not packaged.
 */
export var BG = '/common/bg_rect.jpg';

export function useBackground(vm) {
  vm.bg = BG;
}

/**
 * Crown (rotation) focus for the page's list (ref="list"). It must be released before the list
 * goes away: a focused list removed by router.replace or `if` crashes the engine on the next
 * crown turn (found on the same watch in BreathTrainer).
 */
export function focusList(vm, focus) {
  var list = vm.$refs ? vm.$refs.list : undefined;
  if (!list) {
    return;
  }
  try {
    list.rotation({ focus: focus });
  } catch (e) {
    // no crown or older runtime: touch scrolling still works
  }
}

/** Focuses the list after the template has been rebuilt (a new list may have replaced the old one). */
export function refocusList(vm) {
  setTimeout(function () {
    focusList(vm, true);
  }, 0);
}

/*
 * Screen shape, router param `round` of every page: '1' round (WATCH GT: 454x454, 466x466), '0'
 * rectangular, '' not known yet (the home page asks once, see readRound in pages/index). go() passes
 * it on.
 */
export function isRound(vm) {
  return vm.round === '1';
}

/** Leaves the page: releases the crown focus, then replaces the page. */
export function go(vm, page, params) {
  focusList(vm, false);
  var options = { uri: 'pages/' + page + '/' + page, params: params || {} };
  options.params.round = vm.round || '';
  router.replace(options);
}

/** Swipe from either side means "back" (the system gesture is a swipe from the left edge). */
export function isBackSwipe(e) {
  return !!e && (e.direction === 'right' || e.direction === 'left');
}
