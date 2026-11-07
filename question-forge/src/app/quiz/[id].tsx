import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '@/lib/store';
import type { Question, Quiz, QuizResponse } from '@/lib/types';
import { Icon } from '@/ui/Icon';
import { Button, IconButton, T, tap } from '@/ui/primitives';
import { font, radius, space, usePalette } from '@/ui/theme';

const TYPE_LABEL: Record<Question['type'], string> = {
  mcq: 'Multiple choice',
  truefalse: 'True or false',
  short: 'Short answer',
  flashcard: 'Flashcard',
};

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export default function QuizScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { quizzes } = useStore();
  const quiz = quizzes.find((q) => q.id === id);
  const c = usePalette();
  if (!quiz) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.lg }}>
        <T variant="title">Set not found</T>
        <Button label="Back to library" variant="secondary" onPress={() => router.replace('/')} />
      </View>
    );
  }
  return <Player key={quiz.id + (quiz.completedAt ?? '')} quiz={quiz} />;
}

function Player({ quiz }: { quiz: Quiz }) {
  const c = usePalette();
  const insets = useSafeAreaInsets();
  const { saveQuiz } = useStore();

  // Played in-progress; finished sets open on the results page.
  const [questions, setQuestions] = useState<Question[]>(quiz.questions);
  const [index, setIndex] = useState(0);
  const [responses, setResponses] = useState<QuizResponse[]>([]);
  const [showResults, setShowResults] = useState(!!quiz.completedAt);
  const [current, setCurrent] = useState<QuizResponse | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [typed, setTyped] = useState('');
  const fade = useRef(new Animated.Value(1)).current;

  const q = questions[index];
  const finalResponses = showResults && responses.length === 0 ? quiz.responses : responses;

  function answerChoice(i: number) {
    if (current) return;
    const correct = i === q.answerIndex;
    tap(correct ? 'success' : 'error');
    setCurrent({ questionId: q.id, choiceIndex: i, text: '', correct });
    setRevealed(true);
  }

  function selfMark(correct: boolean) {
    tap(correct ? 'success' : 'light');
    const r = { questionId: q.id, choiceIndex: -1, text: typed, correct };
    advance(r);
  }

  function advance(r: QuizResponse | null = current) {
    if (!r) return;
    const all = [...responses, r];
    setResponses(all);
    if (index + 1 >= questions.length) {
      const merged = quiz.questions.length === questions.length ? all : mergeRetry(quiz, all);
      saveQuiz({ ...quiz, responses: merged, completedAt: Date.now() });
      setShowResults(true);
      return;
    }
    Animated.timing(fade, { toValue: 0, duration: 120, useNativeDriver: Platform.OS !== 'web' }).start(() => {
      setIndex(index + 1);
      setCurrent(null);
      setRevealed(false);
      setTyped('');
      Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: Platform.OS !== 'web' }).start();
    });
  }

  function restart(onlyMissed: boolean) {
    const missedIds = new Set(finalResponses.filter((r) => !r.correct).map((r) => r.questionId));
    const next = onlyMissed ? quiz.questions.filter((x) => missedIds.has(x.id)) : quiz.questions;
    setQuestions(next.length ? next : quiz.questions);
    setIndex(0);
    setResponses([]);
    setCurrent(null);
    setRevealed(false);
    setTyped('');
    setShowResults(false);
  }

  if (showResults) {
    return <Results quiz={quiz} responses={finalResponses} onRetry={restart} />;
  }

  const isChoice = q.type === 'mcq' || q.type === 'truefalse';
  const progress = (index + (current || revealed ? 1 : 0)) / questions.length;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + space.xs }]}>
        <IconButton icon="close" label="Leave quiz" onPress={() => router.back()} />
        <View
          style={[styles.track, { backgroundColor: c.sunken }]}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: questions.length, now: index + 1 }}
        >
          <View style={[styles.fill, { backgroundColor: c.accent, width: `${Math.max(progress, 0.02) * 100}%` }]} />
        </View>
        <T variant="small" color={c.muted} style={{ fontFamily: font.semibold, minWidth: 44, textAlign: 'right' }}>
          {index + 1}/{questions.length}
        </T>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: space.xl, paddingTop: space.xl, paddingBottom: 140 + insets.bottom }}
      >
        <Animated.View style={{ opacity: fade }}>
          <T variant="eyebrow" color={c.accent}>
            {TYPE_LABEL[q.type]}
          </T>

          {q.type === 'flashcard' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={revealed ? `Answer: ${q.answer}` : `${q.prompt}. Tap to reveal the answer.`}
              onPress={() => {
                tap();
                setRevealed((v) => !v);
              }}
              style={({ pressed }) => [
                styles.card,
                { backgroundColor: revealed ? c.ink : c.surface, borderColor: c.line, transform: [{ scale: pressed ? 0.99 : 1 }] },
              ]}
            >
              <T variant="eyebrow" color={revealed ? c.accent : c.muted}>
                {revealed ? 'Answer' : 'Prompt'}
              </T>
              <T variant="question" color={revealed ? c.bg : c.ink} style={{ marginTop: space.md }}>
                {revealed ? q.answer : q.prompt}
              </T>
              <View style={styles.flipHint}>
                <Icon name="flip" size={16} color={revealed ? c.bg : c.muted} />
                <T variant="small" color={revealed ? c.bg : c.muted}>
                  Tap to {revealed ? 'see prompt' : 'flip'}
                </T>
              </View>
            </Pressable>
          ) : (
            <T variant="question" style={{ marginTop: space.md }}>
              {q.prompt}
            </T>
          )}

          {isChoice && (
            <View style={{ marginTop: space.xl, gap: space.md }}>
              {q.choices.map((choice, i) => {
                const picked = current?.choiceIndex === i;
                const isRight = i === q.answerIndex;
                const state = !current ? 'idle' : isRight ? 'right' : picked ? 'wrong' : 'dim';
                const bg = state === 'right' ? c.goodSoft : state === 'wrong' ? c.badSoft : c.surface;
                const border = state === 'right' ? c.good : state === 'wrong' ? c.bad : c.line;
                return (
                  <Pressable
                    key={i}
                    accessibilityRole="button"
                    accessibilityLabel={`${LETTERS[i]}: ${choice}${state === 'right' ? ', correct answer' : state === 'wrong' ? ', your answer, incorrect' : ''}`}
                    accessibilityState={{ disabled: !!current }}
                    disabled={!!current}
                    onPress={() => answerChoice(i)}
                    style={({ pressed }) => [
                      styles.choice,
                      { backgroundColor: pressed ? c.sunken : bg, borderColor: border, opacity: state === 'dim' ? 0.55 : 1 },
                    ]}
                  >
                    <View
                      style={[
                        styles.letter,
                        {
                          borderColor: state === 'idle' || state === 'dim' ? c.line : border,
                          backgroundColor: state === 'right' ? c.good : state === 'wrong' ? c.bad : 'transparent',
                        },
                      ]}
                    >
                      {state === 'right' ? (
                        <Icon name="check" color={c.surface} size={16} />
                      ) : state === 'wrong' ? (
                        <Icon name="cross" color={c.surface} size={16} />
                      ) : (
                        <T variant="small" color={c.muted} style={{ fontFamily: font.semibold }}>
                          {LETTERS[i]}
                        </T>
                      )}
                    </View>
                    <T style={{ flex: 1 }}>{choice}</T>
                  </Pressable>
                );
              })}
            </View>
          )}

          {q.type === 'short' && (
            <View style={{ marginTop: space.xl, gap: space.md }}>
              <TextInput
                value={typed}
                onChangeText={setTyped}
                editable={!revealed}
                multiline
                placeholder="Type your answer"
                placeholderTextColor={c.muted}
                accessibilityLabel="Your answer"
                style={[styles.input, { color: c.ink, backgroundColor: c.surface, borderColor: c.line, fontFamily: font.body }]}
              />
              {revealed && (
                <View style={[styles.answerBox, { backgroundColor: c.sunken }]}>
                  <T variant="eyebrow" color={c.muted}>
                    Model answer
                  </T>
                  <T style={{ marginTop: space.xs, fontFamily: font.medium }}>{q.answer}</T>
                </View>
              )}
            </View>
          )}

          {revealed && q.explanation ? (
            <View style={[styles.explain, { borderLeftColor: current ? (current.correct ? c.good : c.bad) : c.accent }]}>
              {current && (
                <T variant="heading" color={current.correct ? c.good : c.bad}>
                  {current.correct ? 'Correct.' : `Not quite — it’s ${LETTERS[q.answerIndex]}.`}
                </T>
              )}
              <T color={c.inkSoft} style={{ marginTop: current ? space.xs : 0 }}>
                {q.explanation}
              </T>
              {q.sourceName ? (
                <T variant="small" color={c.muted} style={{ marginTop: space.sm }}>
                  {q.sourceName}
                </T>
              ) : null}
            </View>
          ) : null}
        </Animated.View>
      </ScrollView>

      <View style={[styles.dock, { paddingBottom: insets.bottom + space.md, backgroundColor: c.bg, borderTopColor: c.line }]}>
        {isChoice ? (
          <Button
            label={index + 1 >= questions.length ? 'See results' : 'Next question'}
            icon="arrowRight"
            disabled={!current}
            onPress={() => advance()}
          />
        ) : !revealed ? (
          <Button label={q.type === 'flashcard' ? 'Show answer' : 'Check answer'} onPress={() => setRevealed(true)} />
        ) : (
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <Button label="Missed it" icon="cross" variant="secondary" style={{ flex: 1 }} onPress={() => selfMark(false)} />
            <Button label="Got it" icon="check" style={{ flex: 1 }} onPress={() => selfMark(true)} />
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

/** When retrying only missed questions, keep earlier right answers in the saved result. */
function mergeRetry(quiz: Quiz, retry: QuizResponse[]): QuizResponse[] {
  const byId = new Map(quiz.responses.map((r) => [r.questionId, r]));
  for (const r of retry) byId.set(r.questionId, r);
  return quiz.questions.map((q) => byId.get(q.id)).filter((r): r is QuizResponse => !!r);
}

function Results({ quiz, responses, onRetry }: { quiz: Quiz; responses: QuizResponse[]; onRetry: (onlyMissed: boolean) => void }) {
  const c = usePalette();
  const insets = useSafeAreaInsets();
  const byId = useMemo(() => new Map(responses.map((r) => [r.questionId, r])), [responses]);
  const answered = quiz.questions.filter((q) => byId.has(q.id));
  const right = answered.filter((q) => byId.get(q.id)!.correct).length;
  const pct = answered.length ? Math.round((right / answered.length) * 100) : 0;
  const missed = answered.length - right;
  const verdict = pct === 100 ? 'Flawless.' : pct >= 80 ? 'Strong work.' : pct >= 60 ? 'Getting there.' : 'Worth another pass.';

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + space.sm, paddingHorizontal: space.xl, paddingBottom: 160 + insets.bottom }}>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginRight: -space.sm }}>
          <IconButton icon="close" label="Done" onPress={() => router.back()} />
        </View>
        <T variant="eyebrow" color={c.accent} style={{ marginTop: space.lg }}>
          {quiz.title}
        </T>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: space.sm }}>
          <T style={{ fontFamily: font.display, fontSize: 96, lineHeight: 100, letterSpacing: -4, color: c.ink }}>{pct}</T>
          <T style={{ fontFamily: font.displayItalic, fontSize: 40, lineHeight: 72, color: c.accent }}>%</T>
        </View>
        <T variant="title" style={{ fontFamily: font.displayRegular }}>
          {verdict}
        </T>
        <T color={c.muted} style={{ marginTop: space.xs }}>
          {right} of {answered.length} right{missed ? ` · ${missed} to review` : ''}
        </T>

        <View style={{ marginTop: space.xxl, gap: space.md }}>
          {quiz.questions.map((q, i) => {
            const r = byId.get(q.id);
            if (!r) return null;
            return (
              <View key={q.id} style={[styles.review, { backgroundColor: c.surface, borderColor: c.line }]}>
                <View style={[styles.mark, { backgroundColor: r.correct ? c.goodSoft : c.badSoft }]}>
                  <Icon name={r.correct ? 'check' : 'cross'} color={r.correct ? c.good : c.bad} size={16} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T variant="small" color={c.muted} style={{ fontFamily: font.semibold }}>
                    {i + 1}. {TYPE_LABEL[q.type]}
                  </T>
                  <T style={{ marginTop: 2 }} numberOfLines={3}>
                    {q.prompt}
                  </T>
                  {!r.correct && (
                    <T variant="small" color={c.good} style={{ marginTop: space.xs, fontFamily: font.medium }}>
                      Answer: {q.answer}
                    </T>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
      <View style={[styles.dock, { paddingBottom: insets.bottom + space.md, backgroundColor: c.bg, borderTopColor: c.line }]}>
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <Button label="Start over" icon="retry" variant="secondary" style={{ flex: missed ? undefined : 1, paddingHorizontal: space.lg }} onPress={() => onRetry(false)} />
          {missed > 0 && <Button label={`Retry ${missed} missed`} style={{ flex: 1 }} onPress={() => onRetry(true)} />}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md },
  track: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  card: { marginTop: space.lg, minHeight: 260, borderRadius: radius.lg, borderWidth: 1, padding: space.xl, justifyContent: 'center' },
  flipHint: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.xl },
  choice: {
    minHeight: 60,
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  letter: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  input: { minHeight: 110, borderRadius: radius.md, borderWidth: 1, padding: space.lg, fontSize: 17, textAlignVertical: 'top' },
  answerBox: { borderRadius: radius.md, padding: space.lg },
  explain: { marginTop: space.xl, borderLeftWidth: 3, paddingLeft: space.lg, paddingVertical: space.xs },
  review: { flexDirection: 'row', gap: space.md, borderRadius: radius.md, borderWidth: 1, padding: space.lg, alignItems: 'flex-start' },
  mark: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: space.md,
    paddingHorizontal: space.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
