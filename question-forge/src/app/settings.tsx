import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { clearApiKey, getApiKey, setApiKey } from '@/lib/secrets';
import { useStore } from '@/lib/store';
import { Icon } from '@/ui/Icon';
import { Button, IconButton, Segmented, T } from '@/ui/primitives';
import { font, radius, space, usePalette } from '@/ui/theme';

export default function Settings() {
  const c = usePalette();
  const insets = useSafeAreaInsets();
  const { prefs, setPrefs, sources, quizzes } = useStore();
  const [saved, setSaved] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    getApiKey().then(setSaved);
  }, []);

  async function save() {
    const k = draft.trim();
    if (!k.startsWith('sk-ant-')) {
      setStatus('That doesn’t look like an Anthropic key — they start with “sk-ant-”.');
      return;
    }
    await setApiKey(k);
    setSaved(k);
    setDraft('');
    setStatus('Key saved on this device.');
    if (prefs.engine !== 'claude') setPrefs({ engine: 'claude' });
  }

  async function remove() {
    await clearApiKey();
    setSaved(null);
    setStatus('Key removed.');
  }

  const masked = saved ? `${saved.slice(0, 10)}••••${saved.slice(-4)}` : null;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: insets.top + space.sm, paddingHorizontal: space.xl, paddingBottom: insets.bottom + space.xxxl }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginRight: -space.sm }}>
          <IconButton icon="close" label="Close settings" onPress={() => router.back()} />
        </View>
        <T variant="title" style={{ marginTop: space.md }}>
          Settings
        </T>

        <T variant="eyebrow" color={c.muted} style={{ marginTop: space.xxl, marginBottom: space.md }}>
          Who writes the questions
        </T>
        <Segmented
          label="Question engine"
          value={prefs.engine}
          onChange={(engine) => setPrefs({ engine })}
          options={[
            { value: 'claude', label: 'Claude' },
            { value: 'offline', label: 'On-device' },
          ]}
        />
        <T variant="small" color={c.muted} style={{ marginTop: space.sm }}>
          {prefs.engine === 'claude'
            ? 'Best quality. Reads PDFs and images directly, writes explanations and deeper questions. Needs an API key.'
            : 'Private and free. Works on text-based files only and writes fill-in-the-blank style questions.'}
        </T>

        <T variant="eyebrow" color={c.muted} style={{ marginTop: space.xxl, marginBottom: space.md }}>
          Anthropic API key
        </T>
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
          {masked ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <View style={[styles.dot, { backgroundColor: c.goodSoft }]}>
                <Icon name="check" color={c.good} size={16} />
              </View>
              <View style={{ flex: 1 }}>
                <T variant="bodyMedium">Key saved</T>
                <T variant="small" color={c.muted} style={{ fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) }}>
                  {masked}
                </T>
              </View>
              <IconButton icon="trash" label="Remove API key" tone={c.bad} onPress={remove} />
            </View>
          ) : (
            <>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="sk-ant-…"
                placeholderTextColor={c.muted}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                accessibilityLabel="Anthropic API key"
                onSubmitEditing={save}
                style={[styles.input, { color: c.ink, backgroundColor: c.bg, borderColor: c.line, fontFamily: font.body }]}
              />
              <Button label="Save key" onPress={save} disabled={!draft.trim()} style={{ marginTop: space.md }} />
            </>
          )}
          {status && (
            <T variant="small" color={c.inkSoft} style={{ marginTop: space.md }}>
              {status}
            </T>
          )}
        </View>
        <Pressable accessibilityRole="link" onPress={() => Linking.openURL('https://console.anthropic.com/settings/keys')} style={{ marginTop: space.md, minHeight: 44, justifyContent: 'center' }}>
          <T variant="small" color={c.accent} style={{ fontFamily: font.semibold }}>
            Get a key at console.anthropic.com →
          </T>
        </Pressable>
        <T variant="small" color={c.muted}>
          {Platform.OS === 'web'
            ? 'Stored in this browser only. Files are sent straight to the Anthropic API when you make questions.'
            : 'Stored in the device keychain. Files are sent straight to the Anthropic API when you make questions — never to any other server.'}
        </T>

        <T variant="eyebrow" color={c.muted} style={{ marginTop: space.xxl, marginBottom: space.md }}>
          On this device
        </T>
        <T color={c.inkSoft}>
          {sources.length} file{sources.length === 1 ? '' : 's'} · {quizzes.length} question set{quizzes.length === 1 ? '' : 's'}
        </T>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, padding: space.lg },
  input: { minHeight: 52, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: space.lg, fontSize: 16 },
  dot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
