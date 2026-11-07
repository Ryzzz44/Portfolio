import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

export type IconName =
  | 'plus'
  | 'gear'
  | 'close'
  | 'check'
  | 'cross'
  | 'arrowRight'
  | 'arrowLeft'
  | 'trash'
  | 'sparkle'
  | 'device'
  | 'flip'
  | 'retry';

/** A small hand-drawn set at 1.75px stroke on a 24px grid. */
export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color: string }) {
  const p = { stroke: color, strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'plus' && <Path d="M12 5v14M5 12h14" {...p} />}
      {name === 'close' && <Path d="M6 6l12 12M18 6L6 18" {...p} />}
      {name === 'cross' && <Path d="M7 7l10 10M17 7L7 17" {...p} strokeWidth={2.25} />}
      {name === 'check' && <Path d="M5 12.5l4.5 4.5L19 7.5" {...p} strokeWidth={2.25} />}
      {name === 'arrowRight' && <Path d="M5 12h14M13 6l6 6-6 6" {...p} />}
      {name === 'arrowLeft' && <Path d="M19 12H5M11 6l-6 6 6 6" {...p} />}
      {name === 'trash' && <Path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5" {...p} />}
      {name === 'gear' && (
        <>
          <Path d="M4 7h9M17 7h3M4 17h3M11 17h9" {...p} />
          <Circle cx={15} cy={7} r={2.25} {...p} />
          <Circle cx={9} cy={17} r={2.25} {...p} />
        </>
      )}
      {name === 'sparkle' && <Path d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9L12 3zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16z" {...p} />}
      {name === 'device' && <Path d="M8 2.75h8a1.5 1.5 0 011.5 1.5v15.5a1.5 1.5 0 01-1.5 1.5H8a1.5 1.5 0 01-1.5-1.5V4.25A1.5 1.5 0 018 2.75zM11 18h2" {...p} />}
      {name === 'flip' && <Path d="M4 9a8 8 0 0114-3l2 2M20 4v4h-4M20 15a8 8 0 01-14 3l-2-2M4 20v-4h4" {...p} />}
      {name === 'retry' && <Path d="M4 4v5h5M4.6 9A8 8 0 1112 20" {...p} />}
    </Svg>
    </View>
  );
}
