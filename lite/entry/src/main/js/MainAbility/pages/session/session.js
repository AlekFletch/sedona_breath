import { FreeRhythm } from '../../core/BreathPattern.js';
import { BreathFlow, circleScale } from '../../common/breathFlow.js';
import { planOf } from '../../common/plan.js';
import { current, sessionPage } from '../../common/sessionPage.js';
import { textHeight, wrap } from '../../common/textSize.js';
import templateKeys from '../../common/keys/session.js';

/*
 * Screens 3 and 5 of a running session: intro, breathing and completion breathing
 * (the questions are on pages/prompt; see common/sessionPage.js).
 */
var CIRCLE_MAX = 200;           // px, diameter at full inhale
var INHALE_COLOR = '#8FE0B8';
var PHASE_COLOR = '#F2EEDD';

/** A new session from the router params (Store.sessionParams); only this page starts one. */
function create(p, time, haptics, files, wallClock) {
  var free = new FreeRhythm(Number(p.freeIn), Number(p.freeEx)).normalized();
  return new BreathFlow({
    durationMin: Number(p.durationMin), mode: p.mode, patternId: p.patternId, freeInhaleSec: free.inhaleSec,
    freeExhaleSec: free.exhaleSec, vibration: p.vibration !== '0',
    // Asked on pages/feel before the session.
    askEmotion: false, emotion: p.emotion, intensityBefore: p.intensity ? Number(p.intensity) : -1
  }, time, time, haptics, files, wallClock);
}

export default sessionPage({
  name: 'session',
  keys: templateKeys,
  // plan: written into the snapshot on handoff for pages/prompt (common/plan.js).
  core: { Flow: BreathFlow, create: create, plan: planOf },
  data: {
    screen: '',
    introText: '',
    introH: 92,
    caption: '',
    captionH: 38,
    d: 110,
    r: 55,
    phaseText: '',
    phaseColor: PHASE_COLOR
  },
  paint(v) {
    var strings = current.strings;
    this.screen = v.stage === 'intro' ? 'intro' : 'breath';
    if (v.stage === 'intro') {
      var text = wrap(strings.t(v.introIndex === 0 ? 'intro_1' : (v.introIndex === 1 ? 'intro_2' : 'intro_3')), true);
      this.introH = textHeight(text, true);
      this.introText = text;
      return;
    }
    var caption = v.stage === 'completionBreathing'
      ? wrap(strings.t(v.notNowReturn ? 'not_now_breath' : 'completion_breath'), false) : '';
    this.captionH = textHeight(caption, false);
    this.caption = caption;
    this.phaseText = strings.label('phase_', v.phase, 'inhale');
    this.phaseColor = v.phase === 'inhale' ? INHALE_COLOR : PHASE_COLOR;
    this.updateCircle();
  },
  /* Circle grows on inhale, holds, shrinks on exhale; frozen while paused. */
  onTick() {
    if (this.screen === 'breath') {
      this.updateCircle();
    }
  },
  methods: {
    updateCircle() {
      var c = current.c;
      var d = Math.round(CIRCLE_MAX * circleScale(c.currentPhase(), c.phaseProgress()));
      if (d !== this.d) {
        this.d = d;
        this.r = Math.round(d / 2);
      }
    },
    finishIntro() {
      if (this.act()) {
        current.c.finishIntro();
      }
    }
  }
});
