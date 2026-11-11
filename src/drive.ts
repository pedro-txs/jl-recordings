import { GoogleSignin, isSuccessResponse, type User } from '@react-native-google-signin/google-signin';
import * as FileSystem from 'expo-file-system/legacy';
import google from '../google-config.json';
import type { DriveFolder } from './storage';

// Escopo "drive": necessário para listar suas pastas e salvar dentro de uma pasta que já existe.
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

export function configureGoogle() {
  GoogleSignin.configure({
    iosClientId: google.iosClientId,
    scopes: [DRIVE_SCOPE],
  });
}

/** Já existe uma conta Google conectada neste iPhone? (não usa internet) */
export const hasGoogleSession = () => GoogleSignin.hasPreviousSignIn();

export async function restoreSession(): Promise<User | null> {
  if (!GoogleSignin.hasPreviousSignIn()) return null;
  const res = await GoogleSignin.signInSilently();
  return res.type === 'success' ? res.data : null;
}

export async function connectDrive(): Promise<User | null> {
  const res = await GoogleSignin.signIn();
  if (!isSuccessResponse(res)) return null;
  // garante que a permissão do Drive foi concedida
  const granted = res.data.scopes ?? [];
  if (!granted.includes(DRIVE_SCOPE)) {
    const more = await GoogleSignin.addScopes({ scopes: [DRIVE_SCOPE] });
    if (!more || !isSuccessResponse(more)) {
      throw new Error('Sem a permissão do Google Drive o app não consegue salvar os áudios.');
    }
    return more.data;
  }
  return res.data;
}

export async function disconnectDrive() {
  try {
    await GoogleSignin.revokeAccess();
  } catch {
    // ignora
  }
  await GoogleSignin.signOut();
}

/** Token de acesso válido (o SDK do Google renova sozinho quando expira). */
async function token(): Promise<string> {
  if (!GoogleSignin.getCurrentUser()) {
    const u = await restoreSession();
    if (!u) throw new Error('Conecte sua conta do Google Drive.');
  }
  const { accessToken } = await GoogleSignin.getTokens();
  return accessToken;
}

async function api<T>(url: string, init: RequestInit = {}): Promise<T> {
  const t = await token();
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${t}`, ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new DriveError(res.status, `Drive respondeu ${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

class DriveError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const q = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

/** Lista as subpastas de uma pasta ("root" = Meu Drive). */
export async function listFolders(parentId: string): Promise<DriveFolder[]> {
  const query = `'${q(parentId)}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const out: DriveFolder[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      q: query,
      orderBy: 'name',
      pageSize: '200',
      fields: 'nextPageToken, files(id, name)',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const data = await api<{ files: DriveFolder[]; nextPageToken?: string }>(`${API}/files?${params}`);
    out.push(...data.files);
    pageToken = data.nextPageToken;
  } while (pageToken);
  return out;
}

export async function createFolder(name: string, parentId: string): Promise<DriveFolder> {
  return api<DriveFolder>(`${API}/files?fields=id,name`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    }),
  });
}

export async function folderExists(id: string): Promise<boolean> {
  try {
    const f = await api<{ trashed: boolean }>(`${API}/files/${id}?fields=trashed`);
    return !f.trashed;
  } catch (e) {
    // só o 404 quer dizer "não existe"; falta de internet e outros erros sobem para quem chamou
    if (e instanceof DriveError && e.status === 404) return false;
    throw e;
  }
}

/** Id do arquivo com esse nome exato na pasta, ou null se não existir. */
export async function findFileId(folderId: string, name: string): Promise<string | null> {
  const params = new URLSearchParams({
    q: `'${q(folderId)}' in parents and name = '${q(name)}' and trashed = false`,
    fields: 'files(id)',
    pageSize: '1',
  });
  const data = await api<{ files: { id: string }[] }>(`${API}/files?${params}`);
  return data.files[0]?.id ?? null;
}

/**
 * Se já existir um arquivo com o mesmo nome na pasta (ex.: duas idas no mesmo dia),
 * devolve "NOME (2)", "NOME (3)"...
 */
export async function uniqueName(folderId: string, base: string, ext = ''): Promise<string> {
  for (let n = 1; n < 100; n++) {
    const candidate = n === 1 ? `${base}${ext}` : `${base} (${n})${ext}`;
    const params = new URLSearchParams({
      q: `'${q(folderId)}' in parents and name = '${q(candidate)}' and trashed = false`,
      fields: 'files(id)',
      pageSize: '1',
    });
    const data = await api<{ files: { id: string }[] }>(`${API}/files?${params}`);
    if (data.files.length === 0) return candidate;
  }
  return `${base} (${Date.now()})${ext}`;
}

/**
 * Envia o áudio com upload "resumable" do Drive.
 * O envio usa sessão em segundo plano do iOS, então continua mesmo se o app sair da tela.
 */
export async function uploadAudio(localUri: string, name: string, folderId: string): Promise<string> {
  const t = await token();
  const init = await fetch(`${UPLOAD}/files?uploadType=resumable&fields=id`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${t}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': 'audio/mp4',
    },
    body: JSON.stringify({ name, parents: [folderId], mimeType: 'audio/mp4' }),
  });
  const sessionUrl = init.headers.get('location') ?? init.headers.get('Location');
  if (!init.ok || !sessionUrl) {
    throw new Error(`Não consegui iniciar o envio (${init.status}).`);
  }

  const res = await FileSystem.uploadAsync(sessionUrl, localUri, {
    httpMethod: 'PUT',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    sessionType: FileSystem.FileSystemSessionType.BACKGROUND,
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'audio/mp4' },
  });
  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`Falha ao enviar o áudio (${res.status}).`);
  }
  return (JSON.parse(res.body) as { id: string }).id;
}

/** Salva a transcrição como um Google Docs na mesma pasta (abre fácil no celular). */
export async function uploadTranscriptDoc(text: string, name: string, folderId: string): Promise<string> {
  const boundary = `gravacoes${Date.now()}`;
  const metadata = {
    name,
    parents: [folderId],
    mimeType: 'application/vnd.google-apps.document', // converte o texto em Google Docs
  };
  const body =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    'Content-Type: text/plain; charset=UTF-8\r\n\r\n' +
    `${text}\r\n` +
    `--${boundary}--`;

  const data = await api<{ id: string }>(`${UPLOAD}/files?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  return data.id;
}

export const driveFileLink = (id: string) => `https://drive.google.com/file/d/${id}/view`;
export const driveDocLink = (id: string) => `https://docs.google.com/document/d/${id}/edit`;
