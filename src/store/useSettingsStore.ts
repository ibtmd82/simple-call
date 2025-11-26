import { create } from 'zustand';
import { SipConfig } from '../types';

interface SettingsState {
  sipConfig: SipConfig;
  updateSipConfig: (config: SipConfig) => void;
  saveSipConfig: (config: SipConfig) => void;
  resetSipConfig: () => void;
  getSipConfigFromEnv: () => SipConfig;
}

const defaultSipConfig: SipConfig = {
  domain: '',
  uri: '',
  password: '',
  wsServer: '',
  callId: '',
  disableDtls: false,
};

// Helper function to get config from environment variables
const getConfigFromEnv = (): SipConfig => {
  // Load configuration from environment variables
  return {
    domain: import.meta.env.VITE_SIP_DOMAIN || '',
    uri: import.meta.env.VITE_SIP_URI || '',
    password: import.meta.env.VITE_SIP_PASSWORD || '',
    wsServer: import.meta.env.VITE_SIP_WS_SERVER || '',
    callId: import.meta.env.VITE_SIP_CALL_ID || '',
    disableDtls: import.meta.env.VITE_SIP_DISABLE_DTLS === 'true',
  };
};

// Helper function to save config to .env file (simulated by updating environment variables)
const saveConfigToEnv = async (config: SipConfig): Promise<void> => {
  // In a real application, this would make an API call to update the .env file
  // For now, we'll update the environment variables in memory
  if (typeof window !== 'undefined') {
    // Update the environment variables
    (import.meta.env as any).VITE_SIP_DOMAIN = config.domain;
    (import.meta.env as any).VITE_SIP_URI = config.uri;
    (import.meta.env as any).VITE_SIP_PASSWORD = config.password;
    (import.meta.env as any).VITE_SIP_WS_SERVER = config.wsServer;
    (import.meta.env as any).VITE_SIP_CALL_ID = config.callId || '';
    (import.meta.env as any).VITE_SIP_DISABLE_DTLS = config.disableDtls ? 'true' : 'false';
    
    // Also save to localStorage as a backup
    localStorage.setItem('VITE_SIP_DOMAIN', config.domain);
    localStorage.setItem('VITE_SIP_URI', config.uri);
    localStorage.setItem('VITE_SIP_PASSWORD', config.password);
    localStorage.setItem('VITE_SIP_WS_SERVER', config.wsServer);
    localStorage.setItem('VITE_SIP_CALL_ID', config.callId || '');
    localStorage.setItem('VITE_SIP_DISABLE_DTLS', config.disableDtls ? 'true' : 'false');
  }
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  sipConfig: getConfigFromEnv(), // Initialize with environment config
  
  updateSipConfig: (config: SipConfig) => {
    set({ sipConfig: config });
  },
  
  saveSipConfig: async (config: SipConfig) => {
    // Update the store
    set({ sipConfig: config });
    
    // Save to .env file (simulated)
    await saveConfigToEnv(config);
  },
  
  resetSipConfig: () => {
    // Reset to default config
    const resetConfig = {
      domain: '',
      uri: '',
      password: '',
      wsServer: '',
      callId: '',
      disableDtls: false,
    };
    
    set({ sipConfig: resetConfig });
    
    // Clear localStorage backup
    if (typeof window !== 'undefined') {
      localStorage.removeItem('VITE_SIP_DOMAIN');
      localStorage.removeItem('VITE_SIP_URI');
      localStorage.removeItem('VITE_SIP_PASSWORD');
      localStorage.removeItem('VITE_SIP_WS_SERVER');
      localStorage.removeItem('VITE_SIP_CALL_ID');
      localStorage.removeItem('VITE_SIP_DISABLE_DTLS');
    }
  },
  
  getSipConfigFromEnv: () => {
    return getConfigFromEnv();
  },
}));