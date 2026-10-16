/*
 * Safety & wording rules. One rule for the whole app, by the intensity of the emotion after the
 * practice (1 weak .. 5 strong, 0 = free):
 *  - intensity 4 or 5 -> supportive completion message;
 *  - intensity 5 or emotion FEAR -> gentle suggestion to reach out to a close
 *    person or a professional (no emergency numbers until the region is known).
 * Pure logic, portable to the lite-wearable JS build.
 */
import { Emotion } from './SessionTypes';

export enum CompletionMessage {
  GENTLE_1 = 'gentle1',
  GENTLE_2 = 'gentle2',
  GENTLE_3 = 'gentle3',
  SUPPORTIVE = 'supportive'
}

export const GENTLE_MESSAGES: CompletionMessage[] = [
  CompletionMessage.GENTLE_1, CompletionMessage.GENTLE_2, CompletionMessage.GENTLE_3
];

export class SupportRules {
  static isSupportiveIntensity(intensity: number): boolean {
    return intensity === 4 || intensity === 5;
  }

  static recommendsProfessional(intensity: number, emotion: Emotion): boolean {
    return intensity === 5 || emotion === Emotion.FEAR;
  }

  /** Message at the end. `seed` rotates the gentle texts (e.g. number of saved sessions). */
  static completionMessage(intensity: number, seed: number): CompletionMessage {
    if (SupportRules.isSupportiveIntensity(intensity)) {
      return CompletionMessage.SUPPORTIVE;
    }
    const i = Math.abs(Math.floor(seed)) % GENTLE_MESSAGES.length;
    return GENTLE_MESSAGES[i];
  }
}
