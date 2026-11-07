import { uid } from './bytes';
import type { GenerateOptions, Question, QuestionType, SourceMeta, SourcePayload } from './types';

/**
 * On-device question generator. No network, no key. It finds the most
 * information-dense sentences and turns their key terms into cloze-style
 * multiple choice, true/false, short-answer and flashcard questions.
 * It is a fallback — Claude writes far better questions — but it means the app
 * is useful with zero setup for any file that contains readable text.
 */

const STOP = new Set(
  (
    'a about above after again against all also am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further had has have having he her here hers herself him himself his how however i if in into is it its itself just let me more most my myself no nor not now of off on once only or other our ours ourselves out over own same she should so some such than that the their theirs them themselves then there these they this those through to too under until up us very was we were what when where which while who whom why will with would you your yours yourself yourselves ' +
    'one two three many much may might must shall within without upon also thus therefore whereas whether either neither another every often usually rather quite really still yet already although though since unless whose made make makes using used use uses like well even way ways new first last next'
  ).split(' '),
);

interface Sentence {
  text: string;
  index: number;
  score: number;
  terms: Term[];
}

interface Term {
  value: string;
  kind: 'number' | 'proper' | 'word';
  weight: number;
}

/** Small seeded RNG so a given file + settings gives stable output. */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function splitSentences(text: string): string[] {
  return text
    .replace(/\r/g, '')
    .replace(/([.!?])\s+(?=[A-Z0-9"“(])/g, '$1\n')
    .split(/\n+/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => {
      const words = s.split(' ').length;
      return s.length >= 40 && s.length <= 280 && words >= 7 && words <= 48 && /[a-z]/.test(s);
    });
}

function extractTerms(sentence: string, freq: Map<string, number>): Term[] {
  const terms: Term[] = [];
  // Numbers and years, with an optional unit-ish suffix like "%".
  for (const m of sentence.matchAll(/\b\d{1,3}(?:[,.]\d{3})*(?:\.\d+)?%?|\b\d+(?:\.\d+)?%?/g)) {
    if (m.index === 0) continue; // a leading list number is not content
    terms.push({ value: m[0], kind: 'number', weight: 2.2 });
  }
  // Capitalised phrases not at the very start of the sentence.
  for (const m of sentence.matchAll(/(?<=\s)([A-Z][a-zA-Z'-]+(?:\s+(?:of|de|la|the|and)?\s*[A-Z][a-zA-Z'-]+)*)/g)) {
    const v = m[1].trim();
    if (v.length < 3 || STOP.has(v.toLowerCase())) continue;
    terms.push({ value: v, kind: 'proper', weight: 2 + Math.min(2, (freq.get(v.toLowerCase()) ?? 1) * 0.3) });
  }
  // Content words that recur in the document.
  for (const m of sentence.matchAll(/\b[a-z][a-z-]{4,}\b/g)) {
    const w = m[0];
    // Verb forms and adverbs make awkward answers and mismatched distractors.
    if (STOP.has(w) || /(?:ed|ing|ly)$/.test(w)) continue;
    const f = freq.get(w) ?? 0;
    if (f < 2) continue;
    terms.push({ value: w, kind: 'word', weight: Math.min(3, 0.6 + Math.log2(f)) + w.length / 12 });
  }
  // de-dupe, keep the heaviest
  const best = new Map<string, Term>();
  for (const t of terms) {
    const k = t.value.toLowerCase();
    if (!best.has(k) || best.get(k)!.weight < t.weight) best.set(k, t);
  }
  return [...best.values()].sort((a, b) => b.weight - a.weight);
}

function wordFrequencies(text: string): Map<string, number> {
  const freq = new Map<string, number>();
  for (const m of text.toLowerCase().matchAll(/\b[a-z][a-z'-]{2,}\b/g)) {
    const w = m[0];
    if (!STOP.has(w)) freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  return freq;
}

function blank(sentence: string, term: string): string {
  const i = sentence.indexOf(term);
  return i < 0 ? sentence : sentence.slice(0, i) + '_____' + sentence.slice(i + term.length);
}

function perturbNumber(v: string, r: () => number): string[] {
  const pct = v.endsWith('%');
  const raw = v.replace(/[%,]/g, '');
  const n = Number(raw);
  if (!Number.isFinite(n)) return [];
  const decimals = raw.includes('.') ? raw.split('.')[1].length : 0;
  const isYear = !decimals && n >= 1000 && n <= 2100;
  const out = new Set<string>();
  const deltas = isYear ? [-12, -5, -3, 4, 7, 15] : [-0.5, -0.25, 0.2, 0.5, 1, 2];
  while (out.size < 3 && deltas.length) {
    const d = deltas.splice(Math.floor(r() * deltas.length), 1)[0];
    let m = isYear ? n + d : n + Math.max(1, Math.abs(n)) * d;
    if (n > 0 && m <= 0) m = n * (1 + Math.abs(d));
    const s = (decimals ? m.toFixed(decimals) : Math.round(m).toString()) + (pct ? '%' : '');
    if (s !== v) out.add(s);
  }
  return [...out];
}

function shuffle<T>(arr: T[], r: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function definition(sentence: string): { term: string; def: string } | null {
  const m = sentence.match(/^(?:An?\s+|The\s+)?([A-Za-z][\w\s'-]{2,40}?)\s+(?:is|are|refers to|means|describes|is defined as)\s+(.{15,})$/);
  if (!m) return null;
  const term = m[1].trim();
  if (term.split(' ').length > 5 || STOP.has(term.toLowerCase())) return null;
  return { term, def: m[2].replace(/\.$/, '') };
}

export function generateOffline(
  sources: { meta: SourceMeta; payload: SourcePayload }[],
  opts: GenerateOptions,
): { title: string; questions: Question[] } {
  const r = rng(hash(sources.map((s) => s.meta.id).join() + opts.count + opts.types.join() + opts.difficulty));
  const textSources = sources.filter((s) => s.payload.text && s.payload.text.length > 0);
  if (textSources.length === 0) {
    throw new Error('Offline mode needs readable text. PDFs and images need Claude — add an API key in Settings.');
  }

  type Cand = Sentence & { source: string };
  const all: Cand[] = [];
  const pool: Record<Term['kind'], Set<string>> = { number: new Set(), proper: new Set(), word: new Set() };
  const focusWords = opts.focus.toLowerCase().split(/\W+/).filter((w) => w.length > 2);

  for (const { meta, payload } of textSources) {
    const text = payload.text!;
    const freq = wordFrequencies(text);
    splitSentences(text).forEach((s, index) => {
      const terms = extractTerms(s, freq);
      if (!terms.length) return;
      for (const t of terms) pool[t.kind].add(t.value);
      let score = terms.slice(0, 4).reduce((a, t) => a + t.weight, 0);
      if (definition(s)) score += 2;
      if (focusWords.some((w) => s.toLowerCase().includes(w))) score += 4;
      all.push({ text: s, index, score, terms, source: meta.name });
    });
  }
  if (all.length === 0) {
    throw new Error('Could not find enough complete sentences to build questions from.');
  }

  // Pick the best sentences, spread across the document: split into buckets by position.
  const target = Math.min(opts.count, all.length);
  const buckets = Math.max(1, target);
  const perBucket = Math.ceil(all.length / buckets);
  const chosen: Cand[] = [];
  for (let b = 0; b < buckets; b++) {
    const slice = all.slice(b * perBucket, (b + 1) * perBucket).sort((x, y) => y.score - x.score);
    if (slice[0]) chosen.push(slice[0]);
  }
  // Top up if buckets were uneven.
  const rest = all.filter((c) => !chosen.includes(c)).sort((x, y) => y.score - x.score);
  while (chosen.length < target && rest.length) chosen.push(rest.shift()!);

  const usedAnswers = new Set<string>();
  const questions: Question[] = [];

  chosen.forEach((c, i) => {
    const type: QuestionType = opts.types[i % opts.types.length];
    const term = c.terms.find((t) => !usedAnswers.has(t.value.toLowerCase())) ?? c.terms[0];
    usedAnswers.add(term.value.toLowerCase());

    const distractorsFor = (t: Term): string[] => {
      if (t.kind === 'number') {
        const others = [...pool.number].filter((v) => v !== t.value && v.endsWith('%') === t.value.endsWith('%'));
        const mixed = shuffle(others, r).slice(0, 1).concat(perturbNumber(t.value, r));
        return [...new Set(mixed)].filter((v) => v !== t.value).slice(0, 3);
      }
      const lower = c.text.toLowerCase();
      const same = [...pool[t.kind]].filter((v) => v.toLowerCase() !== t.value.toLowerCase() && !lower.includes(v.toLowerCase()));
      const byLen = same.sort((a, b) => Math.abs(a.length - t.value.length) - Math.abs(b.length - t.value.length));
      return shuffle(byLen.slice(0, 10), r).slice(0, 3);
    };

    const base = { id: uid(), sourceName: c.source };
    const where = `“${c.text}”`;

    if (type === 'flashcard') {
      const d = definition(c.text);
      questions.push({
        ...base,
        type,
        prompt: d ? d.term : blank(c.text, term.value),
        choices: [],
        answerIndex: -1,
        answer: d ? d.def.charAt(0).toUpperCase() + d.def.slice(1) : term.value,
        explanation: where,
      });
      return;
    }

    if (type === 'short') {
      questions.push({
        ...base,
        type,
        prompt: `Fill in the blank: ${blank(c.text, term.value)}`,
        choices: [],
        answerIndex: -1,
        answer: term.value,
        explanation: where,
      });
      return;
    }

    const distractors = distractorsFor(term);

    if (type === 'truefalse' || distractors.length < 3) {
      const makeFalse = distractors.length > 0 && r() < 0.5;
      const statement = makeFalse ? c.text.replace(term.value, distractors[0]) : c.text;
      questions.push({
        ...base,
        type: 'truefalse',
        prompt: statement,
        choices: ['True', 'False'],
        answerIndex: makeFalse ? 1 : 0,
        answer: makeFalse ? 'False' : 'True',
        explanation: makeFalse ? `The material says “${term.value}”, not “${distractors[0]}”: ${where}` : where,
      });
      return;
    }

    const choices = shuffle([term.value, ...distractors.slice(0, 3)], r);
    questions.push({
      ...base,
      type: 'mcq',
      prompt: `Fill in the blank: ${blank(c.text, term.value)}`,
      choices,
      answerIndex: choices.indexOf(term.value),
      answer: term.value,
      explanation: where,
    });
  });

  const pretty = (n: string) =>
    n
      .replace(/\.[^.]+$/, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (ch) => ch.toUpperCase());
  const names = textSources.map((s) => pretty(s.meta.name));
  const title = names.length === 1 ? names[0] : names.length === 2 ? `${names[0]} & ${names[1]}` : `${names[0]} + ${names.length - 1} more`;
  return { title, questions };
}
