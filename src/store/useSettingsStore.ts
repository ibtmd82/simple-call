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

// Helper function to save config to localStorage and update environment variables
const saveConfigToEnv = async (config: SipConfig): Promise<void> => {
  if (typeof window !== 'undefined') {
    // Save to localStorage for persistence
    localStorage.setItem('sip-config', JSON.stringify(config));
    
    // Update environment variables in memory
    (import.meta.env as any).VITE_SIP_DOMAIN = config.domain;
    (import.meta.env as any).VITE_SIP_URI = config.uri;
    (import.meta.env as any).VITE_SIP_PASSWORD = config.password;
    (import.meta.env as any).VITE_SIP_WS_SERVER = config.wsServer;
    (import.meta.env as any).VITE_SIP_CALL_ID = config.callId || '';
    (import.meta.env as any).VITE_SIP_DISABLE_DTLS = config.disableDtls ? 'true' : 'false';
    
    console.log('SIP configuration saved to localStorage and environment variables');
  }
};

// Helper function to load config from localStorage first, then environment
const loadConfigFromStorage = (): SipConfig => {
  if (typeof window !== 'undefined') {
    try {
      const savedConfig = localStorage.getItem('sip-config');
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        console.log('Loaded SIP config from localStorage:', {
          domain: parsed.domain,
          uri: parsed.uri,
          wsServer: parsed.wsServer,
          hasPassword: !!parsed.password,
        });
        return parsed;
      }
    } catch (error) {
      console.error('Error loading config from localStorage:', error);
    }
  }
  
  // Fallback to environment variables
  return getConfigFromEnv();
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  sipConfig: loadConfigFromStorage(), // Initialize with saved config or environment config
  
  updateSipConfig: (config: SipConfig) => {
    set({ sipConfig: config });
  },
  
  saveSipConfig: (config: SipConfig) => {
    // Update the store
    set({ sipConfig: config });
    
    // Save to localStorage and update environment variables
    saveConfigToEnv(config);
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
    
    // Clear saved configuration
    if (typeof window !== 'undefined') {
      localStorage.removeItem('sip-config');
    }
  },
  
  getSipConfigFromEnv: () => {
    return getConfigFromEnv();
  },
}));