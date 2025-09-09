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
      {/* Tab Navigation - Mobile Optimized */}
      <div className="flex bg-secondary-100 rounded-xl p-1 mb-3 sm:mb-4">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 sm:py-2 px-1 sm:px-3 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 touch-manipulation ${
              activeTab === id
                ? 'bg-white text-primary-600 shadow-sm'
                : 'text-secondary-600 hover:text-secondary-900'
            }`}
          >
            <Icon className="w-4 h-4" />
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