import { useSyncExternalStore } from 'react';
import { loadRecordings, saveRecordings, type Recording } from './storage';

// Pequeno "store" compartilhado entre a tela e a fila de envio.
let items: Recording[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
  void saveRecordings(items);
}

export const recordingsStore = {
  async init() {
    items = await loadRecordings();
    items = items.map((r) => {
      // App fechado no meio de um envio/transcrição: recoloca na fila.
      if (r.status === 'uploading' || r.status === 'transcribing') return { ...r, status: 'pending' as const };
      // App fechado no meio da GRAVAÇÃO: o arquivo não foi finalizado e pode não tocar.
      // Não envia sozinho; fica como erro e a pessoa decide (Tentar de novo / Remover).
      if (r.status === 'recording') {
        return {
          ...r,
          status: 'error' as const,
          error: 'O app fechou durante a gravação. O áudio pode estar incompleto — toque em "Tentar de novo" para enviar mesmo assim.',
        };
      }
      return r;
    });
    emit();
  },
  get: () => items,
  find: (id: string) => items.find((r) => r.id === id),
  add(r: Recording) {
    items = [r, ...items];
    emit();
  },
  update(id: string, patch: Partial<Recording>) {
    items = items.map((r) => (r.id === id ? { ...r, ...patch } : r));
    emit();
  },
  remove(id: string) {
    items = items.filter((r) => r.id !== id);
    emit();
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};

export function useRecordings(): Recording[] {
  return useSyncExternalStore(recordingsStore.subscribe, recordingsStore.get, recordingsStore.get);
}
