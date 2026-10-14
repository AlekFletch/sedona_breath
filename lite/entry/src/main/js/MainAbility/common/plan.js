/*
 * The session plan as pages/prompt reads it from the snapshot (field `plan`, see common/promptFlow.js):
 * 'stage:question:estimatedMs' per step, comma-separated. pages/session writes it on handoff, so
 * pages/prompt does not bundle the planner and the breath patterns. A string, not an array: on
 * pages/session the heap has no room to serialize an array of 15 steps.
 */
import { SessionPlanner } from '../core/SessionPlan.js';

/** @param c SessionController (steps, pattern) */
export function planOf(c) {
  var plan = '';
  for (var i = 0; i < c.steps.length; i++) {
    var s = c.steps[i];
    plan += (i > 0 ? ',' : '') + s.stage() + ':' + s.question + ':' + SessionPlanner.estimateMs(s, c.pattern);
  }
  return plan;
}
