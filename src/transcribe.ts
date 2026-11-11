import * as FileSystem from 'expo-file-system/legacy';

// Transcrição pela API da OpenAI (Whisper). Ótima em português e barata.
// Limite da API: 25 MB por arquivo. Com a qualidade de voz usada no app (≈ 32 kbps),
// isso dá mais de 1h30 de áudio.
const ENDPOINT = 'https://api.openai.com/v1/audio/transcriptions';
const MODEL = 'whisper-1';
export const MAX_BYTES = 25 * 1024 * 1024;

export async function transcribe(localUri: string, apiKey: string): Promise<string> {
  const res = await FileSystem.uploadAsync(ENDPOINT, localUri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    sessionType: FileSystem.FileSystemSessionType.BACKGROUND,
    fieldName: 'file',
    mimeType: 'audio/m4a',
    headers: { Authorization: `Bearer ${apiKey}` },
    parameters: {
      model: MODEL,
      language: 'pt',
      response_format: 'text',
    },
  });

  if (res.status !== 200) {
    let msg = res.body;
    try {
      msg = (JSON.parse(res.body) as { error?: { message?: string } }).error?.message ?? res.body;
    } catch {
      // corpo não é JSON
    }
    if (res.status === 401) throw new Error('Chave da OpenAI inválida. Confira nas configurações.');
    if (res.status === 429) throw new Error('Sem crédito ou limite atingido na OpenAI.');
    throw new Error(`Transcrição falhou (${res.status}): ${msg.slice(0, 160)}`);
  }
  return res.body.trim();
}
