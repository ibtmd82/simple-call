import React from 'react';
import { DialerTabs } from './components/DialerTabs';
import { CallControls } from './components/CallControls';
import { VideoCall } from './components/VideoCall';
import { useCallStore } from './store/useCallStore';
import { useSettingsStore } from './store/useSettingsStore';
import { sipService } from './services/sipService';

function App() {
  const { status, localStream, remoteStream } = useCallStore();
  const { getSipConfigFromEnv } = useSettingsStore();

  // Auto-initialize SIP service on app load
  React.useEffect(() => {
    const initializeSip = async () => {
      try {
        const config = getSipConfigFromEnv();
        
        // Only initialize if we have valid configuration that was explicitly saved by user
        if (config.domain && config.uri && config.password && config.wsServer) {
          console.log('Auto-initializing SIP service with saved configuration:', {
            domain: config.domain,
            uri: config.uri,
            wsServer: config.wsServer,
            hasPassword: !!config.password
          });
          await sipService.connect(config);
        } else {
          console.log('No saved SIP configuration found. User must configure manually in Settings.');
        }
      } catch (error) {
        console.error('Auto-initialization failed:', error);
        // Don't show error to user for auto-initialization failures
      }
    };

    initializeSip();
  }, [getSipConfigFromEnv]);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 p-4">
      <div className="max-w-md mx-auto">
        {/* Show video call interface when there's an active call */}
        {(status === 'ringing' || status === 'connecting' || status === 'active') ? (
          <VideoCall />
        ) : (
          <DialerTabs />
        )}
        
        {/* Show call controls when there's an active call session */}
        {(status === 'ringing' || status === 'connecting' || status === 'active') && (
          <div className="mt-4">
            <CallControls />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;