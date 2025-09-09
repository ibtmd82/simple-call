import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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

// Helper function to get config from localStorage, session storage, or environment
const getConfigFromEnv = (): SipConfig => {
  // Try localStorage first (for persistent settings)
  if (typeof window !== 'undefined') {
    const localDomain = localStorage.getItem('VITE_SIP_DOMAIN');
    const localUri = localStorage.getItem('VITE_SIP_URI');
    const localPassword = localStorage.getItem('VITE_SIP_PASSWORD');
    const localWsServer = localStorage.getItem('VITE_SIP_WS_SERVER');
    const localCallId = localStorage.getItem('VITE_SIP_CALL_ID');
    const localDisableDtls = localStorage.getItem('VITE_SIP_DISABLE_DTLS');
    const localConfigured = localStorage.getItem('VITE_SIP_CONFIGURED');
    
    // Only use localStorage config if it was explicitly saved by user
    if (localConfigured === 'true' && (localDomain || localUri || localPassword || localWsServer)) {
      return {
        domain: localDomain || '',
        uri: localUri || '',
        password: localPassword || '',
        wsServer: localWsServer || '',
        callId: localCallId || '',
        disableDtls: localDisableDtls === 'true',
      };
    }
  }
  
  // Try session storage (for runtime updates)
  if (typeof window !== 'undefined') {
    const sessionDomain = sessionStorage.getItem('VITE_SIP_DOMAIN');
    const sessionUri = sessionStorage.getItem('VITE_SIP_URI');
    const sessionPassword = sessionStorage.getItem('VITE_SIP_PASSWORD');
    const sessionWsServer = sessionStorage.getItem('VITE_SIP_WS_SERVER');
    const sessionCallId = sessionStorage.getItem('VITE_SIP_CALL_ID');
    const sessionDisableDtls = sessionStorage.getItem('VITE_SIP_DISABLE_DTLS');
    const sessionConfigured = sessionStorage.getItem('VITE_SIP_CONFIGURED');
    
    // Only use session storage config if it was explicitly saved by user
    if (sessionConfigured === 'true' && (sessionDomain || sessionUri || sessionPassword || sessionWsServer)) {
      return {
        domain: sessionDomain || '',
        uri: sessionUri || '',
        password: sessionPassword || '',
        wsServer: sessionWsServer || '',
        callId: sessionCallId || '',
        disableDtls: sessionDisableDtls === 'true',
      };
    }
  }
  
  // Don't use environment variables for auto-registration
  // Only return empty config so user must configure manually
  return {
    domain: '',
    uri: '',
    password: '',
    wsServer: '',
    callId: '',
    disableDtls: false,
  };
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      sipConfig: getConfigFromEnv(), // Initialize with environment config
      
      updateSipConfig: (config: SipConfig) => {
        set({ sipConfig: config });
      },
      
      saveSipConfig: (config: SipConfig) => {
        // Update the store
        set({ sipConfig: config });
        
        // Save to localStorage for persistence across browser sessions
        if (typeof window !== 'undefined') {
          localStorage.setItem('VITE_SIP_DOMAIN', config.domain);
          localStorage.setItem('VITE_SIP_URI', config.uri);
          localStorage.setItem('VITE_SIP_PASSWORD', config.password);
          localStorage.setItem('VITE_SIP_WS_SERVER', config.wsServer);
          localStorage.setItem('VITE_SIP_CALL_ID', config.callId || '');
          localStorage.setItem('VITE_SIP_DISABLE_DTLS', config.disableDtls ? 'true' : 'false');
          localStorage.setItem('VITE_SIP_CONFIGURED', 'true');
        }
        
        // Update session storage for runtime use
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('VITE_SIP_DOMAIN', config.domain);
          sessionStorage.setItem('VITE_SIP_URI', config.uri);
          sessionStorage.setItem('VITE_SIP_PASSWORD', config.password);
          sessionStorage.setItem('VITE_SIP_WS_SERVER', config.wsServer);
          sessionStorage.setItem('VITE_SIP_CALL_ID', config.callId || '');
          sessionStorage.setItem('VITE_SIP_DISABLE_DTLS', config.disableDtls ? 'true' : 'false');
          sessionStorage.setItem('VITE_SIP_CONFIGURED', 'true');
        }
      },
      
      resetSipConfig: () => {
        set({ sipConfig: defaultSipConfig });
        
        // Clear localStorage
        if (typeof window !== 'undefined') {
          localStorage.removeItem('VITE_SIP_DOMAIN');
          localStorage.removeItem('VITE_SIP_URI');
          localStorage.removeItem('VITE_SIP_PASSWORD');
          localStorage.removeItem('VITE_SIP_WS_SERVER');
          localStorage.removeItem('VITE_SIP_CALL_ID');
          localStorage.removeItem('VITE_SIP_DISABLE_DTLS');
          localStorage.removeItem('VITE_SIP_CONFIGURED');
        }
        
        // Clear session storage
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('VITE_SIP_DOMAIN');
          sessionStorage.removeItem('VITE_SIP_URI');
          sessionStorage.removeItem('VITE_SIP_PASSWORD');
          sessionStorage.removeItem('VITE_SIP_WS_SERVER');
          sessionStorage.removeItem('VITE_SIP_CALL_ID');
          sessionStorage.removeItem('VITE_SIP_DISABLE_DTLS');
          sessionStorage.removeItem('VITE_SIP_CONFIGURED');
        }
        
        // Load fresh config from environment
        const envConfig = getConfigFromEnv();
        set({ sipConfig: envConfig });
      },
      
      getSipConfigFromEnv: () => {
        return getConfigFromEnv();
      },
    }),
    {
      name: 'sip-settings',
      // Persist all settings to localStorage for auto-registration
      partialize: (state) => ({
        sipConfig: state.sipConfig
      }),
    }
  )
);