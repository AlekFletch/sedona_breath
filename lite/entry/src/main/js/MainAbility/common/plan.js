/*
 * The session plan for pages/prompt (common/promptFlow.js): 'stage:question:estimatedMs' per step,
 * comma-separated. pages/session writes it to plan.json when it starts, so pages/prompt does not
 * bundle the planner and the breath patterns. Not inside the snapshot: on handoff pages/session
 * had no room left to serialize it.
 */
import { SessionPlanner } from '../core/SessionPlan.js';

/** @param c BreathFlow or SessionController (steps, pattern) */
export function planOf(c) {
  var plan = '';
  for (var i = 0; i < c.steps.length; i++) {
    var s = c.steps[i];
    plan += (i > 0 ? ',' : '') + s.stage() + ':' + s.question + ':' + SessionPlanner.estimateMs(s, c.pattern);
  }
  return plan;
}
