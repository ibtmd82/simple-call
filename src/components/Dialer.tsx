import React, { useState } from 'react';
import { Phone, Backpack as Backspace, Clock, User } from 'lucide-react';
import { Button } from './ui/Button';
import sipService from '../services/sipService';
import { useCallStore } from '../store/useCallStore';
import { useSettingsStore } from '../store/useSettingsStore';

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
    if (phoneNumber.trim() && status === 'idle') {
      try {
        const sipConfig = getSipConfigFromEnv();
        // Use the destination number as-is if it contains @, otherwise use opensips.mooo.com domain
        const destination = phoneNumber.includes('@') 
          ? phoneNumber 
          : `${phoneNumber}@opensips.mooo.com`;
        
        await sipService.makeCall(destination);
        onCall?.(phoneNumber);
      } catch (error) {
        console.error('Failed to make call:', error);
      }
    }
  };

  const handleClear = () => {
    setPhoneNumber('');
  };

  const isCallDisabled = !phoneNumber.trim() || status !== 'idle';

  return (
    <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-6 w-full">
      {/* Header - Mobile Optimized */}
      <div className="text-center mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-xl font-semibold text-secondary-900 mb-2">Make a Call</h2>
      </div>

      {/* Phone Number Display - Mobile Optimized */}
      <div className="mb-4 sm:mb-6">
        <div className="bg-secondary-50 rounded-xl p-3 sm:p-4 min-h-[50px] sm:min-h-[60px] flex items-center justify-center">
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="Enter phone number"
            className="text-xl sm:text-2xl font-mono text-center bg-transparent border-none outline-none w-full text-secondary-900 placeholder-secondary-400"
            maxLength={20}
            inputMode="tel"
          />
        </div>
        {phoneNumber && (
          <div className="flex justify-center mt-2">
            <button
              onClick={handleClear}
              className="text-sm text-secondary-500 hover:text-secondary-700 transition-colors py-1 px-2"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Numpad - Mobile Optimized */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4 sm:mb-6">
        {numpadButtons.map(({ digit, letters }) => (
          <button
            key={digit}
            onClick={() => handleDigitPress(digit)}
            className="aspect-square rounded-xl bg-secondary-50 hover:bg-secondary-100 active:bg-secondary-200 transition-all duration-150 flex flex-col items-center justify-center group touch-manipulation min-h-[60px] sm:min-h-[70px]"
          >
            <span className="text-xl sm:text-2xl font-semibold text-secondary-900 group-active:scale-95 transition-transform">
              {digit}
            </span>
            {letters && (
              <span className="text-xs text-secondary-500 font-medium tracking-wider mt-0.5">
                {letters}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Action Buttons - Mobile Optimized */}
      <div className="flex items-center justify-center gap-3 sm:gap-4">
        {phoneNumber && (
          <button
            onClick={handleBackspace}
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-secondary-100 hover:bg-secondary-200 active:bg-secondary-300 transition-all duration-150 flex items-center justify-center touch-manipulation"
          >
            <Backspace className="w-5 h-5 sm:w-6 sm:h-6 text-secondary-600" />
          </button>
        )}
        
        <button
          onClick={handleCall}
          disabled={isCallDisabled}
          className={`w-16 h-16 sm:w-18 sm:h-18 rounded-full flex items-center justify-center transition-all duration-200 touch-manipulation ${
            isCallDisabled
              ? 'bg-secondary-200 text-secondary-400 cursor-not-allowed'
              : 'bg-success-500 hover:bg-success-600 active:bg-success-700 text-white shadow-lg hover:shadow-xl active:scale-95'
          }`}
        >
          <Phone className="w-6 h-6 sm:w-7 sm:h-7" />
        </button>
      </div>

      {/* Status Indicator - Mobile Optimized */}
      {status !== 'idle' && (
        <div className="mt-4 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-primary-100 text-primary-700 text-sm font-medium">
            <div className="w-2 h-2 rounded-full bg-primary-500 animate-pulse"></div>
            {status === 'connecting' && 'Connecting...'}
            {status === 'ringing' && 'Ringing...'}
            {status === 'active' && 'Call Active'}
          </div>
        </div>
      )}
    </div>
  );
};