import { EMOTIONS, Emotion, INTENSITY_NONE } from '../../core/SessionTypes.js';
import { SupportRules } from '../../core/SupportRules.js';
import { Strings } from '../../common/strings.js';
import { textHeight, wrap } from '../../common/textSize.js';
import { focusList, go, isBackSwipe, refocusList, useBackground } from '../../common/ui.js';
import templateKeys from '../../common/keys/feel.js';

var strings = null;
var emotion = '';

/*
 * Before the practice: the emotion (12 options, "Skip"; fear shows the note about reaching out),
 * then its intensity 1..5, which starts the session with both (router params emotion, intensity).
 * Router params: the session's own (Store.sessionParams), passed on as they are. A small page of its
 * own: the emotion list does not fit next to the session code in the JS heap.
 */
export default {
  data: {
    bg: '',
    s: {},
    lang: 'ru',
    launch: '',
    durationMin: '',
    mode: '',
    patternId: '',
    vibration: '',
    freeIn: '',
    freeEx: '',
    step: 'emotion',
    head: '',
    headH: 46,
    headR: 58,
    options: [],
    note: '',
    noteH: 38
  },
  onInit() {
    useBackground(this);
    strings = new Strings(templateKeys, (path) => this.$t(path));
    strings.lang = this.lang;
    emotion = '';
    this.s = strings.strings();
    var options = [];
    for (var i = 0; i < EMOTIONS.length; i++) {
      options.push({ id: EMOTIONS[i], label: strings.label('emotion_', EMOTIONS[i], 'other') });
    }
    this.options = options;
    this.showHead('emotion_title');
  },
  onShow() {
    focusList(this, true);
  },
  showHead(key) {
    var head = wrap(strings.t(key), true);
    this.headH = textHeight(head, true);
    this.headR = this.headH + 12;
    this.head = head;
  },
  /* The emotion list goes away: release the crown first (see ui.focusList). */
  setStep(step) {
    focusList(this, false);
    this.step = step;
    refocusList(this);
  },
  choose(id) {
    emotion = id;
    if (SupportRules.recommendsProfessional(INTENSITY_NONE, id)) {
      var note = wrap(strings.t('emotion_fear_note'), false);
      this.noteH = textHeight(note, false);
      this.note = note;
      this.setStep('note');
      return;
    }
    this.toIntensity();
  },
  skip() {
    emotion = Emotion.NONE;
    this.toIntensity();
  },
  toIntensity() {
    this.showHead('intensity_title');
    this.setStep('intensity');
  },
  /* Starts the session through pages/hop: this page and pages/session do not fit the heap together. */
  rate(n) {
    this.options = [];
    go(this, 'hop', {
      to: 'session', launch: 'new', lang: this.lang, durationMin: this.durationMin, mode: this.mode, patternId: this.patternId,
      vibration: this.vibration, freeIn: this.freeIn, freeEx: this.freeEx, emotion: emotion, intensity: String(n)
    });
  },
  /* Swipe back: from the intensity (or the note) to the emotions, from the emotions home. */
  onSwipe(e) {
    if (!isBackSwipe(e)) {
      return;
    }
    if (this.step === 'emotion') {
      go(this, 'index');
    } else {
      this.showHead('emotion_title');
      this.setStep('emotion');
    }
  }
};
