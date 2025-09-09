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
      <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-6 w-full">
        <div className="text-center py-8 sm:py-12">
          <Clock className="w-12 h-12 sm:w-16 sm:h-16 text-secondary-300 mx-auto mb-3 sm:mb-4" />
          <h3 className="text-lg sm:text-xl font-semibold text-secondary-900 mb-2">No Call History</h3>
          <p className="text-secondary-500 text-sm sm:text-base">Your recent calls will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-6 w-full">
      <div className="flex items-center gap-2 mb-4 sm:mb-6">
        <Clock className="w-5 h-5 text-secondary-600" />
        <h3 className="text-lg sm:text-xl font-semibold text-secondary-900">Recent Calls</h3>
      </div>
      
      <div className="space-y-2 sm:space-y-3 max-h-80 sm:max-h-96 overflow-y-auto">
        {callHistory.map((call) => (
          <div
            key={call.id}
            className="flex items-center gap-3 p-3 sm:p-4 rounded-xl hover:bg-secondary-50 transition-colors group touch-manipulation"
          >
            <div className="flex-shrink-0">
              {getCallIcon(call.status)}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-sm sm:text-base font-medium text-secondary-900 truncate">
                  Support Call
                </p>
                <span className="text-xs sm:text-sm text-secondary-500 ml-2">
                  {formatTimestamp(call.timestamp)}
                </span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs sm:text-sm text-secondary-500">
                  {getCallStatusText(call.status)}
                </p>
                {call.duration > 0 && (
                  <span className="text-xs sm:text-sm text-secondary-500">
                    {formatDuration(call.duration)}
                  </span>
                )}
              </div>
            </div>
            
            <button
              onClick={() => onCallNumber?.('support')}
              className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary-100 hover:bg-primary-200 text-primary-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity touch-manipulation"
            >
              <Phone className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};