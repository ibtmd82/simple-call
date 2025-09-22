import { UserAgent, Session, UserAgentDelegate, Registerer } from 'sip.js';
import { CallStatus, SipConfig } from '../types/index';

export class SIPService {
  private ua: UserAgent | null = null;
  private registerer: Registerer | null = null;
  private currentSession: Session | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private isExplicitlyDisconnecting = false;
  private isReregistering = false;
  private onStateChange?: (state: CallStatus) => void;
  private onRemoteStreamChange?: (stream: MediaStream | null) => void;

  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Event listeners will be set up when UA is created
  }

  async connect(config: SipConfig): Promise<void> {
    try {
      console.log('Connecting to SIP server with config:', {
        server: config.wsServer,
        username: config.uri,
        domain: config.domain,
        callId: config.callId,
        disableDtls: config.disableDtls,
      });

      if (this.ua) {
        console.log('Disconnecting existing UA before reconnecting...');
        this.isExplicitlyDisconnecting = true;
        if (this.registerer) {
          await this.registerer.unregister();
        }
        await this.ua.stop();
        this.ua = null;
        this.registerer = null;
      }

      const uaConfig = {
        uri: `sip:${config.uri}@${config.domain}`,
        transportOptions: {
          server: config.wsServer,
        },
        authorizationUser: config.uri,
        password: config.password,
        displayName: config.displayName || config.uri,
        register: false,
        registerExpires: 600,
        sessionTimers: !config.disableDtls,
        rtcpMuxPolicy: 'require',
        callId: config.callId || undefined,
      };

      console.log('Creating UA with config:', {
        ...uaConfig,
        password: '[HIDDEN]',
      });

      this.ua = new UserAgent(uaConfig);

      this.ua.delegate = {
        onInvite: (session: Session) => {
          console.log('New RTC session:', session);
          this.handleIncomingCall(session);
        },
        onConnect: () => {
          console.log('Connected to SIP server');
          this.onStateChange?.(CallStatus.CONNECTING);
        },
        onDisconnect: () => {
          console.log('Disconnected from SIP server');
          if (!this.isExplicitlyDisconnecting) {
            this.onStateChange?.(CallStatus.ENDED);
          }
        },
      } as UserAgentDelegate;

      this.registerer = new Registerer(this.ua, {
        expires: 600,
      });

      this.registerer.stateChange.addListener((state) => {
        console.log(`Registerer state changed: ${state}`);
        switch (state) {
          case 'Registered':
            this.isReregistering = false;
            this.onStateChange?.(CallStatus.REGISTERED);
            break;
          case 'Unregistered':
            if (!this.isExplicitlyDisconnecting && !this.isReregistering) {
              console.log('Unregistered from SIP server');
              this.onStateChange?.(CallStatus.UNREGISTERED);
              console.log('Unexpected unregistration, attempting to re-register...');
              this.isReregistering = true;
              setTimeout(() => {
                if (this.registerer && !this.isExplicitlyDisconnecting) {
                  try {
                    this.registerer.register();
                  } catch (error) {
                    console.error('Re-registration failed:', error);
                    this.isReregistering = false;
                    this.onStateChange?.(CallStatus.FAILED);
                  }
                }
              }, 2000);
            }
            break;
          case 'Terminated':
            this.onStateChange?.(CallStatus.ENDED);
            break;
        }
      });

      await this.ua.start();
      await this.registerer.register();
      this.isExplicitlyDisconnecting = false;

    } catch (error) {
      console.error('Failed to connect to SIP server:', error);
      this.onStateChange?.(CallStatus.FAILED);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    console.log('Disconnecting from SIP server...');
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
    this.onStateChange?.(CallStatus.ENDED);
  }

  async makeCall(number: string, video: boolean = false): Promise<void> {
    if (!this.ua) {
      throw new Error('Not connected to SIP server');
    }

    try {
      console.log(`Making ${video ? 'video' : 'audio'} call to:`, number);

      const constraints = {
        audio: true,
        video: video,
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('Got local stream:', this.localStream);

      const options = {
        mediaConstraints: constraints,
        mediaStream: this.localStream,
        pcConfig: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ],
          rtcpMuxPolicy: 'require',
        },
        offerOptions: {
          offerToReceiveAudio: true,
          offerToReceiveVideo: video,
        },
      };

      const session = this.ua.call(`sip:${number}@${this.ua.configuration.uri.host}`, options);
      this.currentSession = session;
      this.setupSessionEventListeners(session);

      this.onStateChange?.(CallStatus.CALLING);

    } catch (error) {
      console.error('Failed to make call:', error);
      this.cleanup();
      this.onStateChange?.(CallStatus.FAILED);
      throw error;
    }
  }

  private handleIncomingCall(session: Session): void {
    console.log('Incoming call from:', session.remoteIdentity.uri.user);
    this.currentSession = session;
    this.setupSessionEventListeners(session);
    this.onStateChange?.(CallStatus.INCOMING);
  }

  async answerCall(video: boolean = false): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No incoming call to answer');
    }

    try {
      console.log(`Answering call with ${video ? 'video' : 'audio'}`);

      const constraints = {
        audio: true,
        video: video,
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('Got local stream for answer:', this.localStream);

      const options = {
        mediaConstraints: constraints,
        mediaStream: this.localStream,
        pcConfig: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ],
          rtcpMuxPolicy: 'require',
        },
        answerOptions: {
          offerToReceiveAudio: true,
          offerToReceiveVideo: video,
        },
      };

      this.currentSession.answer(options);

    } catch (error) {
      console.error('Failed to answer call:', error);
      this.cleanup();
      this.onStateChange?.(CallStatus.FAILED);
      throw error;
    }
  }

  rejectCall(): void {
    if (this.currentSession) {
      console.log('Rejecting call');
      this.currentSession.terminate();
      this.onStateChange?.(CallStatus.ENDED);
    }
  }

  hangup(): void {
    if (this.currentSession) {
      console.log('Hanging up call');
      this.currentSession.terminate();
      this.onStateChange?.(CallStatus.ENDED);
    }
  }

  private setupSessionEventListeners(session: Session): void {
    console.log('Setting up session event listeners');

    session.on('progress', () => {
      console.log('Session in progress...');
      this.onStateChange?.(CallStatus.RINGING);
    });

    session.on('accepted', () => {
      console.log('Session accepted');
      this.onStateChange?.(CallStatus.ACTIVE);
      this.setupPeerConnectionListeners(session);
    });

    session.on('confirmed', () => {
      console.log('Session confirmed');
      this.onStateChange?.(CallStatus.ACTIVE);
      this.setupPeerConnectionListeners(session);
    });

    session.on('ended', () => {
      console.log('Session ended');
      this.cleanup();
      this.onStateChange?.(CallStatus.ENDED);
    });

    session.on('failed', (e: any) => {
      console.error('Session failed:', e);
      this.cleanup();
      this.onStateChange?.(CallStatus.FAILED);
    });

    // Handle peer connection events
    session.on('peerconnection', (e: any) => {
      console.log('Peer connection created:', e);
      this.setupPeerConnectionListeners(session);
    });
  }

  private setupPeerConnectionListeners(session: Session): void {
    const pc = session.sessionDescriptionHandler?.peerConnection;
    if (!pc) {
      console.warn('No peer connection available');
      return;
    }

    console.log('Setting up peer connection listeners');

    pc.ontrack = (event: RTCTrackEvent) => {
      console.log('Received remote track:', event);
      if (event.streams && event.streams[0]) {
        console.log('Setting remote stream:', event.streams[0]);
        this.remoteStream = event.streams[0];
        this.onRemoteStreamChange?.(this.remoteStream);
        event.streams[0].getTracks().forEach(track => {
          console.log(`Remote ${track.kind} track:`, track);
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('Peer connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        this.checkForRemoteStreams(pc);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        this.checkForRemoteStreams(pc);
      }
    };

    setTimeout(() => {
      this.checkForRemoteStreams(pc);
    }, 2000);
  }

  private checkForRemoteStreams(pc: RTCPeerConnection): void {
    console.log('Checking for remote streams...');

    const remoteStreams = pc.getRemoteStreams?.() || [];
    console.log('Remote streams found:', remoteStreams.length);

    if (remoteStreams.length > 0 && !this.remoteStream) {
      console.log('Setting remote stream from getRemoteStreams:', remoteStreams[0]);
      this.remoteStream = remoteStreams[0];
      this.onRemoteStreamChange?.(this.remoteStream);
      remoteStreams[0].getTracks().forEach(track => {
        console.log(`Remote ${track.kind} track from getRemoteStreams:`, track);
      });
    }

    const receivers = pc.getReceivers();
    console.log('Receivers found:', receivers.length);

    receivers.forEach((receiver, index) => {
      if (receiver.track) {
        console.log(`Receiver ${index} track:`, receiver.track.kind, receiver.track);
      }
    });
  }

  private cleanup(): void {
    console.log('Cleaning up call resources...');

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
      });
      this.localStream = null;
    }

    if (this.remoteStream) {
      this.remoteStream = null;
      this.onRemoteStreamChange?.(null);
    }

    this.currentSession = null;
  }

  // Getters
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

  // Event handlers
  onStateChanged(callback: (state: CallStatus) => void): void {
    this.onStateChange = callback;
  }

  onRemoteStreamChanged(callback: (stream: MediaStream | null) => void): void {
    this.onRemoteStreamChange = callback;
  }

  // DTMF support
  sendDTMF(tone: string): void {
    if (this.currentSession && this.currentSession.state === 'established') {
      console.log('Sending DTMF tone:', tone);
      this.currentSession.sendDTMF(tone);
    } else {
      console.warn('Cannot send DTMF: no active session');
    }
  }

  // Call transfer
  transfer(target: string): void {
    if (this.currentSession && this.currentSession.state === 'established') {
      console.log('Transferring call to:', target);
      this.currentSession.refer(target);
    } else {
      console.warn('Cannot transfer: no active session');
    }
  }

  // Hold/Unhold
  hold(): void {
    if (this.currentSession && this.currentSession.state === 'established') {
      console.log('Putting call on hold');
      this.currentSession.hold();
    }
  }

  unhold(): void {
    if (this.currentSession && this.currentSession.state === 'established') {
      console.log('Resuming call from hold');
      this.currentSession.unhold();
    }
  }

  // Mute/Unmute
  mute(): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = false;
      });
      console.log('Muted local audio');
    }
  }

  unmute(): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = true;
      });
      console.log('Unmuted local audio');
    }
  }

  // Video control
  enableVideo(): void {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = true;
      });
      console.log('Enabled local video');
    }
  }

  disableVideo(): void {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = false;
      });
      console.log('Disabled local video');
    }
  }
}

export const sipService = new SIPService();