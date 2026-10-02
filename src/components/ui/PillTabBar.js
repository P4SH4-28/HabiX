// ============================================================
// PillTabBar — Premium oyun tab bar (Linear/Vercel tarzı).
// Bottom-tabs navigator'ına `tabBar` olarak bağlanır.
// - Yüzen kapsül form: blur zemin + ince border + indigo glow
// - Yükseklik: min 60px içerik + safe area bottom (iOS/Android)
// - Aktif sekme: primary tint'li pill + primary ikon/etiket (150ms geçiş)
// - İnaktif sekmeler: outline ikon + soluk etiket, press'te mikro scale
// - İkonlar hâlâ ekranOptions.tabBarIcon'tan gelir (kilit liderlik
//   ikonu mantığı dahil burada korunur).
// ============================================================
import { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tint, useTheme } from '../../theme';
import PressableFX from '../PressableFX';

const ICON_SIZE = 26;
const LABEL_SIZE = 11;
const MIN_BAR_HEIGHT = 60;
const TRANSITION_MS = 150;
const ACTIVE_TINT_ALPHA = '26'; // primary ~%15 alpha — hafif pill zemini
// Android gesture bar (edge-to-edge) için ekstra boşluk.
const ANDROID_BOTTOM_EXTRA = 12;
const IOS_BOTTOM_EXTRA = 6;

function TabButton({ focused, label, glyph, onPress, color, pillColor }) {
  const progress = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: focused ? 1 : 0,
      duration: TRANSITION_MS,
      useNativeDriver: true,
    }).start();
  }, [focused, progress]);

  return (
    <PressableFX
      onPress={onPress}
      scale={0.93}
      style={styles.itemWrap}
      accessibilityRole="tab"
      accessibilityLabel={String(label)}
      accessibilityState={{ selected: focused }}
    >
      <View style={styles.item}>
        <Animated.View
          pointerEvents="none"
          style={[styles.pill, { backgroundColor: pillColor, opacity: progress }]}
        />
        <View style={styles.itemInner}>{glyph}</View>
        <Text style={[styles.label, { color }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </PressableFX>
  );
}

export default function PillTabBar({ state, descriptors, navigation }) {
  const { colors: C, radius } = useTheme();
  const insets = useSafeAreaInsets();

  const bottomPad =
    insets.bottom + (Platform.OS === 'android' ? ANDROID_BOTTOM_EXTRA : IOS_BOTTOM_EXTRA);
  const pillBg = tint(C.primary, ACTIVE_TINT_ALPHA);

  return (
    <View
      style={[
        styles.wrap,
        {
          paddingLeft: insets.left + 13,
          paddingRight: insets.right + 13,
          paddingBottom: bottomPad,
        },
      ]}
    >
      <BlurView
        intensity={35}
        tint="dark"
        style={[styles.bar, { borderRadius: radius.pill }]}
      >
        <View style={styles.barInner}>
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const label =
              options.tabBarLabel !== undefined
                ? Array.isArray(options.tabBarLabel) || typeof options.tabBarLabel === 'string'
                  ? options.tabBarLabel
                  : options.tabBarLabel.toString()
                : options.title != null
                  ? options.title
                  : route.name;
            const focused = state.index === index;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            const color = focused ? C.primary : C.textMuted;
            const glyph = options.tabBarIcon
              ? options.tabBarIcon({ focused, color, size: ICON_SIZE })
              : null;

            return (
              <TabButton
                key={route.key}
                focused={focused}
                label={label}
                glyph={glyph}
                color={color}
                pillColor={pillBg}
                onPress={onPress}
              />
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    paddingTop: 8,
  },
  bar: {
    flex: 1,
    minHeight: MIN_BAR_HEIGHT,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    backgroundColor: 'rgba(16,18,26,0.82)',
    overflow: 'hidden',
  },
  barInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  itemWrap: {
    flex: 1,
  },
  item: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 16,
    gap: 5,
  },
  pill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
  },
  itemInner: {
    height: ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: LABEL_SIZE,
    lineHeight: 14,
    fontWeight: '700',
  },
});
