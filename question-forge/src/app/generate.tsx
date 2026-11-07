import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { uid } from '@/lib/bytes';
import { generateWithClaude, GenerationError } from '@/lib/generateClaude';
import { generateOffline } from '@/lib/generateOffline';
import { getPayload } from '@/lib/payloadStore';
import { getApiKey } from '@/lib/secrets';
import { useStore } from '@/lib/store';
import type { Difficulty, QuestionType } from '@/lib/types';
import { Icon } from '@/ui/Icon';
import { Button, Chip, FileTag, IconButton, Segmented, T, tap } from '@/ui/primitives';
import { font, radius, space, usePalette } from '@/ui/theme';

const TYPES: { value: QuestionType; label: string }[] = [
  { value: 'mcq', label: 'Multiple choice' },
  { value: 'truefalse', label: 'True / false' },
  { value: 'short', label: 'Short answer' },
  { value: 'flashcard', label: 'Flashcards' },
];

const DEPTH: { value: Difficulty; label: string; hint: string }[] = [
  { value: 'recall', label: 'Recall', hint: 'Facts, names, numbers and definitions.' },
  { value: 'understand', label: 'Understand', hint: 'Why things happen and how ideas connect.' },
  { value: 'apply', label: 'Apply', hint: 'New scenarios that use what you learned.' },
];

const PHASES = ['Reading your files', 'Finding the key ideas', 'Drafting questions', 'Writing distractors', 'Checking answers'];

export default function Generate() {
  const c = usePalette();
  const insets = useSafeAreaInsets();
  const { ids } = useLocalSearchParams<{ ids?: string }>();
  const { sources, prefs, saveQuiz } = useStore();
  const picked = useMemo(() => {
    const want = new Set((ids ?? '').split(',').filter(Boolean));
    return sources.filter((s) => want.has(s.id));
  }, [ids, sources]);

  const [count, setCount] = useState(10);
  const [types, setTypes] = useState<QuestionType[]>(['mcq', 'truefalse', 'short']);
  const [difficulty, setDifficulty] = useState<Difficulty>('understand');
  const [focus, setFocus] = useState('');
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    getApiKey().then((k) => setHasKey(!!k));
  }, []);

  useEffect(() => {
    if (!busy) return;
    setPhase(0);
    const t = setInterval(() => setPhase((p) => Math.min(p + 1, PHASES.length - 1)), 3800);
    return () => clearInterval(t);
  }, [busy]);

  const needsClaude = picked.some((s) => s.kind === 'pdf' || s.kind === 'image');
  const engine: 'claude' | 'offline' = prefs.engine === 'claude' && hasKey ? 'claude' : 'offline';
  const blockedOffline = engine === 'offline' && picked.every((s) => s.kind === 'pdf' || s.kind === 'image');

  function toggleType(t: QuestionType) {
    setTypes((prev) => (prev.includes(t) ? (prev.length > 1 ? prev.filter((x) => x !== t) : prev) : [...prev, t]));
  }

  async function run() {
    setError(null);
    setBusy(true);
    abort.current = new AbortController();
    try {
      const loaded = [];
      for (const meta of picked) {
        const payload = await getPayload(meta.id);
        if (payload) loaded.push({ meta, payload });
      }
      if (!loaded.length) throw new Error('These files are no longer available. Import them again.');
      const opts = { count, types, difficulty, focus };
      const out =
        engine === 'claude'
          ? await generateWithClaude((await getApiKey())!, loaded, opts, abort.current.signal)
          : generateOffline(loaded, opts);
      const quiz = {
        id: uid(),
        title: out.title,
        sourceIds: picked.map((s) => s.id),
        createdAt: Date.now(),
        engine,
        difficulty,
        questions: out.questions,
        responses: [],
      };
      await saveQuiz(quiz);
      tap('success');
      router.replace(`/quiz/${quiz.id}`);
    } catch (e) {
      tap('error');
      setError(e instanceof GenerationError || e instanceof Error ? e.message : 'Something went wrong.');
      setBusy(false);
    }
  }

  if (busy) {
    return (
      <View style={[styles.busy, { backgroundColor: c.bg, paddingTop: insets.top, paddingBottom: insets.bottom + space.xl }]}>
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: space.xl }}>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: space.xl }}>
            {picked.slice(0, 5).map((s, i) => (
              <View key={s.id} style={{ transform: [{ rotate: `${(i - 1) * 4}deg` }] }}>
                <FileTag name={s.name} kind={s.kind} size={40} />
              </View>
            ))}
          </View>
          <T variant="eyebrow" color={c.accent}>
            {engine === 'claude' ? 'Claude is writing' : 'Working on device'}
          </T>
          <T variant="hero" style={{ marginTop: space.sm }}>
            {PHASES[phase]}
            <T variant="hero" color={c.accent}>
              …
            </T>
          </T>
          <T color={c.muted} style={{ marginTop: space.md }}>
            {count} questions from {picked.length === 1 ? picked[0].name : `${picked.length} files`}. This usually takes under a minute.
          </T>
          <View style={[styles.track, { backgroundColor: c.sunken }]}>
            <View style={[styles.fill, { backgroundColor: c.ink, width: `${((phase + 1) / PHASES.length) * 92}%` }]} />
          </View>
        </View>
        <View style={{ paddingHorizontal: space.xl }}>
          <Button label="Cancel" variant="secondary" onPress={() => abort.current?.abort()} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: insets.top + space.sm, paddingHorizontal: space.xl, paddingBottom: 140 + insets.bottom }}
      >
        <View style={styles.topbar}>
          <IconButton icon="close" label="Close" onPress={() => router.back()} />
        </View>

        <T variant="title" style={{ marginTop: space.md }}>
          Shape your{' '}
          <T variant="title" color={c.accent} style={{ fontFamily: font.displayItalic }}>
            question set
          </T>
        </T>

        <View style={[styles.files, { borderColor: c.line }]}>
          {picked.map((s) => (
            <View key={s.id} style={styles.fileRow}>
              <FileTag name={s.name} kind={s.kind} size={28} />
              <T variant="small" numberOfLines={1} style={{ flex: 1, fontFamily: font.medium }}>
                {s.name}
              </T>
              <T variant="small" color={c.muted}>
                {s.kind === 'pdf' ? 'PDF' : s.kind === 'image' ? 'Image' : `${s.words.toLocaleString()} words`}
              </T>
            </View>
          ))}
          {picked.length === 0 && <T color={c.muted}>No files selected.</T>}
        </View>

        <Section label="How many">
          <Segmented
            label="Number of questions"
            value={count}
            onChange={setCount}
            options={[5, 10, 15, 20].map((n) => ({ value: n, label: String(n) }))}
          />
        </Section>

        <Section label="Kinds of question">
          <View style={styles.chips}>
            {TYPES.map((t) => (
              <Chip key={t.value} label={t.label} selected={types.includes(t.value)} onPress={() => toggleType(t.value)} />
            ))}
          </View>
        </Section>

        <Section label="Depth">
          <Segmented label="Depth" value={difficulty} onChange={setDifficulty} options={DEPTH} />
          <T variant="small" color={c.muted} style={{ marginTop: space.sm }}>
            {DEPTH.find((d) => d.value === difficulty)!.hint}
            {engine === 'offline' && difficulty !== 'recall' ? ' On-device mode writes recall questions only.' : ''}
          </T>
        </Section>

        <Section label="Focus (optional)">
          <TextInput
            value={focus}
            onChangeText={setFocus}
            placeholder="e.g. chapter 3, the Krebs cycle, dates"
            placeholderTextColor={c.muted}
            accessibilityLabel="Focus topic"
            returnKeyType="done"
            style={[styles.input, { color: c.ink, backgroundColor: c.surface, borderColor: c.line, fontFamily: font.body }]}
          />
        </Section>

        <View style={[styles.engine, { backgroundColor: engine === 'claude' ? c.accentSoft : c.sunken }]}>
          <Icon name={engine === 'claude' ? 'sparkle' : 'device'} color={engine === 'claude' ? c.accent : c.inkSoft} size={20} />
          <View style={{ flex: 1 }}>
            <T variant="small" style={{ fontFamily: font.semibold }}>
              {engine === 'claude' ? 'Written by Claude Opus 5.5' : 'Written on your device'}
            </T>
            <T variant="small" color={c.inkSoft}>
              {engine === 'claude'
                ? 'Your files are sent to the Anthropic API with your key.'
                : needsClaude
                  ? 'PDFs and images need Claude. Add an API key in Settings to include them.'
                  : 'Nothing leaves your phone. Add an API key in Settings for smarter questions.'}
            </T>
          </View>
        </View>

        {error && (
          <View accessibilityLiveRegion="assertive" style={[styles.engine, { backgroundColor: c.badSoft, marginTop: space.md }]}>
            <Icon name="cross" color={c.bad} size={20} />
            <T variant="small" style={{ flex: 1 }}>
              {error}
            </T>
          </View>
        )}
      </ScrollView>

      <View style={[styles.dock, { paddingBottom: insets.bottom + space.md, backgroundColor: c.bg, borderTopColor: c.line }]}>
        {engine === 'offline' && hasKey === false && (
          <Button label="Add API key" variant="ghost" onPress={() => router.push('/settings')} style={{ minHeight: 44, marginBottom: 4 }} />
        )}
        <Button
          label={`Make ${count} questions`}
          icon="arrowRight"
          disabled={picked.length === 0 || blockedOffline}
          onPress={run}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  const c = usePalette();
  return (
    <View style={{ marginTop: space.xl }}>
      <T variant="eyebrow" color={c.muted} style={{ marginBottom: space.md }}>
        {label}
      </T>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: { flexDirection: 'row', justifyContent: 'flex-end', marginRight: -space.sm },
  files: { marginTop: space.xl, borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: space.md, gap: space.sm },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 40 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  input: { minHeight: 52, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: space.lg, fontSize: 16 },
  engine: { marginTop: space.xxl, borderRadius: radius.md, padding: space.lg, flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: space.md,
    paddingHorizontal: space.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  busy: { flex: 1 },
  track: { height: 4, borderRadius: 2, marginTop: space.xxl, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
});
