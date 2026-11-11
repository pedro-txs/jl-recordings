import * as FileSystem from 'expo-file-system/legacy';
import { findFileId, uniqueName, uploadAudio, uploadTranscriptDoc } from './drive';
import { recordingsStore } from './recordingsStore';
import { getOpenAIKey, loadSettings, type Recording } from './storage';
import { MAX_BYTES, transcribe } from './transcribe';

/**
 * Fila de envio: áudio -> Drive, depois transcrição -> Google Docs.
 * Se não tiver internet (comum no carro), o item fica "na fila" e é reenviado
 * quando o app voltar a abrir. Cada etapa é salva, então nada é feito duas vezes.
 */
export const NO_KEY_NOTE = 'Sem chave da OpenAI';

let running = false;
let again = false;

export async function processQueue(): Promise<void> {
  if (running) {
    again = true;
    return;
  }
  running = true;
  try {
    do {
      again = false;
      const pending = recordingsStore
        .get()
        .filter((r) => r.status === 'pending')
        .reverse(); // mais antigos primeiro
      for (const r of pending) {
        await processOne(r.id);
      }
    } while (again);
  } catch {
    // sem internet: para por aqui, tenta de novo no próximo ciclo
  } finally {
    running = false;
  }
}

/** Recoloca um item com erro na fila. */
export function retry(id: string) {
  recordingsStore.update(id, { status: 'pending', error: undefined });
  void processQueue();
}

async function processOne(id: string) {
  const settings = await loadSettings();
  const r = recordingsStore.find(id);
  if (!r) return;

  if (!settings.folder) {
    recordingsStore.update(id, { status: 'error', error: 'Escolha a pasta do Drive nas configurações.' });
    return;
  }
  const folderId = settings.folder.id;

  try {
    // 1) Enviar o áudio
    let current: Recording = r;
    // Um envio anterior pode ter terminado em segundo plano sem o app ficar sabendo
    // (iOS fechou o app). Se o arquivo já está no Drive, aproveita em vez de enviar de novo.
    if (!current.driveFileId && current.uploadName) {
      const existing = await findFileId(folderId, current.uploadName);
      if (existing) {
        recordingsStore.update(id, { driveFileId: existing, driveName: current.uploadName, uploadName: undefined });
        current = recordingsStore.find(id)!;
      }
    }
    if (!current.driveFileId) {
      if (!current.localUri || !(await FileSystem.getInfoAsync(current.localUri)).exists) {
        throw new Error('O arquivo de áudio não foi encontrado no iPhone.');
      }
      recordingsStore.update(id, { status: 'uploading', error: undefined });
      const name = await uniqueName(folderId, current.baseName, '.m4a');
      recordingsStore.update(id, { uploadName: name });
      const fileId = await uploadAudio(current.localUri, name, folderId);
      recordingsStore.update(id, { driveFileId: fileId, driveName: name, uploadName: undefined });
      current = recordingsStore.find(id)!;
    }

    // 2) Transcrever
    if (!current.transcriptDocId && !current.transcriptNote) {
      const key = await getOpenAIKey();
      if (!settings.transcribe) {
        recordingsStore.update(id, { transcriptNote: 'Transcrição desligada' });
      } else if (!key) {
        recordingsStore.update(id, { transcriptNote: NO_KEY_NOTE });
      } else if (current.localUri) {
        const info = await FileSystem.getInfoAsync(current.localUri);
        if (info.exists && info.size > MAX_BYTES) {
          recordingsStore.update(id, { transcriptNote: 'Áudio longo demais para transcrever' });
        } else {
          recordingsStore.update(id, { status: 'transcribing' });
          let text = current.transcript;
          if (text === undefined) {
            text = await transcribe(current.localUri, key);
            recordingsStore.update(id, { transcript: text });
          }
          const docBase = `${(current.driveName ?? current.baseName).replace(/\.m4a$/, '')} - TRANSCRIÇÃO`;
          const docName = await uniqueName(folderId, docBase);
          const header = `${current.baseName}\nInício: ${new Date(current.startedAt).toLocaleTimeString('pt-BR')}\n\n`;
          const docId = await uploadTranscriptDoc(header + (text || '(sem fala detectada)'), docName, folderId);
          recordingsStore.update(id, { transcriptDocId: docId });
        }
      }
    }

    // 3) Tudo certo: apaga a cópia local para não lotar o iPhone
    // (sem chave da OpenAI o áudio fica guardado, para dar para transcrever depois)
    const done = recordingsStore.find(id)!;
    if (done.transcriptNote === NO_KEY_NOTE) {
      recordingsStore.update(id, { status: 'done', error: undefined });
      return;
    }
    if (done.localUri) {
      await FileSystem.deleteAsync(done.localUri, { idempotent: true });
    }
    recordingsStore.update(id, { status: 'done', localUri: null, error: undefined });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const offline = /network|internet|offline|timed out|connection/i.test(msg);
    recordingsStore.update(id, {
      status: offline ? 'pending' : 'error',
      error: offline ? 'Sem internet — envio automático quando a conexão voltar.' : msg,
    });
    if (offline) throw e; // interrompe a fila; tenta de novo depois
  }
}
