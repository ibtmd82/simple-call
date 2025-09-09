import { useCallStore } from '../store/useCallStore';

class WebRTCService {
  private localStream: MediaStream | null = null;


  public async initializeLocalStream(
    audioDeviceId?: string, 
    videoDeviceId?: string, 
    videoEnabled: boolean = true
  ): Promise<MediaStream | null> {
    try {
      console.log('Initializing local stream with constraints:', { audioDeviceId, videoDeviceId, videoEnabled });
      
      const constraints: MediaStreamConstraints = {
        audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true,
        video: videoEnabled 
          ? videoDeviceId 
            ? { deviceId: { exact: videoDeviceId } } 
            : true 
          : false,
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('Local stream obtained:', this.localStream.getTracks().map(t => `${t.kind}: ${t.label}`));
      
      useCallStore.getState().setLocalStream(this.localStream);

      return this.localStream;
    } catch (error) {
      console.error('Error getting user media:', error);
      useCallStore.getState().setError('Failed to access microphone or camera');
      return null;
    }
  }

  public async getAvailableDevices() {
    try {
      // First request permission to access devices
      await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
        .then(stream => {
          // Stop the tracks immediately after getting them
          stream.getTracks().forEach(track => track.stop());
        });

      const devices = await navigator.mediaDevices.enumerateDevices();
      
      return {
        audioInputs: devices.filter(device => device.kind === 'audioinput'),
        audioOutputs: devices.filter(device => device.kind === 'audiooutput'),
        videoInputs: devices.filter(device => device.kind === 'videoinput')
      };
    } catch (error) {
      console.error('Error enumerating devices:', error);
      return {
        audioInputs: [],
        audioOutputs: [],
        videoInputs: []
      };
    }
  }

  public disconnect(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      useCallStore.getState().setLocalStream(null);
      this.localStream = null;
    }

    useCallStore.getState().setRemoteStream(null);
  }

  public toggleAudio(mute: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = !mute;
      });
    }
  }

  public toggleVideo(enable: boolean): void {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = enable;
      });
    }
  }

  public getLocalStream(): MediaStream | null {
    return this.localStream;
  }
}

export const webRTCService = new WebRTCService();
export default webRTCService;