import React, { useState } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Hash } from 'lucide-react';
import { CallButton } from './ui/CallButton';
import { InCallNumpad } from './InCallNumpad';
import { useCallStore } from '../store/useCallStore';
import sipService from '../services/sipService';
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
  const currentUser = sipService.getCurrentUser();

  const handleAnswer = async () => {
    try {
      await sipService.answerCall();
    } catch (error) {
      console.error('Failed to answer call:', error);
    }
  };

  const handleReject = async () => {
    try {
      await sipService.rejectCall();
    } catch (error) {
      console.error('Failed to reject call:', error);
    }
  };

  const handleHangup = async () => {
    if (status === 'connecting' || status === 'ringing' || status === 'active') {
      await sipService.endCall();
    }
  };

  const handleMuteToggle = () => {
    toggleMute();
    sipService.toggleMute(!isMuted);
  };

  const handleVideoToggle = () => {
    toggleVideo();
    sipService.toggleVideo(!isVideoEnabled);
  };

  const handleNumpadToggle = () => {
    setShowNumpad(!showNumpad);
  };

  const handleDigitPress = (digit: string) => {
    // Send DTMF tone during call
    console.log('DTMF digit pressed:', digit);
    sipService.sendDTMF(digit);
  };

  return (
    <>
      <div className="bg-white/95 backdrop-blur-sm border-t border-secondary-200 p-3 sm:p-4 safe-area-bottom">
        <div className="max-w-xl mx-auto">
          {/* Mobile Layout: Stack vertically */}
          <div className="flex flex-col gap-3 sm:hidden">
            {/* Call Duration */}
            <div className="text-center">
              {status === 'active' && (
                <div className="text-secondary-900 font-medium text-lg">
                  {formatDuration(duration)}
                </div>
              )}
              <div className="text-sm text-secondary-600 capitalize mt-1">
                {status}
              </div>
            </div>

            {/* Call Controls */}
            <div className="flex items-center justify-center gap-3">
              {status === 'ringing' ? (
                <>
                  <CallButton
                    variant="hangup"
                    icon={<PhoneOff className="w-6 h-6" />}
                    onClick={handleReject}
                    size="large"
                  />
                  <CallButton
                    variant="answer"
                    icon={<Phone className="w-6 h-6" />}
                    onClick={handleAnswer}
                    pulse
                    size="large"
                  />
                </>
              ) : (
                <>
                  <CallButton
                    variant="mute"
                    icon={isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    onClick={handleMuteToggle}
                    active={isMuted}
                    size="medium"
                  />
                  <CallButton
                    variant="video"
                    icon={isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                    onClick={handleVideoToggle}
                    active={!isVideoEnabled}
                    size="medium"
                  />
                  {status === 'active' && (
                    <CallButton
                      variant="neutral"
                      icon={<Hash className="w-5 h-5" />}
                      onClick={handleNumpadToggle}
                      active={showNumpad}
                      size="medium"
                    />
                  )}
                </>
              )}
              <CallButton
                variant="hangup"
                icon={<PhoneOff className="w-6 h-6" />}
                onClick={handleHangup}
                size="large"
              />
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
              {status === 'ringing' ? (
                <>
                  <CallButton
                    variant="hangup"
                    icon={<PhoneOff className="w-6 h-6" />}
                    onClick={handleReject}
                  />
                  <CallButton
                    variant="answer"
                    icon={<Phone className="w-6 h-6" />}
                    onClick={handleAnswer}
                    pulse
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
              <CallButton
                variant="hangup"
                icon={<PhoneOff className="w-6 h-6" />}
                onClick={handleHangup}
              />
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