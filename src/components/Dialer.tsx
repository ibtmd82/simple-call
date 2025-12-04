import React, { useState } from 'react';
import { Phone, Backpack as Backspace, Clock, User } from 'lucide-react';
import { Button } from './ui/Button';
import { sipService } from '../services/sipService';
import { useCallStore } from '../store/useCallStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { CallStatus } from '../types/index';

interface DialerProps {
  onCall?: (number: string) => void;
}

export const Dialer: React.FC<DialerProps> = ({ onCall }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const { status } = useCallStore();
  const { getSipConfigFromEnv } = useSettingsStore();

  const numpadButtons = [
    { digit: '1', letters: '' },
    { digit: '2', letters: 'ABC' },
    { digit: '3', letters: 'DEF' },
    { digit: '4', letters: 'GHI' },
    { digit: '5', letters: 'JKL' },
    { digit: '6', letters: 'MNO' },
    { digit: '7', letters: 'PQRS' },
    { digit: '8', letters: 'TUV' },
    { digit: '9', letters: 'WXYZ' },
    { digit: '*', letters: '' },
    { digit: '0', letters: '+' },
    { digit: '#', letters: '' },
  ];

  const handleDigitPress = (digit: string) => {
    if (phoneNumber.length < 20) {
      setPhoneNumber(prev => prev + digit);
    }
  };

  const handleBackspace = () => {
    setPhoneNumber(prev => prev.slice(0, -1));
  };

  const handleCall = async () => {
    // Allow calling when status is idle, registered, or connected
    const canMakeCall = status === CallStatus.IDLE || 
                       status === CallStatus.REGISTERED || 
                       status === CallStatus.CONNECTED;
    
    if (phoneNumber.trim() && canMakeCall) {
      try {
        const sipConfig = getSipConfigFromEnv();
        // Use the destination number as-is if it contains @, otherwise use domain from .env
        const destination = phoneNumber.includes('@') 
          ? phoneNumber 
          : `${phoneNumber}@${sipConfig.domain || 'opensips.mooo.com'}`;
        
        await sipService.makeCall(destination, true); // Enable video by default
        onCall?.(phoneNumber);
      } catch (error) {
        console.error('Failed to make call:', error);
      }
    }
  };

  const handleClear = () => {
    setPhoneNumber('');
  };

  // Allow calling when status is idle, registered, or connected (not during active calls)
  const canMakeCall = status === CallStatus.IDLE || 
                     status === CallStatus.REGISTERED || 
                     status === CallStatus.CONNECTED;
  const isCallDisabled = !phoneNumber.trim() || !canMakeCall;

  return (
    <div className="bg-white/90 backdrop-blur-lg rounded-2xl sm:rounded-3xl shadow-strong border border-white/50 p-4 xs:p-5 sm:p-6 w-full animate-fade-in-up">
      {/* Header - Enhanced Design */}
      <div className="text-center mb-4 xs:mb-5 sm:mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 xs:w-20 xs:h-20 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 shadow-medium mb-3">
          <Phone className="w-8 h-8 xs:w-10 xs:h-10 text-white" />
        </div>
        <h2 className="text-lg xs:text-xl sm:text-2xl font-bold bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent mb-1">
          Make a Call
        </h2>
        <p className="text-xs xs:text-sm text-secondary-500 mt-1">Enter number and tap to call</p>
      </div>

      {/* Phone Number Display - Enhanced Design */}
      <div className="mb-4 xs:mb-5 sm:mb-6">
        <div className="bg-gradient-to-br from-secondary-50 to-secondary-100 rounded-2xl p-3 xs:p-4 sm:p-5 min-h-[56px] xs:min-h-[60px] sm:min-h-[70px] flex items-center justify-center border-2 border-secondary-200/50 shadow-soft transition-all duration-300 hover:border-primary-300 hover:shadow-medium">
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="Enter phone number"
            className="text-xl xs:text-2xl sm:text-3xl font-mono font-semibold text-center bg-transparent border-none outline-none w-full text-secondary-900 placeholder-secondary-400"
            maxLength={20}
            inputMode="tel"
          />
        </div>
        {phoneNumber && (
          <div className="flex justify-center mt-3">
            <button
              onClick={handleClear}
              className="text-xs xs:text-sm text-secondary-500 hover:text-primary-600 transition-all duration-200 py-1.5 px-3 rounded-lg hover:bg-secondary-100 active:scale-95 touch-manipulation"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Numpad - Enhanced Design */}
      <div className="grid grid-cols-3 gap-2 xs:gap-2.5 sm:gap-3 mb-4 xs:mb-5 sm:mb-6">
        {numpadButtons.map(({ digit, letters }) => (
          <button
            key={digit}
            onClick={() => handleDigitPress(digit)}
            className="aspect-square rounded-xl xs:rounded-2xl bg-gradient-to-br from-white to-secondary-50 hover:from-primary-50 hover:to-primary-100 active:from-primary-100 active:to-primary-200 border border-secondary-200/50 hover:border-primary-300 shadow-soft hover:shadow-medium active:shadow-soft transition-all duration-200 flex flex-col items-center justify-center group touch-manipulation min-h-[60px] xs:min-h-[64px] sm:min-h-[72px] scale-on-press"
          >
            <span className="text-xl xs:text-2xl sm:text-3xl font-bold text-secondary-900 group-hover:text-primary-700 group-active:scale-90 transition-all duration-150">
              {digit}
            </span>
            {letters && (
              <span className="text-[10px] xs:text-xs text-secondary-500 group-hover:text-primary-600 font-semibold tracking-wider mt-0.5 transition-colors">
                {letters}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Action Buttons - Enhanced Design */}
      <div className="flex items-center justify-center gap-3 xs:gap-4 sm:gap-5">
        {phoneNumber && (
          <button
            onClick={handleBackspace}
            className="w-12 h-12 xs:w-14 xs:h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-secondary-100 to-secondary-200 hover:from-secondary-200 hover:to-secondary-300 active:from-secondary-300 active:to-secondary-400 border border-secondary-300/50 shadow-soft hover:shadow-medium active:scale-95 transition-all duration-200 flex items-center justify-center touch-manipulation smooth-hover"
          >
            <Backspace className="w-5 h-5 xs:w-6 xs:h-6 sm:w-7 sm:h-7 text-secondary-700" />
          </button>
        )}
        
        <button
          onClick={handleCall}
          disabled={isCallDisabled}
          className={`w-16 h-16 xs:w-18 xs:h-18 sm:w-20 sm:h-20 rounded-full flex items-center justify-center transition-all duration-300 touch-manipulation ripple smooth-hover ${
            isCallDisabled
              ? 'bg-gradient-to-br from-secondary-200 to-secondary-300 text-secondary-400 cursor-not-allowed shadow-soft'
              : 'bg-gradient-to-br from-success-500 to-success-600 hover:from-success-600 hover:to-success-700 active:from-success-700 active:to-success-800 text-white shadow-strong hover:shadow-strong hover:scale-105 active:scale-95 animate-pulse-glow'
          }`}
        >
          <Phone className="w-6 h-6 xs:w-7 xs:h-7 sm:w-8 sm:h-8" />
        </button>
      </div>

      {/* Status Indicator - Enhanced Design */}
      {status !== CallStatus.IDLE && status !== CallStatus.REGISTERED && status !== CallStatus.CONNECTED && (
        <div className="mt-5 xs:mt-6 text-center animate-fade-in-up">
          <div className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-gradient-to-r from-primary-100 to-primary-200 border border-primary-300/50 text-primary-700 text-sm font-semibold shadow-soft">
            <div className="w-2.5 h-2.5 rounded-full bg-primary-500 animate-pulse shadow-sm"></div>
            {status === CallStatus.CONNECTING && 'Connecting...'}
            {status === CallStatus.RINGING && 'Ringing...'}
            {status === CallStatus.ACTIVE && 'Call Active'}
            {status === CallStatus.CALLING && 'Calling...'}
          </div>
        </div>
      )}
    </div>
  );
};