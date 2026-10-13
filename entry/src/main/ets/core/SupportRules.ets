/*
 * Safety & wording rules. One rule for the whole app:
 *  - rating 1 or 2  -> supportive completion message;
 *  - rating 1 or emotion FEAR -> gentle suggestion to reach out to a close
 *    person or a professional (no emergency numbers until the region is known).
 * Pure logic, portable to the lite-wearable JS build.
 */
import { Emotion, RATING_NONE } from './SessionTypes';

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
  static isSupportiveRating(rating: number): boolean {
    return rating === 1 || rating === 2;
  }

  static recommendsProfessional(rating: number, emotion: Emotion): boolean {
    return rating === 1 || emotion === Emotion.FEAR;
  }

  /** Message after the check-in. `seed` rotates the gentle texts (e.g. number of saved sessions). */
  static completionMessage(rating: number, seed: number): CompletionMessage {
    if (rating !== RATING_NONE && SupportRules.isSupportiveRating(rating)) {
      return CompletionMessage.SUPPORTIVE;
    }
    const i = Math.abs(Math.floor(seed)) % GENTLE_MESSAGES.length;
    return GENTLE_MESSAGES[i];
  }
}
