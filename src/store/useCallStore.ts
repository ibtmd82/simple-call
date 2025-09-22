import { create } from 'zustand';
import { CallStatus, CallState } from '../types/index';

export const useCallStore = create<CallState>((set) => ({
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
  setMuted: (isMuted) => set({ isMuted }),
  setVideoEnabled: (isVideoEnabled) => set({ isVideoEnabled }),
  setAudioInput: (deviceId) => set({ selectedAudioInput: deviceId }),
  setAudioOutput: (deviceId) => set({ selectedAudioOutput: deviceId }),
  setVideoInput: (deviceId) => set({ selectedVideoInput: deviceId }),
  setError: (error) => set({ error }),
  addCallHistory: (item) => set((state) => ({ callHistory: [...state.callHistory, item] })),
}));