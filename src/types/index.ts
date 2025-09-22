export enum CallStatus {
  IDLE = 'idle',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  REGISTERED = 'registered',
  UNREGISTERED = 'unregistered',
  CALLING = 'calling',
  INCOMING = 'incoming',
  RINGING = 'ringing',
  ACTIVE = 'active',
  ENDED = 'ended',
  FAILED = 'failed',
}

export interface MediaDeviceInfo {
  deviceId: string;
  kind: 'audioinput' | 'audiooutput' | 'videoinput';
  label: string;
}

export interface CallState {
  status: CallStatus;
  duration: number;
  isMuted: boolean;
  isVideoEnabled: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  selectedAudioInput: string | null;
  selectedAudioOutput: string | null;
  selectedVideoInput: string | null;
  error: string | null;
  callHistory: CallHistoryItem[];
}

export interface CallHistoryItem {
  id: string;
  timestamp: number;
  duration: number;
  status: 'completed' | 'missed' | 'failed';
}

export interface SipConfig {
  domain: string;
  uri: string;
  password: string;
  wsServer: string;
  callId?: string;
  disableDtls?: boolean;
  displayName?: string;
}