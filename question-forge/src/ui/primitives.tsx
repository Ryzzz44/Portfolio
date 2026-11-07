import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { extensionOf } from '@/lib/extract';
import type { SourceKind } from '@/lib/types';
import { Icon, type IconName } from './Icon';
import { font, radius, space, type, usePalette } from './theme';

export function tap(kind: 'light' | 'success' | 'error' = 'light') {
  if (Platform.OS === 'web') return;
  if (kind === 'light') Haptics.selectionAsync().catch(() => {});
  else Haptics.notificationAsync(kind === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error).catch(() => {});
}

export function T({
  children,
  variant = 'body',
  color,
  style,
  numberOfLines,
}: {
  children: ReactNode;
  variant?: keyof typeof type;
  color?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const c = usePalette();
  return (
    <Text numberOfLines={numberOfLines} style={[type[variant], { color: color ?? c.ink }, style]} maxFontSizeMultiplier={1.6}>
      {children}
    </Text>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  loading,
  style,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}) {
  const c = usePalette();
  const bg = variant === 'primary' ? c.ink : variant === 'secondary' ? c.surface : 'transparent';
  const fg = variant === 'primary' ? c.bg : c.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      disabled={disabled || loading}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: bg,
          borderColor: variant === 'secondary' ? c.line : 'transparent',
          opacity: disabled ? 0.4 : pressed ? 0.82 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} color={fg} size={20} /> : null}
      <Text style={[type.bodyMedium, { color: fg, fontFamily: font.semibold }]}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({ icon, label, onPress, tone }: { icon: IconName; label: string; onPress: () => void; tone?: string }) {
  const c = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, { backgroundColor: pressed ? c.sunken : 'transparent' }]}
    >
      <Icon name={icon} color={tone ?? c.ink} />
    </Pressable>
  );
}

export function Chip({ label, selected, onPress, hint }: { label: string; selected: boolean; onPress: () => void; hint?: string }) {
  const c = usePalette();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? c.ink : c.surface,
          borderColor: selected ? c.ink : c.line,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {selected && <Icon name="check" color={c.bg} size={16} />}
      <Text style={[type.small, { fontFamily: font.medium, color: selected ? c.bg : c.ink }]}>{label}</Text>
    </Pressable>
  );
}

export function Segmented<V extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: V; label: string }[];
  value: V;
  onChange: (v: V) => void;
  label: string;
}) {
  const c = usePalette();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.segmented, { backgroundColor: c.sunken }]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.label}
            onPress={() => {
              tap();
              onChange(o.value);
            }}
            style={[styles.segment, on && { backgroundColor: c.surface, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 }]}
          >
            <Text style={[type.small, { fontFamily: on ? font.semibold : font.medium, color: on ? c.ink : c.muted }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A paper-tag glyph showing the file extension — quicker to scan than generic icons. */
export function FileTag({ name, kind, size = 44 }: { name: string; kind: SourceKind; size?: number }) {
  const c = usePalette();
  const ext = (extensionOf(name) || kind).slice(0, 4).toUpperCase();
  const tint = kind === 'pdf' ? c.accent : kind === 'image' ? c.good : c.inkSoft;
  return (
    <View
      style={{
        width: size,
        height: size * 1.18,
        borderRadius: 6,
        borderTopRightRadius: size * 0.32,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.line,
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingBottom: Math.round(size * 0.14),
      }}
    >
      <Text style={{ fontFamily: font.semibold, fontSize: Math.max(7, (size / 44) * (ext.length > 3 ? 10 : 11.5)), letterSpacing: 0.6, color: tint }}>{ext}</Text>
    </View>
  );
}

export function Divider() {
  const c = usePalette();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.line }} />;
}

const styles = StyleSheet.create({
  button: {
    minHeight: 54,
    borderRadius: radius.pill,
    paddingHorizontal: space.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    borderWidth: 1,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    minHeight: 40,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: radius.md,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
