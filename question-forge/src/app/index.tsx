import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatBytes } from '@/lib/bytes';
import { pickAndExtract } from '@/lib/importFiles';
import { useStore } from '@/lib/store';
import type { Quiz, SourceMeta } from '@/lib/types';
import { confirmDestructive } from '@/ui/confirm';
import { Icon } from '@/ui/Icon';
import { Button, FileTag, IconButton, T, tap } from '@/ui/primitives';
import { font, radius, space, usePalette } from '@/ui/theme';

function scoreOf(q: Quiz) {
  const right = q.responses.filter((r) => r.correct).length;
  return { right, total: q.questions.length };
}

function relativeDay(ts: number) {
  const d = Math.floor((Date.now() - ts) / 86_400_000);
  if (d <= 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d} days ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function Library() {
  const c = usePalette();
  const insets = useSafeAreaInsets();
  const { sources, quizzes, addSource, removeSource, removeQuiz } = useStore();
  const [selected, setSelected] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  async function onImport() {
    setNotice(null);
    setImporting(true);
    try {
      const res = await pickAndExtract();
      if (!res) return;
      for (const a of res.added) await addSource(a.meta, a.payload);
      // Newly imported files are selected, so "Make questions" is one tap away.
      setSelected((prev) => [...new Set([...res.added.map((a) => a.meta.id), ...prev])]);
      if (res.failed.length) {
        setNotice({
          tone: 'bad',
          text: res.failed.map((f) => `${f.name}: ${f.reason}`).join('\n'),
        });
      } else if (res.added.length) {
        tap('success');
        setNotice({ tone: 'good', text: `Added ${res.added.length} file${res.added.length > 1 ? 's' : ''}. Ready when you are.` });
      }
    } catch (e) {
      setNotice({ tone: 'bad', text: e instanceof Error ? e.message : 'Import failed.' });
    } finally {
      setImporting(false);
    }
  }

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function onDeleteSource(s: SourceMeta) {
    if (await confirmDestructive('Remove file?', `“${s.name}” will be removed from Margins. Question sets made from it stay.`, 'Remove')) {
      setSelected((prev) => prev.filter((x) => x !== s.id));
      removeSource(s.id);
    }
  }

  async function onDeleteQuiz(q: Quiz) {
    if (await confirmDestructive('Delete question set?', `“${q.title}” and its results will be deleted.`, 'Delete')) removeQuiz(q.id);
  }

  const empty = sources.length === 0 && quizzes.length === 0;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + space.sm, paddingBottom: 140 + insets.bottom, paddingHorizontal: space.xl }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topbar}>
          <T variant="title" style={{ fontFamily: font.displayItalic, fontSize: 22 }}>
            Margins
          </T>
          <IconButton icon="gear" label="Settings" onPress={() => router.push('/settings')} />
        </View>

        <T variant="hero" style={{ marginTop: space.xxl }}>
          {empty ? (
            <>
              Turn any file{'\n'}into <T variant="hero" color={c.accent} style={{ fontFamily: font.displayItalic }}>questions</T>.
            </>
          ) : (
            <>
              What are we{'\n'}studying <T variant="hero" color={c.accent} style={{ fontFamily: font.displayItalic }}>today</T>?
            </>
          )}
        </T>
        <T color={c.inkSoft} style={{ marginTop: space.md, maxWidth: 360 }}>
          {empty
            ? 'Import notes, PDFs, slides, spreadsheets, code or photos of a page. Margins writes the quiz.'
            : 'Select one or more files, then make a question set from them.'}
        </T>

        {notice && (
          <View
            accessibilityLiveRegion="polite"
            style={[styles.notice, { backgroundColor: notice.tone === 'good' ? c.goodSoft : c.badSoft }]}
          >
            <Icon name={notice.tone === 'good' ? 'check' : 'cross'} color={notice.tone === 'good' ? c.good : c.bad} size={18} />
            <T variant="small" color={c.ink} style={{ flex: 1 }}>
              {notice.text}
            </T>
            <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" hitSlop={10} onPress={() => setNotice(null)}>
              <Icon name="close" color={c.muted} size={18} />
            </Pressable>
          </View>
        )}

        {empty && (
          <View style={[styles.emptyCard, { borderColor: c.line }]}>
            {[
              ['01', 'Import', 'Pick files from your phone, iCloud, Drive — any type.'],
              ['02', 'Shape', 'Choose how many questions, which kinds, how deep.'],
              ['03', 'Practise', 'Answer, see why, and retry the ones you missed.'],
            ].map(([n, h, b]) => (
              <View key={n} style={styles.step}>
                <T variant="eyebrow" color={c.accent} style={{ width: 28 }}>
                  {n}
                </T>
                <View style={{ flex: 1 }}>
                  <T variant="heading">{h}</T>
                  <T variant="small" color={c.muted}>
                    {b}
                  </T>
                </View>
              </View>
            ))}
          </View>
        )}

        {sources.length > 0 && (
          <View style={{ marginTop: space.xxl }}>
            <View style={styles.sectionHead}>
              <T variant="eyebrow" color={c.muted}>
                Files · {sources.length}
              </T>
              {selected.length > 0 && (
                <Pressable accessibilityRole="button" hitSlop={10} onPress={() => setSelected([])}>
                  <T variant="small" color={c.muted} style={{ fontFamily: font.medium }}>
                    Clear selection
                  </T>
                </Pressable>
              )}
            </View>
            <View style={[styles.list, { backgroundColor: c.surface, borderColor: c.line }]}>
              {sources.map((s, i) => {
                const on = selectedSet.has(s.id);
                return (
                  <Pressable
                    key={s.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={`${s.name}, ${s.detail}`}
                    accessibilityHint="Double tap to select. Long press to remove."
                    onPress={() => {
                      tap();
                      toggle(s.id);
                    }}
                    onLongPress={() => onDeleteSource(s)}
                    style={({ pressed }) => [
                      styles.row,
                      { backgroundColor: pressed ? c.sunken : on ? c.accentSoft : 'transparent' },
                      i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line },
                    ]}
                  >
                    <FileTag name={s.name} kind={s.kind} size={36} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <T variant="bodyMedium" numberOfLines={1}>
                        {s.name}
                      </T>
                      <T variant="small" color={c.muted} numberOfLines={1}>
                        {s.detail} · {formatBytes(s.size)}
                      </T>
                    </View>
                    <View style={[styles.check, { borderColor: on ? c.accent : c.line, backgroundColor: on ? c.accent : 'transparent' }]}>
                      {on && <Icon name="check" color={c.accentInk} size={16} />}
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <T variant="small" color={c.muted} style={{ marginTop: space.sm }}>
              Long-press a file to remove it.
            </T>
          </View>
        )}

        {quizzes.length > 0 && (
          <View style={{ marginTop: space.xxl }}>
            <View style={styles.sectionHead}>
              <T variant="eyebrow" color={c.muted}>
                Question sets · {quizzes.length}
              </T>
            </View>
            <View style={{ gap: space.md }}>
              {quizzes.map((q) => {
                const s = scoreOf(q);
                const done = !!q.completedAt;
                const pct = done ? Math.round((s.right / s.total) * 100) : null;
                return (
                  <Pressable
                    key={q.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${q.title}, ${q.questions.length} questions${pct !== null ? `, last score ${pct} percent` : ', not started'}`}
                    accessibilityHint="Long press to delete."
                    onPress={() => router.push(`/quiz/${q.id}`)}
                    onLongPress={() => onDeleteQuiz(q)}
                    style={({ pressed }) => [styles.quizCard, { backgroundColor: c.surface, borderColor: c.line, opacity: pressed ? 0.85 : 1 }]}
                  >
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <T variant="heading" numberOfLines={2} style={{ fontFamily: font.display, fontSize: 19, lineHeight: 24 }}>
                        {q.title}
                      </T>
                      <T variant="small" color={c.muted}>
                        {q.questions.length} questions · {relativeDay(q.createdAt)} · {q.engine === 'claude' ? 'Claude' : 'On-device'}
                      </T>
                    </View>
                    <View style={[styles.score, { backgroundColor: done ? (pct! >= 70 ? c.goodSoft : c.accentSoft) : c.sunken }]}>
                      <T
                        variant="heading"
                        color={done ? (pct! >= 70 ? c.good : c.accent) : c.muted}
                        style={{ fontFamily: font.display, fontSize: done ? 18 : 13 }}
                      >
                        {done ? `${pct}%` : 'New'}
                      </T>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>

      <View style={[styles.dock, { paddingBottom: insets.bottom + space.md, backgroundColor: c.bg, borderTopColor: c.line }]}>
        {selected.length > 0 ? (
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <Button label="Add" icon="plus" variant="secondary" onPress={onImport} loading={importing} style={{ paddingHorizontal: space.lg }} />
            <Button
              label={selected.length > 1 ? `Make questions · ${selected.length}` : 'Make questions'}
              accessibilityHint={`Uses ${selected.length} selected file${selected.length > 1 ? 's' : ''}`}
              icon="sparkle"
              style={{ flex: 1 }}
              onPress={() => {
                setNotice(null);
                router.push({ pathname: '/generate', params: { ids: selected.join(',') } });
              }}
            />
          </View>
        ) : (
          <Button label={importing ? 'Reading files…' : 'Import files'} icon="plus" onPress={onImport} loading={importing} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  notice: {
    marginTop: space.xl,
    borderRadius: radius.md,
    padding: space.lg,
    flexDirection: 'row',
    gap: space.md,
    alignItems: 'flex-start',
  },
  emptyCard: {
    marginTop: space.xxl,
    borderTopWidth: 1,
    paddingTop: space.xl,
    gap: space.xl,
  },
  step: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.md },
  list: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: 68 },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  quizCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
  },
  score: { minWidth: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.sm },
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
