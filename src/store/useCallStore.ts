import { create } from 'zustand';
import { CallStatus, CallState } from '../types/index';

interface CallActions {
  setStatus: (status: CallStatus) => void;
  setLocalStream: (stream: MediaStream | null) => void;
  setRemoteStream: (stream: MediaStream | null) => void;
  setDuration: (duration: number) => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  setAudioInput: (deviceId: string | null) => void;
  setAudioOutput: (deviceId: string | null) => void;
  setVideoInput: (deviceId: string | null) => void;
  setError: (error: string | null) => void;
  addCallHistory: (item: any) => void;
}

export const useCallStore = create<CallState & CallActions>((set) => ({
  status: CallStatus.IDLE,
  duration: 0,
  isMuted: false,
  isVideoEnabled: false,
  localStream: null,
  remoteStream: null,
  selectedAudioInput: null,
  selectedAudioOutput: null,
  selectedVideoInput: null,
  error: null,
  callHistory: [],
  setStatus: (status) => set({ status }),
  setLocalStream: (stream) => set({ localStream: stream }),
  setRemoteStream: (stream) => set({ remoteStream: stream }),
  setDuration: (duration) => set({ duration }),
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  toggleVideo: () => set((state) => ({ isVideoEnabled: !state.isVideoEnabled })),
  setAudioInput: (deviceId) => set({ selectedAudioInput: deviceId }),
  setAudioOutput: (deviceId) => set({ selectedAudioOutput: deviceId }),
  setVideoInput: (deviceId) => set({ selectedVideoInput: deviceId }),
  setError: (error) => set({ error }),
  addCallHistory: (item) => set((state) => ({ callHistory: [...state.callHistory, item] })),
}));