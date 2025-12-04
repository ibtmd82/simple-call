import React, { useState } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Hash } from 'lucide-react';
import { CallButton } from './ui/CallButton';
import { InCallNumpad } from './InCallNumpad';
import { useCallStore } from '../store/useCallStore';
import { sipService } from '../services/sipService';
import { formatDuration } from '../utils/timeUtils';

export const CallControls: React.FC = () => {
  const { 
    status, 
    duration,
    isMuted,
    isVideoEnabled,
    toggleMute,
    toggleVideo
  } = useCallStore();

  const [showNumpad, setShowNumpad] = useState(false);

  const handleAnswer = async () => {
    console.log('🟢 Answer button clicked, current status:', status);
    try {
      console.log('Calling sipService.answerCall(true)...');
      await sipService.answerCall(true); // Enable video by default
      console.log('✅ Answer call completed');
    } catch (error) {
      console.error('❌ Failed to answer call:', error);
    }
  };

  const handleReject = async () => {
    console.log('🔴 Reject button clicked, current status:', status);
    try {
      console.log('Calling sipService.rejectCall()...');
      await sipService.rejectCall();
      console.log('✅ Reject call completed');
    } catch (error) {
      console.error('❌ Failed to reject call:', error);
    }
  };

  const handleHangup = async () => {
    if (status === 'connecting' || status === 'ringing' || status === 'active' || status === 'calling' || status === 'incoming') {
      try {
        await sipService.hangup();
      } catch (error) {
        console.error('Failed to hangup call:', error);
      }
    }
  };

  const handleMuteToggle = () => {
    toggleMute();
    sipService.toggleMute(!isMuted);
  };

  const handleVideoToggle = async () => {
    toggleVideo();
    try {
      await sipService.toggleVideo(!isVideoEnabled);
    } catch (error) {
      console.error('Failed to toggle video:', error);
      // Revert the store state if toggle failed
      toggleVideo();
    }
  };

  const handleNumpadToggle = () => {
    setShowNumpad(!showNumpad);
  };

  const handleDigitPress = (digit: string) => {
    // Send DTMF tone during call
    console.log('DTMF digit pressed:', digit);
    sipService.sendDTMF(digit);
  };

  console.log('CallControls render - status:', status, 'isIncoming:', status === 'incoming' || status === 'ringing');

  return (
    <>
      <div className="bg-white/90 backdrop-blur-lg border-t border-secondary-200/50 shadow-strong p-4 xs:p-5 sm:p-6 safe-area-bottom relative z-10">
        <div className="max-w-xl mx-auto">
          {/* Mobile Layout: Stack vertically */}
          <div className="flex flex-col gap-3 xs:gap-4 sm:hidden">
            {/* Call Duration */}
            <div className="text-center">
              {status === 'active' && (
                <div className="text-secondary-900 font-bold text-lg xs:text-xl sm:text-2xl mb-1">
                  {formatDuration(duration)}
                </div>
              )}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-secondary-100 to-secondary-200 text-xs xs:text-sm text-secondary-700 font-medium capitalize border border-secondary-300/50">
                <div className="w-1.5 h-1.5 rounded-full bg-secondary-500 animate-pulse"></div>
                {status}
              </div>
            </div>

            {/* Call Controls */}
            <div className="flex items-center justify-center gap-2 xs:gap-3">
              {(status === 'ringing' || status === 'incoming') ? (
                <>
                  <CallButton
                    variant="hangup"
                    icon={<PhoneOff className="w-5 h-5 xs:w-6 xs:h-6" />}
                    onClick={handleReject}
                    size="large"
                    aria-label="Reject call"
                    title="Reject call"
                  />
                  <CallButton
                    variant="answer"
                    icon={<Phone className="w-5 h-5 xs:w-6 xs:h-6" />}
                    onClick={handleAnswer}
                    pulse
                    size="large"
                    aria-label="Answer call"
                    title="Answer call"
                    style={{ zIndex: 10 }}
                  />
                </>
              ) : (
                <>
                  <CallButton
                    variant="mute"
                    icon={isMuted ? <MicOff className="w-4 h-4 xs:w-5 xs:h-5" /> : <Mic className="w-4 h-4 xs:w-5 xs:h-5" />}
                    onClick={handleMuteToggle}
                    active={isMuted}
                    size="medium"
                  />
                  <CallButton
                    variant="video"
                    icon={isVideoEnabled ? <Video className="w-4 h-4 xs:w-5 xs:h-5" /> : <VideoOff className="w-4 h-4 xs:w-5 xs:h-5" />}
                    onClick={handleVideoToggle}
                    active={!isVideoEnabled}
                    size="medium"
                  />
                  {status === 'active' && (
                    <CallButton
                      variant="neutral"
                      icon={<Hash className="w-4 h-4 xs:w-5 xs:h-5" />}
                      onClick={handleNumpadToggle}
                      active={showNumpad}
                      size="medium"
                    />
                  )}
                </>
              )}
              {/* Only show hangup button if not in incoming/ringing state (reject button already shown) */}
              {!(status === 'ringing' || status === 'incoming') && (
                <CallButton
                  variant="hangup"
                  icon={<PhoneOff className="w-5 h-5 xs:w-6 xs:h-6" />}
                  onClick={handleHangup}
                  size="large"
                />
              )}
            </div>
          </div>

          {/* Desktop Layout: Horizontal */}
          <div className="hidden sm:flex items-center justify-between">
            {/* Call Duration */}
            <div className="text-secondary-900 font-medium min-w-[80px]">
              {status === 'active' && formatDuration(duration)}
            </div>

            {/* Call Controls */}
            <div className="flex items-center gap-4">
              {(status === 'ringing' || status === 'incoming') ? (
                <>
                  <CallButton
                    variant="hangup"
                    icon={<PhoneOff className="w-6 h-6" />}
                    onClick={handleReject}
                    aria-label="Reject call"
                    title="Reject call"
                  />
                  <CallButton
                    variant="answer"
                    icon={<Phone className="w-6 h-6" />}
                    onClick={handleAnswer}
                    pulse
                    aria-label="Answer call"
                    title="Answer call"
                  />
                </>
              ) : (
                <>
                  <CallButton
                    variant="mute"
                    icon={isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                    onClick={handleMuteToggle}
                    active={isMuted}
                  />
                  <CallButton
                    variant="video"
                    icon={isVideoEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
                    onClick={handleVideoToggle}
                    active={!isVideoEnabled}
                  />
                  {status === 'active' && (
                    <CallButton
                      variant="neutral"
                      icon={<Hash className="w-6 h-6" />}
                      onClick={handleNumpadToggle}
                      active={showNumpad}
                    />
                  )}
                </>
              )}
              {/* Only show hangup button if not in incoming/ringing state (reject button already shown) */}
              {!(status === 'ringing' || status === 'incoming') && (
                <CallButton
                  variant="hangup"
                  icon={<PhoneOff className="w-6 h-6" />}
                  onClick={handleHangup}
                />
              )}
            </div>

            {/* Connection Status */}
            <div className="text-sm text-secondary-600 capitalize min-w-[80px] text-right">
              {status}
            </div>
          </div>
        </div>
      </div>

      {/* In-Call Numpad Modal */}
      <InCallNumpad
        isVisible={showNumpad}
        onClose={() => setShowNumpad(false)}
        onDigitPress={handleDigitPress}
      />
    </>
  );
};