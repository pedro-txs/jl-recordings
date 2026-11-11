import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDuration } from '../naming';
import { colors, radius } from '../theme';

type Props = {
  fileName: string | null; // "BUSCANDO JOSÉ 04/11/2026" ou null se não escolheu descrição
  accent: string;
  recording: boolean;
  paused: boolean; // iOS pausou (ex.: ligação)
  durationMs: number;
  shake: Animated.Value;
  onPress: () => void;
  onResume: () => void;
};

export function RecordPanel({ fileName, accent, recording, paused, durationMs, shake, onPress, onResume }: Props) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!recording || paused) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [recording, paused, pulse]);

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });
  const translateX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-10, 10] });

  return (
    <View style={styles.card}>
      <Text style={styles.caption}>SERÁ SALVO COMO</Text>
      <Animated.View style={{ transform: [{ translateX }] }}>
        {fileName ? (
          <Text style={[styles.fileName, { color: accent }]} numberOfLines={2}>
            {fileName}
            <Text style={styles.ext}>.m4a</Text>
          </Text>
        ) : (
          <Text style={styles.placeholder}>Escolha a descrição do áudio acima</Text>
        )}
      </Animated.View>

      <Text style={[styles.timer, recording && { color: colors.ink }]}>{formatDuration(durationMs)}</Text>

      <View style={styles.statusLine}>
        {recording ? (
          paused ? (
            <Pressable onPress={onResume} style={styles.resume}>
              <Ionicons name="play" size={14} color={colors.warn} />
              <Text style={styles.resumeText}>Gravação pausada pelo iPhone — toque para continuar</Text>
            </Pressable>
          ) : (
            <>
              <View style={styles.liveDot} />
              <Text style={styles.statusText}>Gravando · pode bloquear a tela</Text>
            </>
          )
        ) : (
          <Text style={styles.statusText}>{fileName ? 'Toque para gravar' : ' '}</Text>
        )}
      </View>

      <View style={styles.buttonWrap}>
        {recording && !paused && (
          <Animated.View
            pointerEvents="none"
            style={[styles.ring, { transform: [{ scale: ringScale }], opacity: ringOpacity }]}
          />
        )}
        <Pressable
          onPress={onPress}
          accessibilityLabel={recording ? 'Parar gravação' : 'Iniciar gravação'}
          style={({ pressed }) => [styles.button, pressed && { transform: [{ scale: 0.96 }] }]}
        >
          <View style={recording ? styles.stopIcon : [styles.recIcon, !fileName && { opacity: 0.35 }]} />
        </Pressable>
      </View>
    </View>
  );
}

const BTN = 88;

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
  },
  caption: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, color: colors.muted, marginBottom: 6 },
  fileName: { fontSize: 18, fontWeight: '700', textAlign: 'center', letterSpacing: 0.2 },
  ext: { color: colors.muted, fontWeight: '500' },
  placeholder: { fontSize: 16, color: colors.muted, textAlign: 'center' },
  timer: {
    fontSize: 60,
    fontWeight: '200',
    color: colors.muted,
    marginTop: 14,
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 24, marginBottom: 18 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.record },
  statusText: { fontSize: 14, color: colors.muted },
  resume: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.warnSoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  resumeText: { fontSize: 13, color: colors.warn, fontWeight: '600' },
  buttonWrap: { width: BTN + 40, height: BTN + 40, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: BTN + 24,
    height: BTN + 24,
    borderRadius: (BTN + 24) / 2,
    backgroundColor: colors.record,
  },
  button: {
    width: BTN,
    height: BTN,
    borderRadius: BTN / 2,
    borderWidth: 5,
    borderColor: colors.recordSoft,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.record,
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  recIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.record },
  stopIcon: { width: 30, height: 30, borderRadius: 8, backgroundColor: colors.record },
});
