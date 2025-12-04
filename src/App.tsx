import React from 'react';
import { DialerTabs } from './components/DialerTabs';
import { CallControls } from './components/CallControls';
import { VideoCall } from './components/VideoCall';
import { useCallStore } from './store/useCallStore';
import { useSettingsStore } from './store/useSettingsStore';
import { sipService } from './services/sipService';
import { CallStatus } from './types/index';

function App() {
  const { status, localStream, remoteStream, setStatus, setRemoteStream, setLocalStream, toggleVideo } = useCallStore();
  const { sipConfig, loadUserCredentials } = useSettingsStore();
  const [isConfigLoaded, setIsConfigLoaded] = React.useState(false);

  // Initialize SIP on mount
  React.useEffect(() => {
    const initializeSip = async () => {
      try {
        // Load user credentials from localStorage if not already loaded
        if (!sipConfig.uri || !sipConfig.password) {
          const credentials = await loadUserCredentials();
          if (credentials) {
            // Credentials will be loaded into store by loadUserCredentials
            // Wait a bit for store to update
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }

        // Get the latest config from store (includes .env config + credentials from localStorage)
        const config = sipConfig;
        console.log('Loading SIP config from .env and localStorage:', {
          domain: config.domain,
          uri: config.uri,
          wsServer: config.wsServer,
          callId: config.callId,
          disableDtls: config.disableDtls,
          hasPassword: !!config.password,
        });
        
        if (config.domain && config.uri && config.password && config.wsServer) {
          console.log('Auto-initializing SIP service with configuration from .env and localStorage');
          // Set up event listeners before connecting
          sipService.onStateChanged(setStatus);
          sipService.onRemoteStreamChanged(setRemoteStream);
          sipService.onLocalStreamChanged((stream) => {
            setLocalStream(stream);
            // Auto-enable video if stream has video tracks
            if (stream && stream.getVideoTracks().length > 0) {
              const hasEnabledVideo = stream.getVideoTracks().some(track => track.enabled);
              if (hasEnabledVideo) {
                // Only toggle if video is currently disabled
                const currentState = useCallStore.getState().isVideoEnabled;
                if (!currentState) {
                  toggleVideo(); // This will set isVideoEnabled to true
                }
              }
            }
          });
          await sipService.connect(config);
        } else {
          console.log('Incomplete SIP configuration. User must configure manually in Settings.');
          setStatus(CallStatus.IDLE);
        }
        setIsConfigLoaded(true);
      } catch (error) {
        console.error('Auto-initialization failed:', error);
        setStatus(CallStatus.FAILED);
        setIsConfigLoaded(true);
      }
    };

    if (!isConfigLoaded) {
      initializeSip();
    }
  }, [sipConfig, loadUserCredentials, setStatus, setRemoteStream, setLocalStream, isConfigLoaded]);

  // Auto-register when status becomes IDLE and not in a call
  React.useEffect(() => {
    const checkAndAutoRegister = async () => {
      // Only auto-register if:
      // - Status is IDLE or UNREGISTERED
      // - Not in a call (not CALLING, RINGING, ACTIVE, INCOMING)
      // - Config is loaded
      // - We have valid SIP config
      const isIdleState = status === CallStatus.IDLE || status === CallStatus.UNREGISTERED;
      const isNotInCall = status !== CallStatus.CALLING && 
                          status !== CallStatus.RINGING && 
                          status !== CallStatus.ACTIVE && 
                          status !== CallStatus.INCOMING &&
                          status !== CallStatus.CONNECTING;
      
      if (isConfigLoaded && isIdleState && isNotInCall && 
          sipConfig.domain && sipConfig.uri && sipConfig.password && sipConfig.wsServer) {
        console.log('Status is idle, checking if auto-registration is needed...');
        // The sipService will handle auto-registration internally
        // This effect just ensures we trigger it when status changes to IDLE
        try {
          await sipService.ensureRegistered();
        } catch (error) {
          console.error('Auto-registration check failed:', error);
        }
      }
    };

    // Small delay to avoid race conditions
    const timeoutId = setTimeout(checkAndAutoRegister, 500);
    return () => clearTimeout(timeoutId);
  }, [status, isConfigLoaded, sipConfig]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 safe-area-top safe-area-bottom">
      <div className="w-full max-w-md mx-auto px-2 sm:px-4 py-2 sm:py-4">
        {(status === CallStatus.CALLING || status === CallStatus.RINGING || status === CallStatus.CONNECTING || status === CallStatus.ACTIVE || status === CallStatus.INCOMING || status === CallStatus.ENDED) ? (
          <>
            <VideoCall />
            <div className="mt-2 sm:mt-4">
              <CallControls />
            </div>
          </>
        ) : (
          <DialerTabs />
        )}
      </div>
    </div>
  );
}

export default App;