import { useColorScheme } from 'react-native';

/**
 * "Margins" — a study tool that feels like annotating a good book:
 * warm paper, near-black ink, one vermilion accent used sparingly for
 * the thing that matters on each screen. Correct answers use a deep
 * moss green so the two states never rely on colour alone (icons + labels too).
 */
const light = {
  bg: '#F4F0E6',
  surface: '#FBF8F1',
  sunken: '#ECE6D8',
  ink: '#1C1A16',
  inkSoft: '#4A463E',
  muted: '#7A7468',
  line: '#DCD4C3',
  accent: '#C8441C',
  accentInk: '#FFF8F2',
  accentSoft: '#F6DDD1',
  good: '#2F6B3F',
  goodSoft: '#DCE9D9',
  bad: '#B3261E',
  badSoft: '#F5D9D5',
  overlay: 'rgba(28,26,22,0.4)',
};

const dark: typeof light = {
  bg: '#14130F',
  surface: '#1D1B17',
  sunken: '#100F0C',
  ink: '#F1ECDF',
  inkSoft: '#CFC8B8',
  muted: '#968F80',
  line: '#34312A',
  accent: '#F07A4E',
  accentInk: '#1A0D06',
  accentSoft: '#3A2219',
  good: '#8CC79A',
  goodSoft: '#1E2E21',
  bad: '#F0857B',
  badSoft: '#3A1E1B',
  overlay: 'rgba(0,0,0,0.55)',
};

export type Palette = typeof light;

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

export const font = {
  display: 'Fraunces_600SemiBold',
  displayItalic: 'Fraunces_400Regular_Italic',
  displayRegular: 'Fraunces_400Regular',
  body: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
};

/** 4pt base grid. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { sm: 8, md: 14, lg: 22, pill: 999 };

export const type = {
  hero: { fontFamily: font.display, fontSize: 44, lineHeight: 48, letterSpacing: -1.2 },
  title: { fontFamily: font.display, fontSize: 28, lineHeight: 34, letterSpacing: -0.6 },
  question: { fontFamily: font.displayRegular, fontSize: 24, lineHeight: 32, letterSpacing: -0.3 },
  heading: { fontFamily: font.semibold, fontSize: 17, lineHeight: 22, letterSpacing: -0.2 },
  body: { fontFamily: font.body, fontSize: 16, lineHeight: 24 },
  bodyMedium: { fontFamily: font.medium, fontSize: 16, lineHeight: 22 },
  small: { fontFamily: font.body, fontSize: 14, lineHeight: 20 },
  eyebrow: { fontFamily: font.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 1.2, textTransform: 'uppercase' as const },
};
