import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, Eye, EyeOff, Wifi, User, Lock, AlertCircle, CheckCircle, Phone, Radio } from 'lucide-react';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { useSettingsStore } from '../store/useSettingsStore';
import { useCallStore } from '../store/useCallStore';
import { sipService } from '../services/sipService';
import { CallStatus, SipConfig } from '../types/index';

interface SettingsProps {
  onClose?: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ onClose }) => {
  const { sipConfig, saveSipConfig, saveUserCredentials, loadUserCredentials } = useSettingsStore();
  const { status } = useCallStore();
  const [formData, setFormData] = useState(sipConfig);
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    // Load config from .env (excluding username/password) and localStorage
    const loadConfig = async () => {
      setIsLoading(true);
      try {
        // Load user credentials from localStorage
        const credentials = await loadUserCredentials();
        
        // Only set form data for fields that can be edited (username, password)
        // domain, wsServer, callId come from .env only
        // disableDtls is always false (DTLS always enabled)
        setFormData({
          domain: '', // Not editable, comes from .env
          wsServer: '', // Not editable, comes from .env
          callId: '', // Not editable, comes from .env
          uri: credentials?.uri || sipConfig.uri || '',
          password: credentials?.password || sipConfig.password || '',
          disableDtls: false, // Always enabled
        });
      } catch (error) {
        console.error('Error loading config:', error);
        setFormData(sipConfig);
      } finally {
        setIsLoading(false);
      }
    };

    loadConfig();
  }, []);

  useEffect(() => {
    // Update form data when sipConfig changes (only for editable fields)
    if (!isLoading) {
      setFormData(prev => ({
        ...prev,
        // domain, wsServer, callId are not editable (come from .env)
        // disableDtls is always false (DTLS always enabled)
        // Keep existing credentials unless explicitly changed
        uri: sipConfig.uri || prev.uri,
        password: sipConfig.password || prev.password,
      }));
    }
  }, [sipConfig, isLoading]);

  const handleInputChange = (field: keyof typeof formData, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setTestResult(null); // Clear test result when config changes
  };

  const handleSave = async () => {
    setIsSaving(true);
    setTestResult(null);

    try {
      // Validate required fields (domain and wsServer come from .env)
      if (!formData.uri || !formData.password) {
        setTestResult({
          success: false,
          message: 'Username and Password are required'
        });
        setIsSaving(false);
        return;
      }

      // Check if .env config is available
      const envDomain = import.meta.env.VITE_SIP_DOMAIN || '';
      const envWsServer = import.meta.env.VITE_SIP_WS_SERVER || '';
      
      if (!envDomain || !envWsServer) {
        setTestResult({
          success: false,
          message: 'Domain and WebSocket Server must be configured in .env file'
        });
        setIsSaving(false);
        return;
      }

      // Build complete config from .env + form data (username, password)
      // DTLS is always enabled (disableDtls: false)
      const completeConfig: SipConfig = {
        domain: import.meta.env.VITE_SIP_DOMAIN || '',
        wsServer: import.meta.env.VITE_SIP_WS_SERVER || '',
        callId: import.meta.env.VITE_SIP_CALL_ID || '',
        uri: formData.uri,
        password: formData.password,
        disableDtls: false, // Always enabled
      };
      
      // Save config (only credentials, domain/wsServer/callId come from .env)
      saveSipConfig(completeConfig);
      saveUserCredentials(formData.uri, formData.password);
      
      // Update formData to reflect saved state
      setFormData(formData);
      
      console.log('Configuration saved successfully:', {
        domain: completeConfig.domain,
        uri: completeConfig.uri,
        wsServer: completeConfig.wsServer,
        hasPassword: !!completeConfig.password,
      });

      // Test connection with new config (use completeConfig which has .env values)
      try {
        await sipService.connect(completeConfig);
        setTestResult({
          success: true,
          message: 'Settings saved! User credentials saved to browser localStorage. Connection established successfully!'
        });
      } catch (error) {
        // Save the config even if connection fails
        setTestResult({
          success: true,
          message: `Settings saved! User credentials saved to browser localStorage. Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: `Failed to save configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      // Validate required fields (domain and wsServer come from .env)
      if (!formData.uri || !formData.password) {
        setTestResult({
          success: false,
          message: 'Username and Password are required for testing'
        });
        return;
      }

      // Check if .env config is available
      const envDomain = import.meta.env.VITE_SIP_DOMAIN || '';
      const envWsServer = import.meta.env.VITE_SIP_WS_SERVER || '';
      
      if (!envDomain || !envWsServer) {
        setTestResult({
          success: false,
          message: 'Domain and WebSocket Server must be configured in .env file'
        });
        return;
      }

      // Build complete config from .env + form data for testing
      // DTLS is always enabled (disableDtls: false)
      const testConfig: SipConfig = {
        domain: import.meta.env.VITE_SIP_DOMAIN || '',
        wsServer: import.meta.env.VITE_SIP_WS_SERVER || '',
        callId: import.meta.env.VITE_SIP_CALL_ID || '',
        uri: formData.uri,
        password: formData.password,
        disableDtls: false, // Always enabled
      };
      
      // Use the dedicated test connection method
      await sipService.testConnection(testConfig);
      setTestResult({
        success: true,
        message: 'Connection and registration test successful!'
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Form is valid if username and password are provided (domain/wsServer come from .env)
  const envDomain = import.meta.env.VITE_SIP_DOMAIN || '';
  const envWsServer = import.meta.env.VITE_SIP_WS_SERVER || '';
  const isFormValid = formData.uri && formData.password && envDomain && envWsServer;

  const getStatusInfo = () => {
    switch (status) {
      case CallStatus.IDLE:
        return { text: 'Idle', color: 'text-secondary-500', bgColor: 'bg-secondary-100', icon: Radio };
      case CallStatus.CONNECTING:
        return { text: 'Connecting...', color: 'text-primary-600', bgColor: 'bg-primary-100', icon: Radio };
      case CallStatus.CONNECTED:
        return { text: 'Connected', color: 'text-primary-600', bgColor: 'bg-primary-100', icon: Radio };
      case CallStatus.REGISTERED:
        return { text: 'Registered', color: 'text-success-600', bgColor: 'bg-success-100', icon: CheckCircle };
      case CallStatus.UNREGISTERED:
        return { text: 'Unregistered', color: 'text-error-600', bgColor: 'bg-error-100', icon: AlertCircle };
      case CallStatus.CALLING:
        return { text: 'Calling...', color: 'text-primary-600', bgColor: 'bg-primary-100', icon: Phone };
      case CallStatus.RINGING:
        return { text: 'Ringing...', color: 'text-primary-600', bgColor: 'bg-primary-100', icon: Phone };
      case CallStatus.ACTIVE:
        return { text: 'Call Active', color: 'text-success-600', bgColor: 'bg-success-100', icon: Phone };
      case CallStatus.ENDED:
        return { text: 'Call Ended', color: 'text-secondary-500', bgColor: 'bg-secondary-100', icon: Phone };
      case CallStatus.FAILED:
        return { text: 'Connection Failed', color: 'text-error-600', bgColor: 'bg-error-100', icon: AlertCircle };
      default:
        return { text: 'Unknown', color: 'text-secondary-500', bgColor: 'bg-secondary-100', icon: Radio };
    }
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  return (
    <div className="bg-white/90 backdrop-blur-lg rounded-2xl xs:rounded-3xl shadow-strong border border-white/50 p-4 xs:p-5 w-full max-w-md mx-auto animate-fade-in-up mobile-ui-only">
      {/* Header */}
      <div className="flex items-center gap-3 xs:gap-3.5 mb-5 xs:mb-6">
        <div className="w-12 h-12 xs:w-14 xs:h-14 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-medium">
          <SettingsIcon className="w-6 h-6 xs:w-7 xs:h-7 text-white" />
        </div>
        <div>
          <h2 className="text-xl xs:text-2xl font-bold bg-gradient-to-r from-secondary-800 to-secondary-900 bg-clip-text text-transparent">SIP Settings</h2>
          <p className="text-xs xs:text-sm text-secondary-500 mt-0.5">Configure your SIP server connection</p>
        </div>
      </div>

      {/* Connection Status */}
      <div className={`mb-5 xs:mb-6 sm:mb-7 rounded-xl xs:rounded-2xl p-3 xs:p-3.5 flex items-center gap-3 xs:gap-3.5 border border-current/20 shadow-soft ${statusInfo.bgColor}`}>
        <div className={`flex-shrink-0 ${statusInfo.color}`}>
          <StatusIcon className="w-5 h-5 xs:w-6 xs:h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-xs xs:text-sm font-semibold ${statusInfo.color}`}>Connection Status</p>
          <p className={`text-[10px] xs:text-xs ${statusInfo.color} opacity-90 truncate font-medium`}>{statusInfo.text}</p>
        </div>
        {(status === CallStatus.REGISTERED || status === CallStatus.CONNECTED) && (
          <div className="flex-shrink-0">
            <div className="w-2.5 h-2.5 rounded-full bg-success-500 animate-pulse shadow-sm"></div>
          </div>
        )}
      </div>

      {/* Form */}
      <div className="space-y-3 xs:space-y-4">
        {/* SIP Username */}
        <Input
          label="SIP Username"
          placeholder="your-username"
          value={formData.uri}
          onChange={(e) => handleInputChange('uri', e.target.value)}
          leftIcon={<User className="w-4 h-4" />}
          fullWidth
        />

        {/* SIP Password */}
        <div className="relative">
          <Input
            label="SIP Password"
            type={showPassword ? 'text' : 'password'}
            placeholder="your-password"
            value={formData.password}
            onChange={(e) => handleInputChange('password', e.target.value)}
            leftIcon={<Lock className="w-4 h-4" />}
            fullWidth
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-8 text-secondary-500 hover:text-secondary-700 transition-colors touch-manipulation"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        {/* Test Result */}
        {testResult && (
          <div className={`rounded-xl xs:rounded-2xl p-3 xs:p-3.5 flex items-start gap-2.5 xs:gap-3 shadow-soft border-2 ${
            testResult.success 
              ? 'bg-gradient-to-br from-success-50 to-success-100 border-success-300/50 text-success-800' 
              : 'bg-gradient-to-br from-error-50 to-error-100 border-error-300/50 text-error-800'
          }`}>
            {testResult.success ? (
              <CheckCircle className="w-5 h-5 xs:w-6 xs:h-6 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 xs:w-6 xs:h-6 mt-0.5 flex-shrink-0" />
            )}
            <p className="text-xs xs:text-sm font-medium">{testResult.message}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2.5 xs:gap-3 pt-3 xs:pt-4">
          <Button
            variant="secondary"
            onClick={handleTestConnection}
            disabled={!isFormValid || isTesting}
            isLoading={isTesting}
            leftIcon={<Wifi className="w-4 h-4" />}
            fullWidth
            className="min-h-[44px]"
          >
            Test Connection
          </Button>
          
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={!isFormValid || isSaving}
            isLoading={isSaving}
            leftIcon={<Save className="w-4 h-4" />}
            fullWidth
            className="min-h-[44px]"
          >
            Save Settings
          </Button>
        </div>

        {onClose && (
          <Button
            variant="ghost"
            onClick={onClose}
            fullWidth
            className="mt-2"
          >
            Close
          </Button>
        )}
      </div>
    </div>
  );
};