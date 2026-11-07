import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateOffline, splitSentences } from '../generateOffline';
import { extractFile } from '../extract';
import { toBase64, printableRatio } from '../bytes';
import type { SourceMeta } from '../types';

const TEXT = `
Photosynthesis is the process by which green plants convert light energy into chemical energy stored in glucose.
The process takes place mainly in the chloroplasts of leaf cells, which contain the pigment chlorophyll.
In 1779 Jan Ingenhousz showed that light is essential for plants to produce oxygen from their leaves.
The light-dependent reactions occur in the thylakoid membranes and produce ATP and NADPH for the plant.
The Calvin cycle uses ATP and NADPH to fix carbon dioxide into sugars inside the stroma of the chloroplast.
Roughly 90% of the oxygen in the atmosphere has been produced by photosynthetic organisms over billions of years.
Chlorophyll absorbs mostly blue and red light and reflects green light, which is why leaves look green.
Melvin Calvin received the Nobel Prize in 1961 for mapping the path of carbon in photosynthesis.
Plants that live in hot dry climates often use C4 or CAM photosynthesis to reduce water loss from leaves.
`;

const meta = (id: string, name: string): SourceMeta => ({
  id, name, mimeType: 'text/plain', size: TEXT.length, kind: 'text', detail: '', words: 100, importedAt: 0,
});

test('splits sentences', () => {
  assert.ok(splitSentences(TEXT).length >= 8);
});

test('offline generator makes the requested mix of questions', () => {
  const { questions, title } = generateOffline([{ meta: meta('a', 'bio.txt'), payload: { text: TEXT } }], {
    count: 8, types: ['mcq', 'truefalse', 'short', 'flashcard'], difficulty: 'recall', focus: '',
  });
  assert.equal(questions.length, 8);
  assert.match(title, /bio/i);
  for (const q of questions) {
    assert.ok(q.prompt.length > 0);
    assert.ok(q.answer.length > 0);
    if (q.type === 'mcq') {
      assert.equal(q.choices.length, 4);
      assert.equal(new Set(q.choices).size, 4, 'choices are unique');
      assert.equal(q.choices[q.answerIndex], q.answer);
      assert.ok(q.prompt.includes('_____'));
    }
    if (q.type === 'truefalse') assert.deepEqual(q.choices, ['True', 'False']);
  }
});

test('offline generator refuses when there is no text', () => {
  assert.throws(() =>
    generateOffline([{ meta: { ...meta('p', 'x.pdf'), kind: 'pdf' }, payload: { base64: 'AAA' } }], {
      count: 5, types: ['mcq'], difficulty: 'recall', focus: '',
    }),
  );
});

test('extracts text, pdf, image and binary', async () => {
  const enc = new TextEncoder();
  const t = await extractFile('notes.md', undefined, enc.encode('# Hello\nSome words here.'));
  assert.equal(t.kind, 'text');
  const p = await extractFile('a.pdf', 'application/pdf', enc.encode('%PDF-1.4'));
  assert.equal(p.kind, 'pdf');
  assert.equal(p.payload.base64, toBase64(enc.encode('%PDF-1.4')));
  const i = await extractFile('a.PNG', undefined, new Uint8Array([137, 80, 78, 71]));
  assert.equal(i.kind, 'image');
  const unknown = await extractFile('data.weird', undefined, enc.encode('plain text in a file with an odd extension'));
  assert.equal(unknown.kind, 'text');
  const bin = new Uint8Array([0, 1, 2, ...enc.encode('Readable string inside a binary'), 0, 255]);
  assert.equal(printableRatio(bin), 0);
  const b = await extractFile('blob.bin', undefined, bin);
  assert.equal(b.kind, 'binary');
  assert.match(b.payload.text!, /Readable string/);
});

test('base64 matches Buffer', () => {
  for (const s of ['', 'a', 'ab', 'abc', 'hello world!']) {
    assert.equal(toBase64(new TextEncoder().encode(s)), Buffer.from(s).toString('base64'));
  }
});
