import React from 'react';
import { DialerTabs } from './components/DialerTabs';
import { CallControls } from './components/CallControls';
import { VideoCall } from './components/VideoCall';
import { useCallStore } from './store/useCallStore';
import { useSettingsStore } from './store/useSettingsStore';
import { sipService } from './services/sipService';
import { CallStatus } from './types/index';

function App() {
  const { status, localStream, remoteStream, setStatus } = useCallStore();
  const { getSipConfigFromEnv } = useSettingsStore();

  React.useEffect(() => {
    const initializeSip = async () => {
      try {
        // Always load fresh config from environment on app start
        const config = getSipConfigFromEnv();
        console.log('Loading SIP config from environment:', {
          domain: config.domain,
          uri: config.uri,
          wsServer: config.wsServer,
          callId: config.callId,
          disableDtls: config.disableDtls,
          hasPassword: !!config.password,
        });
        
        if (config.domain && config.uri && config.password && config.wsServer) {
          console.log('Auto-initializing SIP service with environment configuration');
          // Set up event listeners before connecting
          sipService.onStateChanged(setStatus);
          sipService.onRemoteStreamChanged(setRemoteStream);
          await sipService.connect(config);
        } else {
          console.log('Incomplete SIP configuration in environment. User must configure manually in Settings.');
          setStatus(CallStatus.IDLE);
        }
      } catch (error) {
        console.error('Auto-initialization failed:', error);
        setStatus(CallStatus.FAILED);
      }
    };

    initializeSip();
  }, [getSipConfigFromEnv, setStatus, setRemoteStream]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 p-4">
      <div className="max-w-md mx-auto">
        {(status === CallStatus.RINGING || status === CallStatus.CONNECTING || status === CallStatus.ACTIVE) ? (
          <VideoCall />
        ) : (
          <DialerTabs />
        )}
        {(status === CallStatus.RINGING || status === CallStatus.CONNECTING || status === CallStatus.ACTIVE) && (
          <div className="mt-4">
            <CallControls />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;