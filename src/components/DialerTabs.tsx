import React, { useState } from 'react';
import { Phone, Clock, User, Settings as SettingsIcon } from 'lucide-react';
import { Dialer } from './Dialer';
import { CallHistory } from './CallHistory';
import { Contacts } from './Contacts';
import { Settings } from './Settings';

type TabType = 'dialer' | 'history' | 'contacts' | 'settings';

export const DialerTabs: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('dialer');

  const tabs = [
    { id: 'dialer' as TabType, label: 'Dialer', icon: Phone },
    { id: 'history' as TabType, label: 'Recent', icon: Clock },
    { id: 'contacts' as TabType, label: 'Contacts', icon: User },
    { id: 'settings' as TabType, label: 'Settings', icon: SettingsIcon },
  ];

  const handleCallNumber = (number: string) => {
    setActiveTab('dialer');
  };

  return (
    <div className="w-full">
      {/* Tab Navigation - Enhanced Design */}
      <div className="flex bg-gradient-to-r from-secondary-100 to-secondary-200 rounded-xl xs:rounded-2xl p-1 xs:p-1.5 mb-3 xs:mb-4 sm:mb-5 shadow-soft border border-secondary-300/30">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 xs:gap-2 sm:gap-2.5 py-2.5 xs:py-3 sm:py-2.5 px-1 xs:px-2 sm:px-4 rounded-lg xs:rounded-xl text-[10px] xs:text-xs sm:text-sm font-semibold transition-all duration-300 touch-manipulation min-h-[48px] smooth-hover ${
              activeTab === id
                ? 'bg-gradient-to-br from-white to-primary-50 text-primary-600 shadow-medium border border-primary-200/50 scale-105'
                : 'text-secondary-600 hover:text-primary-600 active:bg-secondary-200/50 hover:scale-105 active:scale-95'
            }`}
          >
            <Icon className={`w-4 h-4 xs:w-4.5 xs:h-4.5 sm:w-5 sm:h-5 transition-transform ${activeTab === id ? 'scale-110' : ''}`} />
            <span className="hidden xs:inline sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="animate-fade-in">
        {activeTab === 'dialer' && <Dialer onCall={handleCallNumber} />}
        {activeTab === 'history' && <CallHistory onCallNumber={handleCallNumber} />}
        {activeTab === 'contacts' && <Contacts onCallNumber={handleCallNumber} />}
        {activeTab === 'settings' && <Settings />}
      </div>
    </div>
  );
};