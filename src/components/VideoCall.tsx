import React, { useRef, useEffect } from 'react';
import { Phone, PhoneOff, User } from 'lucide-react';
import { useCallStore } from '../store/useCallStore';
import { formatDuration } from '../utils/timeUtils';

export const VideoCall: React.FC = () => {
  const { 
    status, 
    duration, 
    localStream, 
    remoteStream,
    isVideoEnabled 
  } = useCallStore();
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Set up local video stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Set up remote video stream
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      console.log('Setting remote video srcObject:', remoteStream);
      console.log('Remote stream video tracks:', remoteStream.getVideoTracks());
      console.log('Remote stream audio tracks:', remoteStream.getAudioTracks());
      console.log('All remote stream tracks:', remoteStream.getTracks().map(t => `${t.kind}: enabled=${t.enabled}, readyState=${t.readyState}`));
      
      remoteVideoRef.current.srcObject = remoteStream;
      
      // Force play the video
      remoteVideoRef.current.play().catch(error => {
        console.log('Error playing remote video:', error);
      });
      
      // Also log when video starts playing
      remoteVideoRef.current.onloadedmetadata = () => {
        console.log('Remote video metadata loaded');
        console.log('Video dimensions:', remoteVideoRef.current?.videoWidth, 'x', remoteVideoRef.current?.videoHeight);
      };
      
      remoteVideoRef.current.onplaying = () => {
        console.log('Remote video started playing');
      };
    }
  }, [remoteStream]);

  const hasRemoteVideo = remoteStream?.getVideoTracks().some(track => track.enabled);
  const hasLocalVideo = localStream?.getVideoTracks().some(track => track.enabled) && isVideoEnabled;

  console.log('VideoCall render - hasRemoteVideo:', hasRemoteVideo, 'hasLocalVideo:', hasLocalVideo);
  console.log('Remote stream:', remoteStream);
  console.log('Local stream:', localStream);

  return (
    <div className="bg-black rounded-2xl shadow-xl overflow-hidden w-full aspect-[4/3] relative">
      {/* Remote Video */}
      <div className="absolute inset-0">
        {hasRemoteVideo ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            muted={false}
            controls={false}
            controls={false}
            muted={false}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-secondary-800 flex items-center justify-center">
            {/* Hidden audio element for audio-only calls */}
            {remoteStream && (
              <audio
                ref={(audioRef) => {
                  if (audioRef && remoteStream) {
                    console.log('Setting audio srcObject for audio-only call');
                    audioRef.srcObject = remoteStream;
                    audioRef.play().catch(error => {
                      console.log('Error playing remote audio:', error);
                    });
                  }
                }}
                autoPlay
                playsInline
                style={{ display: 'none' }}
              />
            )}
            {/* Hidden audio element for audio-only calls */}
            {hasRemoteAudio && !hasRemoteVideo && (
              <audio
                ref={remoteVideoRef as any}
                autoPlay
                playsInline
                controls={false}
                style={{ display: 'none' }}
              />
            )}
            <div className="text-center">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-secondary-600 flex items-center justify-center mx-auto mb-4">
                <User className="w-10 h-10 sm:w-12 sm:h-12 text-secondary-300" />
              </div>
              <p className="text-white text-lg font-medium">
                {status === 'ringing' ? 'Incoming Call' : 'Remote User'}
              </p>
              {remoteStream && (
                <p className="text-secondary-300 text-sm mt-1">
                  Audio: {remoteStream.getAudioTracks().length > 0 ? 'Connected' : 'No audio'}
                </p>
              )}
              {hasRemoteAudio && !hasRemoteVideo && (
                <p className="text-secondary-300 text-sm mt-1">Audio Only</p>
              )}
              {status === 'active' && (
                <p className="text-secondary-300 text-sm mt-1">
                  {formatDuration(duration)}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Local Video (Picture-in-Picture) */}
      {hasLocalVideo && (
        <div className="absolute top-4 right-4 w-24 h-32 sm:w-32 sm:h-40 bg-secondary-800 rounded-lg overflow-hidden border-2 border-white/20">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Call Status Overlay */}
      {status !== 'active' && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
          <div className="text-center text-white">
            <div className="mb-4">
              {status === 'ringing' && (
                <div className="w-16 h-16 rounded-full bg-success-500 flex items-center justify-center mx-auto animate-pulse-slow">
                  <Phone className="w-8 h-8" />
                </div>
              )}
              {status === 'connecting' && (
                <div className="w-16 h-16 rounded-full bg-primary-500 flex items-center justify-center mx-auto">
                  <Phone className="w-8 h-8 animate-pulse" />
                </div>
              )}
            </div>
            <p className="text-xl font-semibold capitalize mb-2">{status}</p>
            {status === 'ringing' && (
              <p className="text-secondary-300">Swipe to answer or decline</p>
            )}
          </div>
        </div>
      )}

      {/* Call Duration (for active calls) */}
      {status === 'active' && !hasRemoteVideo && (
        <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-2">
          <p className="text-white text-sm font-medium">
            {formatDuration(duration)}
          </p>
        </div>
      )}
    </div>
  );
};