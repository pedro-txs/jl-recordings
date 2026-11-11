import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createFolder, listFolders } from '../drive';
import type { DriveFolder } from '../storage';
import { colors, radius } from '../theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  onPick: (folder: DriveFolder) => void;
};

const ROOT: DriveFolder = { id: 'root', name: 'Meu Drive' };

export function FolderPicker({ visible, onClose, onPick }: Props) {
  const [path, setPath] = useState<DriveFolder[]>([ROOT]);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = path[path.length - 1];

  const load = useCallback(async (folder: DriveFolder) => {
    setLoading(true);
    setError(null);
    try {
      setFolders(await listFolders(folder.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) void load(current);
  }, [visible, current, load]);

  useEffect(() => {
    if (!visible) setPath([ROOT]);
  }, [visible]);

  const newFolder = () =>
    Alert.prompt('Nova pasta', `Dentro de "${current.name}"`, async (name) => {
      if (!name?.trim()) return;
      try {
        const f = await createFolder(name.trim(), current.id);
        setPath((p) => [...p, f]);
      } catch (e) {
        Alert.alert('Não consegui criar a pasta', e instanceof Error ? e.message : String(e));
      }
    });

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.screen} edges={['bottom']}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.headerBtn}>Cancelar</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Escolher pasta</Text>
          <Pressable onPress={newFolder} hitSlop={12}>
            <Ionicons name="add-circle-outline" size={26} color={colors.ink} />
          </Pressable>
        </View>

        <View style={styles.crumbs}>
          {path.length > 1 && (
            <Pressable onPress={() => setPath((p) => p.slice(0, -1))} style={styles.back} hitSlop={8}>
              <Ionicons name="chevron-back" size={18} color={colors.ink} />
            </Pressable>
          )}
          <Text style={styles.crumbText} numberOfLines={1}>
            {path.map((p) => p.name).join('  ›  ')}
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.ink} />
        ) : error ? (
          <View style={styles.empty}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => load(current)}>
              <Text style={styles.link}>Tentar de novo</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={folders}
            keyExtractor={(f) => f.id}
            contentContainerStyle={{ padding: 16, gap: 8 }}
            ListEmptyComponent={<Text style={styles.emptyText}>Nenhuma subpasta aqui.</Text>}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => setPath((p) => [...p, item])}
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
              >
                <Ionicons name="folder" size={22} color="#8A93A6" />
                <Text style={styles.rowText} numberOfLines={1}>
                  {item.name}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </Pressable>
            )}
          />
        )}

        <View style={styles.footer}>
          <Pressable
            disabled={current.id === 'root'}
            onPress={() => onPick(current)}
            style={({ pressed }) => [
              styles.cta,
              current.id === 'root' && { opacity: 0.4 },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Ionicons name="checkmark" size={20} color="#fff" />
            <Text style={styles.ctaText} numberOfLines={1}>
              {current.id === 'root' ? 'Entre em uma pasta' : `Salvar áudios em "${current.name}"`}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
  },
  headerBtn: { fontSize: 16, color: colors.inkSoft },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.ink },
  crumbs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 16,
    padding: 10,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
  },
  back: { paddingRight: 2 },
  crumbText: { flex: 1, fontSize: 14, color: colors.inkSoft, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
  },
  rowText: { flex: 1, fontSize: 16, color: colors.ink },
  empty: { alignItems: 'center', marginTop: 40, gap: 10, paddingHorizontal: 24 },
  emptyText: { textAlign: 'center', color: colors.muted, marginTop: 30 },
  errorText: { color: colors.danger, textAlign: 'center' },
  link: { color: colors.ink, fontWeight: '700' },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.bg },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.ink,
    borderRadius: radius.md,
    paddingVertical: 16,
  },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '700', flexShrink: 1 },
});
