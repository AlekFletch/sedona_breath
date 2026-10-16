import { EMOTIONS, answersFor } from '../../core/SessionTypes.js';
import { PromptFlow } from '../../common/promptFlow.js';
import { current, sessionPage } from '../../common/sessionPage.js';
import { textHeight, wrap } from '../../common/textSize.js';
import templateKeys from '../../common/keys/prompt.js';

/*
 * Screens 4, 6 and 7 of a running session: intensity before, Sedona questions, emotion choice (full
 * practice), intensity after with "Free" and "Once more?", the completion message (breathing is on
 * pages/session; see common/sessionPage.js). One list: a top gap that centres short screens, counter,
 * a big text, a small text, a main button, option buttons (`for`), the 1..5 row and a last button;
 * each screen fills what it needs.
 */
var SCREEN_H = 480; // Watch Fit screen height, px
var firstAction = '';
var lastAction = '';

export default sessionPage({
  name: 'prompt',
  keys: templateKeys,
  // Restored from the snapshot only: questions never start a session.
  core: { Flow: PromptFlow, readPlan: true },
  data: {
    screen: '',
    counterText: '',
    headText: '',
    headH: 46,
    headR: 58,
    bodyText: '',
    bodyH: 38,
    bodyR: 48,
    firstText: '',
    options: [],
    scale: false,
    lastText: '',
    topGap: 0
  },
  paint(v) {
    var strings = current.strings;
    var counter = '';
    var head = '';
    var body = '';
    var first = '';
    var last = '';
    var options = [];
    var scale = false;
    var i;
    firstAction = '';
    lastAction = '';
    if (v.stage === 'question') {
      counter = strings.fmt('question_counter', v.questionIndex, v.questionTotal);
      head = strings.label('q_', v.question, '1');
      var ids = answersFor(v.question);
      firstAction = 'a:' + ids[0];
      first = strings.label('ans_', ids[0], 'skip');
      for (i = 1; i < ids.length; i++) {
        options.push({ id: 'a:' + ids[i], label: strings.label('ans_', ids[i], 'skip') });
      }
    } else if (v.stage === 'emotion' && v.emotionNote) {
      body = strings.t('emotion_fear_note');
      firstAction = 'note';
      first = strings.t('btn_next');
    } else if (v.stage === 'emotion') {
      head = strings.t('emotion_title');
      for (i = 0; i < EMOTIONS.length; i++) {
        options.push({ id: 'e:' + EMOTIONS[i], label: strings.label('emotion_', EMOTIONS[i], 'other') });
      }
      lastAction = 'skipEmotion';
      last = strings.t('btn_skip');
    } else if (v.stage === 'intensity') {
      head = strings.t('intensity_title');
      scale = true;
    } else if (v.stage === 'checkIn' && v.repeatOffer) {
      head = strings.t('repeat_title');
      firstAction = 'repeat';
      first = strings.t('btn_repeat');
      lastAction = 'finishRounds';
      last = strings.t('btn_finish');
    } else if (v.stage === 'checkIn') {
      head = strings.t('checkin_title');
      scale = true;
      lastAction = 'free';
      last = strings.t('btn_free');
    } else if (v.stage === 'message') {
      head = strings.label('msg_', v.message, 'gentle1');
      if (v.professionalHint) {
        body = strings.t('msg_professional');
      }
      firstAction = 'finishMessage';
      first = strings.t('btn_next');
    }
    this.screen = v.stage;
    this.counterText = counter;
    head = wrap(head, true);
    body = wrap(body, false);
    this.headH = textHeight(head, true);
    this.headR = this.headH + 12;
    this.headText = head;
    this.bodyH = textHeight(body, false);
    this.bodyR = this.bodyH + 10;
    this.bodyText = body;
    this.firstText = first;
    this.options = options;
    this.scale = scale;
    this.lastText = last;
    // Rows as the list draws them (li 76, li-line 46): a short screen goes to the middle.
    var h = (counter !== '' ? 46 : 0) + (head !== '' ? this.headR : 0) + (body !== '' ? this.bodyR : 0) +
      (first !== '' ? 76 : 0) + options.length * 76 + (scale ? 76 + 46 : 0) + (last !== '' ? 76 : 0);
    this.topGap = h < SCREEN_H ? Math.floor((SCREEN_H - h) / 2) : 0;
  },
  methods: {
    tapFirst() {
      this.choose(firstAction);
    },
    tapLast() {
      this.choose(lastAction);
    },
    choose(id) {
      if (!this.act()) {
        return;
      }
      var c = current.c;
      if (id.indexOf('a:') === 0) {
        c.answer(id.substring(2));
      } else if (id.indexOf('e:') === 0) {
        c.chooseEmotion(id.substring(2));
      } else if (id === 'note') {
        c.acknowledgeEmotionNote();
      } else if (id === 'skipEmotion') {
        c.skipEmotion();
      } else if (id === 'free') {
        c.rate(0);
      } else if (id === 'repeat') {
        c.repeat();
      } else if (id === 'finishRounds') {
        c.finishRounds();
      } else if (id === 'finishMessage') {
        c.finishMessage();
      }
    },
    /* The 1..5 row: the intensity before, or after a round. */
    rate(n) {
      if (!this.act()) {
        return;
      }
      if (current.c.view.stage === 'intensity') {
        current.c.rateBefore(Number(n));
      } else {
        current.c.rate(Number(n));
      }
    }
  }
});
