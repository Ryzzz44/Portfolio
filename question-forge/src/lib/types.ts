/** What we managed to pull out of an imported file. */
export type SourceKind = 'text' | 'pdf' | 'image' | 'document' | 'binary';

export interface SourceMeta {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  kind: SourceKind;
  /** Short human summary of what was extracted, e.g. "2,431 words" or "PDF · sent as-is". */
  detail: string;
  /** Number of words of readable text we extracted (0 when the file is sent as-is). */
  words: number;
  importedAt: number;
}

/** Heavy part of a source, stored separately from the index. */
export interface SourcePayload {
  /** Extracted plain text, if any. */
  text?: string;
  /** Base64 bytes for files Claude reads natively (PDF, images). */
  base64?: string;
  /** Media type for the base64 payload. */
  mediaType?: string;
}

export type QuestionType = 'mcq' | 'truefalse' | 'short' | 'flashcard';
export type Difficulty = 'recall' | 'understand' | 'apply';

export interface Question {
  id: string;
  type: QuestionType;
  prompt: string;
  /** Choices for mcq / truefalse. */
  choices: string[];
  /** Index into choices for mcq / truefalse; -1 otherwise. */
  answerIndex: number;
  /** Model answer (always filled; for mcq it repeats the right choice). */
  answer: string;
  explanation: string;
  /** Name of the file this question came from. */
  sourceName: string;
}

export interface QuizResponse {
  questionId: string;
  /** Picked choice index (mcq / tf) or -1. */
  choiceIndex: number;
  /** Typed answer for short questions. */
  text: string;
  /** Self-marked or auto-marked. */
  correct: boolean;
}

export interface Quiz {
  id: string;
  title: string;
  sourceIds: string[];
  createdAt: number;
  engine: 'claude' | 'offline';
  difficulty: Difficulty;
  questions: Question[];
  /** Latest attempt; empty until played. */
  responses: QuizResponse[];
  completedAt?: number;
}

export interface GenerateOptions {
  count: number;
  types: QuestionType[];
  difficulty: Difficulty;
  focus: string;
}
