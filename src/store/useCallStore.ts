import { create } from 'zustand';
import { CallState, CallHistoryItem, CallStatus } from '../types';
import { v4 as uuidv4 } from 'uuid';
import sipService from '../services/sipService';

const initialState: CallState = {
  status: 'idle',
  duration: 0,
  isMuted: false,
  isVideoEnabled: true,
  localStream: null,
  remoteStream: null,
  selectedAudioInput: null,
  selectedAudioOutput: null,
  selectedVideoInput: null,
  error: null,
  callHistory: [],
};

export const useCallStore = create<
  CallState & {
    setStatus: (status: CallStatus) => void;
    setLocalStream: (stream: MediaStream | null) => void;
    setRemoteStream: (stream: MediaStream | null) => void;
    setAudioInput: (deviceId: string) => void;
    setAudioOutput: (deviceId: string) => void;
    setVideoInput: (deviceId: string) => void;
    toggleMute: () => void;
    toggleVideo: () => void;
    incrementDuration: () => void;
    resetDuration: () => void;
    setError: (error: string | null) => void;
    addCallHistory: (status: 'completed' | 'missed' | 'failed', duration: number) => void;
    reset: () => void;
  }
>((set) => ({
  ...initialState,
  
  setStatus: (status) => set({ status }),
  
  setLocalStream: (localStream) => set({ localStream }),
  
  setRemoteStream: (remoteStream) => set({ remoteStream }),
  
  setAudioInput: (deviceId) => set({ selectedAudioInput: deviceId }),
  
  setAudioOutput: (deviceId) => set({ selectedAudioOutput: deviceId }),
  
  setVideoInput: (deviceId) => set({ selectedVideoInput: deviceId }),
  
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  
  toggleVideo: () => set((state) => ({ isVideoEnabled: !state.isVideoEnabled })),
  
  incrementDuration: () => set((state) => ({ duration: state.duration + 1 })),
  
  resetDuration: () => set({ duration: 0 }),
  
  setError: (error) => set({ error }),
  
  addCallHistory: (status, duration) => 
    set((state) => {
      const newHistoryItem: CallHistoryItem = {
        id: uuidv4(),
        timestamp: Date.now(),
        duration,
        status,
      };
      return { 
        callHistory: [newHistoryItem, ...state.callHistory].slice(0, 50)
      };
    }),
  
  reset: () => set({
    ...initialState,
    callHistory: useCallStore.getState().callHistory
  }),
}));