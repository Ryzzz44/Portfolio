import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { deletePayload, putPayload } from './payloadStore';
import type { Quiz, SourceMeta, SourcePayload } from './types';

const SOURCES_KEY = 'margins.sources.v1';
const QUIZZES_KEY = 'margins.quizzes.v1';
const PREFS_KEY = 'margins.prefs.v1';

export interface Prefs {
  engine: 'claude' | 'offline';
  haptics: boolean;
}

const DEFAULT_PREFS: Prefs = { engine: 'claude', haptics: true };

interface Store {
  ready: boolean;
  sources: SourceMeta[];
  quizzes: Quiz[];
  prefs: Prefs;
  addSource(meta: SourceMeta, payload: SourcePayload): Promise<void>;
  removeSource(id: string): Promise<void>;
  saveQuiz(quiz: Quiz): Promise<void>;
  removeQuiz(id: string): Promise<void>;
  setPrefs(p: Partial<Prefs>): Promise<void>;
}

const Ctx = createContext<Store | null>(null);

async function load<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function save(key: string, value: unknown) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable: state still lives in memory for this session.
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [sources, setSources] = useState<SourceMeta[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [prefs, setPrefsState] = useState<Prefs>(DEFAULT_PREFS);

  useEffect(() => {
    (async () => {
      const [s, q, p] = await Promise.all([
        load<SourceMeta[]>(SOURCES_KEY, []),
        load<Quiz[]>(QUIZZES_KEY, []),
        load<Prefs>(PREFS_KEY, DEFAULT_PREFS),
      ]);
      setSources(s);
      setQuizzes(q);
      setPrefsState({ ...DEFAULT_PREFS, ...p });
      setReady(true);
    })();
  }, []);

  const addSource = useCallback(async (meta: SourceMeta, payload: SourcePayload) => {
    await putPayload(meta.id, payload);
    setSources((prev) => {
      const next = [meta, ...prev];
      save(SOURCES_KEY, next);
      return next;
    });
  }, []);

  const removeSource = useCallback(async (id: string) => {
    await deletePayload(id);
    setSources((prev) => {
      const next = prev.filter((s) => s.id !== id);
      save(SOURCES_KEY, next);
      return next;
    });
  }, []);

  const saveQuiz = useCallback(async (quiz: Quiz) => {
    setQuizzes((prev) => {
      const exists = prev.some((q) => q.id === quiz.id);
      const next = exists ? prev.map((q) => (q.id === quiz.id ? quiz : q)) : [quiz, ...prev];
      save(QUIZZES_KEY, next);
      return next;
    });
  }, []);

  const removeQuiz = useCallback(async (id: string) => {
    setQuizzes((prev) => {
      const next = prev.filter((q) => q.id !== id);
      save(QUIZZES_KEY, next);
      return next;
    });
  }, []);

  const setPrefs = useCallback(async (p: Partial<Prefs>) => {
    setPrefsState((prev) => {
      const next = { ...prev, ...p };
      save(PREFS_KEY, next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ ready, sources, quizzes, prefs, addSource, removeSource, saveQuiz, removeQuiz, setPrefs }),
    [ready, sources, quizzes, prefs, addSource, removeSource, saveQuiz, removeQuiz, setPrefs],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore must be used inside StoreProvider');
  return s;
}
