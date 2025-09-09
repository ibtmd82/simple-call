import React, { useState } from 'react';
import { User, Phone, Search, Plus } from 'lucide-react';
import { Input } from './ui/Input';

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
  
  // Sample contacts - in a real app, these would come from a store or API
  const contacts: Contact[] = [
    { id: '1', name: 'Support Team', number: '168@opensips.mooo.com' },
    { id: '2', name: 'Technical Support', number: '169@opensips.mooo.com' },
    { id: '3', name: 'Customer Service', number: '170@opensips.mooo.com' },
    { id: '4', name: 'Emergency Line', number: '911@opensips.mooo.com' },
  ];

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
    <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-6 w-full">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h3 className="text-lg sm:text-xl font-semibold text-secondary-900">Contacts</h3>
        <button className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary-100 hover:bg-primary-200 text-primary-600 flex items-center justify-center transition-colors touch-manipulation">
          <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </div>

      {/* Search - Mobile Optimized */}
      <div className="mb-4 sm:mb-6">
        <Input
          placeholder="Search contacts..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          leftIcon={<Search className="w-4 h-4" />}
          fullWidth
          className="text-base" // Better for mobile
        />
      </div>

      {/* Contacts List - Mobile Optimized */}
      <div className="space-y-2 sm:space-y-3 max-h-80 sm:max-h-96 overflow-y-auto">
        {filteredContacts.length === 0 ? (
          <div className="text-center py-8 sm:py-12">
            <User className="w-12 h-12 sm:w-16 sm:h-16 text-secondary-300 mx-auto mb-3 sm:mb-4" />
            <p className="text-secondary-500 text-sm sm:text-base">
              {searchTerm ? 'No contacts found' : 'No contacts available'}
            </p>
          </div>
        ) : (
          filteredContacts.map((contact) => (
            <div
              key={contact.id}
              className="flex items-center gap-3 p-3 sm:p-4 rounded-xl hover:bg-secondary-50 transition-colors group touch-manipulation"
            >
              {/* Avatar */}
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                {contact.avatar ? (
                  <img
                    src={contact.avatar}
                    alt={contact.name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <span className="text-sm sm:text-base font-semibold text-primary-600">
                    {getInitials(contact.name)}
                  </span>
                )}
              </div>

              {/* Contact Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm sm:text-base font-medium text-secondary-900 truncate">
                  {contact.name}
                </p>
                <p className="text-xs sm:text-sm text-secondary-500 truncate">
                  {contact.number}
                </p>
              </div>

              {/* Call Button */}
              <button
                onClick={() => onCallNumber?.(contact.number)}
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-success-100 hover:bg-success-200 text-success-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 touch-manipulation"
              >
                <Phone className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};