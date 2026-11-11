import type { ExpoConfig } from 'expo/config';
import google from './google-config.json';

// O "URL scheme" do login do Google é o ID do cliente iOS ao contrário:
// 1234-abc.apps.googleusercontent.com  ->  com.googleusercontent.apps.1234-abc
const iosUrlScheme = google.iosClientId.split('.').reverse().join('.');

const config: ExpoConfig = {
  name: 'Gravações',
  slug: 'gravacoes-jose',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  ios: {
    bundleIdentifier: 'com.txsolucoes.gravacoes',
    supportsTablet: false,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  extra: { eas: { projectId: '48e212d7-2518-4f25-be73-e75d5a2ecfd7' } },
  owner: 'pedro-txs',
  plugins: [
    [
      'expo-audio',
      {
        microphonePermission:
          'O app usa o microfone para gravar os áudios dos trajetos e visitas.',
        // Mantém a gravação rodando com a tela bloqueada (UIBackgroundModes: audio)
        enableBackgroundRecording: true,
        enableBackgroundPlayback: false,
      },
    ],
    ['@react-native-google-signin/google-signin', { iosUrlScheme }],
    'expo-secure-store',
  ],
};

export default config;
