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
        const config = getSipConfigFromEnv();
        if (config.domain && config.uri && config.password && config.wsServer) {
          console.log('Auto-initializing SIP service with saved configuration:', {
            domain: config.domain,
            uri: config.uri,
            wsServer: config.wsServer,
            callId: config.callId,
            disableDtls: config.disableDtls,
            hasPassword: !!config.password,
          });
          await sipService.connect(config);
        } else {
          console.log('No saved SIP configuration found. User must configure manually in Settings.');
          setStatus(CallStatus.IDLE);
        }
      } catch (error) {
        console.error('Auto-initialization failed:', error);
        setStatus(CallStatus.FAILED);
      }
    };

    initializeSip();
  }, [getSipConfigFromEnv, setStatus]);

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