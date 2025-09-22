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
        sessionDescriptionHandler: !config.disableDtls,
        userAgentString: 'SIP.js/0.21.2',
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
            if (!this.isExplicitlyDisconnecting && !this.isR