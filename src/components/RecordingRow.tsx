import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { useState } from 'react';
import { Alert, Linking, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { driveDocLink, driveFileLink } from '../drive';
import { formatDuration, formatTime } from '../naming';
import { NO_KEY_NOTE, retry } from '../queue';
import { recordingsStore } from '../recordingsStore';
import type { RecStatus, Recording } from '../storage';
import { colors, radius } from '../theme';

const STATUS: Record<RecStatus, { label: string; fg: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  recording: { label: 'Gravando', fg: colors.record, bg: colors.recordSoft, icon: 'radio-button-on' },
  local: { label: 'No iPhone', fg: colors.inkSoft, bg: colors.line, icon: 'phone-portrait-outline' },
  pending: { label: 'Na fila', fg: colors.warn, bg: colors.warnSoft, icon: 'time-outline' },
  uploading: { label: 'Enviando', fg: colors.warn, bg: colors.warnSoft, icon: 'cloud-upload-outline' },
  transcribing: { label: 'Transcrevendo', fg: colors.warn, bg: colors.warnSoft, icon: 'document-text-outline' },
  done: { label: 'No Drive', fg: colors.ok, bg: colors.okSoft, icon: 'checkmark-circle' },
  error: { label: 'Erro', fg: colors.danger, bg: colors.dangerSoft, icon: 'alert-circle' },
};

export function RecordingRow({ item }: { item: Recording }) {
  const [open, setOpen] = useState(false);
  const s = STATUS[item.status];
  const started = new Date(item.startedAt);

  const remove = () =>
    Alert.alert(
      'Remover do histórico?',
      item.driveFileId
        ? 'O arquivo continua no seu Google Drive. Só sai desta lista.'
        : 'Este áudio ainda NÃO foi enviado ao Drive e será apagado do iPhone.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            if (item.localUri) await FileSystem.deleteAsync(item.localUri, { idempotent: true });
            recordingsStore.remove(item.id);
          },
        },
      ],
    );

  return (
    <Pressable onPress={() => setOpen((v) => !v)} style={styles.card}>
      <View style={[styles.bar, { backgroundColor: item.color }]} />
      <View style={{ flex: 1 }}>
        <View style={styles.top}>
          <Text style={styles.title} numberOfLines={1}>
            {(item.driveName ?? item.baseName).replace(/\.m4a$/, '')}
          </Text>
          <View style={[styles.chip, { backgroundColor: s.bg }]}>
            <Ionicons name={s.icon} size={13} color={s.fg} />
            <Text style={[styles.chipText, { color: s.fg }]}>{s.label}</Text>
          </View>
        </View>
        <Text style={styles.meta}>
          {formatTime(started)} · {formatDuration(item.durationMs)}
          {item.transcriptNote ? ` · ${item.transcriptNote}` : item.transcriptDocId ? ' · Transcrito' : ''}
        </Text>
        {item.error ? <Text style={styles.error}>{item.error}</Text> : null}
        {item.status === 'local' ? (
          <Text style={styles.localHint}>Guardado no iPhone. Vai para o Drive quando você conectar e escolher a pasta.</Text>
        ) : null}

        {open && (
          <View style={styles.details}>
            {item.transcript ? (
              <Text style={styles.transcript} selectable>
                {item.transcript || '(sem fala detectada)'}
              </Text>
            ) : null}
            <View style={styles.actions}>
              {item.driveFileId && (
                <Action icon="musical-notes-outline" label="Áudio" onPress={() => Linking.openURL(driveFileLink(item.driveFileId!))} />
              )}
              {item.localUri && item.status !== 'recording' && (
                <Action
                  icon="share-outline"
                  label="Compartilhar"
                  onPress={() => void Share.share({ url: item.localUri! }).catch(() => {})}
                />
              )}
              {item.transcriptDocId && (
                <Action icon="document-text-outline" label="Transcrição" onPress={() => Linking.openURL(driveDocLink(item.transcriptDocId!))} />
              )}
              {(item.status === 'error' || item.status === 'pending' || item.transcriptNote === NO_KEY_NOTE) && (
                <Action
                  icon="refresh"
                  label="Tentar de novo"
                  onPress={() => {
                    if (item.transcriptNote === NO_KEY_NOTE) {
                      recordingsStore.update(item.id, { transcriptNote: undefined });
                    }
                    retry(item.id);
                  }}
                />
              )}
              {item.status !== 'recording' && item.status !== 'uploading' && item.status !== 'transcribing' && (
                <Action icon="trash-outline" label="Remover" onPress={remove} danger />
              )}
            </View>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function Action(props: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; danger?: boolean }) {
  const c = props.danger ? colors.danger : colors.inkSoft;
  return (
    <Pressable onPress={props.onPress} style={({ pressed }) => [styles.action, pressed && { opacity: 0.6 }]}>
      <Ionicons name={props.icon} size={16} color={c} />
      <Text style={[styles.actionText, { color: c }]}>{props.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 14,
    paddingLeft: 12,
    borderWidth: 1,
    borderColor: colors.line,
  },
  bar: { width: 4, borderRadius: 2 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.ink },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  chipText: { fontSize: 12, fontWeight: '600' },
  meta: { fontSize: 13, color: colors.muted, marginTop: 4, fontVariant: ['tabular-nums'] },
  error: { fontSize: 13, color: colors.danger, marginTop: 6 },
  localHint: { fontSize: 13, color: colors.muted, marginTop: 6 },
  details: { marginTop: 12, gap: 12 },
  transcript: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.inkSoft,
    backgroundColor: colors.bg,
    padding: 12,
    borderRadius: radius.sm,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
  },
  actionText: { fontSize: 13, fontWeight: '600' },
});
