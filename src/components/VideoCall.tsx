import React, { useRef, useEffect, useState } from 'react';
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
  const [hasRemoteVideoDimensions, setHasRemoteVideoDimensions] = useState(false);

  // Set up local video stream
  // CRITICAL: Also depend on video tracks count to ensure effect runs when tracks are added/removed
  const localVideoTracksCount = localStream?.getVideoTracks().length || 0;
  const localVideoTracksEnabled = localStream?.getVideoTracks().filter(track => track.enabled).length || 0;
  
  useEffect(() => {
    // CRITICAL: If stream is null, immediately clear video element
    // This ensures camera is released even if status hasn't changed yet
    // Also check if video element has a stream with ended tracks
    if (localVideoRef.current) {
      const currentStream = localVideoRef.current.srcObject as MediaStream | null;
      if (currentStream) {
        const allTracksEnded = currentStream.getTracks().every(track => track.readyState === 'ended');
        if (allTracksEnded) {
          console.log('🚨 Video element has stream with all tracks ended - clearing immediately');
          localVideoRef.current.srcObject = null;
          localVideoRef.current.pause();
          localVideoRef.current.load();
        }
      }
    }
    
    if (!localStream && localVideoRef.current) {
      const stream = localVideoRef.current.srcObject as MediaStream | null;
      if (stream) {
        console.log('🚨 Local stream is null but video element still has srcObject - clearing immediately');
        // CRITICAL: Stop tracks FIRST, then clear srcObject
        // This ensures camera is released before clearing the element
        const tracks = stream.getTracks();
        console.log(`Found ${tracks.length} tracks in video element to stop`);
        tracks.forEach(track => {
          try {
            console.log(`Force stopping ${track.kind} track from video element:`, track.id, 'readyState:', track.readyState);
            // Force stop regardless of state - set enabled=false first, then stop
            track.enabled = false;
            if (track.readyState !== 'ended') {
              track.stop();
            } else {
              // Even if ended, try to stop again to ensure release
              try {
                track.stop();
              } catch (e) {
                // Ignore if already ended
              }
            }
            console.log(`✅ Force stopped ${track.kind} track from video element`);
          } catch (e) {
            console.warn(`Error stopping ${track.kind} track from video element:`, e);
            // Try again
            try {
              track.enabled = false;
              track.stop();
            } catch (e2) {
              // Ignore errors
            }
          }
        });
        // Clear srcObject AFTER stopping tracks
        localVideoRef.current.srcObject = null;
        localVideoRef.current.pause();
        localVideoRef.current.load();
        console.log('✅ Video element cleared immediately when stream became null');
      } else {
        // Even if no stream, ensure element is cleared
        if (localVideoRef.current.srcObject) {
          console.log('🚨 Video element has srcObject but stream is null - clearing anyway');
          localVideoRef.current.srcObject = null;
          localVideoRef.current.pause();
          localVideoRef.current.load();
        }
      }
    }
    
    if (localVideoRef.current && localStream) {
      // CRITICAL: Check if video element was marked as cleared - don't re-attach
      // BUT: If we have a valid stream with live video tracks, we should attach it
      // This allows video to be re-enabled after being disabled
      const hasLiveVideoTracks = localStream.getVideoTracks().some(track => track.readyState === 'live');
      if (localVideoRef.current.getAttribute('data-stream-cleared') === 'true' && !hasLiveVideoTracks) {
        console.log('⚠️ Video element was marked as cleared and no live video tracks - not re-attaching stream');
        // Remove the attribute after a delay to allow cleanup
        setTimeout(() => {
          if (localVideoRef.current) {
            localVideoRef.current.removeAttribute('data-stream-cleared');
          }
        }, 1000);
        return; // Don't attach stream if element was cleared and no live tracks
      }
      
      // If we have live video tracks, remove the data-stream-cleared attribute to allow attachment
      if (hasLiveVideoTracks && localVideoRef.current.getAttribute('data-stream-cleared') === 'true') {
        console.log('✅ Found live video tracks, removing data-stream-cleared attribute to allow video display');
        localVideoRef.current.removeAttribute('data-stream-cleared');
      }
      
      // CRITICAL: Check if all tracks are ended - if so, don't attach the stream
      // This prevents re-attaching a stream that's being cleaned up
      const allTracks = localStream.getTracks();
      const allTracksEnded = allTracks.length > 0 && allTracks.every(track => track.readyState === 'ended');
      
      if (allTracksEnded) {
        console.log('⚠️ All tracks in localStream are ended - not attaching to video element');
        // Clear the video element if it has this stream
        if (localVideoRef.current.srcObject === localStream) {
          localVideoRef.current.srcObject = null;
          localVideoRef.current.pause();
          localVideoRef.current.load();
        }
        return; // Don't attach ended stream
      }
      
      const videoTracks = localStream.getVideoTracks();
      console.log('Setting local video srcObject:', localStream);
      console.log('Local video tracks:', videoTracks.length, videoTracks.map(t => ({
        id: t.id,
        enabled: t.enabled,
        readyState: t.readyState,
        muted: t.muted
      })));
      
      // CRITICAL: Ensure data-stream-cleared is removed before attaching
      if (localVideoRef.current.getAttribute('data-stream-cleared') === 'true') {
        console.log('⚠️ Removing data-stream-cleared attribute before attaching stream');
        localVideoRef.current.removeAttribute('data-stream-cleared');
      }
      
      localVideoRef.current.srcObject = localStream;
      
      // Force play the video with error handling
      // Store a flag to prevent playing if stream is cleared
      let shouldPlay = true;
      const playLocalVideo = async () => {
        // Check if stream is still valid before playing
        if (!localVideoRef.current || !localVideoRef.current.srcObject || !localStream) {
          console.log('⚠️ Cannot play video - stream or element is null');
          shouldPlay = false;
          return;
        }
        
        // Double-check that the srcObject matches the current localStream
        if (localVideoRef.current.srcObject !== localStream) {
          console.log('⚠️ Cannot play video - srcObject does not match localStream');
          shouldPlay = false;
          return;
        }
        
        try {
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Check again after delay - stream might have been cleared
          if (!localVideoRef.current || !localVideoRef.current.srcObject || !localStream) {
            console.log('⚠️ Cannot play video - stream cleared during delay');
            shouldPlay = false;
            return;
          }
          
          // Final check before playing
          if (localVideoRef.current.srcObject !== localStream) {
            console.log('⚠️ Cannot play video - srcObject changed during delay');
            shouldPlay = false;
            return;
          }
          
          await localVideoRef.current.play();
          console.log('✅ Local video playing successfully');
        } catch (error: any) {
          if (error.name === 'AbortError') {
            console.log('Local video play interrupted (element changed) - this is normal');
            return;
          }
          console.error('Error playing local video:', error);
        }
      };
      
      // Only schedule play if stream is still valid
      if (shouldPlay && localStream) {
        setTimeout(playLocalVideo, 200);
      }
      
      localVideoRef.current.onloadedmetadata = () => {
        console.log('Local video metadata loaded');
        console.log('Local video dimensions:', localVideoRef.current?.videoWidth, 'x', localVideoRef.current?.videoHeight);
      };
      
      localVideoRef.current.onplaying = () => {
        // Only log if stream is still valid
        if (localStream && localVideoRef.current?.srcObject === localStream) {
          console.log('Local video started playing');
        } else {
          console.log('⚠️ Video started playing but stream is no longer valid - stopping');
          if (localVideoRef.current) {
            localVideoRef.current.pause();
            localVideoRef.current.srcObject = null;
            localVideoRef.current.load();
          }
        }
      };
      
      localVideoRef.current.onerror = (error) => {
        console.error('❌ Local video error:', error);
      };
    } else if (localVideoRef.current && !localStream) {
      // Clear the video element if stream is removed
      console.log('Clearing local video element (stream is null)');
      const stream = localVideoRef.current.srcObject as MediaStream | null;
      if (stream) {
        // CRITICAL: Stop all tracks from the video element BEFORE clearing srcObject
        // This ensures the camera is released even if tracks are still active
        console.log('Stopping tracks from video element before clearing...');
        const tracks = stream.getTracks();
        console.log(`Found ${tracks.length} tracks in video element to stop`);
        tracks.forEach(track => {
          console.log(`Stopping ${track.kind} track from video element:`, track.id, 'readyState:', track.readyState);
          try {
            if (track.readyState !== 'ended') {
              track.stop();
              track.enabled = false;
              console.log(`✅ Stopped ${track.kind} track from video element`);
            } else {
              // Track already ended, but try to stop anyway
              try {
                track.stop();
                track.enabled = false;
                console.log(`✅ Stopped ${track.kind} track from video element (was already ended)`);
              } catch (e) {
                // Ignore errors if track is already ended
                console.log(`Track ${track.kind} already ended, cannot stop again`);
              }
            }
          } catch (error) {
            console.warn(`Error stopping ${track.kind} track from video element:`, error);
          }
        });
      }
      // CRITICAL: Clear srcObject, pause, and load to fully release camera
      localVideoRef.current.srcObject = null;
      localVideoRef.current.pause();
      localVideoRef.current.load();
      console.log('✅ Local video element cleared and camera should be released');
    }
    
    // Also ensure video element is cleared if it exists but stream is null
    // This handles the case where the element exists but stream was cleared
    if (localVideoRef.current && !localStream && localVideoRef.current.srcObject) {
      console.log('⚠️ Video element still has srcObject but stream is null - force clearing...');
      const stream = localVideoRef.current.srcObject as MediaStream | null;
      if (stream) {
        stream.getTracks().forEach(track => {
          try {
            track.stop();
            track.enabled = false;
          } catch (e) {
            // Ignore errors
          }
        });
      }
      localVideoRef.current.srcObject = null;
      localVideoRef.current.pause();
      localVideoRef.current.load();
      console.log('✅ Force-cleared video element srcObject');
    }
    
    // Also clear video when call ends (status becomes IDLE or FAILED) to ensure camera is turned off
    if ((status === 'idle' || status === 'failed') && localVideoRef.current) {
      console.log(`Call ended (status=${status}), clearing local video element and stopping camera`);
      const stream = localVideoRef.current.srcObject as MediaStream | null;
      if (stream) {
        // Stop all tracks in the stream before clearing
        const tracks = stream.getTracks();
        console.log(`Found ${tracks.length} tracks to stop from video element`);
        tracks.forEach(track => {
          console.log(`Stopping ${track.kind} track from video element:`, track.id, 'readyState:', track.readyState);
          try {
            if (track.readyState !== 'ended') {
              track.stop();
              track.enabled = false;
              console.log(`✅ Stopped ${track.kind} track from video element`);
            } else {
              // Try to stop anyway
              try {
                track.stop();
                track.enabled = false;
                console.log(`✅ Stopped ${track.kind} track from video element (was already ended)`);
              } catch (e) {
                console.log(`Track ${track.kind} already ended`);
              }
            }
          } catch (error) {
            console.warn(`Error stopping ${track.kind} track from video element:`, error);
          }
        });
      }
      localVideoRef.current.srcObject = null;
      localVideoRef.current.pause();
      localVideoRef.current.load();
      console.log('✅ Local video element cleared and camera should be off');
    }
  }, [localStream, status, localVideoTracksCount, localVideoTracksEnabled]);

  // Set up remote video stream
  useEffect(() => {
    // Reset dimensions state when stream changes
    setHasRemoteVideoDimensions(false);
    
    if (remoteVideoRef.current && remoteStream) {
      const videoTracks = remoteStream.getVideoTracks();
      const audioTracks = remoteStream.getAudioTracks();
      
      console.log('Setting remote video srcObject:', remoteStream);
      console.log('Remote stream video tracks:', videoTracks.length, videoTracks);
      console.log('Remote stream audio tracks:', audioTracks.length, audioTracks);
      console.log('All remote stream tracks:', remoteStream.getTracks().map(t => `${t.kind}: enabled=${t.enabled}, readyState=${t.readyState}, muted=${t.muted}`));
      
      if (videoTracks.length > 0) {
        console.log('Video tracks found! Details:', videoTracks.map(t => ({
          id: t.id,
          kind: t.kind,
          enabled: t.enabled,
          readyState: t.readyState,
          muted: t.muted,
          settings: t.getSettings ? t.getSettings() : 'N/A'
        })));
      }
      
      remoteVideoRef.current.srcObject = remoteStream;
      
      // Force play the video - retry if it fails
      // Use a more robust approach that handles DOM changes
      const playVideo = async () => {
        if (!remoteVideoRef.current || !remoteVideoRef.current.srcObject) {
          return;
        }
        
        try {
          // Wait a bit for the element to be ready
          await new Promise(resolve => setTimeout(resolve, 100));
          
          if (!remoteVideoRef.current || !remoteVideoRef.current.srcObject) {
            return;
          }
          
          await remoteVideoRef.current.play();
          console.log('✅ Remote video playing successfully');
        } catch (error: any) {
          // AbortError is expected when element is removed/replaced - not a real error
          if (error.name === 'AbortError') {
            console.log('Video play interrupted (element changed) - this is normal');
            return;
          }
          
          // NotAllowedError means user interaction is required (shouldn't happen with autoplay)
          if (error.name === 'NotAllowedError') {
            console.warn('Video play not allowed - may need user interaction');
            return;
          }
          
          console.error('Error playing remote video:', error);
          
          // Only retry for other errors, and only if element still exists
          if (remoteVideoRef.current && remoteVideoRef.current.srcObject) {
            setTimeout(playVideo, 500);
          }
        }
      };
      
      // Delay initial play to ensure element is stable
      setTimeout(playVideo, 200);
      
      // Also log when video starts playing
      remoteVideoRef.current.onloadedmetadata = () => {
        const width = remoteVideoRef.current?.videoWidth || 0;
        const height = remoteVideoRef.current?.videoHeight || 0;
        console.log('Remote video metadata loaded');
        console.log('Video dimensions:', width, 'x', height);
        // Only consider video as available if it has actual dimensions
        setHasRemoteVideoDimensions(width > 0 && height > 0);
      };
      
      remoteVideoRef.current.onplaying = () => {
        console.log('✅ Remote video started playing');
        // Check dimensions when playing starts
        const width = remoteVideoRef.current?.videoWidth || 0;
        const height = remoteVideoRef.current?.videoHeight || 0;
        if (width > 0 && height > 0) {
          setHasRemoteVideoDimensions(true);
        }
      };
      
      // Also check dimensions periodically in case they become available later
      const checkDimensions = setInterval(() => {
        if (remoteVideoRef.current) {
          const width = remoteVideoRef.current.videoWidth || 0;
          const height = remoteVideoRef.current.videoHeight || 0;
          if (width > 0 && height > 0) {
            setHasRemoteVideoDimensions(true);
            clearInterval(checkDimensions);
          }
        }
      }, 500);
      
      // Clean up interval when component unmounts or stream changes
      return () => {
        clearInterval(checkDimensions);
        setHasRemoteVideoDimensions(false);
      };
      
      remoteVideoRef.current.onerror = (error) => {
        console.error('❌ Remote video error:', error);
      };
      
      // Listen for track events to detect when video becomes unmuted
      remoteStream.getVideoTracks().forEach(track => {
        track.onunmute = () => {
          console.log('✅ Remote video track unmuted!');
          // Use the same robust play function
          setTimeout(() => {
            if (remoteVideoRef.current && remoteVideoRef.current.srcObject) {
              remoteVideoRef.current.play()
                .then(() => {
                  console.log('✅ Remote video playing after unmute');
                  // Check dimensions after unmute
                  const width = remoteVideoRef.current?.videoWidth || 0;
                  const height = remoteVideoRef.current?.videoHeight || 0;
                  if (width > 0 && height > 0) {
                    setHasRemoteVideoDimensions(true);
                  }
                })
                .catch((err: any) => {
                  if (err.name !== 'AbortError') {
                    console.error('Error playing after unmute:', err);
                  }
                });
            }
          }, 200);
        };
        
        track.onmute = () => {
          console.log('⚠️ Remote video track muted');
        };
        
        // If track is currently muted, try to handle it
        if (track.muted) {
          console.log('⚠️ Remote video track is muted, waiting for unmute...');
          // The track might become unmuted when actual video data arrives
        }
      });
    } else if (remoteVideoRef.current && !remoteStream) {
      // Clear the video element if stream is removed
      console.log('Clearing remote video element');
      remoteVideoRef.current.srcObject = null;
      // Also pause and load empty to ensure it's fully cleared
      remoteVideoRef.current.pause();
      remoteVideoRef.current.load();
    }
    
    // Also clear video when call ends (status becomes IDLE)
    if (status === 'idle' && remoteVideoRef.current) {
      console.log('Call ended (status=idle), clearing remote video element');
      const stream = remoteVideoRef.current.srcObject as MediaStream | null;
      if (stream) {
        // Stop all tracks in the stream before clearing
        stream.getTracks().forEach(track => {
          console.log(`Stopping ${track.kind} track from remote video element:`, track.id);
          track.stop();
        });
      }
      remoteVideoRef.current.srcObject = null;
      remoteVideoRef.current.pause();
      remoteVideoRef.current.load();
      console.log('✅ Remote video element cleared');
    }
  }, [remoteStream, status]);

  // Immediate cleanup when call ends - ensure camera is turned off
  useEffect(() => {
    if (status === 'idle' || status === 'failed') {
      console.log(`Call ended (status=${status}) - performing immediate cleanup of video elements`);
      
      // Clean up local video immediately - try multiple times to ensure it's cleared
      const cleanupLocalVideo = () => {
        if (localVideoRef.current) {
          const stream = localVideoRef.current.srcObject as MediaStream | null;
          if (stream) {
            console.log('Stopping all tracks in local video element...');
            const tracks = stream.getTracks();
            console.log(`Found ${tracks.length} tracks to stop in local video element`);
            tracks.forEach(track => {
              console.log(`Force stopping ${track.kind} track:`, track.id, 'readyState:', track.readyState);
              try {
                if (track.readyState !== 'ended') {
                  track.stop();
                  track.enabled = false;
                  console.log(`✅ Force stopped ${track.kind} track`);
                } else {
                  // Try to stop anyway
                  try {
                    track.stop();
                    track.enabled = false;
                    console.log(`✅ Force stopped ${track.kind} track (was already ended)`);
                  } catch (e) {
                    console.log(`Track ${track.kind} already ended`);
                  }
                }
              } catch (error) {
                console.warn(`Error force stopping ${track.kind} track:`, error);
              }
            });
          }
          // Always clear srcObject, pause, and load, even if stream is null
          // This is CRITICAL to release the camera
          localVideoRef.current.srcObject = null;
          localVideoRef.current.pause();
          localVideoRef.current.load();
          console.log('✅ Local video element force-cleared');
        }
      };
      
      // Clean up immediately - don't wait
      cleanupLocalVideo();
      
      // Also clean up after short delays to catch any race conditions
      setTimeout(cleanupLocalVideo, 50);
      setTimeout(cleanupLocalVideo, 100);
      setTimeout(cleanupLocalVideo, 300);
      setTimeout(cleanupLocalVideo, 500);
      
      // Clean up remote video immediately
      if (remoteVideoRef.current) {
        const stream = remoteVideoRef.current.srcObject as MediaStream | null;
        if (stream) {
          console.log('Stopping all tracks in remote video element...');
          stream.getTracks().forEach(track => {
            console.log(`Force stopping ${track.kind} track:`, track.id);
            track.stop();
          });
        }
        remoteVideoRef.current.srcObject = null;
        remoteVideoRef.current.pause();
        remoteVideoRef.current.load();
        console.log('✅ Remote video element force-cleared');
      }
      
      // Reset remote video dimensions state
      setHasRemoteVideoDimensions(false);
    }
  }, [status]);

  // Check for remote video tracks - show video if track exists, is live, and enabled
  // Don't require dimensions immediately - they might come later as video starts playing
  // Show video if there's any live, enabled video track (even if muted - it might unmute)
  const hasRemoteVideo = remoteStream?.getVideoTracks().some(track => 
    track.enabled && track.readyState === 'live'
  ) || false;
  const hasRemoteAudio = remoteStream?.getAudioTracks().some(track => track.enabled);
  // Check if local video is available - if we have enabled video tracks, show them
  // Don't require isVideoEnabled to be true if we have video tracks (they might be enabled by default)
  const hasLocalVideo = localStream?.getVideoTracks().some(track => track.enabled) || false;

  console.log('VideoCall render - hasRemoteVideo:', hasRemoteVideo, 'hasLocalVideo:', hasLocalVideo);
  console.log('Remote stream:', remoteStream);
  console.log('Local stream:', localStream);

  return (
    <div className="bg-black rounded-2xl sm:rounded-3xl shadow-strong overflow-hidden w-full aspect-[4/3] sm:aspect-video relative border-2 border-white/10">
      {/* Remote Video or Local Video (if no remote) */}
      <div className="absolute inset-0">
        {hasRemoteVideo ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            muted={false}
            className="w-full h-full object-cover"
            style={{ backgroundColor: '#000' }}
          />
        ) : hasLocalVideo && (status === 'calling' || status === 'ringing' || status === 'connecting' || (status === 'active' && !hasRemoteVideo)) ? (
          // Show local video as main video during calling/ringing or when active call has no remote video
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ backgroundColor: '#000' }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-secondary-900 via-secondary-800 to-secondary-900 flex items-center justify-center">
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
            <div className="text-center px-4">
              <div className="w-20 h-20 xs:w-24 xs:h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-br from-primary-500/20 to-primary-600/30 border-2 border-primary-400/30 flex items-center justify-center mx-auto mb-4 sm:mb-5 shadow-strong backdrop-blur-sm">
                <User className="w-10 h-10 xs:w-12 xs:h-12 sm:w-14 sm:h-14 text-primary-300" />
              </div>
              <p className="text-white text-lg xs:text-xl sm:text-2xl font-bold mb-2">
                {(status === 'ringing' || status === 'incoming') ? 'Incoming Call' : 'Remote User'}
              </p>
              {remoteStream && (
                <p className="text-secondary-300 text-xs xs:text-sm mt-1 flex items-center justify-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-success-400 animate-pulse"></span>
                  Audio: {remoteStream.getAudioTracks().length > 0 ? 'Connected' : 'No audio'}
                </p>
              )}
              {hasRemoteAudio && !hasRemoteVideo && (
                <p className="text-secondary-300 text-xs xs:text-sm mt-1 flex items-center justify-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-pulse"></span>
                  Audio Only
                </p>
              )}
              {status === 'active' && (
                <p className="text-primary-300 text-sm xs:text-base font-semibold mt-2">
                  {formatDuration(duration)}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Local Video (Picture-in-Picture) - only show if remote video exists (don't show if local is already main) */}
      {hasLocalVideo && hasRemoteVideo && (
        <div className="absolute top-3 right-3 sm:top-4 sm:right-4 w-24 h-32 xs:w-28 xs:h-36 sm:w-36 sm:h-48 bg-secondary-900 rounded-xl overflow-hidden border-2 border-white/30 shadow-strong backdrop-blur-sm">
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
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/60 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="text-center text-white px-4 animate-fade-in-up">
            <div className="mb-4 sm:mb-5">
              {(status === 'ringing' || status === 'incoming') && (
                <div className="w-16 h-16 xs:w-20 xs:h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-success-500 to-success-600 flex items-center justify-center mx-auto animate-pulse-glow shadow-strong border-2 border-white/20">
                  <Phone className="w-8 h-8 xs:w-10 xs:h-10 sm:w-12 sm:h-12" />
                </div>
              )}
              {status === 'connecting' && (
                <div className="w-16 h-16 xs:w-20 xs:h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center mx-auto shadow-strong border-2 border-white/20">
                  <Phone className="w-8 h-8 xs:w-10 xs:h-10 sm:w-12 sm:h-12 animate-pulse" />
                </div>
              )}
            </div>
            <p className="text-xl xs:text-2xl sm:text-3xl font-bold capitalize mb-2 sm:mb-3 bg-gradient-to-r from-white to-secondary-200 bg-clip-text text-transparent">{status}</p>
              {(status === 'ringing' || status === 'incoming') && (
                <p className="text-secondary-200 text-sm xs:text-base font-medium">Tap answer or reject buttons below</p>
              )}
          </div>
        </div>
      )}

      {/* Call Duration (for active calls) */}
      {status === 'active' && !hasRemoteVideo && (
        <div className="absolute top-3 left-3 xs:top-4 xs:left-4 bg-black/60 backdrop-blur-md rounded-xl px-3 py-2 xs:px-4 xs:py-2.5 border border-white/10 shadow-medium">
          <p className="text-white text-sm xs:text-base font-bold">
            {formatDuration(duration)}
          </p>
        </div>
      )}
    </div>
  );
};