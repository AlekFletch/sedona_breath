import { EMOTIONS, answersFor } from '../../core/SessionTypes.js';
import { PromptFlow } from '../../common/promptFlow.js';
import { current, sessionPage } from '../../common/sessionPage.js';
import templateKeys from '../../common/keys/prompt.js';

/*
 * Screens 4, 6 and 7 of a running session: Sedona questions, emotion choice (full practice),
 * check-in 1..5 and the completion message (breathing is on pages/session; see common/sessionPage.js).
 */
var firstId = '';

export default sessionPage({
  name: 'prompt',
  keys: templateKeys,
  // Restored from the snapshot only: questions never start a session.
  core: { SessionController: PromptFlow },
  data: {
    screen: '',
    counterText: '',
    questionText: '',
    firstAnswer: '',
    answers: [],
    emotions: [],
    messageText: '',
    supportive: false,
    showProfessional: false
  },
  release() {
    this.answers = [];
    this.emotions = [];
  },
  paint(v) {
    var strings = current.strings;
    // One screen string with independent if blocks: a long if/elif chain does not render on lite.
    this.screen = v.stage === 'emotion' && v.emotionNote ? 'note' : v.stage;
    if (v.stage === 'emotion' && this.emotions.length === 0) {
      var list = [];
      for (var e = 0; e < EMOTIONS.length; e++) {
        list.push({ id: EMOTIONS[e], label: strings.label('emotion_', EMOTIONS[e], 'other') });
      }
      this.emotions = list;
    }
    if (v.stage === 'question') {
      this.counterText = strings.fmt('question_counter', v.questionIndex, v.questionTotal);
      this.questionText = strings.label('q_', v.question, '1');
      var ids = answersFor(v.question);
      firstId = ids[0];
      this.firstAnswer = strings.label('ans_', ids[0], 'skip');
      var answers = [];
      for (var i = 1; i < ids.length; i++) {
        answers.push({ id: ids[i], label: strings.label('ans_', ids[i], 'skip') });
      }
      this.answers = answers;
    }
    if (v.stage === 'message') {
      this.messageText = strings.label('msg_', v.message, 'gentle1');
      this.supportive = v.message === 'supportive';
      this.showProfessional = v.professionalHint;
    }
  },
  methods: {
    answerFirst() {
      this.answer(firstId);
    },
    answer(id) {
      if (this.act()) {
        current.c.answer(id);
      }
    },
    chooseEmotion(id) {
      if (this.act()) {
        current.c.chooseEmotion(id);
      }
    },
    skipEmotion() {
      if (this.act()) {
        current.c.skipEmotion();
      }
    },
    ackNote() {
      if (this.act()) {
        current.c.acknowledgeEmotionNote();
      }
    },
    rate(n) {
      if (this.act()) {
        current.c.rate(Number(n));
      }
    },
    skipRating() {
      if (this.act()) {
        current.c.rate(0);
      }
    },
    finishMessage() {
      if (this.act()) {
        current.c.finishMessage();
      }
    }
  }
});
