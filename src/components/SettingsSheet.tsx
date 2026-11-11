import { Ionicons } from '@expo/vector-icons';
import type { User } from '@react-native-google-signin/google-signin';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { buildBaseName } from '../naming';
import { getOpenAIKey, newId, setOpenAIKey, type Settings } from '../storage';
import { categoryPalette, colors, radius } from '../theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  settings: Settings;
  onChange: (s: Settings) => void;
  user: User | null;
  onConnect: () => void;
  onDisconnect: () => void;
  onPickFolder: () => void;
};

export function SettingsSheet({ visible, onClose, settings, onChange, user, onConnect, onDisconnect, onPickFolder }: Props) {
  const [newLabel, setNewLabel] = useState('');
  const [key, setKey] = useState('');
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    if (!visible) return;
    void getOpenAIKey().then((k) => {
      setHasKey(!!k);
      setKey('');
    });
  }, [visible]);

  const addCategory = () => {
    const label = newLabel.trim();
    if (!label) return;
    const color = categoryPalette[settings.categories.length % categoryPalette.length];
    onChange({ ...settings, categories: [...settings.categories, { id: newId(), label, color }] });
    setNewLabel('');
  };

  const removeCategory = (id: string) => {
    if (settings.categories.length <= 1) {
      Alert.alert('Precisa ter pelo menos uma descrição.');
      return;
    }
    onChange({ ...settings, categories: settings.categories.filter((c) => c.id !== id) });
  };

  const saveKey = async () => {
    await setOpenAIKey(key);
    setHasKey(!!key.trim());
    setKey('');
  };

  const example = buildBaseName(settings.categories[0]?.label ?? 'Buscando José', new Date());

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Configurações</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.done}>OK</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Section title="GOOGLE DRIVE">
            <Row
              icon="logo-google"
              title={user ? user.user.email : 'Não conectado'}
              action={user ? 'Desconectar' : 'Conectar'}
              onPress={user ? onDisconnect : onConnect}
              danger={!!user}
            />
            <Row
              icon="folder-outline"
              title={settings.folder?.name ?? 'Nenhuma pasta escolhida'}
              action={settings.folder ? 'Trocar' : 'Escolher'}
              onPress={onPickFolder}
              disabled={!user}
            />
          </Section>

          <Section title="DESCRIÇÕES DO ÁUDIO">
            {settings.categories.map((c) => (
              <View key={c.id} style={styles.row}>
                <View style={[styles.dot, { backgroundColor: c.color }]} />
                <Text style={styles.rowTitle}>{c.label}</Text>
                <Pressable onPress={() => removeCategory(c.id)} hitSlop={10}>
                  <Ionicons name="trash-outline" size={20} color={colors.muted} />
                </Pressable>
              </View>
            ))}
            <View style={styles.row}>
              <TextInput
                value={newLabel}
                onChangeText={setNewLabel}
                placeholder="Nova descrição (ex.: Médico do José)"
                placeholderTextColor={colors.muted}
                style={styles.input}
                onSubmitEditing={addCategory}
                returnKeyType="done"
              />
              <Pressable onPress={addCategory} hitSlop={10}>
                <Ionicons name="add-circle" size={26} color={colors.ink} />
              </Pressable>
            </View>
            <Text style={styles.hint}>
              Nome do arquivo: <Text style={styles.hintStrong}>{example}.m4a</Text>
            </Text>
          </Section>

          <Section title="TRANSCRIÇÃO">
            <View style={styles.row}>
              <Ionicons name="document-text-outline" size={20} color={colors.inkSoft} />
              <Text style={styles.rowTitle}>Transcrever automaticamente</Text>
              <Switch
                value={settings.transcribe}
                onValueChange={(v) => onChange({ ...settings, transcribe: v })}
                trackColor={{ true: colors.ok }}
              />
            </View>
            <View style={styles.row}>
              <TextInput
                value={key}
                onChangeText={setKey}
                placeholder={hasKey ? 'Chave salva ✓  (cole outra para trocar)' : 'Chave da OpenAI (sk-...)'}
                placeholderTextColor={hasKey ? colors.ok : colors.muted}
                style={styles.input}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable onPress={saveKey} hitSlop={10} disabled={!key.trim()}>
                <Text style={[styles.action, !key.trim() && { opacity: 0.3 }]}>Salvar</Text>
              </Pressable>
            </View>
            <Text style={styles.hint}>
              A transcrição vira um Google Docs na mesma pasta, com o mesmo nome + "- TRANSCRIÇÃO". A chave fica guardada no
              Keychain do iPhone.
            </Text>
          </Section>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Row(props: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  action: string;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <View style={[styles.row, props.disabled && { opacity: 0.4 }]}>
      <Ionicons name={props.icon} size={20} color={colors.inkSoft} />
      <Text style={styles.rowTitle} numberOfLines={1}>
        {props.title}
      </Text>
      <Pressable onPress={props.onPress} disabled={props.disabled} hitSlop={10}>
        <Text style={[styles.action, props.danger && { color: colors.danger }]}>{props.action}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  headerTitle: { fontSize: 26, fontWeight: '700', color: colors.ink, letterSpacing: -0.4 },
  done: { fontSize: 17, fontWeight: '700', color: colors.ink },
  content: { padding: 16, gap: 24, paddingBottom: 60 },
  sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 1, color: colors.muted, marginLeft: 4 },
  sectionBody: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  rowTitle: { flex: 1, fontSize: 16, color: colors.ink },
  dot: { width: 12, height: 12, borderRadius: 6 },
  input: { flex: 1, fontSize: 16, color: colors.ink, paddingVertical: 2 },
  action: { fontSize: 15, fontWeight: '700', color: colors.ink },
  hint: { fontSize: 13, color: colors.muted, padding: 16, lineHeight: 19 },
  hintStrong: { color: colors.inkSoft, fontWeight: '700' },
});
