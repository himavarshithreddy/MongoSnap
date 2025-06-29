import React, { useState } from 'react';
import { X, Shield, Mail, Key, Smartphone, Check, AlertCircle, Settings as SettingsIcon, User } from 'lucide-react';
import { useUser } from '../hooks/useUser';

function Settings({ isOpen, onClose }) {
    const { user } = useUser();
    const [changePasswordLoading, setChangePasswordLoading] = useState(false);
    const [changePasswordSuccess, setChangePasswordSuccess] = useState('');
    const [changePasswordError, setChangePasswordError] = useState('');
    const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

    if (!isOpen) return null;

    const isOAuthUser = user?.oauthProvider;

    const handleChangePasswordRequest = async () => {
        setChangePasswordLoading(true);
        setChangePasswordError('');
        setChangePasswordSuccess('');

        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/auth/request-password-change', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });
            
            const data = await res.json();
            
            if (!res.ok) {
                throw new Error(data.message || 'Failed to send password change link');
            }
            
            setChangePasswordSuccess('Password change link has been sent to your email address.');
        } catch (err) {
            setChangePasswordError(err.message);
        } finally {
            setChangePasswordLoading(false);
        }
    };

    const handleToggle2FA = () => {
        setTwoFactorEnabled(!twoFactorEnabled);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="bg-[#17211b] rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex">
                {/* Left Sidebar */}
                <div className="w-64 bg-[#0f1611] p-6">
                    <div className="flex items-center gap-2 mb-6">
                        <SettingsIcon size={20} className="text-[#11a15e]" />
                        <h2 className="text-xl font-bold text-white">Settings</h2>
                    </div>
                    
                    <div className="bg-[#35c56a69] rounded-lg p-4 flex items-center gap-3">
                        <Shield size={18} className="text-[#11a15e]" />
                        <span className="font-medium text-white">Security</span>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 flex flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6">
                        <h3 className="text-xl font-semibold text-white">Security</h3>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-700 rounded-lg cursor-pointer"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 p-6 overflow-y-auto">
                        {isOAuthUser ? (
                            /* OAuth User Message */
                            <div className="bg-[#1a2520] rounded-lg p-8 text-center">
                                <div className="flex justify-center mb-4">
                                    <div className="p-3 bg-[#35c56a69] rounded-full">
                                        <User size={24} className="text-[#11a15e]" />
                                    </div>
                                </div>
                                <h4 className="text-xl font-semibold text-white mb-3">OAuth Account</h4>
                                <p className="text-gray-300 text-sm mb-4 leading-relaxed">
                                    You're signed in with <span className="text-[#11a15e] font-medium">{user?.oauthProvider}</span>. 
                                    Your password and security settings are managed by your OAuth provider.
                                </p>
                                <div className="bg-[#0f1611] rounded-lg p-4">
                                    <p className="text-gray-400 text-xs">
                                        To manage your security settings, please visit your {user?.oauthProvider} account settings.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            /* Regular User Security Settings */
                            <div className="space-y-6">
                                {/* Change Password Section */}
                                <div className="bg-[#1a2520] rounded-lg p-6">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-2 bg-[#35c56a69] rounded-lg">
                                            <Key size={20} className="text-[#11a15e]" />
                                        </div>
                                        <div>
                                            <h4 className="text-lg font-semibold text-white">Change Password</h4>
                                            <p className="text-gray-400 text-sm">Send a secure link to your email</p>
                                        </div>
                                    </div>

                                    {/* Success Message */}
                                    {changePasswordSuccess && (
                                        <div className="flex items-center gap-2 bg-green-900/50 border border-green-500 text-green-200 px-4 py-3 rounded-lg mb-4">
                                            <Check size={16} />
                                            <span className="text-sm">{changePasswordSuccess}</span>
                                        </div>
                                    )}

                                    {/* Error Message */}
                                    {changePasswordError && (
                                        <div className="flex items-center gap-2 bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg mb-4">
                                            <AlertCircle size={16} />
                                            <span className="text-sm">{changePasswordError}</span>
                                        </div>
                                    )}

                                    <p className="text-gray-300 text-sm mb-4">
                                        For security, we'll send a password change link to your registered email address.
                                    </p>

                                    <button
                                        onClick={handleChangePasswordRequest}
                                        disabled={changePasswordLoading}
                                        className={`px-6 py-3 bg-[#35c56a69] text-white rounded-lg font-medium transition-all duration-200 cursor-pointer ${
                                            changePasswordLoading 
                                                ? 'opacity-60 cursor-not-allowed' 
                                                : 'hover:bg-[#35c56a] hover:scale-105'
                                        }`}
                                    >
                                        {changePasswordLoading ? (
                                            <div className="flex items-center gap-2">
                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                                <span>Sending...</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <Mail size={16} />
                                                <span>Send Password Change Link</span>
                                            </div>
                                        )}
                                    </button>
                                </div>

                                {/* Two-Factor Authentication Section */}
                                <div className="bg-[#1a2520] rounded-lg p-6">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-2 bg-[#35c56a69] rounded-lg">
                                            <Smartphone size={20} className="text-[#11a15e]" />
                                        </div>
                                        <div>
                                            <h4 className="text-lg font-semibold text-white">Two-Factor Authentication</h4>
                                            <p className="text-gray-400 text-sm">Add extra security to your account</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between bg-[#0f1611] rounded-lg p-4 mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-3 h-3 rounded-full ${twoFactorEnabled ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                                            <span className="text-white font-medium">
                                                {twoFactorEnabled ? 'Enabled' : 'Disabled'}
                                            </span>
                                        </div>
                                        <span className={`px-3 py-1 rounded text-xs font-medium ${
                                            twoFactorEnabled 
                                                ? 'bg-green-900/50 text-green-300 border border-green-600' 
                                                : 'bg-red-900/50 text-red-300 border border-red-600'
                                        }`}>
                                            {twoFactorEnabled ? 'ACTIVE' : 'INACTIVE'}
                                        </span>
                                    </div>

                                    <p className="text-gray-300 text-sm mb-4">
                                        {twoFactorEnabled 
                                            ? 'Your account is protected with two-factor authentication.' 
                                            : 'Enable 2FA using an authenticator app like Google Authenticator or Authy.'
                                        }
                                    </p>

                                    <button
                                        onClick={handleToggle2FA}
                                        className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 cursor-pointer ${
                                            twoFactorEnabled 
                                                ? 'bg-red-600 hover:bg-red-700 text-white' 
                                                : 'bg-[#35c56a69] hover:bg-[#35c56a] text-white hover:scale-105'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Smartphone size={16} />
                                            <span>{twoFactorEnabled ? 'Disable 2FA' : 'Enable 2FA'}</span>
                                        </div>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Settings; 