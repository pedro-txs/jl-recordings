import { Ionicons } from '@expo/vector-icons';
import type { User } from '@react-native-google-signin/google-signin';
import {
  AudioQuality,
  IOSOutputFormat,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  type RecordingOptions,
} from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { CategoryList } from './src/components/CategoryList';
import { FolderPicker } from './src/components/FolderPicker';
import { RecordingRow } from './src/components/RecordingRow';
import { RecordPanel } from './src/components/RecordPanel';
import { SettingsSheet } from './src/components/SettingsSheet';
import { configureGoogle, connectDrive, disconnectDrive, folderExists, restoreSession } from './src/drive';
import { buildBaseName, formatLongDate } from './src/naming';
import { processQueue } from './src/queue';
import { recordingsStore, useRecordings } from './src/recordingsStore';
import { defaultSettings, loadSettings, newId, saveSettings, type Category, type DriveFolder, type Settings } from './src/storage';
import { colors, radius } from './src/theme';

configureGoogle();

// Qualidade de voz: AAC mono 32 kbps ≈ 14 MB por hora. Ótimo para fala e transcrição.
const VOICE: RecordingOptions = {
  extension: '.m4a',
  sampleRate: 22050,
  numberOfChannels: 1,
  bitRate: 32000,
  isMeteringEnabled: false,
  android: { outputFormat: 'mpeg4', audioEncoder: 'aac' },
  ios: { outputFormat: IOSOutputFormat.MPEG4AAC, audioQuality: AudioQuality.MEDIUM },
  web: {},
};

type Active = { id: string; startedAt: number };

function Home() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [user, setUser] = useState<User | null>(null);
  const [selected, setSelected] = useState<Category | null>(null);
  const [active, setActive] = useState<Active | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [now, setNow] = useState(new Date());
  const shake = useRef(new Animated.Value(0)).current;
  const recordings = useRecordings();
  const activeRef = useRef<Active | null>(null);
  activeRef.current = active;

  const recorder = useAudioRecorder(VOICE, (status) => {
    if (status.hasError && activeRef.current) {
      void finishRecording();
      Alert.alert('A gravação foi interrompida', status.error ?? 'Erro no microfone. O que foi gravado será enviado.');
    }
  });
  const recState = useAudioRecorderState(recorder, 500);

  // ---------- inicialização ----------
  useEffect(() => {
    (async () => {
      const s = await loadSettings();
      setSettings(s);
      await recordingsStore.init();
      try {
        const u = await restoreSession();
        setUser(u);
        if (u && s.folder && !(await folderExists(s.folder.id))) {
          Alert.alert('Pasta não encontrada', `A pasta "${s.folder.name}" não existe mais no Drive. Escolha outra.`);
        }
      } catch {
        // sem internet: segue sem conta por enquanto
      }
      void processQueue();
    })();
  }, []);

  // reenvia pendentes quando o app volta para a tela e a cada minuto
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') {
        setNow(new Date());
        void processQueue();
      }
    });
    const t = setInterval(() => void processQueue(), 60_000);
    return () => {
      sub.remove();
      clearInterval(t);
    };
  }, []);

  const updateSettings = useCallback((s: Settings) => {
    setSettings(s);
    void saveSettings(s);
    setSelected((cur) => (cur && !s.categories.some((c) => c.id === cur.id) ? null : cur));
  }, []);

  // ---------- Google Drive ----------
  const connect = async () => {
    try {
      const u = await connectDrive();
      if (!u) return;
      setUser(u);
      if (!settings.folder) setShowPicker(true);
      void processQueue();
    } catch (e) {
      Alert.alert('Não consegui conectar', e instanceof Error ? e.message : String(e));
    }
  };

  const disconnect = () =>
    Alert.alert('Desconectar o Google Drive?', 'Os áudios novos ficam guardados no iPhone até você conectar de novo.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Desconectar',
        style: 'destructive',
        onPress: async () => {
          await disconnectDrive();
          setUser(null);
        },
      },
    ]);

  const pickFolder = (f: DriveFolder) => {
    updateSettings({ ...settings, folder: f });
    setShowPicker(false);
    // itens que falharam por falta de pasta voltam para a fila
    recordingsStore
      .get()
      .filter((r) => r.status === 'error' && !r.driveFileId)
      .forEach((r) => recordingsStore.update(r.id, { status: 'pending', error: undefined }));
    void processQueue();
  };

  // ---------- gravação ----------
  const nudge = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 1, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const startRecording = async () => {
    if (!selected) return nudge();
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Microfone bloqueado', 'Libere o microfone em Ajustes > Gravações.');
      return;
    }
    try {
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        allowsBackgroundRecording: true, // continua com a tela bloqueada
        shouldPlayInBackground: true,
        interruptionMode: 'doNotMix',
      });
      const id = newId();
      const startedAt = new Date(); // data puxada no INÍCIO da gravação
      await recorder.prepareToRecordAsync({ ...VOICE, directory: 'document', fileName: id });
      recorder.record();
      recordingsStore.add({
        id,
        categoryLabel: selected.label,
        color: selected.color,
        baseName: buildBaseName(selected.label, startedAt),
        startedAt: startedAt.toISOString(),
        durationMs: 0,
        localUri: recorder.uri,
        status: 'recording',
      });
      setActive({ id, startedAt: startedAt.getTime() });
      setNow(startedAt);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch (e) {
      Alert.alert('Não consegui começar a gravar', e instanceof Error ? e.message : String(e));
    }
  };

  const finishRecording = async () => {
    const a = activeRef.current;
    if (!a) return;
    setActive(null);
    const durationMs = recorder.getStatus().durationMillis || Date.now() - a.startedAt;
    try {
      await recorder.stop();
    } catch {
      // já estava parado
    }
    const uri = recorder.uri ?? recordingsStore.find(a.id)?.localUri ?? null;
    recordingsStore.update(a.id, { status: 'pending', localUri: uri, durationMs });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await setAudioModeAsync({ allowsRecording: false, allowsBackgroundRecording: false, shouldPlayInBackground: false });
    void processQueue();
  };

  // ignora toques repetidos enquanto o início/fim da gravação ainda está em andamento
  const busyRef = useRef(false);
  const onRecordPress = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      await (active ? finishRecording() : startRecording());
    } finally {
      busyRef.current = false;
    }
  };

  // pausado pelo iOS (ex.: ligação) — só considera depois de 2 s de gravação
  const paused = !!active && !recState.isRecording && Date.now() - active.startedAt > 2000;
  const fileName = selected ? buildBaseName(selected.label, active ? new Date(active.startedAt) : now) : null;
  const queued = recordings.filter((r) => r.status === 'pending' || r.status === 'uploading' || r.status === 'transcribing').length;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Cabeçalho */}
        <View style={styles.header}>
          <View>
            <Text style={styles.date}>{formatLongDate(now).toUpperCase()}</Text>
            <Text style={styles.title}>Gravações</Text>
          </View>
          <Pressable onPress={() => setShowSettings(true)} style={styles.iconBtn} hitSlop={8}>
            <Ionicons name="settings-outline" size={22} color={colors.ink} />
          </Pressable>
        </View>

        {/* Drive */}
        {!user ? (
          <View style={styles.setupCard}>
            <Ionicons name="cloud-outline" size={28} color={colors.ink} />
            <View style={{ flex: 1 }}>
              <Text style={styles.setupTitle}>Conecte o Google Drive</Text>
              <Text style={styles.setupText}>Os áudios vão direto para a pasta que você escolher.</Text>
            </View>
            <Pressable onPress={connect} style={styles.setupBtn}>
              <Text style={styles.setupBtnText}>Conectar</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => setShowPicker(true)} style={styles.folderPill}>
            <Ionicons name="folder" size={18} color={settings.folder ? '#8A93A6' : colors.warn} />
            <Text style={styles.folderText} numberOfLines={1}>
              {settings.folder ? settings.folder.name : 'Toque para escolher a pasta do Drive'}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.muted} />
          </Pressable>
        )}

        {/* Descrição */}
        <Text style={styles.section}>DESCRIÇÃO DO ÁUDIO</Text>
        <CategoryList
          categories={settings.categories}
          selectedId={selected?.id ?? null}
          locked={!!active}
          onSelect={(c) => {
            setSelected(c);
            void Haptics.selectionAsync();
          }}
        />

        {/* Gravador */}
        <View style={{ marginTop: 20 }}>
          <RecordPanel
            fileName={fileName}
            accent={selected?.color ?? colors.ink}
            recording={!!active}
            paused={paused}
            durationMs={active ? recState.durationMillis : 0}
            shake={shake}
            onPress={onRecordPress}
            onResume={() => recorder.record()}
          />
        </View>

        {/* Recentes */}
        {recordings.length > 0 && (
          <>
            <View style={styles.recentHeader}>
              <Text style={styles.section}>RECENTES</Text>
              {queued > 0 && <Text style={styles.queued}>{queued} na fila</Text>}
            </View>
            <View style={{ gap: 10 }}>
              {recordings.slice(0, 30).map((r) => (
                <RecordingRow key={r.id} item={r} />
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <SettingsSheet
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        onChange={updateSettings}
        user={user}
        onConnect={connect}
        onDisconnect={disconnect}
        onPickFolder={() => {
          setShowSettings(false);
          setTimeout(() => setShowPicker(true), 400);
        }}
      />
      <FolderPicker visible={showPicker} onClose={() => setShowPicker(false)} onPick={pickFolder} />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Home />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 60 },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18 },
  date: { fontSize: 12, fontWeight: '700', letterSpacing: 1, color: colors.muted },
  title: { fontSize: 34, fontWeight: '800', letterSpacing: -0.8, color: colors.ink, marginTop: 2 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: radius.md,
    backgroundColor: colors.warnSoft,
    borderWidth: 1,
    borderColor: '#F1DFB8',
  },
  setupTitle: { fontSize: 16, fontWeight: '700', color: colors.ink },
  setupText: { fontSize: 13, color: colors.inkSoft, marginTop: 2 },
  setupBtn: { backgroundColor: colors.ink, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.pill },
  setupBtnText: { color: '#fff', fontWeight: '700' },
  folderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  folderText: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.inkSoft },
  section: { fontSize: 12, fontWeight: '700', letterSpacing: 1, color: colors.muted, marginTop: 26, marginBottom: 10 },
  recentHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  queued: { fontSize: 13, fontWeight: '600', color: colors.warn },
});
