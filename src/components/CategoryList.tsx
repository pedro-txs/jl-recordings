import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Category } from '../storage';
import { colors, radius, tint } from '../theme';

type Props = {
  categories: Category[];
  selectedId: string | null;
  locked: boolean; // durante a gravação não dá para trocar
  onSelect: (c: Category) => void;
};

export function CategoryList({ categories, selectedId, locked, onSelect }: Props) {
  return (
    <View style={styles.list}>
      {categories.map((c) => {
        const selected = c.id === selectedId;
        const faded = locked && !selected;
        return (
          <Pressable
            key={c.id}
            disabled={locked}
            onPress={() => onSelect(c)}
            style={({ pressed }) => [
              styles.row,
              selected && { backgroundColor: tint(c.color, 0.09), borderColor: c.color },
              pressed && !selected && { backgroundColor: '#FAF9F6' },
              faded && { opacity: 0.35 },
            ]}
          >
            <View style={[styles.dot, { backgroundColor: c.color }]} />
            <Text style={[styles.label, selected && { color: c.color }]} numberOfLines={1}>
              {c.label}
            </Text>
            <Ionicons
              name={selected ? 'checkmark-circle' : 'ellipse-outline'}
              size={24}
              color={selected ? c.color : colors.line}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  label: { flex: 1, fontSize: 17, fontWeight: '600', color: colors.ink },
});
