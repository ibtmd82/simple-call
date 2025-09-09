import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, Eye, EyeOff, Wifi, Server, User, Lock, Globe, RefreshCw, AlertCircle, CheckCircle, Phone } from 'lucide-react';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { useSettingsStore } from '../store/useSettingsStore';
import sipService from '../services/sipService';

interface SettingsProps {
  onClose?: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ onClose }) => {
  const { sipConfig, updateSipConfig, saveSipConfig, resetSipConfig, getSipConfigFromEnv } = useSettingsStore();
  const [formData, setFormData] = useState(sipConfig);
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    // Load current config from store, but fall back to environment if no saved config
    const savedConfig = sipConfig;
    
    // If no saved config, load from environment for initial display
    if (!savedConfig.domain && !savedConfig.uri && !savedConfig.password && !savedConfig.wsServer) {
      const envConfig = {
        domain: import.meta.env.VITE_SIP_DOMAIN || '',
        uri: import.meta.env.VITE_SIP_URI || '',
        password: import.meta.env.VITE_SIP_PASSWORD || '',
        wsServer: import.meta.env.VITE_SIP_WS_SERVER || '',
        callId: import.meta.env.VITE_SIP_CALL_ID || '',
        disableDtls: import.meta.env.VITE_SIP_DISABLE_DTLS === 'true',
      };
      setFormData(envConfig);
    } else {
      setFormData(savedConfig);
    }
  }, [sipConfig]);

  const handleInputChange = (field: keyof typeof formData, value: string) => {
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
      // Validate required fields
      if (!formData.domain || !formData.uri || !formData.password || !formData.wsServer) {
        setTestResult({
          success: false,
          message: 'Domain, Username, Password, and WebSocket Server are required'
        });
        return;
      }

      // Validate WebSocket URL format
      if (!formData.wsServer.startsWith('ws://') && !formData.wsServer.startsWith('wss://')) {
        setTestResult({
          success: false,
          message: 'WebSocket server must start with ws:// or wss://'
        });
        return;
      }

      // Save to store and session storage
      saveSipConfig(formData);

      // Test connection with new config
      try {
        await sipService.initialize(formData);
        setTestResult({
          success: true,
          message: 'Settings saved and connection established successfully!'
        });
      } catch (error) {
        // Save the config even if connection fails
        setTestResult({
          success: false,
          message: `Configuration saved, but connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
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
      // Validate required fields first
      if (!formData.domain || !formData.uri || !formData.password || !formData.wsServer) {
        setTestResult({
          success: false,
          message: 'Domain, Username, Password, and WebSocket Server are required for testing'
        });
        return;
      }

      await sipService.initialize(formData);
      setTestResult({
        success: true,
        message: 'Connection test successful!'
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleReset = () => {
    resetSipConfig();
    setFormData({
      domain: '',
      uri: '',
      password: '',
      wsServer: '',
      callId: '',
    });
    setTestResult(null);
    
    // Show success message after reset
    setTestResult({
      success: true,
      message: 'Settings reset successfully. Using default configuration from environment.'
    });
  };

  const isFormValid = formData.domain && formData.uri && formData.password && formData.wsServer;
  const hasChanges = JSON.stringify(formData) !== JSON.stringify(sipConfig);

  return (
    <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-6 w-full max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
          <SettingsIcon className="w-5 h-5 text-primary-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-secondary-900">SIP Settings</h2>
          <p className="text-sm text-secondary-500">Configure your SIP server connection</p>
        </div>
      </div>

      {/* Form */}
      <div className="space-y-4">
        {/* SIP Domain */}
        <Input
          label="SIP Domain"
          placeholder="192.223.13.211 or sip.example.com"
          value={formData.domain}
          onChange={(e) => handleInputChange('domain', e.target.value)}
          leftIcon={<Globe className="w-4 h-4" />}
          fullWidth
        />

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

        {/* WebSocket Server */}
        <Input
          label="WebSocket Server"
          placeholder="wss://192.223.13.211:8080/ws"
          value={formData.wsServer}
          onChange={(e) => handleInputChange('wsServer', e.target.value)}
          leftIcon={<Server className="w-4 h-4" />}
          fullWidth
        />

        {/* Call ID */}
        <Input
          label="Call ID (Optional)"
          placeholder="unique-call-identifier"
          value={formData.callId || ''}
          onChange={(e) => handleInputChange('callId', e.target.value)}
          leftIcon={<Phone className="w-4 h-4" />}
          fullWidth
        />

        {/* Quick Actions */}
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            leftIcon={<RefreshCw className="w-3 h-3" />}
          >
            Reset
          </Button>
        </div>

        {/* Help Text */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-blue-700">
            <strong>Note:</strong> You need valid SIP server credentials from a VoIP provider. 
            The WebSocket server URL should use wss:// for secure connections.
          </p>
        </div>

        {/* Test Result */}
        {testResult && (
          <div className={`rounded-lg p-3 flex items-start gap-2 ${
            testResult.success 
              ? 'bg-success-50 border border-success-200 text-success-700' 
              : 'bg-error-50 border border-error-200 text-error-700'
          }`}>
            {testResult.success ? (
              <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            )}
            <p className="text-sm">{testResult.message}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <Button
            variant="secondary"
            onClick={handleTestConnection}
            disabled={!isFormValid || isTesting}
            isLoading={isTesting}
            leftIcon={<Wifi className="w-4 h-4" />}
            fullWidth
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