/** Stages shown by pages/prompt; the rest (intro, breathing, completion breathing) by pages/session. */
var PROMPT_STAGES = ['intensity', 'question', 'emotion', 'checkIn', 'message'];

/** The page that shows a session stage. Its own module, so the home page does not bundle the session code. */
export function pageForStage(stage) {
  return PROMPT_STAGES.indexOf(stage) >= 0 ? 'prompt' : 'session';
}
