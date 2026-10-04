import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Text from './ui/Text';
import { useTheme } from '../theme';
import AnimatedCounter from './AnimatedCounter';
import Icon from './ui/icons';

export default function StatCard({ label, value, icon, color }) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  return (
    <View style={styles.card}>
      <View
        style={[
          styles.iconBox,
          {
            backgroundColor: (color || C.primary) + '22',
          },
        ]}
      >
        <Icon emoji={icon} size={16} color={color || C.primary} />
      </View>
      <AnimatedCounter value={value} style={styles.value} />
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    card: {
      flex: 1,
      minWidth: 0,
      backgroundColor: C.surface,
      borderRadius: 16,
      padding: 14,
      gap: 6,
    },
    iconBox: {
      width: 32,
      height: 32,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    value: {
      color: C.text,
      fontSize: 22,
      fontWeight: '700',
      lineHeight: 32,
    },
    label: {
      color: C.textMuted,
      fontSize: 11,
      fontWeight: '600',
      lineHeight: 16,
    },
  });
}
