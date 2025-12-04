import { UserAgent, Session, UserAgentDelegate, Registerer, URI, Inviter, Invitation } from 'sip.js';
import { CallStatus, SipConfig } from '../types/index';

export class SIPService {
  private ua: UserAgent | null = null;
  private registerer: Registerer | null = null;
  private currentSession: Session | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private isExplicitlyDisconnecting = false;
  private isReregistering = false;
  private isAutoRegistering = false;
  private lastSipConfig: SipConfig | null = null;
  private isCleaningUp = false;
  private isHangingUp = false;
  private onStateChange?: (state: CallStatus) => void;
  private onRemoteStreamChange?: (stream: MediaStream | null) => void;
  private onLocalStreamChange?: (stream: MediaStream | null) => void;

  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Các trình nghe sự kiện sẽ được thiết lập khi tạo UA
  }

  async connect(config: SipConfig): Promise<void> {
    try {
      // Store config early so it's available for reconnection even if connection fails
      this.lastSipConfig = config;
      
      // Kiểm tra đầu vào cấu hình
      if (!config.uri || !config.domain || !config.wsServer) {
        console.error('Cấu hình SIP không hợp lệ:', {
          uri: config.uri,
          domain: config.domain,
          wsServer: config.wsServer,
        });
        throw new Error('Cấu hình SIP không hợp lệ: yêu cầu uri, domain và wsServer');
      }

      console.log('Đang kết nối đến máy chủ SIP với cấu hình:', {
        server: config.wsServer,
        username: config.uri,
        domain: config.domain,
        callId: config.callId,
        disableDtls: config.disableDtls,
        password: config.password ? '[ẨN]' : 'Không cung cấp',
      });

      if (this.ua) {
        // Only clear existing UA if we're explicitly reconnecting or if it's not working
        const isWorking = this.ua.isConnected() && this.registerer && 
          (this.registerer.state === 'Registered' || String(this.registerer.state).includes('Registered'));
        
        if (!isWorking || this.isExplicitlyDisconnecting) {
        console.log('Ngắt kết nối UA hiện tại trước khi kết nối lại...');
        this.isExplicitlyDisconnecting = true;
        if (this.registerer) {
          console.log('Đang hủy đăng ký Registerer...');
            try {
          await this.registerer.unregister();
            } catch (error) {
              console.warn('Error unregistering:', error);
            }
        }
        console.log('Đang dừng UserAgent...');
          try {
        await this.ua.stop();
          } catch (error) {
            console.warn('Error stopping UA:', error);
          }
        this.ua = null;
        this.registerer = null;
        } else {
          console.log('UA đang hoạt động, không cần kết nối lại');
          return; // UA is already working, no need to reconnect
        }
      }

      const uaConfig = {
        uri: new URI('sip', config.uri, config.domain), // Tạo đối tượng URI
        transportOptions: {
          server: config.wsServer,
          connectionTimeout: 10000,
          maxReconnectionAttempts: 3,
          reconnectionTimeout: 4000,
        },
        authorizationUser: config.uri,
        password: config.password || '',
        displayName: config.displayName || config.uri,
        register: false,
        registerExpires: 600,
        sessionDescriptionHandlerFactoryOptions: { 
          // DTLS is always enabled for WebRTC compatibility
          disableDtls: false,
          peerConnectionConfiguration: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
            ],
            rtcpMuxPolicy: 'require',
          },
        },
        userAgentString: 'SIP.js/0.21.2',
        logLevel: 'debug' as any,
      };
      console.log('Tạo UA với cấu hình:', {
        ...uaConfig,
        uri: uaConfig.uri.toString(),
        userAgentString: 'WebRTC-SIP-Client/1.0',
        traceSip: false,
        logLevel: 'error',
      }
      )

      this.ua = new UserAgent(uaConfig);

      this.ua.delegate = {
        onInvite: (session: Session) => {
          console.log('Phiên RTC mới:', session);
          this.handleIncomingCall(session);
        },
        onConnect: () => {
          console.log('Đã kết nối đến máy chủ SIP');
          // Ensure UA is still set (it should be, but verify)
          if (!this.ua) {
            console.error('⚠️ UA is null in onConnect - this should not happen');
          }
          this.onStateChange?.(CallStatus.REGISTERED);
        },
        onDisconnect: () => {
          console.log('Đã ngắt kết nối khỏi máy chủ SIP');
          // CRITICAL: If we're in a call and connection is lost, show state transitions and clean up
          // This ensures camera is released even if session doesn't terminate immediately
          // But skip if hangup was already called (prevents duplicate state transitions)
          if (this.isHangingUp) {
            console.log('⚠️ Hangup already in progress, skipping onDisconnect handler');
            return;
          }
          
          // Only clean up if the call is actually established (not just in "Establishing" state)
          // This prevents cleanup during call setup when WebSocket temporarily closes
          const isEstablishedCall = this.currentSession && 
                                    this.currentSession.state === 'Established';
          
          if (isEstablishedCall && this.localStream) {
            console.log('⚠️ Connection lost during established call - cleaning up');
            
            // Simple cleanup - no retry logic, no camera checks
            // Stop local stream tracks
            if (this.localStream) {
              this.localStream.getTracks().forEach(track => {
                track.stop();
              });
              this.localStream = null;
              this.onLocalStreamChange?.(null);
            }
            
            // Clear video elements
            const videoElements = document.querySelectorAll('video');
            videoElements.forEach(videoEl => {
              if (videoEl.srcObject) {
                videoEl.srcObject = null;
              }
            });
            
            // Cleanup peer connection and session
            this.cleanupLocalStream();
            this.cleanup();
            
            // Clear session reference
            this.currentSession = null;
            
            // Transition to IDLE immediately - no waiting, no retries
            console.log('✅ Cleanup complete after connection loss, transitioning to IDLE');
            this.onStateChange?.(CallStatus.IDLE);
          } else if (this.currentSession && this.currentSession.state === 'Establishing') {
            // Call is still being set up - don't clean up, let SIP.js handle reconnection
            console.log('⚠️ Connection lost during call setup - waiting for reconnection, not cleaning up');
          }
          
          // Don't clear UA during automatic reconnection - SIP.js will handle reconnection
          // Only update status if we're not explicitly disconnecting
          if (!this.isExplicitlyDisconnecting) {
            // UA should still exist during reconnection, just update status
            this.onStateChange?.(CallStatus.UNREGISTERED);
            // SIP.js will automatically reconnect, so we don't need to do anything here
          }
        },
        onTransportError: (error: Error) => {
          console.error('Transport error:', error);
          // CRITICAL: If we're in a call and transport error occurs, clean up local stream
          if (this.isInCall() && this.localStream) {
            console.log('⚠️ Transport error during active call - cleaning up local stream');
            this.cleanupLocalStream();
          }
          this.onStateChange?.(CallStatus.FAILED);
        },
      } as UserAgentDelegate;

      this.registerer = new Registerer(this.ua, {
      });

      this.registerer.stateChange.addListener((state) => {
        console.log(`Trạng thái Registerer thay đổi: ${state}`);
        switch (state) {
          case 'Registered':
            this.isReregistering = false;
            this.isAutoRegistering = false;
            console.log('✅ Registerer is now Registered, updating status to REGISTERED');
            this.onStateChange?.(CallStatus.REGISTERED);
            break;
          case 'Unregistered':
            if (!this.isExplicitlyDisconnecting && !this.isReregistering && !this.isAutoRegistering) {
              console.log('Đã hủy đăng ký khỏi máy chủ SIP');
              this.onStateChange?.(CallStatus.UNREGISTERED);
              // Only auto-reregister if not in a call
              if (!this.isInCall()) {
              console.log('Hủy đăng ký không mong muốn, đang thử đăng ký lại...');
              this.isReregistering = true;
              setTimeout(() => {
                  if (this.registerer && !this.isExplicitlyDisconnecting && !this.isInCall()) {
                  try {
                    this.registerer.register();
                  } catch (error) {
                    console.error('Đăng ký lại thất bại:', error);
                    this.isReregistering = false;
                    this.onStateChange?.(CallStatus.FAILED);
                  }
                  } else {
                    this.isReregistering = false;
                }
              }, 2000);
              }
            }
            break;
          case 'Terminated':
            this.onStateChange?.(CallStatus.ENDED);
            break;
        }
      });

      console.log('Bắt đầu khởi động UserAgent...');
      await this.ua.start();
      
      // Wait for connection before registering
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000);
        
        if (this.ua?.isConnected()) {
          clearTimeout(timeout);
          resolve();
        } else {
          const checkConnection = () => {
            if (this.ua?.isConnected()) {
              clearTimeout(timeout);
              resolve();
            } else {
              setTimeout(checkConnection, 100);
            }
          };
          checkConnection();
        }
      });
      
      console.log('Bắt đầu đăng ký Registerer...');
      await this.registerer.register();
      console.log('Đã đăng ký thành công');
      this.isExplicitlyDisconnecting = false;
      // lastSipConfig is already set at the beginning of connect()

    } catch (error) {
      console.error('Kết nối đến máy chủ SIP thất bại:', error);
      this.onStateChange?.(CallStatus.FAILED);
      
      // Clean up on connection failure
      if (this.ua) {
        try {
          // When ua.start() fails, the UserAgent is already unusable
          // No need to call stop() as it may already be stopped
        } catch (stopError) {
          console.error('Error stopping UA after connection failure:', stopError);
        }
        this.ua = null;
      }
      this.registerer = null;
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('WebSocket closed') || error.message.includes('1006')) {
          throw new Error('Không thể kết nối đến máy chủ SIP. Vui lòng kiểm tra:\n1. URL WebSocket Server có đúng không (hiện tại: ' + config.wsServer + ')\n2. Máy chủ SIP có đang hoạt động không\n3. Firewall có chặn kết nối không\n4. Chứng chỉ SSL có hợp lệ không (nếu dùng wss://)');
        } else if (error.message.includes('timeout')) {
          throw new Error('Kết nối bị timeout. Vui lòng kiểm tra kết nối mạng và thử lại.');
        }
      }
      throw new Error(`Lỗi kết nối: ${error instanceof Error ? error.message : 'Lỗi không xác định'}`);
    }
  }

  async disconnect(): Promise<void> {
    console.log('Ngắt kết nối khỏi máy chủ SIP...');
    this.isExplicitlyDisconnecting = true;

    if (this.currentSession) {
      await this.currentSession.terminate();
      this.currentSession = null;
    }

    if (this.registerer) {
      await this.registerer.unregister();
      this.registerer = null;
    }

    if (this.ua) {
      await this.ua.stop();
      this.ua = null;
    }

    this.cleanup();
    this.onStateChange?.(CallStatus.IDLE);
  }

  private getConfigFromStorage(): SipConfig | null {
    try {
      // Get config from environment variables
      const domain = import.meta.env.VITE_SIP_DOMAIN || '';
      const wsServer = import.meta.env.VITE_SIP_WS_SERVER || '';
      const callId = import.meta.env.VITE_SIP_CALL_ID || '';
      
      if (!domain || !wsServer) {
        console.warn('Environment variables not set for SIP config');
        return null;
      }
      
      // Get credentials from localStorage
      let uri = '';
      let password = '';
      if (typeof window !== 'undefined') {
        try {
          const saved = localStorage.getItem('sip-credentials');
          if (saved) {
            const parsed = JSON.parse(saved);
            uri = parsed.uri || '';
            password = parsed.password || '';
          }
        } catch (error) {
          console.warn('Error loading credentials from localStorage:', error);
        }
      }
      
      if (!uri || !password) {
        console.warn('Credentials not found in localStorage');
        return null;
      }
      
      return {
        domain,
        wsServer,
        callId,
        uri,
        password,
        disableDtls: false, // Always enabled
      };
    } catch (error) {
      console.error('Error getting config from storage:', error);
      return null;
    }
  }

  async makeCall(number: string, video: boolean = true): Promise<void> {
    // CRITICAL: Check if hangup/cleanup is in progress - wait for it to complete
    if (this.isHangingUp) {
      console.warn('⚠️ Cannot make call: hangup is in progress, waiting...');
      // Wait for hangup to complete (max 3 seconds)
      let waitCount = 0;
      while (this.isHangingUp && waitCount < 30) {
        await new Promise(resolve => setTimeout(resolve, 100));
        waitCount++;
      }
      if (this.isHangingUp) {
        console.error('❌ Cannot make call: hangup is still in progress after waiting');
        throw new Error('Cannot make call: previous call is still ending');
      }
    }
    
    // CRITICAL: Check if there's an active session that's not terminated
    if (this.currentSession && this.currentSession.state !== 'Terminated') {
      console.warn('⚠️ Cannot make call: there is an active session', {
        sessionState: this.currentSession.state,
        sessionType: this.currentSession instanceof Inviter ? 'Inviter' : 'Invitation'
      });
      throw new Error('Cannot make call: there is already an active call');
    }
    
    // Clear any terminated session reference before starting new call
    if (this.currentSession && this.currentSession.state === 'Terminated') {
      console.log('Clearing terminated session reference before starting new call');
      this.currentSession = null;
    }
    
    // Reset cleanup flag when starting a new call
    this.isCleaningUp = false;
    
    if (!this.ua) {
      console.error('makeCall: UA is null', {
        hasLastSipConfig: !!this.lastSipConfig,
        isExplicitlyDisconnecting: this.isExplicitlyDisconnecting,
        lastSipConfig: this.lastSipConfig ? {
          uri: this.lastSipConfig.uri,
          domain: this.lastSipConfig.domain,
          wsServer: this.lastSipConfig.wsServer,
          hasPassword: !!this.lastSipConfig.password
        } : null
      });
      
      // Try to get config from storage if lastSipConfig is null
      let configToUse = this.lastSipConfig;
      if (!configToUse && !this.isExplicitlyDisconnecting) {
        console.log('lastSipConfig is null, trying to load from storage...');
        configToUse = this.getConfigFromStorage();
        if (configToUse) {
          console.log('✅ Loaded config from storage:', {
            uri: configToUse.uri,
            domain: configToUse.domain,
            wsServer: configToUse.wsServer,
            hasPassword: !!configToUse.password
          });
          // Store it for future use
          this.lastSipConfig = configToUse;
        }
      }
      
      // Try to reconnect if we have config
      if (configToUse && !this.isExplicitlyDisconnecting) {
        console.log('UA is null, attempting to reconnect with config:', {
          uri: this.lastSipConfig.uri,
          domain: this.lastSipConfig.domain,
          wsServer: this.lastSipConfig.wsServer
        });
        try {
          // Store the config before connecting (connect might clear it)
          const reconnectConfig = { ...configToUse };
          await this.connect(reconnectConfig);
          
          // Wait for UA to be created
          let retries = 0;
          while (!this.ua && retries < 20) {
            await new Promise(resolve => setTimeout(resolve, 100));
            retries++;
          }
          
          if (!this.ua) {
            throw new Error('UA vẫn null sau khi kết nối lại');
          }
          
          // Wait for connection to establish
          retries = 0;
          while (!this.ua.isConnected() && retries < 30) {
            await new Promise(resolve => setTimeout(resolve, 100));
            retries++;
          }
          
          if (!this.ua.isConnected()) {
            throw new Error('UA chưa kết nối sau khi reconnect');
          }
          
          // Wait for registration to complete
          retries = 0;
          while (this.registerer && 
                 this.registerer.state !== 'Registered' && 
                 !String(this.registerer.state).includes('Registered') &&
                 retries < 30) {
            await new Promise(resolve => setTimeout(resolve, 100));
            retries++;
          }
          
          console.log('✅ Reconnected successfully, UA state:', this.ua.state, 'Registerer state:', this.registerer?.state);
        } catch (error) {
          console.error('Failed to reconnect:', error);
          throw new Error('Chưa kết nối đến máy chủ SIP. Vui lòng kết nối lại trong Settings.');
        }
      } else {
        const reason = !configToUse ? 'no config' : 'explicitly disconnecting';
        console.error(`Cannot reconnect: ${reason}`);
        throw new Error('Chưa kết nối đến máy chủ SIP. Vui lòng kết nối lại trong Settings.');
      }
    }
    
    if (!this.ua.isConnected()) {
      console.error('makeCall: UA is not connected, state:', this.ua.state);
      // If UA exists but not connected, wait a bit for reconnection
      if (this.ua.state === 'Started' || this.ua.state === 'Stopped') {
        console.log('UA exists but not connected, waiting for reconnection...');
        // Wait up to 2 seconds for reconnection
        for (let i = 0; i < 20; i++) {
          await new Promise(resolve => setTimeout(resolve, 100));
          if (this.ua && this.ua.isConnected()) {
            console.log('✅ UA reconnected');
            break;
          }
        }
      }
      
      if (!this.ua || !this.ua.isConnected()) {
        throw new Error('Kết nối đến máy chủ SIP đã bị ngắt. Vui lòng kết nối lại trong Settings.');
      }
    }
    
    // Also check if we're registered (recommended but not strictly required for calls)
    if (this.registerer && this.registerer.state !== 'Registered') {
      console.warn('makeCall: Not registered, but attempting call anyway. Registerer state:', this.registerer.state);
    }

    try {
      console.log(`Thực hiện cuộc gọi ${video ? 'video' : 'âm thanh'} đến:`, number);

      // Always request video to ensure SDP includes video capability
      // This allows remote side to toggle video on/off via re-INVITE
      // We'll disable the video track if video=false
      const constraints = {
        audio: true,
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('Đã lấy luồng cục bộ:', this.localStream);
      
      // Ensure video and audio tracks are enabled by default
      if (this.localStream) {
        // Enable all audio tracks
        this.localStream.getAudioTracks().forEach(track => {
          track.enabled = true;
          console.log(`✅ Audio track enabled: ${track.id}`);
        });
        
        // Enable or disable video tracks based on video parameter
        this.localStream.getVideoTracks().forEach(track => {
          track.enabled = video;
          console.log(`📹 Video track ${video ? 'enabled' : 'disabled'}: ${track.id}`);
        });
      }
      
      const localStreamTracks = this.localStream.getTracks();
      console.log(`Local stream has ${localStreamTracks.length} tracks:`, localStreamTracks.map(t => `${t.kind} (enabled=${t.enabled})`));
      this.onLocalStreamChange?.(this.localStream);
      
      // Store video flag for use in modifier
      const wantsVideo = video;

      // Parse the destination number
      let targetUri: URI;
      if (number.includes('@')) {
        // If number already contains @, parse it as a full URI
        const parts = number.split('@');
        targetUri = new URI('sip', parts[0], parts[1]);
      } else {
        // Otherwise, use the domain from UA configuration or default
        const domain = this.ua.configuration?.uri?.host || 'opensips.mooo.com';
        targetUri = new URI('sip', number, domain);
      }

      // Create a custom media stream factory that uses our pre-obtained stream
      // This is critical - the SDH will call this factory to get the stream for the peer connection
      const mediaStreamFactory = async (constraints: MediaStreamConstraints): Promise<MediaStream> => {
        console.log('🎥 Media stream factory called with constraints:', constraints);
        if (this.localStream) {
          console.log('✅ Using pre-obtained local stream with', this.localStream.getTracks().length, 'tracks');
          const videoTracks = this.localStream.getVideoTracks();
          console.log(`   Video tracks: ${videoTracks.length}, all enabled: ${videoTracks.every(t => t.enabled)}`);
          // Return the stream we already have - this ensures the SDH uses our stream with video
          return this.localStream;
        }
        // Fallback: get a new stream if we don't have one
        console.warn('⚠️ No local stream available, getting new media stream');
        return await navigator.mediaDevices.getUserMedia(constraints);
      };

      const options = {
        sessionDescriptionHandlerOptions: {
          constraints: constraints,
          iceCheckingTimeout: 5000,
          peerConnectionConfiguration: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
            ],
            rtcpMuxPolicy: 'require',
          },
          // Provide custom media stream factory to use our pre-obtained stream
          sessionDescriptionHandlerModifiers: [
            // Modifier to ensure our local stream is used when creating the offer
            // Also ensures DTMF (telephone-event) is included
            async (description: RTCSessionDescriptionInit, session: Session) => {
              console.log('🔧 SDH Modifier called - modifying SDP offer');
              console.log('📋 Full SDP BEFORE modifier:', description.sdp?.substring(0, 500));
              
              // Check if DTMF (telephone-event) is included in SDP
              if (description.sdp) {
                const hasDTMF = description.sdp.includes('telephone-event') || description.sdp.includes('telephoneevent');
                console.log(`📞 SDP includes DTMF (telephone-event): ${hasDTMF}`);
                if (!hasDTMF) {
                  console.warn('⚠️ DTMF not found in SDP - SIP.js should include it by default');
                }
              }
              
              const sdh = (session as any).sessionDescriptionHandler;
              const pc = sdh?.peerConnection as RTCPeerConnection | undefined;
              
              // Log current SDP state
              // Always ensure video is in SDP (even if disabled) to allow remote to toggle video
              let needsVideoFix = false;
              if (description.sdp) {
                const hasVideo = description.sdp.includes('m=video') && !description.sdp.includes('m=video 0');
                console.log(`📋 SDP BEFORE modifier - includes video: ${hasVideo}`);
                // Always include video in SDP to support remote toggling, even if we start with video disabled
                if (!hasVideo && this.localStream && this.localStream.getVideoTracks().length > 0) {
                  needsVideoFix = true;
                  console.warn('⚠️ SDP does NOT include video but we have video track! Attempting to fix by recreating offer...');
                  // Log the video line if it exists
                  const videoLineMatch = description.sdp.match(/m=video[^\n]*/);
                  if (videoLineMatch) {
                    console.log(`📹 Found video line: ${videoLineMatch[0]}`);
                  } else {
                    console.warn('❌ No video line found in SDP at all!');
                  }
                }
              } else {
                console.warn('⚠️ No SDP in description!');
              }
              
              if (pc && this.localStream) {
                console.log('🔧 SDH Modifier: Ensuring local stream tracks are in peer connection');
                const localTracks = this.localStream.getTracks();
                const senders = pc.getSenders();
                
                console.log(`📊 Local stream has ${localTracks.length} tracks:`, localTracks.map(t => `${t.kind} (enabled=${t.enabled}, readyState=${t.readyState})`));
                console.log(`📊 Peer connection has ${senders.length} senders:`, senders.map(s => s.track ? `${s.track.kind} (${s.track.id})` : 'no track'));
                
                // Check if we have video tracks in local stream
                const localVideoTracks = localTracks.filter(t => t.kind === 'video');
                const hasVideoSender = senders.some(s => s.track && s.track.kind === 'video');
                
                console.log(`📹 Local video tracks: ${localVideoTracks.length}, Video sender in PC: ${hasVideoSender}`);
                
                let tracksAdded = false;
                // Ensure all local tracks are in the peer connection
                localTracks.forEach(localTrack => {
                  const hasSender = senders.some(sender => sender.track && sender.track.id === localTrack.id);
                  if (!hasSender) {
                    try {
                      pc.addTrack(localTrack, this.localStream!);
                      console.log(`✅ Added ${localTrack.kind} track to peer connection in modifier`);
                      tracksAdded = true;
                    } catch (error) {
                      console.warn(`Could not add ${localTrack.kind} track in modifier:`, error);
                    }
                  } else {
                    console.log(`✅ ${localTrack.kind} track already in peer connection`);
                  }
                });
                
                // Always recreate offer if video is missing, even if tracks weren't just added
                // This handles the case where tracks exist but SDP doesn't have video
                // Always include video in SDP to support remote toggling
                if (tracksAdded || needsVideoFix || (!hasVideoSender && localVideoTracks.length > 0)) {
                  console.log('🔄 Recreating SDP offer with video tracks...');
                  try {
                    // Get current senders after adding tracks
                    const finalSenders = pc.getSenders();
                    console.log(`📊 Final senders before recreating offer: ${finalSenders.length}`);
                    finalSenders.forEach((sender, idx) => {
                      if (sender.track) {
                        console.log(`  Sender ${idx}: ${sender.track.kind}, enabled=${sender.track.enabled}, id=${sender.track.id}`);
                      }
                    });
                    
                    const newOffer = await pc.createOffer();
                    console.log('✅ Created new offer, SDP length:', newOffer.sdp?.length);
                    
                    await pc.setLocalDescription(newOffer);
                    console.log('✅ Set local description on peer connection');
                    
                    // Update the description with the new SDP
                    description.sdp = newOffer.sdp || '';
                    description.type = newOffer.type;
                    
                    // Log the new SDP
                    if (description.sdp) {
                      const hasVideo = description.sdp.includes('m=video') && !description.sdp.includes('m=video 0');
                      console.log(`📋 New SDP includes video: ${hasVideo}`);
                      if (hasVideo) {
                        const videoLine = description.sdp.match(/m=video \d+/);
                        console.log(`📹 Video line in new SDP: ${videoLine ? videoLine[0] : 'NOT FOUND'}`);
                        console.log('📋 Full SDP AFTER modifier (first 500 chars):', description.sdp.substring(0, 500));
                      } else {
                        console.error('❌ New SDP STILL does not include video!');
                        console.log('📋 Full new SDP:', description.sdp);
                      }
                    }
                  } catch (error) {
                    console.error('❌ Error recreating offer:', error);
                  }
                } else {
                  console.log('ℹ️ No need to recreate offer - video already present or not needed');
                }
              } else {
                if (!pc) console.warn('⚠️ No peer connection in modifier');
                if (!this.localStream) console.warn('⚠️ No local stream in modifier');
              }
              
              // Log final SDP state
              if (description.sdp) {
                const hasVideo = description.sdp.includes('m=video') && !description.sdp.includes('m=video 0');
                console.log(`📋 SDP AFTER modifier - includes video: ${hasVideo}`);
                if (hasVideo) {
                  const videoLine = description.sdp.match(/m=video \d+/);
                  console.log(`📹 Video line in SDP: ${videoLine ? videoLine[0] : 'NOT FOUND'}`);
                } else {
                  console.error('❌ SDP STILL does not include video after modifier!');
                  // Log a snippet of the SDP to debug
                  const lines = description.sdp.split('\n');
                  const videoLineIndex = lines.findIndex(line => line.startsWith('m=video'));
                  if (videoLineIndex >= 0) {
                    console.log(`Video line at index ${videoLineIndex}: ${lines[videoLineIndex]}`);
                    console.log(`Context: ${lines.slice(Math.max(0, videoLineIndex - 2), videoLineIndex + 3).join('\n')}`);
                  }
                }
              }
              
              return Promise.resolve(description);
            }
          ],
        },
        // Override the media stream factory for this session
        sessionDescriptionHandlerFactoryOptions: {
          ...this.ua.configuration.sessionDescriptionHandlerFactoryOptions,
          // This will be used by the SDH
        },
      };

      // Create an Inviter to make an outbound call
      const inviter = new Inviter(this.ua, targetUri, options);
      this.currentSession = inviter;
      
      this.setupSessionEventListeners(inviter);

      // Note: SDH is created lazily when invite() is called, so we can't set it up beforehand
      // Instead, we rely on:
      // 1. The constraints being passed to SDH (which should create video tracks)
      // 2. The modifier to fix the SDP if video is missing
      
      // Ensure video tracks are enabled in our local stream
      if (this.localStream && wantsVideo) {
        const videoTracks = this.localStream.getVideoTracks();
        console.log(`Enabling ${videoTracks.length} video tracks in local stream`);
        videoTracks.forEach(track => {
          track.enabled = true;
          console.log(`✅ Video track enabled: ${track.id}, enabled=${track.enabled}, readyState=${track.readyState}`);
        });
      }

      // CRITICAL: Override the SDH's getDescription method to ensure video is included
      // This is called when the SDH generates the SDP offer
      const originalGetDescription = (inviter as any).sessionDescriptionHandler?.getDescription;
      if (originalGetDescription) {
        console.log('✅ Found SDH getDescription method, will override after invite()');
      }

      // CRITICAL: Set up delegate to intercept SDP generation and ensure video is included
      // This is called when the SDH generates the SDP offer, BEFORE it's sent
      const originalDelegate = inviter.delegate;
      inviter.delegate = {
        ...originalDelegate,
        // Handle call rejection (e.g., 404 Not Found, remote not registered)
        onReject: (response: any) => {
          console.log('📞 Inviter: Call rejected by remote side:', response?.statusCode, response?.reasonPhrase);
          console.log('📞 Inviter onReject delegate called - cleaning up immediately');
          // CRITICAL: Clean up local stream immediately when call is rejected
          this.cleanupLocalStream();
          // Also notify UI immediately
          this.onLocalStreamChange?.(null);
          // Call original handler if it exists
          if (originalDelegate?.onReject) {
            originalDelegate.onReject.call(originalDelegate, response);
          }
        },
        // Handle call timeout
        onRequestTimeout: (request: any) => {
          console.log('📞 Inviter: Call request timeout - remote side not responding');
          // CRITICAL: Clean up local stream immediately when call times out
          this.cleanupLocalStream();
          // Also notify UI immediately
          this.onLocalStreamChange?.(null);
          // Call original handler if it exists
          if (originalDelegate?.onRequestTimeout) {
            originalDelegate.onRequestTimeout.call(originalDelegate, request);
          }
        },
        // This delegate method is called when the SDH needs to get the description
        // We can't directly intercept getDescription, but we can ensure the SDH has our stream
        onInvite: async (request: any) => {
          console.log('🔧 onInvite delegate called - checking SDH state');
          const sdh = (inviter as any).sessionDescriptionHandler;
          if (sdh && this.localStream) {
            console.log('✅ Setting localMediaStream on SDH in onInvite delegate');
            sdh.localMediaStream = this.localStream;
            
            const pc = sdh.peerConnection as RTCPeerConnection | undefined;
            if (pc) {
              const localTracks = this.localStream.getTracks();
              const senders = pc.getSenders();
              
              console.log(`📊 onInvite: Local tracks: ${localTracks.length}, PC senders: ${senders.length}`);
              
              // Ensure all tracks are in the PC
              localTracks.forEach(localTrack => {
                const hasSender = senders.some(sender => sender.track?.id === localTrack.id);
                if (!hasSender) {
                  try {
                    pc.addTrack(localTrack, this.localStream!);
                    console.log(`✅ Added ${localTrack.kind} track to PC in onInvite delegate`);
                  } catch (error) {
                    console.warn(`Could not add ${localTrack.kind} track:`, error);
                  }
                }
              });
            }
          }
          
          // Call original handler if it exists
          if (originalDelegate?.onInvite) {
            return originalDelegate.onInvite.call(originalDelegate, request);
          }
        }
      };

      // Send the INVITE - the session description handler will create the peer connection
      // The modifier will ensure video is included in the SDP
      // The key difference from answerCall is that for outgoing calls, we need the modifier
      // to fix the SDP if the SDH doesn't use our pre-obtained stream
      // NOTE: We do NOT set up local/remote streams here - that will only happen after
      // successful ACK response in the "Established" state handler
      console.log('📞 Calling invite() - modifier and delegate will ensure video is included in SDP');
      await inviter.invite();
      
      // Set up early peer connection listeners to catch remote tracks as soon as they arrive
      // This is important for outbound calls to receive remote media
      const setupEarlyListeners = () => {
        const sdh = (inviter as any).sessionDescriptionHandler;
        const pc = sdh?.peerConnection as RTCPeerConnection | undefined;
        if (pc) {
          console.log('Setting up early peer connection listeners for outbound call');
          this.setupPeerConnectionListeners(inviter);
        } else {
          // Retry after a short delay
          setTimeout(setupEarlyListeners, 200);
        }
      };
      setupEarlyListeners();
      
      // Only update state - stream setup will happen in "Established" state handler
      this.onStateChange?.(CallStatus.CALLING);

    } catch (error) {
      console.error('Thực hiện cuộc gọi thất bại:', error);
      // CRITICAL: Clean up local stream immediately when call fails
      // This ensures camera is released even if call fails before establishment
      this.cleanupLocalStream();
      this.cleanup();
      this.onStateChange?.(CallStatus.FAILED);
      throw error;
    }
  }

  private handleIncomingCall(session: Session): void {
    console.log('Cuộc gọi đến từ:', session.remoteIdentity.uri.user);
    console.log('Setting up incoming call session:', session);
    this.currentSession = session;
    this.setupSessionEventListeners(session);
    
    // Try to set up peer connection listeners early for incoming calls
    // This helps detect remote streams as soon as possible
    const setupEarlyListeners = () => {
      const sdh = (session as any).sessionDescriptionHandler;
      const pc = sdh?.peerConnection as RTCPeerConnection | undefined;
      if (pc) {
        console.log('Setting up early peer connection listeners for incoming call');
        this.setupPeerConnectionListeners(session);
      } else {
        // Retry after a short delay
        setTimeout(setupEarlyListeners, 200);
      }
    };
    setTimeout(setupEarlyListeners, 300);
    
    this.onStateChange?.(CallStatus.INCOMING);
    console.log('✅ Incoming call status set to INCOMING');
  }

  async answerCall(video: boolean = true): Promise<void> {
    // Try to find the session if currentSession is null
    let sessionToAnswer = this.currentSession;
    
    if (!sessionToAnswer && this.ua) {
      console.warn('⚠️ currentSession is null, trying to find active invitation from UserAgent...');
      // Try to find an active invitation from the UserAgent
      // SIP.js stores sessions internally, but we need to check if there's a way to access them
      // For now, we'll rely on currentSession being set properly
      console.error('❌ Cannot find session to answer - currentSession was not set or was cleared');
      throw new Error('Không có cuộc gọi đến để trả lời - phiên đã bị xóa hoặc không tồn tại');
    }

    if (!sessionToAnswer) {
      console.error('❌ Cannot answer: currentSession is null and UserAgent is not available');
      throw new Error('Không có cuộc gọi đến để trả lời');
    }

    // Verify the session is an Invitation (incoming call)
    if (!(sessionToAnswer instanceof Invitation)) {
      console.error('❌ Cannot answer: currentSession is not an Invitation', {
        sessionType: sessionToAnswer.constructor.name,
        sessionState: sessionToAnswer.state
      });
      throw new Error('Không có cuộc gọi đến để trả lời');
    }

    // Check if session is in a valid state to be answered
    const validStates = ['Initial', 'Establishing'];
    if (!validStates.includes(sessionToAnswer.state)) {
      console.error('❌ Cannot answer: session is in invalid state', {
        state: sessionToAnswer.state,
        sessionId: (sessionToAnswer as any).id
      });
      throw new Error(`Không thể trả lời cuộc gọi - trạng thái không hợp lệ: ${sessionToAnswer.state}`);
    }

    console.log('✅ Answering call - session is valid:', {
      sessionType: 'Invitation',
      sessionState: sessionToAnswer.state,
      sessionId: (sessionToAnswer as any).id
    });

    try {
      // Always enable video when answering to allow remote side to toggle video
      // This ensures the SDP answer includes video capability, enabling the remote side to toggle video later
      console.log(`Trả lời cuộc gọi với video (luôn bật để cho phép remote toggle video)`);

      const constraints = {
        audio: true,
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('Đã lấy luồng cục bộ để trả lời:', this.localStream);
      
      // Ensure video and audio tracks are enabled by default
      if (this.localStream) {
        // Enable all audio tracks
        this.localStream.getAudioTracks().forEach(track => {
          track.enabled = true;
          console.log(`✅ Audio track enabled: ${track.id}`);
        });
        
        // Enable video tracks based on video parameter
        this.localStream.getVideoTracks().forEach(track => {
          track.enabled = video;
          console.log(`📹 Video track ${video ? 'enabled' : 'disabled'}: ${track.id}`);
        });
      }
      
      this.onLocalStreamChange?.(this.localStream);

      const options = {
        sessionDescriptionHandlerOptions: {
          constraints: constraints,
          peerConnectionConfiguration: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
            ],
            rtcpMuxPolicy: 'require',
          },
          // Add modifier to ensure DTMF is included in answer SDP
          sessionDescriptionHandlerModifiers: [
            async (description: RTCSessionDescriptionInit, session: Session) => {
              console.log('🔧 Answer SDP Modifier called');
              if (description.sdp) {
                const hasDTMF = description.sdp.includes('telephone-event') || description.sdp.includes('telephoneevent');
                console.log(`📞 Answer SDP includes DTMF (telephone-event): ${hasDTMF}`);
                if (!hasDTMF) {
                  console.warn('⚠️ DTMF not found in answer SDP - SIP.js should include it by default');
                }
              }
              return Promise.resolve(description);
            }
          ],
        },
      };

      await (sessionToAnswer as any).accept(options);
      
      // Ensure local stream is added to peer connection after accepting
      const setupLocalStreamAfterAccept = () => {
        const sdh = (sessionToAnswer as any).sessionDescriptionHandler;
        const pc = sdh?.peerConnection as RTCPeerConnection | undefined;
        if (pc && this.localStream) {
          // Check if tracks are already added
          const existingTracks = pc.getSenders().map((sender: RTCRtpSender) => sender.track).filter(Boolean);
          const localTracks = this.localStream.getTracks();
          
          localTracks.forEach(localTrack => {
            const exists = existingTracks.some((existingTrack: MediaStreamTrack | null) => 
              existingTrack?.id === localTrack.id
            );
            if (!exists) {
              try {
                pc.addTrack(localTrack, this.localStream!);
                console.log(`✅ Đã thêm local track ${localTrack.kind} vào peer connection (answer)`);
              } catch (error) {
                console.warn(`Không thể thêm local track ${localTrack.kind}:`, error);
              }
            }
          });
        } else if (!pc) {
          // Wait a bit and try again
          setTimeout(setupLocalStreamAfterAccept, 100);
        }
      };
      
      // Set up peer connection listeners after accepting
      this.setupPeerConnectionListeners(sessionToAnswer);
      
      // Setup local stream after accept
      setTimeout(setupLocalStreamAfterAccept, 200);
      setTimeout(setupLocalStreamAfterAccept, 500);
      setTimeout(setupLocalStreamAfterAccept, 1000);
      
      // Wait a bit for the session to establish, then check for remote streams
      setTimeout(() => {
        const pc = (sessionToAnswer as any).sessionDescriptionHandler?.peerConnection;
        if (pc) {
          this.setupPeerConnectionListeners(sessionToAnswer);
        }
      }, 500);
      
      this.onStateChange?.(CallStatus.ACTIVE);

    } catch (error) {
      console.error('Trả lời cuộc gọi thất bại:', error);
      this.cleanup();
      this.onStateChange?.(CallStatus.FAILED);
      throw error;
    }
  }

  async rejectCall(): Promise<void> {
    if (this.currentSession) {
      try {
      console.log('Từ chối cuộc gọi');
        const session = this.currentSession;
        
        if (session instanceof Invitation) {
          await session.reject();
        } else if (typeof (session as any).reject === 'function') {
          await (session as any).reject();
        } else if (typeof (session as any).terminate === 'function') {
          await (session as any).terminate();
        }
      } catch (error) {
        console.error('Error rejecting call:', error);
      } finally {
        this.cleanup();
        this.currentSession = null;
        this.onStateChange?.(CallStatus.IDLE);
        // Auto-register when call is rejected
        setTimeout(() => {
          this.autoRegisterIfNeeded().catch(error => {
            console.error('Auto-registration error after reject:', error);
          });
        }, 500);
      }
    }
  }

  private isInCall(): boolean {
    // Check if we're currently in a call state
    return this.currentSession !== null && 
           this.currentSession.state !== 'Terminated';
  }

  private async autoRegisterIfNeeded(): Promise<void> {
    // Debug log only (can be removed in production)
    // console.debug('Checking if auto-registration is needed...', {
    //   isExplicitlyDisconnecting: this.isExplicitlyDisconnecting,
    //   isReregistering: this.isReregistering,
    //   isAutoRegistering: this.isAutoRegistering,
    //   isInCall: this.isInCall(),
    //   hasConfig: !!this.lastSipConfig,
    //   hasUA: !!this.ua,
    //   hasRegisterer: !!this.registerer,
    //   registererState: this.registerer?.state,
    //   uaConnected: this.ua?.isConnected()
    // });

    // Don't auto-register if:
    // - We're explicitly disconnecting
    // - We're already registering
    // - We're in a call
    // - We don't have config
    // - We're already registered
    if (this.isExplicitlyDisconnecting) {
      console.log('Skipping auto-registration: explicitly disconnecting');
      return;
    }
    
    if (this.isReregistering || this.isAutoRegistering) {
      console.log('Skipping auto-registration: already registering');
      return;
    }
    
    if (this.isInCall()) {
      console.log('Skipping auto-registration: in a call');
      return;
    }
    
    // Try to get config from storage if lastSipConfig is null
    let configToUse = this.lastSipConfig;
    if (!configToUse) {
      console.log('lastSipConfig is null, trying to load from storage for auto-registration...');
      configToUse = this.getConfigFromStorage();
      if (configToUse) {
        console.log('✅ Loaded config from storage for auto-registration');
        this.lastSipConfig = configToUse;
      }
    }
    
    if (!configToUse) {
      console.log('Skipping auto-registration: no SIP config available');
      return;
    }
    
    if (!this.ua || !this.registerer) {
      console.log('Skipping auto-registration: UA or registerer not available');
      return;
    }

    // Check if we're registered (handle enum type)
    const registererState = (this.registerer.state as any).toString ? (this.registerer.state as any).toString() : String(this.registerer.state);
    if (registererState === 'Registered' || registererState.includes('Registered')) {
      // Already registered, just ensure status is correct (no need to log)
      this.onStateChange?.(CallStatus.REGISTERED);
      return;
    }

    // Check if UA is connected
    if (!this.ua || !this.ua.isConnected()) {
      console.log('UA không kết nối hoặc không tồn tại, đang thử kết nối lại...');
      try {
        this.isAutoRegistering = true;
        await this.connect(configToUse);
        this.isAutoRegistering = false;
        console.log('✅ Auto-reconnection successful');
      } catch (error) {
        console.error('Auto-registration failed:', error);
        this.isAutoRegistering = false;
      }
      return;
    }

    // Try to register
    try {
      console.log('🔄 Tự động đăng ký khi idle...');
      this.isAutoRegistering = true;
      await this.registerer.register();
      this.isAutoRegistering = false;
      console.log('✅ Tự động đăng ký thành công');
      // Ensure status is updated after successful registration
      // The stateChange listener should handle this, but ensure it's set
      const registererState = (this.registerer.state as any).toString ? (this.registerer.state as any).toString() : String(this.registerer.state);
      if (registererState === 'Registered' || registererState.includes('Registered')) {
        console.log('Registerer state is Registered after auto-registration, setting status to REGISTERED');
        this.onStateChange?.(CallStatus.REGISTERED);
      }
    } catch (error) {
      console.error('❌ Tự động đăng ký thất bại:', error);
      this.isAutoRegistering = false;
      // Retry after a delay
      setTimeout(() => {
        if (!this.isAutoRegistering && !this.isReregistering && !this.isInCall()) {
          console.log('🔄 Retrying auto-registration...');
          this.autoRegisterIfNeeded().catch(err => {
            console.error('Retry auto-registration failed:', err);
          });
        }
      }, 3000);
    }
  }

  async hangup(): Promise<void> {
    // Prevent duplicate hangup calls
    if (this.isHangingUp) {
      console.log('⚠️ Hangup already in progress, ignoring duplicate call');
      return;
    }
    
    if (!this.currentSession) {
      console.log('⚠️ No active session to hangup');
      return;
    }
    
    this.isHangingUp = true;
    
    // CRITICAL: Capture peer connection and streams BEFORE sending BYE
    // For outbound calls, the session may be disposed after BYE, destroying the peer connection
    // By capturing these references early, we can clean them up even if the session is disposed
    let peerConnection: RTCPeerConnection | undefined;
    let localStreamSnapshot: MediaStream | null = null;
    let remoteStreamSnapshot: MediaStream | null = null;
    
    try {
      console.log('Ngắt cuộc gọi');
      const session = this.currentSession;
      
      if (session) {
        try {
          const sdh = (session as any).sessionDescriptionHandler;
          peerConnection = sdh?.peerConnection as RTCPeerConnection | undefined;
          localStreamSnapshot = this.localStream;
          remoteStreamSnapshot = this.remoteStream;
          console.log('📸 Captured peer connection and streams for cleanup:', {
            hasPeerConnection: !!peerConnection,
            hasLocalStream: !!localStreamSnapshot,
            hasRemoteStream: !!remoteStreamSnapshot
          });
        } catch (error) {
          console.warn('Error capturing peer connection/streams:', error);
        }
      }
      
      // CRITICAL: Send BYE first to notify remote side before cleanup
      if (session && session.state !== 'Terminated' && session.state !== 'Terminating') {
        try {
          if (session instanceof Inviter) {
            if (session.state === 'Established') {
              console.log('📞 Sending BYE for outbound call...');
              // Initiate BYE - don't await the promise as it may not resolve if remote doesn't respond
              // The dialog will be destroyed when BYE is sent, which stops retransmissions
              session.bye().catch(error => {
                // 404 or other errors are acceptable - remote may have already terminated
                console.warn('⚠️ BYE response error (may be expected):', error);
              });
              console.log('✅ BYE initiated for outbound call');
            } else {
              console.log('📞 Cancelling outbound call...');
              session.cancel().catch(error => {
                console.error('Error cancelling outbound call:', error);
              });
            }
          } else if (session instanceof Invitation) {
            if (session.state === 'Established') {
              console.log('📞 Sending BYE for inbound call...');
              // Initiate BYE - don't await the promise as it may not resolve if remote doesn't respond
              // The dialog will be destroyed when BYE is sent, which stops retransmissions
              session.bye().catch(error => {
                // 404 or other errors are acceptable - remote may have already terminated
                console.warn('⚠️ BYE response error (may be expected):', error);
              });
              console.log('✅ BYE initiated for inbound call');
            } else {
              console.log('📞 Rejecting inbound call...');
              session.reject().catch(error => {
                console.error('Error rejecting inbound call:', error);
              });
            }
          }
        } catch (error) {
          console.error('Error initiating BYE/CANCEL/REJECT:', error);
        }
        
        // Give BYE time to be sent over the network before cleanup
        // The dialog will be destroyed when BYE is sent, which stops retransmissions
        // We don't wait for BYE response as it may not come (404 is acceptable)
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // NOTE: Stream cleanup is handled by cleanup() function in finally block
      // This ensures consistent cleanup for both inbound and outbound calls
    } catch (error) {
      console.error('Error hanging up call:', error);
    } finally {
      // Set state to IDLE immediately for UI responsiveness
      this.onStateChange?.(CallStatus.IDLE);
      
      // Cleanup streams and resources after delay to ensure:
      // 1. BYE is sent over network
      // 2. BYE response can be received and processed (even if 404)
      // 3. Dialog cleanup completes properly
      // cleanup() handles all stream cleanup comprehensively (similar to inbound calls)
      // Pass captured peer connection and streams to cleanup in case session is disposed
      setTimeout(() => {
        this.cleanup(peerConnection, localStreamSnapshot, remoteStreamSnapshot);
        // Keep session reference briefly to allow BYE response to be processed
        setTimeout(() => {
          this.currentSession = null;
          console.log('✅ Hangup complete, state set to IDLE');
          
          // Reset hangup flag
          this.isHangingUp = false;
          
          // Auto-register if needed
          this.autoRegisterIfNeeded().catch(error => {
            console.error('Auto-registration error after hangup:', error);
          });
        }, 500);
      }, 500);
    }
  }

  private setupSessionEventListeners(session: Session): void {
    console.log('Thiết lập trình nghe sự kiện phiên');

    // Set up session delegate to handle remote BYE messages
    if (session.delegate === undefined) {
      session.delegate = {};
    }
    
    // Handle when remote side sends BYE (ends call)
    const originalOnBye = (session.delegate as any).onBye;
    (session.delegate as any).onBye = (request: any) => {
      console.log('📞 Remote side sent BYE - call ended by remote party');
      if (originalOnBye) {
        originalOnBye.call(session.delegate, request);
      }
      // Handle remote termination
      this.handleRemoteTermination(session);
    };

    // Handle when remote side cancels the call
    const originalOnCancel = (session.delegate as any).onCancel;
    (session.delegate as any).onCancel = (request: any) => {
      console.log('📞 Remote side cancelled the call');
      if (originalOnCancel) {
        originalOnCancel.call(session.delegate, request);
      }
      this.handleRemoteTermination(session);
    };

    // Handle re-INVITEs from remote side (e.g., when they toggle video/audio)
    const originalOnReinvite = (session.delegate as any).onReinvite;
    (session.delegate as any).onReinvite = async (request: any) => {
      console.log('📞 Remote side sent re-INVITE (toggling video/audio)');
      
      // Get the SDP from the re-INVITE to check what media is being requested
      const body = request.body;
      if (body) {
        const hasVideo = body.includes('m=video') && !body.includes('m=video 0');
        const hasAudio = body.includes('m=audio') && !body.includes('m=audio 0');
        console.log(`Re-INVITE SDP - hasVideo: ${hasVideo}, hasAudio: ${hasAudio}`);
        
        const sdh = (session as any).sessionDescriptionHandler;
        const pc = sdh?.peerConnection as RTCPeerConnection | undefined;
        
        // Handle video toggle
        if (hasVideo) {
          // Remote side is requesting video
          console.log('📹 Remote side requesting video');
          
          // If we don't have video, get it
          if (!this.localStream || !this.localStream.getVideoTracks().length) {
            console.log('Getting local video stream for re-INVITE...');
            try {
              const constraints = {
                audio: true,
                video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
              };
              this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
              this.onLocalStreamChange?.(this.localStream);
              
              // Update SDH's localMediaStream to ensure SDP answer includes video
              if (sdh) {
                sdh.localMediaStream = this.localStream;
                console.log('✅ Updated SDH localMediaStream for re-INVITE');
              }
              
              // Add video track to peer connection if it exists
              if (pc && this.localStream) {
                const videoTrack = this.localStream.getVideoTracks()[0];
                if (videoTrack) {
                  try {
                    // Check if video sender already exists
                    const senders = pc.getSenders();
                    const hasVideoSender = senders.some(s => s.track && s.track.kind === 'video');
                    if (!hasVideoSender) {
                      pc.addTrack(videoTrack, this.localStream);
                      console.log('✅ Added video track to peer connection for re-INVITE');
                    } else {
                      // Replace existing video track
                      const videoSender = senders.find(s => s.track && s.track.kind === 'video');
                      if (videoSender) {
                        videoSender.replaceTrack(videoTrack);
                        console.log('✅ Replaced video track in peer connection for re-INVITE');
                      }
                    }
                  } catch (error) {
                    console.warn('Could not add video track to PC:', error);
                  }
                }
              }
              
              // Update store to reflect video is enabled
              const { useCallStore } = await import('../store/useCallStore');
              const store = useCallStore.getState();
              if (!store.isVideoEnabled) {
                store.toggleVideo();
              }
              
              console.log('✅ Got local video stream for re-INVITE');
            } catch (error) {
              console.error('Failed to get video stream for re-INVITE:', error);
            }
          } else {
            // We have video, ensure it's enabled and in the peer connection
            const videoTrack = this.localStream.getVideoTracks()[0];
            if (videoTrack) {
              videoTrack.enabled = true;
              console.log('✅ Enabled existing video track for re-INVITE');
              
              // Update SDH's localMediaStream
              if (sdh) {
                sdh.localMediaStream = this.localStream;
                console.log('✅ Updated SDH localMediaStream for re-INVITE');
              }
              
              // Ensure video track is in peer connection
              if (pc) {
                const senders = pc.getSenders();
                const hasVideoSender = senders.some(s => s.track && s.track.kind === 'video');
                if (!hasVideoSender) {
                  try {
                    pc.addTrack(videoTrack, this.localStream);
                    console.log('✅ Added video track to peer connection');
                  } catch (error) {
                    console.warn('Could not add video track:', error);
                  }
                } else {
                  // Replace existing video track
                  const videoSender = senders.find(s => s.track && s.track.kind === 'video');
                  if (videoSender) {
                    videoSender.replaceTrack(videoTrack);
                    console.log('✅ Replaced video track in peer connection');
                  }
                }
              }
            }
          }
        } else {
          // Remote side is requesting audio only (no video)
          console.log('🔇 Remote side requesting audio only (no video)');
          
          // Disable video track but keep it (don't stop it, just disable)
          if (this.localStream) {
            const videoTracks = this.localStream.getVideoTracks();
            videoTracks.forEach(track => {
              track.enabled = false;
              console.log('✅ Disabled video track for audio-only re-INVITE');
            });
            
            // Update SDH's localMediaStream (remove video tracks)
            // Create audio-only stream for SDH
            if (sdh) {
              const audioOnlyStream = new MediaStream();
              const audioTracks = this.localStream.getAudioTracks();
              audioTracks.forEach(track => {
                audioOnlyStream.addTrack(track);
              });
              sdh.localMediaStream = audioOnlyStream;
              console.log('✅ Updated SDH localMediaStream to audio-only for re-INVITE');
            }
            
            // Remove video sender from peer connection
            if (pc) {
              const senders = pc.getSenders();
              senders.forEach(sender => {
                if (sender.track && sender.track.kind === 'video') {
                  try {
                    sender.replaceTrack(null);
                    console.log('✅ Removed video sender from peer connection');
                  } catch (error) {
                    console.warn('Could not remove video sender:', error);
                  }
                }
              });
            }
            
            // Update store to reflect video is disabled
            const { useCallStore } = await import('../store/useCallStore');
            const store = useCallStore.getState();
            if (store.isVideoEnabled) {
              store.toggleVideo();
            }
          }
        }
        
        // Handle audio toggle
        if (!hasAudio) {
          // Remote side is requesting no audio (video only)
          console.log('🔇 Remote side requesting video only (no audio)');
          // We typically want to keep audio, but if remote explicitly rejects it, we should handle it
          // For now, we'll keep audio enabled on our side
        }
      }
      
      // Wait a bit for peer connection to update before SIP.js generates SDP answer
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Ensure SDH has the correct localMediaStream before generating answer
      if (sdh && this.localStream) {
        // If remote requested video, ensure SDH has full stream
        // If remote requested audio-only, ensure SDH has audio-only stream
        const hasVideo = body && body.includes('m=video') && !body.includes('m=video 0');
        if (hasVideo) {
          sdh.localMediaStream = this.localStream;
        } else {
          // Create audio-only stream for SDH
          const audioOnlyStream = new MediaStream();
          const audioTracks = this.localStream.getAudioTracks();
          audioTracks.forEach(track => {
            audioOnlyStream.addTrack(track);
          });
          sdh.localMediaStream = audioOnlyStream;
        }
        console.log('✅ Updated SDH localMediaStream before generating SDP answer');
      }
      
      // Call original handler if it exists
      if (originalOnReinvite) {
        return originalOnReinvite.call(session.delegate, request);
      }
      
      // Default behavior: accept the re-INVITE
      // The SDH will generate the appropriate SDP answer based on our current media state
      // SIP.js will automatically send the 200 OK response with the SDP answer
      return Promise.resolve();
    };

    // Handle session rejection/failure delegates
    if (session.delegate === undefined) {
      session.delegate = {};
    }
    
    // Handle when call is rejected (e.g., 404 Not Found, remote not registered)
    const originalOnReject = (session.delegate as any).onReject;
    (session.delegate as any).onReject = (response: any) => {
      console.log('📞 Call rejected by remote side:', response?.statusCode, response?.reasonPhrase);
      console.log('📞 onReject delegate called - cleaning up immediately');
      if (originalOnReject) {
        originalOnReject.call(session.delegate, response);
      }
      // CRITICAL: Clean up local stream immediately when call is rejected
      // This must happen BEFORE handleRemoteTermination to ensure camera is released
      this.cleanupLocalStream();
      // Also notify UI immediately that stream is cleared
      this.onLocalStreamChange?.(null);
      // Then handle the termination
      this.handleRemoteTermination(session);
    };
    
    // Handle when call request times out
    const originalOnRequestTimeout = (session.delegate as any).onRequestTimeout;
    (session.delegate as any).onRequestTimeout = (request: any) => {
      console.log('📞 Call request timeout - remote side not responding');
      if (originalOnRequestTimeout) {
        originalOnRequestTimeout.call(session.delegate, request);
      }
      // Clean up local stream immediately when call times out
      this.cleanupLocalStream();
      this.handleRemoteTermination(session);
    };

    session.stateChange.addListener((state) => {
      console.log(`Trạng thái phiên thay đổi: ${state}`);
      switch (state) {
        case 'Established':
          console.log('Phiên đã được thiết lập');
          this.onStateChange?.(CallStatus.ACTIVE);
          this.setupPeerConnectionListeners(session);
          
          // Set up local stream after ACK is received (similar to inbound calls)
          // This ensures local tracks are properly added to peer connection
          const setupLocalStreamAfterAck = () => {
            const sdh = (session as any).sessionDescriptionHandler;
            const pc = sdh?.peerConnection as RTCPeerConnection | undefined;
            if (pc && this.localStream) {
              // Check if tracks are already added
              const existingTracks = pc.getSenders().map((sender: RTCRtpSender) => sender.track).filter(Boolean);
              const localTracks = this.localStream.getTracks();
              
              localTracks.forEach(localTrack => {
                const exists = existingTracks.some((existingTrack: MediaStreamTrack | null) => 
                  existingTrack?.id === localTrack.id
                );
                if (!exists) {
                  try {
                    pc.addTrack(localTrack, this.localStream!);
                    console.log(`✅ Đã thêm local track ${localTrack.kind} vào peer connection (outbound after ACK)`);
                  } catch (error) {
                    console.warn(`Không thể thêm local track ${localTrack.kind}:`, error);
                  }
                }
              });
            } else if (!pc) {
              // Wait a bit and try again
              setTimeout(setupLocalStreamAfterAck, 100);
            }
          };
          
          // Setup local stream after ACK (similar to inbound calls after accept)
          setTimeout(setupLocalStreamAfterAck, 200);
          setTimeout(setupLocalStreamAfterAck, 500);
          setTimeout(setupLocalStreamAfterAck, 1000);
          
          // CRITICAL: Wait a bit for the session to establish, then check for remote streams
          // This is similar to inbound calls and ensures remote streams are captured
          // This retry mechanism is important for outbound calls to receive remote media
          setTimeout(() => {
            const sdh = (session as any).sessionDescriptionHandler;
            const pc = sdh?.peerConnection as RTCPeerConnection | undefined;
            if (pc) {
              console.log('Retrying setupPeerConnectionListeners for outbound call to capture remote streams');
              this.setupPeerConnectionListeners(session);
            }
          }, 500);
          break;
        case 'Establishing':
          console.log('Phiên đang tiến hành...');
          this.onStateChange?.(CallStatus.RINGING);
          break;
        case 'Terminated':
          console.log('📞 Phiên đã kết thúc (Terminated state)');
          
          // If hangup was already called, skip everything - hangup already handled cleanup
          if (this.isHangingUp) {
            console.log('⚠️ Hangup already in progress, skipping Terminated handler');
            return;
          }
          
          // Simple cleanup for remote termination - no retry logic, no camera checks
          // Just clean up resources and transition to IDLE immediately
          console.log('🧹 Cleaning up after remote termination...');
          
          // Stop local stream tracks
          if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
              track.stop();
            });
            this.localStream = null;
            this.onLocalStreamChange?.(null);
          }
          
          // Clear video elements
          const videoElements = document.querySelectorAll('video');
          videoElements.forEach(videoEl => {
            if (videoEl.srcObject) {
              videoEl.srcObject = null;
            }
          });
          
          // Cleanup peer connection and session
          this.cleanupLocalStream();
          this.handleRemoteTermination(session);
          this.cleanup();
          
          // Clear session reference
          this.currentSession = null;
          
          // Transition to IDLE immediately - no waiting, no retries
          console.log('✅ Cleanup complete, transitioning to IDLE');
          this.onStateChange?.(CallStatus.IDLE);
          break;
      }
    });
  }

  /**
   * Stop all media tracks from the session's peer connection
   * This is the recommended way to release camera/microphone when a call ends
   * Based on the pattern: stop tracks from senders and receivers directly
   */
  private stopMediaTracks(session: Session): void {
    try {
      const sdh = (session as any).sessionDescriptionHandler;
      if (!sdh) {
        console.log('⚠️ No session description handler found');
        return;
      }

      const pc = sdh.peerConnection as RTCPeerConnection | undefined;
      if (!pc) {
        console.log('⚠️ No peer connection found in session');
        return;
      }

      console.log('🛑 Stopping all media tracks from peer connection...');

      // CRITICAL: Replace tracks in senders with null FIRST, then stop them
      // This releases the camera immediately by removing the track from the peer connection
      const senders = pc.getSenders();
      const liveSenders = senders.filter(s => s.track && s.track.readyState === 'live');
      console.log(`Found ${senders.length} senders (${liveSenders.length} with LIVE tracks)`);
      
      // Replace LIVE tracks with null first (these are actively using camera)
      liveSenders.forEach(sender => {
        if (sender.track) {
          const track = sender.track;
          console.log(`🛑 Replacing LIVE sender ${track.kind} track with null:`, track.id);
          try {
            // CRITICAL: Replace track with null to release camera immediately
            sender.replaceTrack(null).then(() => {
              console.log(`✅ Replaced LIVE sender ${track.kind} track with null`);
              // Now stop the track
              try {
                track.enabled = false;
                track.stop();
                console.log(`✅ Stopped LIVE sender ${track.kind} track after replacement`);
              } catch (e) {
                console.warn(`Error stopping track after replacement:`, e);
              }
            }).catch(e => {
              console.warn(`Error replacing LIVE track with null:`, e);
              // Fallback: just stop the track
              try {
                track.enabled = false;
                track.stop();
                console.log(`✅ Stopped LIVE sender ${track.kind} track (fallback)`);
              } catch (e2) {
                console.warn(`Error stopping track in fallback:`, e2);
              }
            });
          } catch (error) {
            console.warn(`Error replacing LIVE sender ${track.kind} track:`, error);
            // Fallback: just stop the track
            try {
              track.enabled = false;
              track.stop();
              console.log(`✅ Stopped LIVE sender ${track.kind} track (fallback)`);
            } catch (e) {
              console.warn(`Error stopping track in fallback:`, e);
            }
          }
        }
      });
      
      // Also replace non-live tracks and stop them
      senders.filter(s => s.track && s.track.readyState !== 'live').forEach(sender => {
        if (sender.track) {
          const track = sender.track;
          console.log(`Replacing sender ${track.kind} track with null:`, track.id);
          try {
            sender.replaceTrack(null).catch(() => {
              // If replaceTrack fails, just stop the track
              try {
                track.enabled = false;
                track.stop();
              } catch (e) {
                // Ignore errors
              }
            });
            // Also stop the track
            try {
              track.enabled = false;
              track.stop();
              console.log(`✅ Stopped sender ${track.kind} track`);
            } catch (error) {
              console.warn(`Error stopping sender ${track.kind} track:`, error);
            }
          } catch (error) {
            console.warn(`Error replacing sender ${track.kind} track:`, error);
            // Fallback: just stop the track
            try {
              track.enabled = false;
              track.stop();
            } catch (e) {
              // Ignore errors
            }
          }
        }
      });

      // Stop remote tracks (from receivers) - optional cleanup
      pc.getReceivers().forEach(receiver => {
        if (receiver.track) {
          console.log(`Stopping receiver ${receiver.track.kind} track:`, receiver.track.id);
          try {
            receiver.track.stop();
            console.log(`✅ Stopped receiver ${receiver.track.kind} track`);
          } catch (error) {
            console.warn(`Error stopping receiver ${receiver.track.kind} track:`, error);
          }
        }
      });

      console.log('✅ All media tracks stopped from peer connection');
    } catch (error) {
      console.warn('Error stopping media tracks from peer connection:', error);
    }
  }

  /**
   * Check if camera is actually off by verifying no active video tracks exist
   * Returns true if camera is off (no active video tracks found)
   */
  private isCameraOff(): boolean {
    try {
      // Check all video elements for active video tracks
      const videoElements = document.querySelectorAll('video');
      for (const videoEl of videoElements) {
        const stream = (videoEl as HTMLVideoElement).srcObject as MediaStream | null;
        if (stream) {
          const videoTracks = stream.getVideoTracks();
          const liveVideoTracks = videoTracks.filter(t => t.readyState === 'live');
          if (liveVideoTracks.length > 0) {
            console.log(`🚨 Camera still ON: Found ${liveVideoTracks.length} LIVE video track(s) in video element`);
            return false;
          }
        }
      }
      
      // Check peer connection for active video tracks
      if (this.currentSession) {
        try {
          const sdh = (this.currentSession as any).sessionDescriptionHandler;
          const pc = sdh?.peerConnection as RTCPeerConnection | undefined;
          if (pc && pc.connectionState !== 'closed') {
            const senders = pc.getSenders();
            const liveVideoSenders = senders.filter(s => 
              s.track && 
              s.track.kind === 'video' && 
              s.track.readyState === 'live'
            );
            if (liveVideoSenders.length > 0) {
              console.log(`🚨 Camera still ON: Found ${liveVideoSenders.length} LIVE video sender(s) in peer connection`);
              return false;
            }
          }
        } catch (e) {
          // Peer connection might be closed, which is fine
        }
      }
      
      // Check localStream for active video tracks
      if (this.localStream) {
        const videoTracks = this.localStream.getVideoTracks();
        const liveVideoTracks = videoTracks.filter(t => t.readyState === 'live');
        if (liveVideoTracks.length > 0) {
          console.log(`🚨 Camera still ON: Found ${liveVideoTracks.length} LIVE video track(s) in localStream`);
          return false;
        }
      }
      
      // CRITICAL: Also check all audio elements for video tracks (unlikely but possible)
      const audioElements = document.querySelectorAll('audio');
      for (const audioEl of audioElements) {
        const stream = (audioEl as HTMLAudioElement).srcObject as MediaStream | null;
        if (stream) {
          const videoTracks = stream.getVideoTracks();
          const liveVideoTracks = videoTracks.filter(t => t.readyState === 'live');
          if (liveVideoTracks.length > 0) {
            console.log(`🚨 Camera still ON: Found ${liveVideoTracks.length} LIVE video track(s) in audio element`);
            return false;
          }
        }
      }
      
      // Additional check: Try to enumerate all MediaStreams by checking all media elements
      // This catches any streams we might have missed
      const allMediaElements = (Array.from(videoElements) as (HTMLVideoElement | HTMLAudioElement)[]).concat(Array.from(audioElements));
      for (const mediaEl of allMediaElements) {
        const stream = mediaEl.srcObject as MediaStream | null;
        if (stream) {
          // Check all tracks in the stream
          const videoTracks = stream.getVideoTracks();
          const liveVideoTracks = videoTracks.filter(t => t.readyState === 'live');
          if (liveVideoTracks.length > 0) {
            console.log(`🚨 Camera still ON: Found ${liveVideoTracks.length} LIVE video track(s) in media element`);
            return false;
          }
        }
      }
      
      // Final check: Verify no video tracks are in 'live' state anywhere
      // We've already checked all known sources, so if we get here, camera should be off
      // Additional verification: Check if any tracks are in 'ended' state but might still be holding hardware
      let foundEndedVideoTracks = 0;
      const allVideoElements = document.querySelectorAll('video');
      for (const videoEl of allVideoElements) {
        const stream = (videoEl as HTMLVideoElement).srcObject as MediaStream | null;
        if (stream) {
          const videoTracks = stream.getVideoTracks();
          foundEndedVideoTracks += videoTracks.filter(t => t.readyState === 'ended').length;
        }
      }
      
      if (foundEndedVideoTracks > 0) {
        console.log(`ℹ️ Found ${foundEndedVideoTracks} ended video track(s) - these should not hold camera hardware`);
      }
      
      // CRITICAL: Additional hardware-level check - try to enumerate devices
      // This helps verify if the camera hardware is actually released
      // Note: This is async, so we can't wait for it, but we log it for debugging
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        navigator.mediaDevices.enumerateDevices().then(devices => {
          const videoInputDevices = devices.filter(d => d.kind === 'videoinput');
          console.log(`ℹ️ Found ${videoInputDevices.length} video input device(s) - checking if any are in use...`);
          // Note: We can't directly check if a device is "in use" via the API,
          // but if enumerateDevices completes without errors, it's a good sign
        }).catch(e => {
          console.warn('⚠️ Could not enumerate devices (this is normal if camera is still releasing):', e);
        });
      }
      
      console.log('✅ Camera is OFF: No active video tracks found in any checked location');
      return true;
    } catch (error) {
      console.warn('Error checking camera status:', error);
      // If we can't check, assume it's off to avoid blocking
      return true;
    }
  }

  /**
   * Wait for camera to turn off, polling until confirmed or timeout
   * Returns a promise that resolves when camera is off or timeout is reached
   * Requires multiple consecutive confirmations to ensure camera is really off
   */
  private async waitForCameraOff(maxWaitMs: number = 20000): Promise<boolean> {
    const startTime = Date.now();
    const pollInterval = 600; // Check every 600ms (less frequent to give browser more time)
    const minWaitMs = 12000; // Minimum 12 seconds wait even if camera appears off (browser needs significant time to release hardware - camera light is hardware indicator controlled by OS)
    const requiredConsecutiveChecks = 15; // Require 15 consecutive checks showing camera is off (very strict - camera light MUST be off, hardware indicator is OS-level)
    let consecutiveOffChecks = 0;
    
    return new Promise((resolve) => {
      const checkCamera = () => {
        const elapsed = Date.now() - startTime;
        const isOff = this.isCameraOff();
        
        if (isOff) {
          consecutiveOffChecks++;
          console.log(`✅ Camera check ${consecutiveOffChecks}/${requiredConsecutiveChecks}: Camera appears OFF`);
          
          // Require multiple consecutive checks AND minimum wait time
          if (consecutiveOffChecks >= requiredConsecutiveChecks && elapsed >= minWaitMs) {
            console.log(`✅ Camera confirmed OFF after ${elapsed}ms (${consecutiveOffChecks} consecutive checks)`);
            resolve(true);
            return;
          }
        } else {
          // Reset counter if camera is still on
          if (consecutiveOffChecks > 0) {
            console.log(`⚠️ Camera check failed - resetting counter (was at ${consecutiveOffChecks}/${requiredConsecutiveChecks})`);
            consecutiveOffChecks = 0;
          }
        }
        
        // Check timeout
        if (elapsed >= maxWaitMs) {
          if (consecutiveOffChecks >= requiredConsecutiveChecks) {
            console.log(`✅ Camera confirmed OFF after timeout (${consecutiveOffChecks} consecutive checks)`);
            resolve(true);
          } else {
            console.warn(`⚠️ Camera check timeout after ${maxWaitMs}ms - camera may still be on (only ${consecutiveOffChecks}/${requiredConsecutiveChecks} checks passed)`);
            resolve(false);
          }
          return;
        }
        
        // Continue polling
        setTimeout(checkCamera, pollInterval);
      };
      
      // Start checking
      checkCamera();
    });
  }

  private findAndStopAllActiveMediaStreams(): void {
    // CRITICAL: Find ALL active MediaStreams in the browser and stop their video tracks
    // This catches any streams we might have missed
    try {
      // Get all video elements and check their streams
      const videoElements = document.querySelectorAll('video');
      const audioElements = document.querySelectorAll('audio');
      
      const activeStreams = new Set<MediaStream>();
      
      // CRITICAL: Clear srcObject from video elements FIRST, then collect streams for stopping
      // This ensures browser releases camera before we stop tracks
      Array.from(videoElements).forEach(element => {
        const videoEl = element as HTMLVideoElement;
        const stream = videoEl.srcObject as MediaStream | null;
        console.log(`findAndStopAllActiveMediaStreams: Checking video element, has srcObject: ${!!stream}, stream ID: ${stream?.id || 'null'}`);
        if (stream) {
          // Clear srcObject FIRST to release camera
          console.log(`🚨 Clearing video element srcObject in findAndStopAllActiveMediaStreams (stream: ${stream.id})`);
          videoEl.srcObject = null;
          videoEl.pause();
          videoEl.load();
          videoEl.setAttribute('data-stream-cleared', 'true');
          console.log('✅ Cleared video element srcObject in findAndStopAllActiveMediaStreams');
          activeStreams.add(stream);
        } else {
          console.log('Video element has no srcObject (already cleared or never set)');
        }
      });
      
      // Collect all streams from audio elements (no need to clear srcObject for audio)
      Array.from(audioElements).forEach(element => {
        const stream = (element as HTMLAudioElement).srcObject as MediaStream | null;
        if (stream) {
          activeStreams.add(stream);
        }
      });
      
      // Also check if we can enumerate active tracks using MediaDevices
      // Note: This is a workaround - we can't directly enumerate streams, but we can check tracks
      if (activeStreams.size > 0) {
        console.log(`🚨 Found ${activeStreams.size} active MediaStream(s) - stopping all video tracks...`);
        activeStreams.forEach(stream => {
          const videoTracks = stream.getVideoTracks();
          const liveVideoTracks = videoTracks.filter(t => t.readyState === 'live');
          if (liveVideoTracks.length > 0) {
            console.log(`🚨 Found ${liveVideoTracks.length} LIVE video tracks in active stream - stopping...`);
            liveVideoTracks.forEach(track => {
              try {
                track.enabled = false;
                track.stop();
                // Try removing from stream if supported
                try {
                  if (typeof stream.removeTrack === 'function') {
                    stream.removeTrack(track);
                    console.log(`✅ Removed and stopped LIVE video track from active stream:`, track.id);
                  } else {
                    console.log(`✅ Stopped LIVE video track from active stream:`, track.id);
                  }
                } catch (e) {
                  console.log(`✅ Stopped LIVE video track from active stream:`, track.id);
                }
              } catch (e) {
                console.warn(`Error stopping video track from active stream:`, e);
              }
            });
          }
        });
      }
    } catch (e) {
      console.warn('Error finding active media streams:', e);
    }
  }

  private cleanupLocalStream(capturedPeerConnection?: RTCPeerConnection): void {
    console.log('🧹 Cleaning up local stream (stopping camera/microphone)...');
    
    // CRITICAL: FIRST, clear video element srcObject - this tells browser the element isn't using the stream
    // This must happen BEFORE replacing tracks in senders to ensure proper camera release
    try {
      const videoElements = document.querySelectorAll('video');
      videoElements.forEach((videoEl) => {
        const stream = videoEl.srcObject as MediaStream | null;
        if (stream) {
          const videoTracks = stream.getVideoTracks();
          if (videoTracks.length > 0) {
            console.log('🚨 STEP 1: Clearing video element srcObject FIRST (before peer connection cleanup)');
            videoEl.setAttribute('data-stream-cleared', 'true');
            videoEl.setAttribute('data-camera-released', 'true');
            videoEl.srcObject = null;
            videoEl.pause();
            videoEl.load();
            console.log('✅ STEP 1: Video element srcObject cleared');
          }
        }
      });
    } catch (e) {
      console.warn('Error clearing video elements in step 1:', e);
    }
    
    // CRITICAL: SECOND, replace tracks in peer connection senders with null
    // This must happen AFTER clearing video element srcObject, but BEFORE stopping tracks
    // The browser releases the camera when the track is removed from the peer connection
    // Use captured peer connection if provided (for outbound calls where session may be disposed)
    // Otherwise fall back to current session's peer connection (for inbound calls)
    const pc = capturedPeerConnection || (this.currentSession ? 
      ((this.currentSession as any).sessionDescriptionHandler?.peerConnection as RTCPeerConnection | undefined) : 
      undefined);
    
    if (pc) {
      try {
        // Check if peer connection is already closed
        const pcState = pc.connectionState;
        if (pcState === 'closed' || pcState === 'failed') {
          console.log(`⚠️ Peer connection is already ${pcState} - skipping track replacement (camera already released)`);
          return; // Connection is closed, camera is already released
        }
          
          console.log('🛑 STEP 2: Replacing tracks in peer connection senders with null (after clearing video element)...');
          const senders = pc.getSenders();
          const liveSenders = senders.filter(s => s.track && s.track.readyState === 'live');
          console.log(`Found ${senders.length} senders (${liveSenders.length} with LIVE tracks)`);
          
          // CRITICAL: Replace LIVE tracks with null IMMEDIATELY - this releases camera
          // Do this synchronously for all senders - the browser will process it immediately
          liveSenders.forEach(sender => {
            if (sender.track) {
              const track = sender.track;
              console.log(`🛑 STEP 2: Replacing LIVE sender ${track.kind} track with null (immediate camera release):`, track.id);
              try {
                // Replace track with null - this immediately releases the camera
                // Don't await - let it happen in parallel while we continue cleanup
                sender.replaceTrack(null).then(() => {
                  console.log(`✅ Replaced LIVE sender ${track.kind} track with null - camera should be released`);
                }).catch(e => {
                  // Ignore errors if connection is closed (camera is already released)
                  if (e.name === 'InvalidStateError' && (pc.connectionState === 'closed' || pc.connectionState === 'failed')) {
                    console.log(`✅ Track replacement skipped - peer connection is ${pc.connectionState} (camera already released)`);
                  } else {
                    console.warn(`Error replacing LIVE track with null:`, e);
                  }
                });
              } catch (error) {
                // Ignore errors if connection is closed
                if (error instanceof Error && error.name === 'InvalidStateError' && (pc.connectionState === 'closed' || pc.connectionState === 'failed')) {
                  console.log(`✅ Track replacement skipped - peer connection is ${pc.connectionState} (camera already released)`);
                } else {
                  console.warn(`Error replacing LIVE sender ${track.kind} track:`, error);
                }
              }
            }
          });
          
          // Also replace non-LIVE tracks to be thorough
          senders.filter(s => s.track && s.track.readyState !== 'live').forEach(sender => {
            if (sender.track) {
              const track = sender.track;
              console.log(`🛑 Replacing ${track.kind} track with null:`, track.id);
              try {
                sender.replaceTrack(null).then(() => {
                  console.log(`✅ Replaced ${track.kind} track with null`);
                }).catch(e => {
                  // Ignore errors if connection is closed (camera is already released)
                  if (e.name === 'InvalidStateError' && (pc.connectionState === 'closed' || pc.connectionState === 'failed')) {
                    console.log(`✅ Track replacement skipped - peer connection is ${pc.connectionState} (camera already released)`);
                  } else {
                    console.warn(`Error replacing track with null:`, e);
                  }
                });
              } catch (error) {
                // Ignore errors if connection is closed
                if (error instanceof Error && error.name === 'InvalidStateError' && (pc.connectionState === 'closed' || pc.connectionState === 'failed')) {
                  console.log(`✅ Track replacement skipped - peer connection is ${pc.connectionState} (camera already released)`);
                } else {
                  console.warn(`Error replacing sender ${track.kind} track:`, error);
                }
              }
            }
          });
          
          console.log('✅ Initiated track replacement in peer connection - camera should be releasing now');
          
          // CRITICAL: Close peer connection immediately after replacing tracks
          // This forces the browser to release all resources, including the camera
          // ALWAYS close during cleanup - we're ending the call, so peer connection must be closed
          // This is critical for camera release - the browser won't release camera until peer connection is closed
          try {
            const sessionState = this.currentSession?.state;
            // Check connection state before closing (might have been closed by another cleanup)
            if (pc.connectionState !== 'closed' && pc.connectionState !== 'failed') {
              console.log('🛑 FORCING peer connection close to release camera (session state:', sessionState, ', connection state:', pc.connectionState, ')...');
              pc.close();
              console.log('✅ Peer connection closed - camera should be released now');
            } else {
              console.log(`✅ Peer connection already ${pc.connectionState} - camera should already be released`);
            }
          } catch (closeError) {
            console.warn('Error closing peer connection:', closeError);
            // Even if close fails, try to force close
            try {
              if (pc.connectionState !== 'closed' && pc.connectionState !== 'failed') {
                pc.close();
                console.log('✅ Force-closed peer connection after error');
              }
            } catch (e) {
              console.warn('Error force-closing peer connection:', e);
            }
          }
      } catch (error) {
        console.warn('Error replacing tracks in peer connection:', error);
      }
    }
    
    // CRITICAL: First, find and stop ALL active MediaStreams in the browser
    // This catches any streams we might have missed
    this.findAndStopAllActiveMediaStreams();
    
    // CRITICAL: ALWAYS try to clear video elements FIRST, even if this.localStream is null
    // This ensures browser releases camera hardware immediately
    // The video element might still have a stream reference even if this.localStream is null
    try {
      // Find all video elements in the document that might have a stream
      const videoElements = document.querySelectorAll('video');
      console.log(`Found ${videoElements.length} video elements to check`);
      videoElements.forEach((videoEl) => {
        const stream = videoEl.srcObject as MediaStream | null;
        if (stream) {
          console.log(`Video element has stream: ${stream.id}, active: ${stream.active}`);
          // Check if this stream has video tracks (camera) - clear it regardless of whether it matches this.localStream
          const videoTracks = stream.getVideoTracks();
          console.log(`Video element stream has ${videoTracks.length} video tracks`);
          if (videoTracks.length > 0) {
            // Check if this is our stream (by reference or ID) OR if this.localStream is null (cleanup all video streams)
            // When localStream is null, we aggressively clear ANY video stream to ensure camera is released
            const isOurStream = this.localStream 
              ? (stream === this.localStream || stream.id === this.localStream.id)
              : true; // If localStream is null, clear ANY video stream we find (aggressive cleanup)
            
            console.log(`isOurStream: ${isOurStream}, localStream: ${this.localStream ? this.localStream.id : 'null'}`);
            if (isOurStream) {
              console.log('🚨 Found video element with video stream - clearing immediately');
              if (this.localStream) {
                console.log(`Video element stream ID: ${stream.id}, our stream ID: ${this.localStream.id}`);
              } else {
                console.log(`Video element stream ID: ${stream.id}, localStream is null (aggressive cleanup - clearing all video streams)`);
              }
              
              // CRITICAL: Get track references BEFORE clearing srcObject
              const allTracks = stream.getTracks();
              const liveTracks = allTracks.filter(t => t.readyState === 'live');
              console.log(`Found ${allTracks.length} tracks in video element (${liveTracks.length} LIVE) to stop`);
              
              // CRITICAL: Clear srcObject FIRST - this tells the browser the video element is no longer using the stream
              // This must happen BEFORE stopping tracks to ensure proper camera release
              videoEl.setAttribute('data-stream-cleared', 'true');
              videoEl.setAttribute('data-camera-released', 'true');
              videoEl.srcObject = null;
              videoEl.pause();
              videoEl.load();
              console.log('✅ Video element srcObject cleared FIRST (before stopping tracks)');
              
              // CRITICAL: NOW stop tracks after srcObject is cleared
              // This ensures the browser knows the video element is no longer using them
              
              // CRITICAL: Remove tracks from stream before stopping (if supported)
              if (typeof stream.removeTrack === 'function') {
                allTracks.forEach(track => {
                  try {
                    stream.removeTrack(track);
                    console.log(`✅ Removed ${track.kind} track from stream:`, track.id);
                  } catch (e) {
                    console.log(`Could not remove ${track.kind} track from stream:`, e);
                  }
                });
              }
              
              // CRITICAL: Prioritize stopping LIVE tracks first (these are actively using camera)
              liveTracks.forEach(track => {
                console.log(`🛑 Stopping LIVE ${track.kind} track from video element:`, track.id);
                try {
                  track.enabled = false;
                  track.stop();
                  // Try stopping again immediately
                  try {
                    track.stop();
                    track.enabled = false;
                  } catch (e) {
                    // Ignore if already stopped
                  }
                  console.log(`✅ Stopped LIVE ${track.kind} track from video element`);
                } catch (e) {
                  console.warn(`Error stopping LIVE ${track.kind} track:`, e);
                }
              });
              
              // Also stop non-live tracks to be thorough
              allTracks.filter(t => t.readyState !== 'live').forEach(track => {
                console.log(`Stopping ${track.kind} track from video element:`, track.id, 'readyState:', track.readyState);
                try {
                  track.enabled = false;
                  track.stop();
                  console.log(`✅ Stopped ${track.kind} track from video element`);
                } catch (e) {
                  // Ignore if already stopped
                }
              });
            
            // CRITICAL: Clear srcObject multiple times with delays to ensure it stays cleared
            // This prevents React from re-attaching the stream
            [50, 100, 200, 500, 1000, 2000].forEach((delay, index) => {
              setTimeout(() => {
                if (videoEl.srcObject) {
                  console.warn(`🚨 [Clear ${index + 1}] Video element srcObject was re-attached - clearing again...`);
                  const reattachedStream = videoEl.srcObject as MediaStream | null;
                  if (reattachedStream) {
                    // Stop any tracks in the re-attached stream
                    const tracks = reattachedStream.getTracks();
                    const liveTracks = tracks.filter(t => t.readyState === 'live');
                    if (liveTracks.length > 0) {
                      console.warn(`🚨 [Clear ${index + 1}] Found ${liveTracks.length} LIVE tracks in re-attached stream - stopping...`);
                      liveTracks.forEach(track => {
                        try {
                          track.enabled = false;
                          track.stop();
                          console.log(`✅ [Clear ${index + 1}] Stopped LIVE ${track.kind} track`);
                        } catch (e) {
                          console.warn(`[Clear ${index + 1}] Error stopping track:`, e);
                        }
                      });
                    }
                  }
                  videoEl.srcObject = null;
                  videoEl.pause();
                  videoEl.load();
                  videoEl.setAttribute('data-stream-cleared', 'true');
                  videoEl.setAttribute('data-camera-released', 'true');
                } else {
                  console.log(`✅ [Clear ${index + 1}] Video element srcObject is null (good)`);
                }
              }, delay);
            });
            
            // CRITICAL: Temporarily remove video element from DOM to force browser to release camera
            // This is the most aggressive way to ensure camera is released
            const parent = videoEl.parentNode;
            const nextSibling = videoEl.nextSibling;
            if (parent) {
              try {
                // Remove from DOM - this forces browser to release camera
                parent.removeChild(videoEl);
                console.log('✅ Video element removed from DOM');
                
                // Small delay to ensure browser processes the removal
                setTimeout(() => {
                  // Re-insert immediately (but without srcObject)
                  // This forces browser to release camera hardware
                  if (parent && nextSibling) {
                    parent.insertBefore(videoEl, nextSibling);
                  } else if (parent) {
                    parent.appendChild(videoEl);
                  }
                  // Ensure srcObject is still null after re-insertion
                  videoEl.srcObject = null;
                  videoEl.pause();
                  videoEl.load();
                  console.log('✅ Video element re-inserted into DOM (camera should be released)');
                }, 10);
              } catch (e) {
                console.warn('Could not remove/re-insert video element:', e);
              }
            }
            
            // Force the video element to be hidden/disabled to ensure camera release
            videoEl.style.display = 'none';
            videoEl.muted = true;
            videoEl.volume = 0;
            
            // Use requestAnimationFrame to ensure browser processes the change
            requestAnimationFrame(() => {
              videoEl.srcObject = null;
              videoEl.pause();
              videoEl.load();
            });
            
            console.log('✅ Video element cleared and re-inserted synchronously');
            }
          }
        } else {
          // CRITICAL: Even if video element has no stream, ensure it's cleared
          // This handles cases where stream was cleared but element still holds a reference
          if (videoEl.hasAttribute('data-stream-cleared')) {
            // Already marked as cleared, but ensure it's really cleared
            videoEl.srcObject = null;
            videoEl.pause();
            videoEl.load();
            console.log('✅ Video element without stream cleared (was marked as cleared)');
          } else {
            // No stream and not marked as cleared - might be a new element, clear it anyway if localStream is null
            if (!this.localStream) {
              console.log('🚨 Video element has no stream but localStream is null - clearing anyway');
              videoEl.srcObject = null;
              videoEl.pause();
              videoEl.load();
              videoEl.setAttribute('data-stream-cleared', 'true');
              console.log('✅ Video element without stream cleared (aggressive cleanup)');
            }
          }
        }
      });
    } catch (e) {
      console.warn('Could not access video elements directly:', e);
    }
    
    // Now handle this.localStream if it exists
    if (this.localStream) {
      const tracks = Array.from(this.localStream.getTracks());
      console.log(`Found ${tracks.length} local tracks to stop`);
      
      // CRITICAL: Stop tracks FIRST, then clear stream reference
      // This ensures tracks are stopped before any video element cleanup
      // CRITICAL: Stop tracks multiple times to ensure they're really stopped
      // Some browsers need multiple stop() calls to fully release the camera
      tracks.forEach(track => {
        console.log(`Stopping ${track.kind} track:`, track.id, 'readyState:', track.readyState);
        try {
          // First attempt: disable then stop
          track.enabled = false;
          if (track.readyState !== 'ended') {
            track.stop();
          }
          console.log(`✅ Stopped ${track.kind} track (attempt 1)`);
          
          // Second attempt: try stopping again immediately
          try {
            track.stop();
            track.enabled = false;
            console.log(`✅ Stopped ${track.kind} track (attempt 2)`);
          } catch (e) {
            // Ignore if already stopped
          }
        } catch (error) {
          console.warn(`Error stopping ${track.kind} track:`, error);
          // Try again with enabled = false first
          try {
            track.enabled = false;
            track.stop();
            console.log(`✅ Stopped ${track.kind} track (retry)`);
          } catch (e2) {
            console.warn(`Failed to stop ${track.kind} track after retry:`, e2);
            // Last resort: try one more time
            try {
              track.stop();
              track.enabled = false;
            } catch (e3) {
              // Give up
            }
          }
        }
      });
      
      // CRITICAL: Get all tracks BEFORE clearing the stream reference
      // This ensures we can still access tracks even after stream is null
      const streamToClear = this.localStream;
      const allTracksSnapshot = Array.from(streamToClear.getTracks());
      
      // CRITICAL: Remove tracks from the stream BEFORE stopping them
      // This helps the browser release the camera more aggressively
      console.log(`🛑 Removing ${allTracksSnapshot.length} tracks from stream before stopping...`);
      allTracksSnapshot.forEach(track => {
        try {
          // Remove track from stream - this helps browser release camera
          // Note: removeTrack may not be available in all browsers
          if (typeof streamToClear.removeTrack === 'function') {
            streamToClear.removeTrack(track);
            console.log(`✅ Removed ${track.kind} track from stream:`, track.id);
          } else {
            console.log(`⚠️ removeTrack not supported for ${track.kind} track, will stop directly`);
          }
        } catch (e) {
          // Some browsers don't support removeTrack, that's okay
          console.log(`Could not remove ${track.kind} track from stream (may not be supported):`, e);
        }
      });
      
      // CRITICAL: Clear stream reference and notify UI IMMEDIATELY
      // This must happen synchronously to ensure UI clears video element
      this.localStream = null;
      
      // Notify UI immediately - this triggers VideoCall component cleanup
      this.onLocalStreamChange?.(null);
      
      // CRITICAL: Force stop all tracks from the snapshot (even if stream is now null)
      // This ensures tracks are stopped even if they were missed earlier
      console.log(`🛑 Force stopping ${allTracksSnapshot.length} tracks from stream snapshot...`);
      allTracksSnapshot.forEach(track => {
        try {
          // Force stop regardless of state
          track.enabled = false;
          if (track.readyState === 'live') {
            console.log(`🛑 Force stopping LIVE ${track.kind} track:`, track.id);
            track.stop();
            console.log(`✅ Force stopped LIVE ${track.kind} track`);
          } else {
            // Even if not live, try to stop to ensure release
            try {
              track.stop();
              track.enabled = false;
              console.log(`✅ Force stopped ${track.kind} track (state: ${track.readyState})`);
            } catch (e) {
              console.log(`Track ${track.kind} already stopped`);
            }
          }
        } catch (e) {
          console.warn(`Error force stopping ${track.kind} track:`, e);
        }
      });
      
      console.log('✅ Local stream cleaned up - camera should be released');
      
      // Double-check: ensure all tracks are stopped after short delays
      // Sometimes tracks might not be fully stopped immediately, or browser needs time to release camera
      [50, 100, 200, 500].forEach((delay, index) => {
        setTimeout(() => {
          // Use snapshot to check tracks (stream might be null now)
          const remainingTracks = allTracksSnapshot.filter(t => t.readyState !== 'ended');
          if (remainingTracks.length > 0) {
            console.log(`⚠️ [Check ${index + 1}] Found ${remainingTracks.length} remaining LIVE tracks, stopping again...`);
            remainingTracks.forEach(track => {
              try {
                // Force stop regardless of state
                track.enabled = false;
                if (track.readyState === 'live') {
                  console.log(`🛑 [Check ${index + 1}] Force stopping LIVE ${track.kind} track:`, track.id);
                  track.stop();
                  console.log(`✅ [Check ${index + 1}] Stopped LIVE ${track.kind} track`);
                } else {
                  // Even if not live, try to stop to ensure release
                  try {
                    track.stop();
                    track.enabled = false;
                    console.log(`✅ [Check ${index + 1}] Stopped ${track.kind} track (state: ${track.readyState})`);
                  } catch (e) {
                    // Ignore if already ended
                  }
                }
              } catch (e) {
                console.warn(`[Check ${index + 1}] Error stopping ${track.kind} track:`, e);
              }
            });
          } else {
            console.log(`✅ [Check ${index + 1}] All tracks are ended`);
          }
        }, delay);
      });
      
      // CRITICAL: Final check after 1 second to verify camera is released
      setTimeout(() => {
        try {
          // First, do a comprehensive scan for all active streams
          this.findAndStopAllActiveMediaStreams();
          
          // Check if there are any video elements still with active streams
          const videoElements = document.querySelectorAll('video');
          let hasActiveStreams = false;
          videoElements.forEach(videoEl => {
            const stream = videoEl.srcObject as MediaStream | null;
            if (stream) {
              const videoTracks = stream.getVideoTracks();
              const liveVideoTracks = videoTracks.filter(t => t.readyState === 'live');
              if (liveVideoTracks.length > 0) {
                hasActiveStreams = true;
                console.warn(`🚨 FINAL CHECK: Found ${liveVideoTracks.length} LIVE video tracks in video element - forcing stop...`);
                liveVideoTracks.forEach(track => {
                  try {
                    track.enabled = false;
                    track.stop();
                    // Try removing from stream if supported
                    try {
                      if (typeof stream.removeTrack === 'function') {
                        stream.removeTrack(track);
                      }
                    } catch (e) {
                      // Ignore if removeTrack not supported
                    }
                    console.log(`✅ FINAL CHECK: Stopped LIVE video track:`, track.id);
                  } catch (e) {
                    console.warn(`FINAL CHECK: Error stopping video track:`, e);
                  }
                });
                // Clear the video element
                videoEl.srcObject = null;
                videoEl.pause();
                videoEl.load();
              }
            }
          });
          
          // Check snapshot tracks one more time
          const stillLiveTracks = allTracksSnapshot.filter(t => t.readyState === 'live');
          if (stillLiveTracks.length > 0) {
            console.warn(`🚨 FINAL CHECK: Found ${stillLiveTracks.length} LIVE tracks in snapshot - forcing stop...`);
            stillLiveTracks.forEach(track => {
              try {
                track.enabled = false;
                track.stop();
                console.log(`✅ FINAL CHECK: Stopped LIVE ${track.kind} track:`, track.id);
              } catch (e) {
                console.warn(`FINAL CHECK: Error stopping ${track.kind} track:`, e);
              }
            });
          }
          
          if (!hasActiveStreams && stillLiveTracks.length === 0) {
            console.log('✅ FINAL CHECK: All tracks are stopped, camera should be released');
          } else {
            console.warn(`⚠️ FINAL CHECK: Some tracks may still be active - camera might still be on`);
          }
        } catch (e) {
          console.warn('FINAL CHECK: Error during final verification:', e);
        }
      }, 1000);
    } else {
      console.log('Local stream is already null');
    }
  }

  private handleRemoteTermination(session: Session): void {
    console.log('🔄 Handling remote termination...');
    // Only handle if this is the current session
    if (this.currentSession === session || !this.currentSession) {
      console.log('Cleaning up after remote termination');
      
      // CRITICAL: Clean up local stream FIRST to release camera immediately
      this.cleanupLocalStream();
      
      // CRITICAL: Stop tracks from the session's peer connection BEFORE cleanup
      // The session might be terminated, but the peer connection might still exist
      try {
        const sdh = (session as any).sessionDescriptionHandler;
        const pc = sdh?.peerConnection as RTCPeerConnection | undefined;
        if (pc) {
          console.log('🛑 Stopping all tracks from session peer connection...');
          // CRITICAL: Replace tracks in senders with null FIRST, then stop them
          // Check if peer connection is still open before trying to replace tracks
          if (pc.connectionState === 'closed' || pc.signalingState === 'closed') {
            console.log('⚠️ Peer connection is already closed, stopping tracks directly');
            const senders = pc.getSenders();
            senders.forEach(sender => {
              if (sender.track && sender.track.readyState === 'live') {
                try {
                  sender.track.enabled = false;
                  sender.track.stop();
                  console.log(`✅ Stopped LIVE sender ${sender.track.kind} track (PC closed)`);
                } catch (e) {
                  console.warn(`Error stopping track (PC closed):`, e);
                }
              }
            });
            return;
          }
          
          // This releases the camera immediately
          const senders = pc.getSenders();
          const liveSenders = senders.filter(s => s.track && s.track.readyState === 'live');
          console.log(`Found ${senders.length} senders (${liveSenders.length} with LIVE tracks)`);
          
          // Replace LIVE tracks with null first (these are actively using camera)
          liveSenders.forEach(sender => {
            if (sender.track) {
              const track = sender.track;
              console.log(`🛑 Replacing LIVE sender ${track.kind} track with null (terminated session):`, track.id);
              try {
                sender.replaceTrack(null).then(() => {
                  console.log(`✅ Replaced LIVE sender ${track.kind} track with null`);
                  try {
                    track.enabled = false;
                    track.stop();
                    console.log(`✅ Stopped LIVE sender ${track.kind} track after replacement`);
                  } catch (e) {
                    console.warn(`Error stopping track after replacement:`, e);
                  }
                }).catch(e => {
                  console.warn(`Error replacing LIVE track with null:`, e);
                  try {
                    track.enabled = false;
                    track.stop();
                    console.log(`✅ Stopped LIVE sender ${track.kind} track (fallback)`);
                  } catch (e2) {
                    console.warn(`Error stopping track in fallback:`, e2);
                  }
                });
              } catch (error) {
                console.warn(`Error replacing LIVE sender ${track.kind} track:`, error);
                try {
                  track.enabled = false;
                  track.stop();
                  console.log(`✅ Stopped LIVE sender ${track.kind} track (fallback)`);
                } catch (e) {
                  console.warn(`Error stopping track in fallback:`, e);
                }
              }
            }
          });
          
          // Also replace and stop non-live tracks
          senders.filter(s => s.track && s.track.readyState !== 'live').forEach(sender => {
            if (sender.track) {
              const track = sender.track;
              console.log(`Stopping sender ${track.kind} track from terminated session:`, track.id);
              try {
                sender.replaceTrack(null).catch(() => {
                  // If replaceTrack fails, just stop the track
                });
                track.enabled = false;
                track.stop();
                console.log(`✅ Stopped sender ${track.kind} track`);
              } catch (error) {
                console.warn(`Error stopping sender ${track.kind} track:`, error);
              }
            }
          });
          // Stop all receivers
          pc.getReceivers().forEach(receiver => {
            if (receiver.track) {
              try {
                receiver.track.stop();
                console.log(`✅ Stopped receiver ${receiver.track.kind} track`);
              } catch (error) {
                console.warn(`Error stopping receiver ${receiver.track.kind} track:`, error);
              }
            }
          });
        }
      } catch (error) {
        console.warn('Error stopping tracks from session peer connection:', error);
      }
      
      // CRITICAL: Call cleanup to ensure all streams and camera are closed
      // cleanup() is idempotent and safe to call multiple times
      this.cleanup();
      this.currentSession = null;
      this.onStateChange?.(CallStatus.IDLE);
      // Auto-register after session terminates, but only if not already registered
      setTimeout(() => {
        // Check if already registered before attempting auto-registration
        if (this.registerer && this.ua && this.ua.isConnected()) {
          const registererState = (this.registerer.state as any).toString ? (this.registerer.state as any).toString() : String(this.registerer.state);
          if (registererState === 'Registered' || registererState.includes('Registered')) {
            // Already registered, just ensure status is correct
            this.onStateChange?.(CallStatus.REGISTERED);
            return;
          }
        }
        // Not registered, attempt auto-registration
        this.autoRegisterIfNeeded().catch(error => {
          console.error('Auto-registration error after session terminated:', error);
        });
      }, 500);
    } else {
      console.log('Session termination event for different session, ignoring');
    }
  }

  private setupPeerConnectionListeners(session: Session): void {
    const sdh = (session as any).sessionDescriptionHandler;
    const pc = sdh?.peerConnection as RTCPeerConnection | undefined;
    if (!pc) {
      console.warn('Không có kết nối ngang hàng, sẽ thử lại sau');
      // Try again after a short delay
      setTimeout(() => {
        const retrySdh = (session as any).sessionDescriptionHandler;
        const retryPc = retrySdh?.peerConnection as RTCPeerConnection | undefined;
        if (retryPc) {
          console.log('Retry: Tìm thấy peer connection');
          this.setupPeerConnectionListeners(session);
        }
      }, 500);
      return;
    }
    
    // Create or reuse a MediaStream to collect all remote tracks
    if (!this.remoteStream) {
      this.remoteStream = new MediaStream();
    }
    const remoteMediaStream = this.remoteStream;

    const updateRemoteStream = () => {
      // Get all receivers and their active tracks
      const receivers = pc.getReceivers();
      const activeReceiverTracks = receivers
        .map((receiver: RTCRtpReceiver) => receiver.track)
        .filter((track): track is MediaStreamTrack => track !== null && track.readyState === 'live');
      
      // Get current tracks in the stream
      const currentTracks = remoteMediaStream.getTracks();
      const currentTrackIds = new Set(currentTracks.map(t => t.id));
      const activeReceiverTrackIds = new Set(activeReceiverTracks.map(t => t.id));
      
      // Remove tracks that are no longer in receivers or are ended
      currentTracks.forEach(track => {
        if (!activeReceiverTrackIds.has(track.id) || track.readyState === 'ended') {
          console.log(`Removing ${track.kind} track from remote stream (ended or not in receivers):`, track.id);
          try {
            remoteMediaStream.removeTrack(track);
          } catch (error) {
            console.warn(`Error removing ${track.kind} track:`, error);
          }
        }
      });
      
      // Add new tracks from receivers that aren't already in the stream
      activeReceiverTracks.forEach(track => {
        if (!currentTrackIds.has(track.id)) {
          console.log(`Thêm track ${track.kind} vào remote stream:`, track);
          // Enable remote tracks by default
          track.enabled = true;
          try {
            remoteMediaStream.addTrack(track);
            console.log(`✅ Remote ${track.kind} track enabled by default`);
          } catch (error) {
            console.warn(`Error adding ${track.kind} track to remote stream:`, error);
          }
        }
      });

      // Update remote stream if we have tracks
      const finalTracks = remoteMediaStream.getTracks();
      if (finalTracks.length > 0) {
        console.log('Cập nhật remote stream với', finalTracks.length, 'tracks');
        
        // Ensure all remote tracks are enabled by default
        finalTracks.forEach(track => {
          if (track.readyState === 'live') {
            track.enabled = true;
          }
        });
        
        const videoTracks = remoteMediaStream.getVideoTracks().filter(t => t.readyState === 'live');
        const audioTracks = remoteMediaStream.getAudioTracks().filter(t => t.readyState === 'live');
        console.log(`  - Video tracks: ${videoTracks.length} (live)`);
        console.log(`  - Audio tracks: ${audioTracks.length} (live)`);
        
        this.remoteStream = remoteMediaStream;
        this.onRemoteStreamChange?.(this.remoteStream);
        
        // Log track details
        finalTracks.forEach(track => {
          console.log(`Remote track ${track.kind}: enabled=${track.enabled}, readyState=${track.readyState}, muted=${track.muted}`);
        });
        
        // Specifically log video tracks
        if (videoTracks.length > 0) {
          console.log('✅ VIDEO TRACKS in updateRemoteStream:', videoTracks.map(t => ({
            id: t.id,
            enabled: t.enabled,
            readyState: t.readyState,
            muted: t.muted
          })));
        }
      } else {
        // Clear remote stream if no active tracks
        this.remoteStream = null;
        this.onRemoteStreamChange?.(null);
        console.log('No active remote tracks, cleared remote stream');
      }
    };

    // CRITICAL: Always call updateRemoteStream to capture any existing remote tracks
    // This is important for outbound calls where remote tracks might arrive before listeners are set up
    updateRemoteStream();

    // Prevent duplicate event listeners, but allow updateRemoteStream to be called
    if ((pc as any)._sipServiceListenersSetup) {
      console.log('Peer connection listeners đã được thiết lập, chỉ cập nhật remote stream');
      // Still update remote stream even if listeners are already set up
      // This ensures we capture remote tracks for outbound calls
      return;
    }
    (pc as any)._sipServiceListenersSetup = true;

    console.log('Thiết lập trình nghe kết nối ngang hàng');

    // Monitor track ended events to detect when remote side stops sending media
    const setupTrackEndedListeners = (track: MediaStreamTrack) => {
      // Only set up listener once
      if ((track as any)._endedListenerSetup) {
        return;
      }
      (track as any)._endedListenerSetup = true;
      
      track.onended = () => {
        console.log(`⚠️ Remote ${track.kind} track ended - remote side may have disconnected`);
        // Check if all remote tracks are ended
        const currentRemoteStream = this.remoteStream;
        if (currentRemoteStream) {
          const allTracksEnded = currentRemoteStream.getTracks().every(t => t.readyState === 'ended');
          if (allTracksEnded && this.currentSession === session) {
            console.log('📞 All remote tracks ended - handling as remote termination');
            setTimeout(() => {
              // Double check session state before terminating
              if (this.currentSession === session) {
                this.handleRemoteTermination(session);
              }
            }, 1000);
          }
        }
      };
    };

    pc.ontrack = (event: RTCTrackEvent) => {
      console.log('=== Nhận được track từ xa ===');
      console.log('Track event details:', {
        track: event.track,
        trackKind: event.track.kind,
        trackEnabled: event.track.enabled,
        trackReadyState: event.track.readyState,
        trackMuted: event.track.muted,
        streams: event.streams,
        streamsCount: event.streams?.length || 0,
        transceiver: event.transceiver
      });
      
      // Only process live tracks - ignore ended tracks
      if (event.track.readyState === 'ended') {
        console.log(`⚠️ Ignoring ${event.track.kind} track - already ended`);
        return;
      }
      
      // Set up ended listener for the track
      setupTrackEndedListeners(event.track);
      
      // Use updateRemoteStream to handle track addition/removal properly
      // This ensures we only keep live tracks and avoid duplicates
      updateRemoteStream();
      
      // Log video tracks specifically if this is a video track
      if (event.track.kind === 'video' && event.track.readyState === 'live') {
        console.log('✅ VIDEO TRACK RECEIVED!', {
          id: event.track.id,
          enabled: event.track.enabled,
          readyState: event.track.readyState,
          muted: event.track.muted
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('Trạng thái kết nối ngang hàng:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        this.onStateChange?.(CallStatus.ACTIVE);
        updateRemoteStream();
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        console.log('⚠️ Peer connection disconnected/failed/closed - remote side may have ended call');
        // CRITICAL: Clean up local stream immediately when peer connection fails
        // This ensures camera is released even if session doesn't terminate
        if (this.currentSession === session && this.localStream) {
          console.log('⚠️ Peer connection failed during call - cleaning up local stream immediately');
          this.cleanupLocalStream();
        }
        // Don't immediately terminate, wait a bit to see if it's temporary
        setTimeout(() => {
          if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
            console.log('📞 Peer connection still disconnected - handling as remote termination');
            if (this.currentSession === session) {
              this.handleRemoteTermination(session);
            }
          }
        }, 2000);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('Trạng thái kết nối ICE:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        updateRemoteStream();
      } else if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
        console.log('⚠️ ICE connection disconnected/failed/closed');
        // CRITICAL: Clean up local stream immediately when ICE connection fails
        // This ensures camera is released even if session doesn't terminate
        if (this.currentSession === session && this.localStream) {
          console.log('⚠️ ICE connection failed during call - cleaning up local stream immediately');
          this.cleanupLocalStream();
      }
        // Check if session is still active
        setTimeout(() => {
          if ((pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') &&
              session.state === 'Established') {
            console.log('📞 ICE connection failed while session established - may be remote termination');
            if (this.currentSession === session) {
              this.handleRemoteTermination(session);
            }
          }
        }, 2000);
      }
    };

    // Check for remote streams periodically to catch any late-arriving tracks
    setTimeout(() => {
      updateRemoteStream();
    }, 100);
    
    setTimeout(() => {
      updateRemoteStream();
    }, 500);
    
    setTimeout(() => {
      updateRemoteStream();
    }, 1000);
    
    setTimeout(() => {
      updateRemoteStream();
    }, 2000);
    
    setTimeout(() => {
      updateRemoteStream();
    }, 3000);
  }

  private checkForRemoteStreams(pc: RTCPeerConnection): void {
    console.log('Kiểm tra luồng từ xa...');

    // Try getRemoteStreams (deprecated but might still work)
    try {
      const remoteStreams = (pc as any).getRemoteStreams?.() || [];
      console.log('Tìm thấy luồng từ xa (getRemoteStreams):', remoteStreams.length);

      if (remoteStreams.length > 0) {
      console.log('Thiết lập luồng từ xa từ getRemoteStreams:', remoteStreams[0]);
      // Enable all remote tracks by default
      remoteStreams[0].getTracks().forEach((track: MediaStreamTrack) => {
        track.enabled = true;
        console.log(`✅ Remote ${track.kind} track enabled by default: ${track.id}`);
      });
      this.remoteStream = remoteStreams[0];
      this.onRemoteStreamChange?.(this.remoteStream);
        remoteStreams[0].getTracks().forEach((track: MediaStreamTrack) => {
        console.log(`Track từ xa ${track.kind} từ getRemoteStreams:`, track);
      });
        return;
      }
    } catch (e) {
      console.log('getRemoteStreams không khả dụng:', e);
    }

    // Fallback: Create stream from receivers
    const receivers = pc.getReceivers();
    console.log('Tìm thấy bộ nhận:', receivers.length);

    if (receivers.length > 0) {
      const remoteStream = new MediaStream();
    receivers.forEach((receiver, index) => {
      if (receiver.track) {
        console.log(`Bộ nhận ${index} track:`, receiver.track.kind, receiver.track);
        // Enable remote track by default
        receiver.track.enabled = true;
          remoteStream.addTrack(receiver.track);
          console.log(`✅ Remote ${receiver.track.kind} track enabled by default: ${receiver.track.id}`);
      }
    });

      if (remoteStream.getTracks().length > 0) {
        console.log('Tạo remote stream từ receivers với', remoteStream.getTracks().length, 'tracks');
        // Ensure all tracks are enabled
        remoteStream.getTracks().forEach(track => {
          track.enabled = true;
        });
        this.remoteStream = remoteStream;
        this.onRemoteStreamChange?.(this.remoteStream);
      }
    }
  }

  private cleanup(
    capturedPeerConnection?: RTCPeerConnection,
    capturedLocalStream?: MediaStream | null,
    capturedRemoteStream?: MediaStream | null
  ): void {
    // Prevent redundant cleanup calls
    if (this.isCleaningUp) {
      console.log('⚠️ Cleanup already in progress, skipping redundant call');
      return;
    }
    
    this.isCleaningUp = true;
    console.log('Dọn dẹp tài nguyên cuộc gọi...');

    // Use captured references if provided (for outbound calls where session may be disposed)
    // Otherwise fall back to current session and current streams
    const pc = capturedPeerConnection || (this.currentSession ? 
      ((this.currentSession as any).sessionDescriptionHandler?.peerConnection as RTCPeerConnection | undefined) : 
      undefined);
    const localStream = capturedLocalStream !== undefined ? capturedLocalStream : this.localStream;
    const remoteStream = capturedRemoteStream !== undefined ? capturedRemoteStream : this.remoteStream;

    console.log('Using cleanup references:', {
      hasPeerConnection: !!pc,
      hasLocalStream: !!localStream,
      hasRemoteStream: !!remoteStream,
      usingCaptured: !!(capturedPeerConnection || capturedLocalStream !== undefined || capturedRemoteStream !== undefined)
    });

    // CRITICAL: For outbound calls, ensure this.localStream is set to captured stream
    // This ensures cleanupLocalStream() can process it even if this.localStream was already cleared
    // cleanupLocalStream() will clear this.localStream, so we need to ensure it has the captured stream
    const originalLocalStream = this.localStream;
    if (capturedLocalStream && (!this.localStream || this.localStream !== capturedLocalStream)) {
      console.log('⚠️ Setting this.localStream to captured stream for cleanupLocalStream() (outbound call cleanup)');
      this.localStream = capturedLocalStream;
    }

    // CRITICAL: Call cleanupLocalStream FIRST - this handles video element cleanup and stream stopping
    // This is the most comprehensive cleanup method that handles all edge cases
    // For outbound calls, this will process the captured local stream we just set
    // Pass captured peer connection so it works even if session is disposed (outbound calls)
    this.cleanupLocalStream(pc);
    
    // After cleanupLocalStream(), this.localStream is likely null
    // Restore captured stream reference for additional cleanup below if needed
    if (capturedLocalStream && (!this.localStream || this.localStream !== capturedLocalStream)) {
      // Keep captured stream for additional cleanup below (cleanupLocalStream may have cleared it)
      this.localStream = capturedLocalStream;
    }

    // CRITICAL: Also stop local stream tracks directly (in case cleanupLocalStream didn't catch everything)
    // This ensures the camera is released even if peer connection ends the tracks
    // Note: localStream might already be null if it was cleared in cleanupLocalStream()
    // CRITICAL: Clean up BOTH captured reference AND current property to ensure outbound calls work properly
    const streamsToCleanup = new Set<MediaStream>();
    if (localStream) streamsToCleanup.add(localStream);
    if (this.localStream && this.localStream !== localStream) streamsToCleanup.add(this.localStream);
    
    if (streamsToCleanup.size > 0) {
      console.log(`Stopping local stream tracks from ${streamsToCleanup.size} stream(s) (additional cleanup)...`);
      streamsToCleanup.forEach(stream => {
        // Get a fresh copy of tracks array before anything can modify it
        const tracks = Array.from(stream.getTracks());
        const liveTracks = tracks.filter(t => t.readyState === 'live');
        console.log(`Found ${tracks.length} local tracks (${liveTracks.length} LIVE) to stop in stream ${stream.id}`);
        
        // CRITICAL: Prioritize stopping LIVE tracks first (these are actively using camera)
        liveTracks.forEach(track => {
          console.log(`🛑 Stopping LIVE ${track.kind} track:`, track.id);
          try {
            track.enabled = false;
            track.stop(); // This releases the camera/microphone
            // Try stopping again immediately
            try {
              track.stop();
              track.enabled = false;
            } catch (e) {
              // Ignore if already stopped
            }
            console.log(`✅ Stopped LIVE ${track.kind} track:`, track.id);
          } catch (error) {
            console.error(`Error stopping LIVE ${track.kind} track:`, error);
          }
        });
        
        // Also stop non-live tracks to be thorough
        tracks.filter(t => t.readyState !== 'live').forEach(track => {
          console.log(`Stopping ${track.kind} track:`, track.id, 'readyState:', track.readyState);
          try {
            if (track.readyState !== 'ended') {
              track.stop();
              track.enabled = false;
              console.log(`✅ Stopped ${track.kind} track:`, track.id);
            } else {
              console.log(`⚠️ Track ${track.kind} already ended, but trying to stop anyway to ensure release`);
              try {
                track.stop(); // Try to stop even if ended - some browsers need this
                track.enabled = false;
              } catch (e) {
                // Ignore errors if track is already ended
                console.log(`Track ${track.kind} already ended, cannot stop again`);
              }
            }
          } catch (error) {
            console.error(`Error stopping ${track.kind} track:`, error);
          }
        });
      });
      
      // Clear the stream reference immediately
      this.localStream = null;
      this.onLocalStreamChange?.(null);
      console.log('✅ Local stream cleaned up - camera should be released');
    } else {
      console.log('Local stream is null, but checking peer connection for active tracks...');
      // CRITICAL: Always clear this.localStream even if captured reference is null
      // This ensures outbound calls properly release streams
      if (this.localStream) {
        console.log('⚠️ this.localStream still exists, clearing it...');
        this.localStream.getTracks().forEach(track => {
          try {
            track.stop();
          } catch (e) {
            // Ignore errors
          }
        });
        this.localStream = null;
        this.onLocalStreamChange?.(null);
      }
    }

    // CRITICAL: Always try to stop tracks in peer connection, even if localStream is null
    // The tracks might still be active in the peer connection even if localStream was cleared
    // Use captured peer connection if available (for outbound calls where session may be disposed)
    if (pc) {
      try {
          console.log('Stopping tracks in peer connection...');
          // Stop all senders (local tracks) - these might still be active even if localStream is null
          const senders = pc.getSenders();
          const liveSenderTracks = senders.filter(s => s.track && s.track.readyState === 'live').map(s => s.track!);
          console.log(`Found ${senders.length} senders in peer connection (${liveSenderTracks.length} LIVE)`);
          
          // Check if peer connection is still open before trying to replace tracks
          if (pc.connectionState === 'closed' || pc.signalingState === 'closed') {
            console.log('⚠️ Peer connection is already closed, stopping tracks directly');
            senders.forEach(sender => {
              if (sender.track && sender.track.readyState === 'live') {
                try {
                  sender.track.enabled = false;
                  sender.track.stop();
                  console.log(`✅ Stopped LIVE sender ${sender.track.kind} track (PC closed)`);
                } catch (e) {
                  console.warn(`Error stopping track (PC closed):`, e);
                }
              }
            });
          } else {
            // CRITICAL: Replace tracks in senders with null FIRST, then stop them
            // This releases the camera immediately by removing the track from the peer connection
            senders.forEach(sender => {
              if (sender.track && sender.track.readyState === 'live') {
                const track = sender.track;
                console.log(`🛑 Replacing LIVE sender ${track.kind} track with null:`, track.id);
                try {
                  // CRITICAL: Replace track with null to release camera immediately
                  sender.replaceTrack(null).then(() => {
                    console.log(`✅ Replaced LIVE sender ${track.kind} track with null`);
                    // Now stop the track
                    try {
                      track.enabled = false;
                      track.stop();
                      console.log(`✅ Stopped LIVE sender ${track.kind} track after replacement`);
                    } catch (e) {
                      console.warn(`Error stopping track after replacement:`, e);
                    }
                  }).catch(e => {
                    console.warn(`Error replacing track with null:`, e);
                    // Fallback: just stop the track
                    try {
                      track.enabled = false;
                    track.stop();
                  } catch (e2) {
                    console.warn(`Error stopping track in fallback:`, e2);
                  }
                });
                } catch (error) {
                  console.warn(`Error initiating track replacement:`, error);
                  // Fallback: just stop the track
                  try {
                    track.enabled = false;
                    track.stop();
                    console.log(`✅ Stopped LIVE sender ${track.kind} track (error fallback)`);
                  } catch (e2) {
                    console.warn(`Error stopping track in error fallback:`, e2);
                  }
                }
              }
            });
          }
          
          // Also stop non-live sender tracks (regardless of PC state)
          senders.forEach(sender => {
            if (sender.track && sender.track.readyState !== 'live') {
              console.log(`Stopping sender ${sender.track.kind} track:`, sender.track.id, 'readyState:', sender.track.readyState);
              try {
                if (sender.track.readyState !== 'ended') {
                  sender.track.stop();
                  sender.track.enabled = false;
                  console.log(`✅ Stopped sender ${sender.track.kind} track:`, sender.track.id);
                } else {
                  // Try to stop anyway, even if ended
                  try {
                    sender.track.stop();
                    sender.track.enabled = false;
                    console.log(`✅ Stopped sender ${sender.track.kind} track (was already ended):`, sender.track.id);
                  } catch (e) {
                    console.log(`Sender ${sender.track.kind} track already ended`);
                  }
                }
              } catch (error) {
                console.warn('Error stopping sender track:', error);
              }
            }
          });
          // Stop all receivers (remote tracks)
          const receivers = pc.getReceivers();
          console.log(`Found ${receivers.length} receivers in peer connection`);
          receivers.forEach(receiver => {
            if (receiver.track) {
              console.log(`Stopping receiver ${receiver.track.kind} track:`, receiver.track.id);
              try {
                if (receiver.track.readyState !== 'ended') {
                  receiver.track.stop();
                  console.log(`✅ Stopped receiver ${receiver.track.kind} track:`, receiver.track.id);
                } else {
                  try {
                    receiver.track.stop();
                    console.log(`✅ Stopped receiver ${receiver.track.kind} track (was already ended):`, receiver.track.id);
                  } catch (e) {
                    console.log(`Receiver ${receiver.track.kind} track already ended`);
                  }
                }
              } catch (error) {
                console.warn('Error stopping receiver track:', error);
              }
            }
          });
          
          // CRITICAL: Close the peer connection to fully release all resources
          // This ensures the browser fully releases camera/microphone hardware
          try {
            if (pc.connectionState !== 'closed') {
              console.log('🛑 Closing peer connection to release all resources...');
              pc.close();
              console.log('✅ Peer connection closed');
            } else {
              console.log('Peer connection already closed');
            }
          } catch (error) {
            console.warn('Error closing peer connection:', error);
          }
      } catch (error) {
        console.warn('Error cleaning up peer connection tracks:', error);
      }
    } else {
      console.log('No peer connection available for cleanup');
    }

    // Clear remote stream
    // CRITICAL: Clean up BOTH captured reference AND current property to ensure outbound calls work properly
    const remoteStreamsToCleanup = new Set<MediaStream>();
    if (remoteStream) remoteStreamsToCleanup.add(remoteStream);
    if (this.remoteStream && this.remoteStream !== remoteStream) remoteStreamsToCleanup.add(this.remoteStream);
    
    if (remoteStreamsToCleanup.size > 0) {
      console.log(`Stopping remote stream tracks from ${remoteStreamsToCleanup.size} stream(s)...`);
      remoteStreamsToCleanup.forEach(stream => {
        // Stop remote tracks before clearing
        stream.getTracks().forEach(track => {
          try {
            track.stop();
          } catch (error) {
            console.warn('Error stopping remote track:', error);
          }
        });
      });
      this.remoteStream = null;
      this.onRemoteStreamChange?.(null);
      console.log('✅ Remote stream cleaned up');
    } else {
      // CRITICAL: Always clear this.remoteStream even if captured reference is null
      // This ensures outbound calls properly release streams
      if (this.remoteStream) {
        console.log('⚠️ this.remoteStream still exists, clearing it...');
        this.remoteStream.getTracks().forEach(track => {
          try {
            track.stop();
          } catch (e) {
            // Ignore errors
          }
        });
        this.remoteStream = null;
        this.onRemoteStreamChange?.(null);
      }
    }

    // CRITICAL: Final verification - ensure all video elements are cleared
    // This is a last resort to ensure camera is released
    try {
      const videoElements = document.querySelectorAll('video');
      videoElements.forEach(videoEl => {
        const stream = videoEl.srcObject as MediaStream | null;
        if (stream) {
          console.log('🚨 Final check: Found video element with stream - clearing...');
          // Stop all tracks
          stream.getTracks().forEach(track => {
            try {
              track.enabled = false;
              track.stop();
            } catch (e) {
              // Ignore errors
            }
          });
          // Clear the element
          videoEl.srcObject = null;
          videoEl.pause();
          videoEl.load();
          videoEl.setAttribute('data-stream-cleared', 'true');
          console.log('✅ Final check: Video element cleared');
        }
      });
    } catch (e) {
      console.warn('Error in final video element check:', e);
    }

    this.currentSession = null;
    console.log('✅ Cleanup complete - all tracks stopped, camera should be off');
    
    // Reset cleanup flag after a delay to allow final verification to complete
    setTimeout(() => {
      this.isCleaningUp = false;
    }, 1000);
    
    // CRITICAL: Final verification after a short delay to ensure camera is released
    setTimeout(() => {
      try {
        // First, do a comprehensive scan for any remaining active streams
        this.findAndStopAllActiveMediaStreams();
        
        const videoElements = document.querySelectorAll('video');
        let hasActiveStreams = false;
        videoElements.forEach(videoEl => {
          const stream = videoEl.srcObject as MediaStream | null;
          if (stream) {
            const videoTracks = stream.getVideoTracks();
            const activeVideoTracks = videoTracks.filter(track => track.readyState === 'live');
            if (activeVideoTracks.length > 0) {
              hasActiveStreams = true;
              console.warn(`⚠️ Final verification: Found ${activeVideoTracks.length} active video tracks - forcing stop...`);
              activeVideoTracks.forEach(track => {
                try {
                  track.enabled = false;
                  track.stop();
                  // Try removing from stream if supported
                  try {
                    if (typeof stream.removeTrack === 'function') {
                      stream.removeTrack(track);
                    }
                  } catch (e) {
                    // Ignore if removeTrack not supported
                  }
                } catch (e) {
                  // Ignore errors
                }
              });
              // Clear the video element
              videoEl.srcObject = null;
              videoEl.pause();
              videoEl.load();
              videoEl.setAttribute('data-stream-cleared', 'true');
            }
          }
        });
        
        if (!hasActiveStreams) {
          console.log('✅ Final verification: All video tracks are stopped, camera should be off');
        } else {
          console.warn('⚠️ Final verification: Some video tracks were still active - forced stop');
        }
      } catch (e) {
        console.warn('Error in final verification:', e);
      }
    }, 500);
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  getCurrentSession(): Session | null {
    return this.currentSession;
  }

  isConnected(): boolean {
    return this.ua?.isConnected() || false;
  }

  isRegistered(): boolean {
    return this.registerer?.state === 'Registered' || false;
  }

  onStateChanged(callback: (state: CallStatus) => void): void {
    this.onStateChange = callback;
  }

  onRemoteStreamChanged(callback: (stream: MediaStream | null) => void): void {
    this.onRemoteStreamChange = callback;
  }

  onLocalStreamChanged(callback: (stream: MediaStream | null) => void): void {
    this.onLocalStreamChange = callback;
  }

  async testConnection(config: SipConfig): Promise<void> {
    try {
      console.log('Testing SIP connection with config:', {
        domain: config.domain,
        uri: config.uri,
        wsServer: config.wsServer,
        hasPassword: !!config.password,
      });

      // Create a temporary UserAgent for testing
      const testUaConfig = {
        uri: new URI('sip', config.uri, config.domain),
        transportOptions: {
          server: config.wsServer,
          connectionTimeout: 15000,
          maxReconnectionAttempts: 1,
          reconnectionTimeout: 1000,
        },
        authorizationUser: config.uri,
        password: config.password || '',
        displayName: config.displayName || config.uri,
        register: false, // Don't auto-register for test
        registerExpires: 300,
        sessionDescriptionHandlerFactoryOptions: {
          constraints: {
            audio: true,
            video: false,
          },
          disableDtls: false, // Always enabled
          peerConnectionConfiguration: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
            ],
            rtcpMuxPolicy: 'require',
          },
        },
        userAgentString: 'WebRTC-SIP-Client/1.0',
        traceSip: false,
        logLevel: 'debug',
      };

      const testUa = new UserAgent(testUaConfig);
      let testRegisterer: Registerer | null = null;

      try {
        // Start the test UserAgent
        await testUa.start();

        // Wait for connection
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Connection timeout after 15 seconds'));
          }, 15000);

          const checkConnection = () => {
            if (testUa.isConnected()) {
              clearTimeout(timeout);
              resolve();
            } else {
              setTimeout(checkConnection, 100);
            }
          };
          checkConnection();
        });

        console.log('Test connection established, attempting registration...');

        // Create and configure registerer for test
        testRegisterer = new Registerer(testUa, {
          expires: 300,
        });

        // Test registration
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Registration timeout after 10 seconds'));
          }, 10000);

          const stateChangeHandler = (state: any) => {
            console.log(`Test registration state: ${state}`);
            if (state === 'Registered') {
              clearTimeout(timeout);
              testRegisterer!.stateChange.removeListener(stateChangeHandler);
              resolve();
            } else if (state === 'Terminated') {
              clearTimeout(timeout);
              testRegisterer!.stateChange.removeListener(stateChangeHandler);
              reject(new Error('Registration terminated'));
            }
          };

          testRegisterer!.stateChange.addListener(stateChangeHandler);
          testRegisterer!.register().catch(reject);
        });

        console.log('Test registration successful');

        // Clean up test registration
        if (testRegisterer) {
          await testRegisterer.unregister();
        }

      } finally {
        // Always clean up the test UserAgent
        if (testUa && testUa.state !== 'Stopped') {
          await testUa.stop();
        }
      }

    } catch (error) {
      console.error('Test connection failed:', error);
      throw error;
    }
  }

  sendDTMF(tone: string): void {
    if (this.currentSession && this.currentSession.state === 'Established') {
      console.log('Gửi âm DTMF:', tone);
      this.currentSession.dtmf(tone);
    } else {
      console.warn('Không thể gửi DTMF: không có phiên hoạt động');
    }
  }

  transfer(target: string): void {
    if (this.currentSession && this.currentSession.state === 'Established') {
      console.log('Chuyển cuộc gọi đến:', target);
      this.currentSession.refer(target);
    } else {
      console.warn('Không thể chuyển: không có phiên hoạt động');
    }
  }

  hold(): void {
    if (this.currentSession && this.currentSession.state === 'Established') {
      console.log('Đặt cuộc gọi vào trạng thái giữ');
      this.currentSession.hold();
    }
  }

  unhold(): void {
    if (this.currentSession && this.currentSession.state === 'Established') {
      console.log('Tiếp tục cuộc gọi từ trạng thái giữ');
      this.currentSession.unhold();
    }
  }

  mute(): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = false;
      });
      console.log('Đã tắt âm thanh cục bộ');
    }
  }

  unmute(): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = true;
      });
      console.log('Đã bật âm thanh cục bộ');
    }
  }

  toggleMute(muted: boolean): void {
    if (muted) {
      this.mute();
    } else {
      this.unmute();
    }
  }

  async toggleVideo(enabled: boolean): Promise<void> {
    if (!this.currentSession || this.currentSession.state !== 'Established') {
      console.warn('Cannot toggle video: no active session');
      return;
    }

    // If enabling video and we don't have a video track, get one
    if (enabled) {
      // Check if we need a new video track
      const needsNewTrack = !this.localStream || 
                            !this.localStream.getVideoTracks().length ||
                            this.localStream.getVideoTracks().every(track => track.readyState === 'ended');
      
      if (needsNewTrack) {
        console.log('Getting video stream for toggle...');
        try {
          // CRITICAL: Remove old ended video tracks before adding a new one
    if (this.localStream) {
            const oldVideoTracks = this.localStream.getVideoTracks();
            oldVideoTracks.forEach(track => {
              if (track.readyState === 'ended') {
                console.log('🧹 Removing old ended video track:', track.id);
                this.localStream!.removeTrack(track);
                track.stop();
              }
            });
          }
          
          // If we have audio but no video, just get video
          if (this.localStream && this.localStream.getAudioTracks().length > 0) {
            const videoStream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
            });
            // Add video track to existing stream
            const videoTrack = videoStream.getVideoTracks()[0];
            this.localStream.addTrack(videoTrack);
            // Stop the audio track from the new stream (we only need video)
            videoStream.getAudioTracks().forEach(track => track.stop());
            console.log('✅ Added video track to existing stream');
          } else {
            // Get both audio and video
            const constraints = {
              audio: true,
              video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
            };
            this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
            console.log('✅ Got new video stream for toggle');
          }
          // CRITICAL: Notify UI immediately so video element can attach the stream
          this.onLocalStreamChange?.(this.localStream);
        } catch (error) {
          console.error('Failed to get video stream:', error);
          throw error;
        }
      }
    }

    // Enable/disable video tracks
    if (this.localStream) {
      const videoTracks = this.localStream.getVideoTracks();
      // Find the first live video track (not ended)
      const videoTrack = videoTracks.find(track => track.readyState === 'live') || videoTracks[0];
      if (videoTrack) {
        const sdh = (this.currentSession as any).sessionDescriptionHandler;
        const pc = sdh?.peerConnection as RTCPeerConnection | undefined;
        
        if (pc) {
          const senders = pc.getSenders();
          const videoSender = senders.find(sender => sender.track?.kind === 'video');
          
          if (enabled) {
            // Enable video: ensure track is enabled and in peer connection
            videoTrack.enabled = true;
            console.log(`Đã bật video cục bộ`);
            
            // CRITICAL: Remove data-stream-cleared attribute and attach stream IMMEDIATELY
            // Do this synchronously before notifying React, so the video element is ready
            try {
              const videoElements = document.querySelectorAll('video');
              videoElements.forEach((videoEl) => {
                // Remove data-stream-cleared attribute if it exists
                if (videoEl.hasAttribute('data-stream-cleared')) {
                  videoEl.removeAttribute('data-stream-cleared');
                  console.log('✅ Removed data-stream-cleared attribute to allow video re-attachment');
                }
                // CRITICAL: Ensure video element is visible and can display video
                videoEl.style.display = '';
                videoEl.muted = false;
                
                // CRITICAL: Attach stream IMMEDIATELY (synchronously) before React processes
                // This ensures the video element has the stream even if React's useEffect doesn't run
                if (this.localStream) {
                  console.log('🚨 Attaching local stream to video element when enabling video (synchronous)...');
                  videoEl.srcObject = this.localStream;
                  // Don't try to play immediately - let React's useEffect handle it to avoid conflicts
                  // The delayed play in requestAnimationFrame will handle it
                  console.log('✅ Local stream attached to video element (synchronous)');
                }
              });
            } catch (e) {
              console.warn('Could not remove data-stream-cleared attribute or attach stream:', e);
            }
            
            // CRITICAL: Notify UI that local stream has changed
            // This ensures React updates the video element (even though we already attached it)
            this.onLocalStreamChange?.(this.localStream);
            
            // CRITICAL: Double-check after React has processed (use requestAnimationFrame)
            // This ensures the video element still has the stream after React's useEffect runs
            // Wait longer to ensure React's useEffect has finished
            setTimeout(() => {
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  try {
                    const videoElements = document.querySelectorAll('video');
                    videoElements.forEach((videoEl) => {
                      // Ensure stream is still attached after React processing
                      if (this.localStream && videoEl.srcObject !== this.localStream) {
                        console.log('🚨 Video element lost stream after React processing - re-attaching...');
                        videoEl.removeAttribute('data-stream-cleared');
                        videoEl.style.display = '';
                        videoEl.muted = false;
                        videoEl.srcObject = this.localStream;
                        // Wait a bit before playing to avoid AbortError
                        setTimeout(() => {
                          if (videoEl.srcObject === this.localStream && this.localStream) {
                            videoEl.play().then(() => {
                              console.log('✅ Video playing after re-attachment');
                            }).catch(e => {
                              console.warn('Could not play video after re-attachment:', e);
                            });
                          }
                        }, 100);
                        console.log('✅ Local stream re-attached to video element');
                      } else if (this.localStream && videoEl.srcObject === this.localStream) {
                        // Stream is attached, just make sure it's playing and visible
                        videoEl.style.display = '';
                        videoEl.muted = false;
                        // Wait a bit before playing to avoid AbortError from React's useEffect
                        setTimeout(() => {
                          if (videoEl.srcObject === this.localStream && this.localStream) {
                            videoEl.play().then(() => {
                              console.log('✅ Video playing successfully');
                            }).catch(e => {
                              if (e.name !== 'AbortError') {
                                console.warn('Could not play video (already attached):', e);
                              }
                            });
                          }
                        }, 200);
                        console.log('✅ Video element has stream, ensuring it plays');
                      }
                    });
                  } catch (e) {
                    console.warn('Could not verify/attach stream to video element:', e);
                  }
                });
              });
            }, 300);
            
            if (videoSender) {
              // Replace with enabled track
              try {
                await videoSender.replaceTrack(videoTrack);
                console.log('✅ Replaced video track in sender');
              } catch (error) {
                console.warn('Failed to replace video track:', error);
              }
            } else {
              // Add video track if no sender exists
              try {
                pc.addTrack(videoTrack, this.localStream!);
                console.log('✅ Added video track to peer connection');
              } catch (error) {
                console.warn('Failed to add video track:', error);
              }
            }
            
            // Note: localMediaStream is read-only in SIP.js, so we can't set it directly
            // The SDH will automatically use the stream from the peer connection senders
          } else {
            // Disable video: stop the track and replace with null to disable sender
            videoTrack.enabled = false;
            console.log(`Đã tắt video cục bộ`);
            
            // CRITICAL: Stop the video track to release camera
            try {
              videoTrack.stop();
              console.log('✅ Stopped video track to release camera');
            } catch (error) {
              console.warn('Failed to stop video track:', error);
            }
            
            if (videoSender) {
              try {
                // Replace track with null to disable the sender
                // This ensures video is not included in SDP (or included as inactive)
                await videoSender.replaceTrack(null);
                console.log('✅ Disabled video sender by replacing track with null');
              } catch (error) {
                // If replaceTrack(null) fails, try removing the sender
                try {
                  pc.removeTrack(videoSender);
                  console.log('✅ Removed video sender from peer connection');
                } catch (removeError) {
                  console.warn('Failed to remove video sender:', removeError);
                }
              }
            }
            
            // CRITICAL: Clear video element to release camera immediately
            try {
              const videoElements = document.querySelectorAll('video');
              videoElements.forEach((videoEl) => {
                const stream = videoEl.srcObject as MediaStream | null;
                if (stream) {
                  const videoTracks = stream.getVideoTracks();
                  if (videoTracks.length > 0) {
                    // Check if this stream has our video track
                    const hasOurTrack = videoTracks.some(track => track.id === videoTrack.id);
                    if (hasOurTrack) {
                      console.log('🚨 Clearing video element when disabling video...');
                      // Stop all tracks first
                      stream.getTracks().forEach(t => {
                        t.enabled = false;
                        if (t.readyState !== 'ended') {
                          t.stop();
                        }
                      });
                      // Then clear the element
                      videoEl.setAttribute('data-stream-cleared', 'true');
                      videoEl.srcObject = null;
                      videoEl.pause();
                      videoEl.load();
                      // Hide and mute
                      videoEl.style.display = 'none';
                      videoEl.muted = true;
                      console.log('✅ Video element cleared when disabling video');
                    }
                  }
                } else {
                  // Even if no stream, ensure element is cleared
                  if (videoEl.hasAttribute('data-stream-cleared')) {
                    videoEl.srcObject = null;
                    videoEl.pause();
                    videoEl.load();
                  }
                }
              });
            } catch (e) {
              console.warn('Could not clear video element when disabling video:', e);
            }
          }
          
          // Wait a bit for peer connection to update before sending re-INVITE
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // CRITICAL: Wait for peer connection to be in stable state before sending re-INVITE
          // This prevents "Invalid signaling state have-local-offer" errors
          // If previous re-INVITE failed (404), the state might be stuck - skip re-INVITE in that case
          const waitForStableState = async (maxWait = 3000): Promise<boolean> => {
            const startTime = Date.now();
            while (Date.now() - startTime < maxWait) {
              const signalingState = pc.signalingState;
              if (signalingState === 'stable') {
                console.log('✅ Peer connection is in stable state, can send re-INVITE');
                return true;
              }
              console.log(`⏳ Waiting for peer connection to be stable (current state: ${signalingState})...`);
              await new Promise(resolve => setTimeout(resolve, 100));
            }
            const finalState = pc.signalingState;
            if (finalState === 'have-local-offer' || finalState === 'have-remote-offer') {
              console.warn(`⚠️ Peer connection stuck in ${finalState} state (likely from previous failed re-INVITE) - skipping re-INVITE`);
              console.warn('⚠️ Video will work locally but remote side may not see the change. Try toggling again later.');
            } else {
              console.warn(`⚠️ Peer connection did not reach stable state within timeout (current: ${finalState})`);
            }
            return false;
          };
          
          const isStable = await waitForStableState();
          if (!isStable) {
            // Skip re-INVITE if state is not stable - video will work locally
            // The user can try toggling again later when the state becomes stable
            return;
          }
          
          // Send re-INVITE to notify remote side
          // Even if state is not stable, try to send it - SIP.js might handle it
          // If it fails, video will still work locally
          try {
            console.log(`Sending re-INVITE to ${enabled ? 'enable' : 'disable'} video...`);
            await (this.currentSession as any).invite();
            console.log('✅ Re-INVITE sent successfully');
          } catch (error: any) {
            // If error is about signaling state, that's expected when state is not stable
            if (error?.message?.includes('signaling state') || error?.message?.includes('have-local-offer')) {
              console.warn('⚠️ Re-INVITE failed due to signaling state - video will work locally but remote may not see it immediately');
            } else {
              console.error('Failed to send re-INVITE:', error);
            }
            // Don't throw - track is already enabled/disabled locally, video works locally
            // Set up a listener to retry when state becomes stable
            if (pc && enabled) {
              const retryReInvite = () => {
                const currentState = pc.signalingState;
                if (currentState === 'stable') {
                  console.log('✅ Peer connection became stable - retrying re-INVITE...');
                  pc.removeEventListener('signalingstatechange', retryReInvite);
                  // Retry after a short delay
                  setTimeout(async () => {
                    try {
                      await (this.currentSession as any).invite();
                      console.log('✅ Re-INVITE sent successfully after retry');
                    } catch (retryError) {
                      console.warn('⚠️ Re-INVITE retry also failed:', retryError);
                    }
                  }, 500);
                }
              };
              // Only set up listener if state is not stable
              if (pc.signalingState !== 'stable') {
                pc.addEventListener('signalingstatechange', retryReInvite);
                // Remove listener after 10 seconds to avoid memory leak
                setTimeout(() => {
                  pc.removeEventListener('signalingstatechange', retryReInvite);
                }, 10000);
              }
            }
          }
        } else {
          // No peer connection yet, just enable/disable track
          videoTracks.forEach(track => {
            track.enabled = enabled;
      });
          console.log(`Đã ${enabled ? 'bật' : 'tắt'} video cục bộ (no peer connection yet)`);
        }
      } else if (enabled) {
        console.warn('No video tracks available to enable');
    }
    } else if (enabled) {
      console.warn('No local stream available to enable video');
    }
  }

  async enableVideo(): Promise<void> {
    await this.toggleVideo(true);
  }

  async disableVideo(): Promise<void> {
    await this.toggleVideo(false);
  }

  async ensureRegistered(): Promise<void> {
    // Public method to ensure we're registered when idle
    await this.autoRegisterIfNeeded();
  }
}

export const sipService = new SIPService();