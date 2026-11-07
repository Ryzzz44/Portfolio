import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { uid } from './bytes';
import type { GenerateOptions, Question, SourceMeta, SourcePayload } from './types';

export const CLAUDE_MODEL = 'claude-opus-5-5';

const QuestionSchema = z.object({
  type: z.enum(['mcq', 'truefalse', 'short', 'flashcard']),
  prompt: z.string(),
  choices: z.array(z.string()),
  answer_index: z.number().int(),
  answer: z.string(),
  explanation: z.string(),
  source_name: z.string(),
});

const QuizSchema = z.object({
  title: z.string(),
  questions: z.array(QuestionSchema),
});

const TYPE_GUIDE: Record<string, string> = {
  mcq: 'mcq — multiple choice with exactly 4 choices, one correct; distractors must be plausible to someone who skimmed.',
  truefalse: 'truefalse — choices must be exactly ["True", "False"].',
  short: 'short — open question answerable in one or two sentences; choices empty, answer_index -1.',
  flashcard: 'flashcard — a term or cue on the front (prompt) and the definition or fact on the back (answer); choices empty, answer_index -1.',
};

const DIFFICULTY_GUIDE = {
  recall: 'Recall: test specific facts, names, numbers and definitions stated in the material.',
  understand: 'Understand: test whether the learner grasps relationships, causes, comparisons and the main ideas — not just wording.',
  apply: 'Apply: put the ideas to work on new scenarios, edge cases or problems the material does not spell out word-for-word.',
};

function buildContent(sources: { meta: SourceMeta; payload: SourcePayload }[]): Anthropic.Beta.BetaContentBlockParam[] {
  const blocks: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const { meta, payload } of sources) {
    if (meta.kind === 'pdf' && payload.base64) {
      blocks.push({
        type: 'document',
        title: meta.name,
        source: { type: 'base64', media_type: 'application/pdf', data: payload.base64 },
      });
    } else if (meta.kind === 'image' && payload.base64 && payload.mediaType) {
      blocks.push({ type: 'text', text: `Image file: ${meta.name}` });
      blocks.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: payload.mediaType as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp',
          data: payload.base64,
        },
      });
    } else if (payload.text) {
      blocks.push({
        type: 'document',
        title: meta.name,
        source: { type: 'text', media_type: 'text/plain', data: payload.text },
      });
    }
  }
  return blocks;
}

export class GenerationError extends Error {}

export async function generateWithClaude(
  apiKey: string,
  sources: { meta: SourceMeta; payload: SourcePayload }[],
  opts: GenerateOptions,
  signal?: AbortSignal,
): Promise<{ title: string; questions: Question[] }> {
  // The key is the user's own, entered on this device and sent only to the Anthropic API.
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 2 });

  const instructions = [
    `Write ${opts.count} study questions from the material above.`,
    `Use only these question types, mixed sensibly: ${opts.types.map((t) => TYPE_GUIDE[t]).join(' ')}`,
    DIFFICULTY_GUIDE[opts.difficulty],
    opts.focus.trim() ? `Focus on: ${opts.focus.trim()}` : '',
    'Every question must be answerable from the material, cover a different point, and spread across the whole material rather than the first pages.',
    'The explanation says in one or two sentences why the answer is right, pointing at where the material says so.',
    'source_name is the title of the file the question came from.',
    'title is a short, specific name for this question set (max 6 words).',
    'If a file has little usable content (e.g. a binary with stray strings), base questions on what is there and do not invent facts.',
  ]
    .filter(Boolean)
    .join('\n');

  let message;
  try {
    message = await client.beta.messages.parse(
      {
        model: CLAUDE_MODEL,
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system:
          'You are an exam writer who turns study material into precise, fair questions. Questions are self-contained: never say "according to the text" or refer to page numbers.',
        output_config: { effort: 'medium', format: betaZodOutputFormat(QuizSchema) },
        messages: [{ role: 'user', content: [...buildContent(sources), { type: 'text', text: instructions }] }],
      },
      { signal },
    );
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new GenerationError('Your API key was rejected. Check it in Settings.');
    if (e instanceof Anthropic.PermissionDeniedError) throw new GenerationError('This API key cannot use the model. Check your Anthropic account.');
    if (e instanceof Anthropic.RateLimitError) throw new GenerationError('Rate limited by the API. Wait a moment and try again.');
    if (e instanceof Anthropic.BadRequestError) throw new GenerationError(`The request was refused: ${e.message}`);
    if (e instanceof Anthropic.APIConnectionError) throw new GenerationError('Could not reach the Anthropic API. Check your connection.');
    if (e instanceof Anthropic.APIUserAbortError) throw new GenerationError('Cancelled.');
    if (e instanceof Anthropic.APIError) throw new GenerationError(`API error ${e.status ?? ''}: ${e.message}`);
    throw e;
  }

  if (message.stop_reason === 'refusal') {
    throw new GenerationError('Claude declined to write questions for this material.');
  }
  if (message.stop_reason === 'max_tokens') {
    throw new GenerationError('The answer was cut off. Try fewer questions.');
  }
  const parsed = message.parsed_output;
  if (!parsed || parsed.questions.length === 0) {
    throw new GenerationError('No questions came back. Try again or change the settings.');
  }

  const questions: Question[] = parsed.questions.map((q) => {
    const choices = q.type === 'truefalse' ? ['True', 'False'] : q.type === 'mcq' ? q.choices : [];
    const answerIndex = choices.length ? Math.max(0, Math.min(choices.length - 1, q.answer_index)) : -1;
    return {
      id: uid(),
      type: q.type,
      prompt: q.prompt,
      choices,
      answerIndex,
      answer: q.answer || (answerIndex >= 0 ? choices[answerIndex] : ''),
      explanation: q.explanation,
      sourceName: q.source_name,
    };
  });

  return { title: parsed.title, questions };
}
