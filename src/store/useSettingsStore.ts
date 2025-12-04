import { create } from 'zustand';
import { SipConfig } from '../types';

interface UserCredentials {
  uri: string;
  password: string;
}

interface SettingsState {
  sipConfig: SipConfig;
  updateSipConfig: (config: SipConfig) => void;
  saveSipConfig: (config: SipConfig) => void;
  saveUserCredentials: (uri: string, password: string) => void;
  loadUserCredentials: () => Promise<UserCredentials | null>;
  resetSipConfig: () => void;
  getSipConfigFromEnv: () => SipConfig;
}

// Helper function to get config from environment variables (excluding username/password)
// domain, wsServer, callId always come from .env
// disableDtls is always false (DTLS always enabled)
const getConfigFromEnv = (): Omit<SipConfig, 'uri' | 'password'> => {
  const config: Omit<SipConfig, 'uri' | 'password'> = {
    domain: import.meta.env.VITE_SIP_DOMAIN || '',
    wsServer: import.meta.env.VITE_SIP_WS_SERVER || '',
    callId: import.meta.env.VITE_SIP_CALL_ID || '',
    disableDtls: false, // Always enabled
  };
  
  return config;
};

// Helper function to load user credentials from localStorage only
const loadUserCredentialsFromStorage = (): UserCredentials | null => {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('sip-credentials');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.uri && parsed.password) {
          console.log('Loaded user credentials from localStorage');
          return parsed;
        }
      }
    } catch (error) {
      console.error('Error loading credentials from localStorage:', error);
    }
  }
  
  return null;
};

// Helper function to save config to localStorage (nothing to save, domain/wsServer/callId come from .env)
// DTLS is always enabled, so we don't save it
const saveConfigToStorage = (): void => {
  // Nothing to save - domain, wsServer, callId come from .env
  // DTLS is always enabled (disableDtls: false)
  // We can clear any old saved config
  if (typeof window !== 'undefined') {
    try {
      // Clear old config if it exists (no longer needed)
      localStorage.removeItem('sip-config');
      console.log('SIP configuration: domain, wsServer, callId loaded from .env only');
    } catch (error) {
      console.error('Error clearing old config from localStorage:', error);
    }
  }
};

// Helper function to save user credentials
const saveUserCredentialsToStorage = (uri: string, password: string): void => {
  if (typeof window !== 'undefined') {
    try {
      const credentials = { uri, password };
      localStorage.setItem('sip-credentials', JSON.stringify(credentials));
      console.log('User credentials saved to localStorage');
    } catch (error) {
      console.error('Error saving credentials to localStorage:', error);
      throw error;
    }
  }
};

// Initialize with sync config from .env (credentials will be loaded async)
const getInitialConfig = (): SipConfig => {
  const envConfig = getConfigFromEnv();
  return {
    ...envConfig,
    uri: '',
    password: '',
  };
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  sipConfig: getInitialConfig(),
  
  updateSipConfig: (config: SipConfig) => {
    set({ sipConfig: config });
  },
  
  saveSipConfig: (config: SipConfig) => {
    // Separate credentials from other config
    const { uri, password } = config;
    
    // Build config from .env (domain, wsServer, callId always from .env)
    // DTLS is always enabled (disableDtls: false)
    const normalizedConfig: Omit<SipConfig, 'uri' | 'password'> = {
      domain: import.meta.env.VITE_SIP_DOMAIN || '', // Always from .env
      wsServer: import.meta.env.VITE_SIP_WS_SERVER || '', // Always from .env
      callId: import.meta.env.VITE_SIP_CALL_ID || '', // Always from .env
      disableDtls: false, // Always enabled
    };
    
    // Save credentials separately
    if (uri && password) {
      saveUserCredentialsToStorage(uri, password);
    }
    
    // Nothing to save to localStorage (domain/wsServer/callId come from .env)
    saveConfigToStorage();
    
    // Update the store with complete config (from .env + credentials)
    set({ 
      sipConfig: {
        ...normalizedConfig,
        uri: uri || '',
        password: password || '',
      }
    });
  },
  
  saveUserCredentials: (uri: string, password: string) => {
    saveUserCredentialsToStorage(uri, password);
    
    // Update the store
    const currentConfig = get().sipConfig;
    set({ 
      sipConfig: {
        ...currentConfig,
        uri,
        password,
      }
    });
  },
  
  loadUserCredentials: async () => {
    const credentials = loadUserCredentialsFromStorage();
    if (credentials) {
      // Update store with loaded credentials
      const currentConfig = get().sipConfig;
      set({ 
        sipConfig: {
          ...currentConfig,
          uri: credentials.uri,
          password: credentials.password,
        }
      });
    }
    return credentials;
  },
  
  resetSipConfig: () => {
    // Reset to default config from .env (excluding credentials)
    const envConfig = getConfigFromEnv();
    const resetConfig: SipConfig = {
      ...envConfig,
      uri: '',
      password: '',
    };
    
    set({ sipConfig: resetConfig });
    
    // Clear saved configuration
    if (typeof window !== 'undefined') {
      localStorage.removeItem('sip-config');
      localStorage.removeItem('sip-credentials');
    }
  },
  
  getSipConfigFromEnv: () => {
    const envConfig = getConfigFromEnv();
    const currentConfig = get().sipConfig;
    return {
      ...envConfig,
      uri: currentConfig.uri,
      password: currentConfig.password,
    };
  },
}));