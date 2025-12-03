import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tico.bistrota',        // ← mude para algo único seu
  appName: 'MED',                  // ← nome que aparece no celular
  webDir: 'www',                        // ← normalmente "www" no Ionic
  server: {
    androidScheme: 'https'
  }
};

export default config;