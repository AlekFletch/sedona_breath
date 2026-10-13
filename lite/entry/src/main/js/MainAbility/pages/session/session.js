import { BreathVisual, SessionConfig, SessionController } from '../../core/SessionController.js';
import { current, sessionPage } from '../../common/sessionPage.js';
import { textHeight } from '../../common/textSize.js';
import templateKeys from '../../common/keys/session.js';

/*
 * Screens 3 and 5 of a running session: intro, breathing and completion breathing
 * (the questions are on pages/prompt; see common/sessionPage.js).
 */
var CIRCLE_MAX = 200;           // px, diameter at full inhale
var INHALE_COLOR = '#8FE0B8';
var PHASE_COLOR = '#F2EEDD';

export default sessionPage({
  name: 'session',
  keys: templateKeys,
  core: { SessionController: SessionController, SessionConfig: SessionConfig },
  data: {
    screen: '',
    introText: '',
    introH: 84,
    caption: '',
    d: 110,
    r: 55,
    phaseText: '',
    phaseColor: PHASE_COLOR
  },
  paint(v) {
    var strings = current.strings;
    this.screen = v.stage === 'intro' ? 'intro' : 'breath';
    if (v.stage === 'intro') {
      var text = strings.t(v.introIndex === 0 ? 'intro_1' : (v.introIndex === 1 ? 'intro_2' : 'intro_3'));
      this.introH = textHeight(text, true);
      this.introText = text;
      return;
    }
    this.caption = v.stage === 'completionBreathing'
      ? strings.t(v.notNowReturn ? 'not_now_breath' : 'completion_breath') : '';
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
      var d = Math.round(CIRCLE_MAX * BreathVisual.scaleAt(c.currentPhase(), c.phaseProgress()));
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
