import React, { useState, useMemo } from 'react';
import { User, Phone, Search, Plus } from 'lucide-react';
import { Input } from './ui/Input';
import { useSettingsStore } from '../store/useSettingsStore';

interface Contact {
  id: string;
  name: string;
  number: string;
  avatar?: string;
}

interface ContactsProps {
  onCallNumber?: (number: string) => void;
}

export const Contacts: React.FC<ContactsProps> = ({ onCallNumber }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const { getSipConfigFromEnv } = useSettingsStore();
  
  // Get domain from .env configuration
  const sipConfig = getSipConfigFromEnv();
  const domain = sipConfig.domain || '';
  
  // Sample contacts - use domain from .env configuration
  // In a real app, these would come from a store or API
  const contacts: Contact[] = useMemo(() => {
    if (!domain) {
      // Return empty contacts if domain is not configured
      return [];
    }
    
    return [
      { id: '1', name: 'Support Team', number: `168@${domain}` },
      { id: '2', name: 'Technical Support', number: `169@${domain}` },
      { id: '3', name: 'Customer Service', number: `170@${domain}` },
      { id: '4', name: 'Emergency Line', number: `911@${domain}` },
    ];
  }, [domain]);

  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="bg-white/90 backdrop-blur-lg rounded-2xl xs:rounded-3xl shadow-strong border border-white/50 p-4 xs:p-5 w-full animate-fade-in-up mobile-ui-only">
      <div className="flex items-center justify-between mb-4 xs:mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 xs:w-12 xs:h-12 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center shadow-soft">
            <User className="w-5 h-5 xs:w-6 xs:h-6 text-primary-600" />
          </div>
          <h3 className="text-lg xs:text-xl font-bold bg-gradient-to-r from-secondary-800 to-secondary-900 bg-clip-text text-transparent">Contacts</h3>
        </div>
        <button className="w-10 h-10 xs:w-11 xs:h-11 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 active:from-primary-700 active:to-primary-800 text-white flex items-center justify-center shadow-medium hover:shadow-strong hover:scale-110 active:scale-95 transition-all duration-300 touch-manipulation smooth-hover">
          <Plus className="w-5 h-5 xs:w-6 xs:h-6" />
        </button>
      </div>

      {/* Search - Mobile UI */}
      <div className="mb-3 xs:mb-4">
        <Input
          placeholder="Search contacts..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          leftIcon={<Search className="w-4 h-4" />}
          fullWidth
          className="text-base" // Better for mobile
        />
      </div>

      {/* Contacts List - Mobile UI */}
      <div className="space-y-1.5 xs:space-y-2 max-h-[60vh] overflow-y-auto">
        {!domain ? (
          <div className="text-center py-8 xs:py-10 sm:py-14">
            <div className="inline-flex items-center justify-center w-16 h-16 xs:w-20 xs:h-20 rounded-full bg-gradient-to-br from-secondary-100 to-secondary-200 mb-4 shadow-soft">
              <User className="w-8 h-8 xs:w-10 xs:h-10 sm:w-12 sm:h-12 text-secondary-500" />
            </div>
            <p className="text-secondary-500 text-sm xs:text-base font-medium">
              SIP domain not configured
            </p>
            <p className="text-secondary-400 text-xs xs:text-sm mt-2">
              Please configure VITE_SIP_DOMAIN in .env file
            </p>
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="text-center py-8 xs:py-10 sm:py-14">
            <div className="inline-flex items-center justify-center w-16 h-16 xs:w-20 xs:h-20 rounded-full bg-gradient-to-br from-secondary-100 to-secondary-200 mb-4 shadow-soft">
              <User className="w-8 h-8 xs:w-10 xs:h-10 sm:w-12 sm:h-12 text-secondary-500" />
            </div>
            <p className="text-secondary-500 text-sm xs:text-base font-medium">
              {searchTerm ? 'No contacts found' : 'No contacts available'}
            </p>
          </div>
        ) : (
          filteredContacts.map((contact) => (
            <div
              key={contact.id}
              className="flex items-center gap-3 xs:gap-3.5 p-3 xs:p-3.5 sm:p-4 rounded-xl xs:rounded-2xl bg-gradient-to-r from-white to-secondary-50/50 hover:from-primary-50 hover:to-primary-100/50 active:from-primary-100 active:to-primary-200/50 border border-secondary-200/50 hover:border-primary-300/50 shadow-soft hover:shadow-medium transition-all duration-300 group touch-manipulation smooth-hover"
            >
              {/* Avatar */}
              <div className="w-11 h-11 xs:w-12 xs:h-12 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center flex-shrink-0 shadow-medium border-2 border-white/50">
                {contact.avatar ? (
                  <img
                    src={contact.avatar}
                    alt={contact.name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <span className="text-sm xs:text-base font-bold text-white">
                    {getInitials(contact.name)}
                  </span>
                )}
              </div>

              {/* Contact Info */}
              <div className="flex-1 min-w-0">
                <p className="text-xs xs:text-sm font-medium text-secondary-900 truncate">
                  {contact.name}
                </p>
                <p className="text-[10px] xs:text-xs text-secondary-500 truncate">
                  {contact.number}
                </p>
              </div>

              {/* Call Button */}
              <button
                onClick={() => onCallNumber?.(contact.number)}
                className="w-10 h-10 xs:w-11 xs:h-11 rounded-full bg-gradient-to-br from-success-500 to-success-600 hover:from-success-600 hover:to-success-700 active:from-success-700 active:to-success-800 text-white flex items-center justify-center opacity-100 shadow-medium hover:shadow-strong hover:scale-110 active:scale-95 transition-all duration-300 touch-manipulation smooth-hover"
              >
                <Phone className="w-4.5 h-4.5 xs:w-5 xs:h-5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};