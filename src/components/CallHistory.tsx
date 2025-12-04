import React from 'react';
import { Clock, Phone, PhoneIncoming, PhoneMissed, PhoneOff } from 'lucide-react';
import { useCallStore } from '../store/useCallStore';
import { formatTimestamp, formatDuration } from '../utils/timeUtils';
import { CallHistoryItem } from '../types';

interface CallHistoryProps {
  onCallNumber?: (number: string) => void;
}

export const CallHistory: React.FC<CallHistoryProps> = ({ onCallNumber }) => {
  const { callHistory } = useCallStore();

  const getCallIcon = (status: CallHistoryItem['status']) => {
    switch (status) {
      case 'completed':
        return <Phone className="w-4 h-4 text-success-500" />;
      case 'missed':
        return <PhoneMissed className="w-4 h-4 text-error-500" />;
      case 'failed':
        return <PhoneOff className="w-4 h-4 text-error-500" />;
      default:
        return <Phone className="w-4 h-4 text-secondary-500" />;
    }
  };

  const getCallStatusText = (status: CallHistoryItem['status']) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'missed':
        return 'Missed';
      case 'failed':
        return 'Failed';
      default:
        return 'Unknown';
    }
  };

  if (callHistory.length === 0) {
    return (
      <div className="bg-white/90 backdrop-blur-lg rounded-2xl sm:rounded-3xl shadow-strong border border-white/50 p-4 xs:p-5 sm:p-6 w-full animate-fade-in-up">
        <div className="text-center py-8 xs:py-10 sm:py-14">
          <div className="inline-flex items-center justify-center w-16 h-16 xs:w-20 xs:h-20 rounded-full bg-gradient-to-br from-secondary-100 to-secondary-200 mb-4 shadow-soft">
            <Clock className="w-8 h-8 xs:w-10 xs:h-10 sm:w-12 sm:h-12 text-secondary-500" />
          </div>
          <h3 className="text-lg xs:text-xl sm:text-2xl font-bold text-secondary-900 mb-2 bg-gradient-to-r from-secondary-700 to-secondary-900 bg-clip-text text-transparent">No Call History</h3>
          <p className="text-secondary-500 text-sm xs:text-base">Your recent calls will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/90 backdrop-blur-lg rounded-2xl sm:rounded-3xl shadow-strong border border-white/50 p-4 xs:p-5 sm:p-6 w-full animate-fade-in-up">
      <div className="flex items-center gap-2 xs:gap-2.5 mb-4 xs:mb-5 sm:mb-6">
        <div className="w-10 h-10 xs:w-12 xs:h-12 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center shadow-soft">
          <Clock className="w-5 h-5 xs:w-6 xs:h-6 text-primary-600" />
        </div>
        <h3 className="text-lg xs:text-xl sm:text-2xl font-bold bg-gradient-to-r from-secondary-800 to-secondary-900 bg-clip-text text-transparent">Recent Calls</h3>
      </div>
      
      <div className="space-y-2 xs:space-y-2.5 sm:space-y-3 max-h-[60vh] sm:max-h-96 overflow-y-auto">
        {callHistory.map((call) => (
          <div
            key={call.id}
            className="flex items-center gap-2.5 xs:gap-3 p-3 xs:p-3.5 sm:p-4 rounded-xl xs:rounded-2xl bg-gradient-to-r from-white to-secondary-50/50 hover:from-primary-50 hover:to-primary-100/50 active:from-primary-100 active:to-primary-200/50 border border-secondary-200/50 hover:border-primary-300/50 shadow-soft hover:shadow-medium transition-all duration-300 group touch-manipulation smooth-hover"
          >
            <div className="flex-shrink-0">
              {getCallIcon(call.status)}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs xs:text-sm sm:text-base font-medium text-secondary-900 truncate">
                  Support Call
                </p>
                <span className="text-[10px] xs:text-xs sm:text-sm text-secondary-500 flex-shrink-0">
                  {formatTimestamp(call.timestamp)}
                </span>
              </div>
              <div className="flex items-center justify-between mt-0.5 xs:mt-1 gap-2">
                <p className="text-[10px] xs:text-xs sm:text-sm text-secondary-500">
                  {getCallStatusText(call.status)}
                </p>
                {call.duration > 0 && (
                  <span className="text-[10px] xs:text-xs sm:text-sm text-secondary-500 flex-shrink-0">
                    {formatDuration(call.duration)}
                  </span>
                )}
              </div>
            </div>
            
            <button
              onClick={() => onCallNumber?.('support')}
              className="flex-shrink-0 w-9 h-9 xs:w-10 xs:h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-br from-success-500 to-success-600 hover:from-success-600 hover:to-success-700 active:from-success-700 active:to-success-800 text-white flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 shadow-medium hover:shadow-strong hover:scale-110 active:scale-95 transition-all duration-300 touch-manipulation smooth-hover"
            >
              <Phone className="w-4 h-4 xs:w-4.5 xs:h-4.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};