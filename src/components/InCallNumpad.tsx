import React, { useState } from 'react';
import { Hash, X } from 'lucide-react';

interface InCallNumpadProps {
  isVisible: boolean;
  onClose: () => void;
  onDigitPress: (digit: string) => void;
}

export const InCallNumpad: React.FC<InCallNumpadProps> = ({
  isVisible,
  onClose,
  onDigitPress,
}) => {
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

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-2 xs:p-4 safe-area-bottom">
      <div className="bg-white/95 backdrop-blur-xl rounded-t-3xl xs:rounded-t-3xl sm:rounded-3xl w-full max-w-sm mx-auto animate-slide-up safe-area-bottom shadow-strong border-t-2 border-x-2 border-white/50">
        {/* Header */}
        <div className="flex items-center justify-between p-4 xs:p-5 sm:p-6 border-b border-secondary-200/50">
          <h3 className="text-lg xs:text-xl font-bold bg-gradient-to-r from-secondary-800 to-secondary-900 bg-clip-text text-transparent">Keypad</h3>
          <button
            onClick={onClose}
            className="w-10 h-10 xs:w-11 xs:h-11 rounded-full bg-gradient-to-br from-secondary-100 to-secondary-200 hover:from-secondary-200 hover:to-secondary-300 active:from-secondary-300 active:to-secondary-400 flex items-center justify-center shadow-soft hover:shadow-medium hover:scale-110 active:scale-95 transition-all duration-300 touch-manipulation smooth-hover"
          >
            <X className="w-5 h-5 xs:w-6 xs:h-6 text-secondary-700" />
          </button>
        </div>

        {/* Numpad */}
        <div className="p-4 xs:p-5 sm:p-6 pb-safe-area-bottom">
          <div className="grid grid-cols-3 gap-2.5 xs:gap-3 sm:gap-4">
            {numpadButtons.map(({ digit, letters }) => (
              <button
                key={digit}
                onClick={() => onDigitPress(digit)}
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
        </div>
      </div>
    </div>
  );
};