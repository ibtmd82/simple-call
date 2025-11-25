import { UserAgent, Session, UserAgentDelegate, Registerer, URI } from 'sip.js';
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
    // Các trình nghe sự kiện sẽ được thiết lập khi tạo UA
  }

  async connect(config: SipConfig): Promise<void> {
    try {
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
        console.log('Ngắt kết nối UA hiện tại trước khi kết nối lại...');
        this.isExplicitlyDisconnecting = true;
        if (this.registerer) {
          console.log('Đang hủy đăng ký Registerer...');
          await this.registerer.unregister();
        }
        console.log('Đang dừng UserAgent...');
        await this.ua.stop();
        this.ua = null;
        this.registerer = null;
      }

      const uaConfig = {
        uri: new URI('sip', config.uri, config.domain), // Tạo đối tượng URI
        transportOptions: {
          server: config.wsServer,
          traceSip: true,
        },
        authorizationUser: config.uri,
        password: config.password || '',
        displayName: config.displayName || config.uri,
        register: true,
        registerExpires: 600,
        sessionDescriptionHandlerFactoryOptions: { 
          disableDtls: config.disableDtls || false,
          constraints: {
            audio: true,
            video: false
          }
        },
        userAgentString: 'SIP.js/0.21.2',
      };

      console.log('Tạo UA với cấu hình:', {
        ...uaConfig,
        uri: uaConfig.uri.toString(),
        password: '[ẨN]',
      });

      this.ua = new UserAgent(uaConfig);

      this.ua.delegate = {
        onInvite: (session: Session) => {
          console.log('Phiên RTC mới:', session);
          this.handleIncomingCall(session);
        },
        onConnect: () => {
          console.log('Đã kết nối đến máy chủ SIP');
          this.onStateChange?.(CallStatus.CONNECTING);
        },
        onDisconnect: () => {
          console.log('Đã ngắt kết nối khỏi máy chủ SIP');
          if (!this.isExplicitlyDisconnecting) {
            this.onStateChange?.(CallStatus.ENDED);
          }
        },
      } as UserAgentDelegate;

      this.registerer = new Registerer(this.ua, {
        expires: 600,
        extraHeaders: [],
      });

      this.registerer.stateChange.addListener((state) => {
        console.log(`Trạng thái Registerer thay đổi: ${state}`);
        switch (state) {
          case 'Registered':
            this.isReregistering = false;
            this.onStateChange?.(CallStatus.REGISTERED);
            break;
          case 'Unregistered':
            if (!this.isExplicitlyDisconnecting && !this.isReregistering) {
              console.log('Đã hủy đăng ký khỏi máy chủ SIP');
              this.onStateChange?.(CallStatus.UNREGISTERED);
              console.log('Hủy đăng ký không mong muốn, đang thử đăng ký lại...');
              this.isReregistering = true;
              setTimeout(() => {
                if (this.registerer && !this.isExplicitlyDisconnecting) {
                  try {
                    this.registerer.register();
                  } catch (error) {
                    console.error('Đăng ký lại thất bại:', error);
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

      console.log('Bắt đầu khởi động UserAgent...');
      await this.ua.start();
      console.log('Bắt đầu đăng ký Registerer...');
      await this.registerer.register();
      console.log('Đã đăng ký thành công');
      this.isExplicitlyDisconnecting = false;

    } catch (error) {
      console.error('Kết nối đến máy chủ SIP thất bại:', error);
      this.onStateChange?.(CallStatus.FAILED);
      throw error;
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
    this.onStateChange?.(CallStatus.ENDED);
  }

  async makeCall(number: string, video: boolean = false): Promise<void> {
    if (!this.ua) {
      throw new Error('Chưa kết nối đến máy chủ SIP');
    }

    try {
      console.log(`Thực hiện cuộc gọi ${video ? 'video' : 'âm thanh'} đến:`, number);

      const constraints = {
        audio: true,
        video: video,
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('Đã lấy luồng cục bộ:', this.localStream);

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

      const session = this.ua.invite(`sip:${number}@${this.ua.configuration.uri.host}`, options);
      this.currentSession = session;
      this.setupSessionEventListeners(session);

      this.onStateChange?.(CallStatus.CALLING);

    } catch (error) {
      console.error('Thực hiện cuộc gọi thất bại:', error);
      this.cleanup();
      this.onStateChange?.(CallStatus.FAILED);
      throw error;
    }
  }

  private handleIncomingCall(session: Session): void {
    console.log('Cuộc gọi đến từ:', session.remoteIdentity.uri.user);
    this.currentSession = session;
    this.setupSessionEventListeners(session);
    this.onStateChange?.(CallStatus.INCOMING);
  }

  async answerCall(video: boolean = false): Promise<void> {
    if (!this.currentSession) {
      throw new Error('Không có cuộc gọi đến để trả lời');
    }

    try {
      console.log(`Trả lời cuộc gọi với ${video ? 'video' : 'âm thanh'}`);

      const constraints = {
        audio: true,
        video: video,
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('Đã lấy luồng cục bộ để trả lời:', this.localStream);

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
      };

      await this.currentSession.accept(options);
      this.onStateChange?.(CallStatus.ACTIVE);

    } catch (error) {
      console.error('Trả lời cuộc gọi thất bại:', error);
      this.cleanup();
      this.onStateChange?.(CallStatus.FAILED);
      throw error;
    }
  }

  rejectCall(): void {
    if (this.currentSession) {
      console.log('Từ chối cuộc gọi');
      this.currentSession.terminate();
      this.onStateChange?.(CallStatus.ENDED);
    }
  }

  hangup(): void {
    if (this.currentSession) {
      console.log('Ngắt cuộc gọi');
      this.currentSession.terminate();
      this.onStateChange?.(CallStatus.ENDED);
    }
  }

  private setupSessionEventListeners(session: Session): void {
    console.log('Thiết lập trình nghe sự kiện phiên');

    session.stateChange.addListener((state) => {
      console.log(`Trạng thái phiên thay đổi: ${state}`);
      switch (state) {
        case 'Established':
          console.log('Phiên đã được thiết lập');
          this.onStateChange?.(CallStatus.ACTIVE);
          this.setupPeerConnectionListeners(session);
          break;
        case 'Establishing':
          console.log('Phiên đang tiến hành...');
          this.onStateChange?.(CallStatus.RINGING);
          break;
        case 'Terminated':
          console.log('Phiên đã kết thúc');
          this.cleanup();
          this.onStateChange?.(CallStatus.ENDED);
          break;
      }
    });
  }

  private setupPeerConnectionListeners(session: Session): void {
    const pc = session.sessionDescriptionHandler?.peerConnection;
    if (!pc) {
      console.warn('Không có kết nối ngang hàng');
      return;
    }

    console.log('Thiết lập trình nghe kết nối ngang hàng');

    pc.ontrack = (event: RTCTrackEvent) => {
      console.log('Nhận được track từ xa:', event);
      if (event.streams && event.streams[0]) {
        console.log('Thiết lập luồng từ xa:', event.streams[0]);
        this.remoteStream = event.streams[0];
        this.onRemoteStreamChange?.(this.remoteStream);
        event.streams[0].getTracks().forEach(track => {
          console.log(`Track từ xa ${track.kind}:`, track);
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('Trạng thái kết nối ngang hàng:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        this.onStateChange?.(CallStatus.ACTIVE);
        this.checkForRemoteStreams(pc);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('Trạng thái kết nối ICE:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        this.checkForRemoteStreams(pc);
      }
    };

    setTimeout(() => {
      this.checkForRemoteStreams(pc);
    }, 2000);
  }

  private checkForRemoteStreams(pc: RTCPeerConnection): void {
    console.log('Kiểm tra luồng từ xa...');

    const remoteStreams = pc.getRemoteStreams?.() || [];
    console.log('Tìm thấy luồng từ xa:', remoteStreams.length);

    if (remoteStreams.length > 0 && !this.remoteStream) {
      console.log('Thiết lập luồng từ xa từ getRemoteStreams:', remoteStreams[0]);
      this.remoteStream = remoteStreams[0];
      this.onRemoteStreamChange?.(this.remoteStream);
      remoteStreams[0].getTracks().forEach(track => {
        console.log(`Track từ xa ${track.kind} từ getRemoteStreams:`, track);
      });
    }

    const receivers = pc.getReceivers();
    console.log('Tìm thấy bộ nhận:', receivers.length);

    receivers.forEach((receiver, index) => {
      if (receiver.track) {
        console.log(`Bộ nhận ${index} track:`, receiver.track.kind, receiver.track);
      }
    });
  }

  private cleanup(): void {
    console.log('Dọn dẹp tài nguyên cuộc gọi...');

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

  enableVideo(): void {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = true;
      });
      console.log('Đã bật video cục bộ');
    }
  }

  disableVideo(): void {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = false;
      });
      console.log('Đã tắt video cục bộ');
    }
  }
}

export const sipService = new SIPService();