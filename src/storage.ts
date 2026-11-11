import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { categoryPalette } from './theme';

export type Category = { id: string; label: string; color: string };
export type DriveFolder = { id: string; name: string };

export type Settings = {
  folder: DriveFolder | null;
  categories: Category[];
  transcribe: boolean;
};

export type RecStatus =
  | 'recording' // gravando agora
  | 'pending' // na fila para enviar
  | 'local' // guardado no iPhone, esperando conectar o Drive / escolher a pasta
  | 'uploading' // enviando o áudio
  | 'transcribing' // transcrevendo
  | 'done' // tudo certo
  | 'error'; // falhou (toque para tentar de novo)

export type Recording = {
  id: string;
  categoryLabel: string;
  color: string;
  baseName: string; // "BUSCANDO JOSÉ 04/11/2026"
  startedAt: string; // ISO
  durationMs: number;
  localUri: string | null;
  driveFileId?: string;
  driveName?: string;
  uploadName?: string; // nome escolhido para um envio que começou e ainda não foi confirmado
  transcript?: string;
  transcriptDocId?: string;
  transcriptNote?: string; // ex.: "Transcrição desligada" / "Áudio longo demais"
  status: RecStatus;
  error?: string;
};

const K_SETTINGS = 'settings.v1';
const K_RECORDINGS = 'recordings.v1';
const K_OPENAI = 'openai_api_key';

export const defaultSettings: Settings = {
  folder: null,
  transcribe: true,
  categories: [
    { id: 'buscando', label: 'Buscando José', color: categoryPalette[0] },
    { id: 'levando', label: 'Levando José', color: categoryPalette[1] },
    { id: 'visita', label: 'Visita na escola', color: categoryPalette[2] },
  ],
};

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(K_SETTINGS);
    if (!raw) return defaultSettings;
    return { ...defaultSettings, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return defaultSettings;
  }
}

export async function saveSettings(s: Settings): Promise<void> {
  await AsyncStorage.setItem(K_SETTINGS, JSON.stringify(s));
}

export async function loadRecordings(): Promise<Recording[]> {
  try {
    const raw = await AsyncStorage.getItem(K_RECORDINGS);
    return raw ? (JSON.parse(raw) as Recording[]) : [];
  } catch {
    return [];
  }
}

export async function saveRecordings(list: Recording[]): Promise<void> {
  // guarda só as 200 mais recentes no histórico
  await AsyncStorage.setItem(K_RECORDINGS, JSON.stringify(list.slice(0, 200)));
}

// A chave da OpenAI fica no Keychain do iPhone, não no armazenamento comum.
export async function getOpenAIKey(): Promise<string | null> {
  return SecureStore.getItemAsync(K_OPENAI);
}

export async function setOpenAIKey(key: string | null): Promise<void> {
  if (key && key.trim()) await SecureStore.setItemAsync(K_OPENAI, key.trim());
  else await SecureStore.deleteItemAsync(K_OPENAI);
}

export function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
