import { EMOTIONS, answersFor } from '../../core/SessionTypes.js';
import { PromptFlow } from '../../common/promptFlow.js';
import { current, sessionPage } from '../../common/sessionPage.js';
import { textHeight } from '../../common/textSize.js';
import templateKeys from '../../common/keys/prompt.js';

/*
 * Screens 4, 6 and 7 of a running session: Sedona questions, emotion choice (full practice),
 * check-in 1..5 and the completion message (breathing is on pages/session; see common/sessionPage.js).
 * One list: counter, a big text, a small text, a main button, option buttons (`for`), the rating
 * row and a last button; each screen fills what it needs.
 */
var firstAction = '';
var lastAction = '';

export default sessionPage({
  name: 'prompt',
  keys: templateKeys,
  // Restored from the snapshot only: questions never start a session.
  core: { SessionController: PromptFlow },
  data: {
    screen: '',
    counterText: '',
    headText: '',
    headH: 42,
    headR: 54,
    bodyText: '',
    bodyH: 34,
    bodyR: 44,
    firstText: '',
    options: [],
    lastText: ''
  },
  paint(v) {
    var strings = current.strings;
    var counter = '';
    var head = '';
    var body = '';
    var first = '';
    var last = '';
    var options = [];
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
    } else if (v.stage === 'checkIn') {
      head = strings.t('checkin_title');
      lastAction = 'skipRating';
      last = strings.t('btn_skip');
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
    this.headH = textHeight(head, true);
    this.headR = this.headH + 12;
    this.headText = head;
    this.bodyH = textHeight(body, false);
    this.bodyR = this.bodyH + 10;
    this.bodyText = body;
    this.firstText = first;
    this.options = options;
    this.lastText = last;
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
      } else if (id === 'skipRating') {
        c.rate(0);
      } else if (id === 'finishMessage') {
        c.finishMessage();
      }
    },
    rate(n) {
      if (this.act()) {
        current.c.rate(Number(n));
      }
    }
  }
});
