import router from '@system.router';

/*
 * Screens 3-7 of a running session. All logic lives in SessionController
 * (generated core); this page only renders SessionView and forwards taps.
 */
var MODAL_NONE = 0;
var MODAL_PAUSED = 1;
var MODAL_END = 2;
var MODAL_INTERRUPTED = 3;
var MODAL_LOW_BATTERY = 4;

var TICK_MS = 100;
var REMAINING_EVERY = 5;        // remaining time refresh: every 500 ms
var BATTERY_EVERY = 300;        // battery check: every 30 s
var SNAPSHOT_EVERY = 50;        // periodic snapshot while breathing: every 5 s
var CIRCLE_MAX = 200;           // px, diameter at full inhale

export default {
  data: {
    s: {},
    modal: 0,
    modalTitle: '',
    modalBody: '',
    isIntro: false,
    isBreathing: false,
    isQuestion: false,
    isEmotion: false,
    isCheckIn: false,
    isMessage: false,
    introText: '',
    caption: '',
    d: 110,
    r: 55,
    phaseText: '',
    isInhale: false,
    remainingText: '',
    counterText: '',
    questionText: '',
    firstAnswer: '',
    answers: [],
    emotions: [],
    emotionNote: false,
    ratings: [1, 2, 3, 4, 5],
    messageText: '',
    supportive: false,
    showProfessional: false
  },

  onInit() {
    var svc = this.$app.$def.services;
    this.s = svc.strings();
    this.leaving = false;
    this.ticks = 0;
    this.timer = null;
    var c = svc.activeSession();
    if (c === null) {
      this.leaving = true;
      setTimeout(() => router.replace({ uri: 'pages/index/index' }), 0);
      return;
    }
    this.c = c;
    var em = svc.emotions();
    var list = [];
    for (var i = 0; i < em.length; i++) {
      list.push({ id: em[i], label: svc.emotionLabel(em[i]) });
    }
    this.emotions = list;
    c.setObserver({
      onUpdate: (v) => this.render(v),
      onSummary: () => this.toSummary()
    });
    this.render(c.view);
    if (c.isPaused()) {
      this.showModal(MODAL_INTERRUPTED); // restored after an interruption
    }
    svc.keepScreenOn(true);
    this.timer = setInterval(() => this.tick(), TICK_MS);
  },

  onShow() {
    if (this.c && this.c.isPaused() && this.modal === MODAL_NONE) {
      this.showModal(MODAL_INTERRUPTED);
    }
  },

  /* Screen off / watch face / call: pause, stop vibration, persist. */
  onHide() {
    this.interrupt(MODAL_INTERRUPTED);
  },

  onDestroy() {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.$app.$def.services.keepScreenOn(false);
    if (this.c) {
      this.c.setObserver(undefined);
      if (!this.leaving) {
        this.c.interrupt();
      }
    }
  },

  // ---------------------------------------------------------------- rendering

  render(v) {
    var svc = this.$app.$def.services;
    this.isIntro = v.stage === 'intro';
    this.isBreathing = v.stage === 'breathing' || v.stage === 'completionBreathing';
    this.isQuestion = v.stage === 'question';
    this.isEmotion = v.stage === 'emotion';
    this.isCheckIn = v.stage === 'checkIn';
    this.isMessage = v.stage === 'message';
    this.emotionNote = v.emotionNote;

    if (this.isIntro) {
      this.introText = svc.t(v.introIndex === 0 ? 'intro_1' : (v.introIndex === 1 ? 'intro_2' : 'intro_3'));
    }
    if (this.isBreathing) {
      this.caption = v.stage === 'completionBreathing'
        ? svc.t(v.notNowReturn ? 'not_now_breath' : 'completion_breath') : '';
      this.phaseText = svc.phaseLabel(v.phase);
      this.isInhale = v.phase === 'inhale';
      this.updateCircle();
    }
    if (this.isQuestion) {
      this.counterText = svc.fmt('question_counter', v.questionIndex, v.questionTotal);
      this.questionText = svc.questionText(v.question);
      var ids = svc.answersFor(v.question);
      this.firstId = ids[0];
      this.firstAnswer = svc.answerLabel(ids[0]);
      var answers = [];
      for (var i = 1; i < ids.length; i++) {
        answers.push({ id: ids[i], label: svc.answerLabel(ids[i]) });
      }
      this.answers = answers;
    }
    if (this.isMessage) {
      this.messageText = svc.messageText(v.message);
      this.supportive = v.message === 'supportive';
      this.showProfessional = v.professionalHint;
    }
    this.remainingText = svc.fmt('remaining', svc.mmss(this.c.remainingMs()));
  },

  /* Circle grows on inhale, holds, shrinks on exhale; frozen while paused. */
  updateCircle() {
    var c = this.c;
    var scale = this.$app.$def.services.visual.scaleAt(c.currentPhase(), c.phaseProgress());
    var d = Math.round(CIRCLE_MAX * scale);
    if (d !== this.d) {
      this.d = d;
      this.r = Math.round(d / 2);
    }
  },

  tick() {
    if (!this.c || this.c.isEnded()) {
      return;
    }
    this.ticks++;
    var running = !this.c.isPaused() && this.modal === MODAL_NONE;
    if (this.isBreathing && running) {
      this.updateCircle();
    }
    if (this.ticks % REMAINING_EVERY === 0) {
      var svc = this.$app.$def.services;
      this.remainingText = svc.fmt('remaining', svc.mmss(this.c.remainingMs()));
    }
    if (this.isBreathing && running && this.ticks % SNAPSHOT_EVERY === 0) {
      this.$app.$def.services.save(this.c.snapshot());
    }
    if (running && this.ticks % BATTERY_EVERY === 0) {
      this.$app.$def.services.checkLowBattery((low) => {
        if (low) {
          this.interrupt(MODAL_LOW_BATTERY);
        }
      });
    }
  },

  showModal(kind) {
    var svc = this.$app.$def.services;
    this.modal = kind;
    if (kind === MODAL_PAUSED) {
      this.modalTitle = svc.t('paused_title');
      this.modalBody = '';
    } else if (kind === MODAL_END) {
      this.modalTitle = svc.t('end_title');
      this.modalBody = '';
    } else if (kind === MODAL_LOW_BATTERY) {
      this.modalTitle = svc.t('low_battery');
      this.modalBody = '';
    } else {
      this.modalTitle = svc.t('interrupted_title');
      this.modalBody = svc.t('interrupted_body');
    }
  },

  interrupt(kind) {
    if (!this.c || this.c.isEnded() || this.leaving) {
      return;
    }
    this.c.interrupt();
    this.$app.$def.services.keepScreenOn(false);
    this.showModal(kind);
  },

  // ---------------------------------------------------------------- actions

  act() {
    return this.c && this.modal === MODAL_NONE;
  },
  pause() {
    this.c.pause();
    this.$app.$def.services.keepScreenOn(false);
    this.showModal(MODAL_PAUSED);
  },
  resume() {
    this.modal = MODAL_NONE;
    this.c.resume();
    this.$app.$def.services.keepScreenOn(true);
  },
  askEnd() {
    this.c.pause();
    this.showModal(MODAL_END);
  },
  endNow() {
    this.leaving = true;
    this.$app.$def.services.discard();
    router.replace({ uri: 'pages/index/index' });
  },
  endAndSave() {
    this.leaving = true;
    this.$app.$def.services.saveInterrupted(() => {
      router.replace({ uri: 'pages/index/index' });
    });
  },
  toSummary() {
    this.leaving = true;
    this.$app.$def.services.prepareSummary();
    router.replace({ uri: 'pages/summary/summary' });
  },
  finishIntro() {
    if (this.act()) {
      this.c.finishIntro();
    }
  },
  answerFirst() {
    this.answer(this.firstId);
  },
  answer(id) {
    if (this.act()) {
      this.c.answer(id);
    }
  },
  chooseEmotion(id) {
    if (this.act()) {
      this.c.chooseEmotion(id);
    }
  },
  skipEmotion() {
    if (this.act()) {
      this.c.skipEmotion();
    }
  },
  ackNote() {
    if (this.act()) {
      this.c.acknowledgeEmotionNote();
    }
  },
  rate(n) {
    if (this.act()) {
      this.c.rate(n);
    }
  },
  skipRating() {
    if (this.act()) {
      this.c.rate(0);
    }
  },
  finishMessage() {
    if (this.act()) {
      this.c.finishMessage();
    }
  },

  /* Swipe right never silently drops a practice: it opens the end dialog. */
  onSwipe(e) {
    if (e.direction !== 'right') {
      return;
    }
    if (this.modal === MODAL_NONE) {
      this.askEnd();
    } else if (this.modal === MODAL_END) {
      this.resume();
    }
  }
};
