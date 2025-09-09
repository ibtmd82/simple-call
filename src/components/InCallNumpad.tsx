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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-sm mx-auto animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-secondary-100">
          <h3 className="text-lg font-semibold text-secondary-900">Keypad</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-secondary-100 hover:bg-secondary-200 flex items-center justify-center transition-colors touch-manipulation"
          >
            <X className="w-4 h-4 text-secondary-600" />
          </button>
        </div>

        {/* Numpad */}
        <div className="p-4 sm:p-6">
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            {numpadButtons.map(({ digit, letters }) => (
              <button
                key={digit}
                onClick={() => onDigitPress(digit)}
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
        </div>

        {/* Safe area for mobile */}
        <div className="h-safe-area-bottom sm:hidden"></div>
      </div>
    </div>
  );
};