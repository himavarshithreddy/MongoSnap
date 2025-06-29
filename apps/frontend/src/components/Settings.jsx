import React, { useState, useEffect, useCallback } from 'react';
import { X, Shield, Mail, Key, Smartphone, Check, AlertCircle, Settings as SettingsIcon, User, QrCode, Clock, Smartphone as PhoneIcon } from 'lucide-react';
import { useUser } from '../hooks/useUser';

function Settings({ isOpen, onClose }) {
    const { user } = useUser();
    const [changePasswordLoading, setChangePasswordLoading] = useState(false);
    const [changePasswordSuccess, setChangePasswordSuccess] = useState('');
    const [changePasswordError, setChangePasswordError] = useState('');
    
    // 2FA States
    const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
    const [twoFactorMethod, setTwoFactorMethod] = useState(null);
    const [email2FALoading, setEmail2FALoading] = useState(false);
    const [totp2FALoading, setTotp2FALoading] = useState(false);
    const [showTotpSetup, setShowTotpSetup] = useState(false);
    const [totpSecret, setTotpSecret] = useState('');
    const [totpQrCode, setTotpQrCode] = useState('');
    const [totpVerificationCode, setTotpVerificationCode] = useState('');
    const [totpVerificationError, setTotpVerificationError] = useState('');
    const [twoFactorSuccess, setTwoFactorSuccess] = useState('');
    const [twoFactorError, setTwoFactorError] = useState('');

    const isOAuthUser = user?.oauthProvider;

    const fetch2FAStatus = useCallback(async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/twofactor/status', {
                headers: { 
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (res.ok) {
                const data = await res.json();
                setTwoFactorEnabled(data.enabled);
                setTwoFactorMethod(data.method);
            }
        } catch (error) {
            console.error('Failed to fetch 2FA status:', error);
        }
    }, []);

    // Fetch current 2FA status on component mount
    useEffect(() => {
        if (user && !isOAuthUser) {
            fetch2FAStatus();
        }
    }, [user, isOAuthUser, fetch2FAStatus]);

    // Early return after all hooks
    if (!isOpen) return null;

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

    const handleEnableEmail2FA = async () => {
        setEmail2FALoading(true);
        setTwoFactorError('');
        setTwoFactorSuccess('');

        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/twofactor/enable-email-two-factor', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });
            
            const data = await res.json();
            
            if (!res.ok) {
                throw new Error(data.message || 'Failed to enable email 2FA');
            }
            
            setTwoFactorSuccess('Email two-factor authentication has been enabled successfully!');
            setTwoFactorEnabled(true);
            setTwoFactorMethod('email');
        } catch (err) {
            setTwoFactorError(err.message);
        } finally {
            setEmail2FALoading(false);
        }
    };

    const handleDisableEmail2FA = async () => {
        setEmail2FALoading(true);
        setTwoFactorError('');
        setTwoFactorSuccess('');

        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/twofactor/disable-email-two-factor', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });
            
            const data = await res.json();
            
            if (!res.ok) {
                throw new Error(data.message || 'Failed to disable email 2FA');
            }
            
            setTwoFactorSuccess('Email two-factor authentication has been disabled successfully!');
            setTwoFactorEnabled(false);
            setTwoFactorMethod(null);
        } catch (err) {
            setTwoFactorError(err.message);
        } finally {
            setEmail2FALoading(false);
        }
    };

    const generateTOTPSecret = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        let secret = '';
        for (let i = 0; i < 32; i++) {
            secret += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return secret;
    };

    const generateQRCode = (secret, email) => {
        const otpauth = `otpauth://totp/MongoSnap:${encodeURIComponent(email)}?secret=${secret}&issuer=MongoSnap&algorithm=SHA1&digits=6&period=30`;
        return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauth)}`;
    };

    const handleEnableTOTP2FA = () => {
        const secret = generateTOTPSecret();
        setTotpSecret(secret);
        setTotpQrCode(generateQRCode(secret, user.email));
        setShowTotpSetup(true);
        setTotpVerificationError('');
    };

    const handleVerifyTOTP = () => {
        if (!totpVerificationCode || totpVerificationCode.length !== 6) {
            setTotpVerificationError('Please enter a valid 6-digit code');
            return;
        }

        // For demo purposes, we'll simulate verification
        // In a real implementation, you'd verify against the TOTP algorithm
        setTotp2FALoading(true);
        
        setTimeout(() => {
            setTotp2FALoading(false);
            setTwoFactorSuccess('TOTP two-factor authentication has been enabled successfully!');
            setTwoFactorEnabled(true);
            setTwoFactorMethod('totp');
            setShowTotpSetup(false);
            setTotpVerificationCode('');
            setTotpSecret('');
            setTotpQrCode('');
        }, 1000);
    };

    const handleDisableTOTP2FA = () => {
        setTotp2FALoading(true);
        
        setTimeout(() => {
            setTotp2FALoading(false);
            setTwoFactorSuccess('TOTP two-factor authentication has been disabled successfully!');
            setTwoFactorEnabled(false);
            setTwoFactorMethod(null);
        }, 1000);
    };

    const closeTotpSetup = () => {
        setShowTotpSetup(false);
        setTotpVerificationCode('');
        setTotpSecret('');
        setTotpQrCode('');
        setTotpVerificationError('');
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
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

                                    {/* 2FA Status */}
                                    <div className="flex items-center justify-between bg-[#0f1611] rounded-lg p-4 mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-3 h-3 rounded-full ${twoFactorEnabled ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                                            <span className="text-white font-medium">
                                                {twoFactorEnabled ? 'Enabled' : 'Disabled'}
                                            </span>
                                            {twoFactorMethod && (
                                                <span className="text-gray-400 text-sm">({twoFactorMethod.toUpperCase()})</span>
                                            )}
                                        </div>
                                        <span className={`px-3 py-1 rounded text-xs font-medium ${
                                            twoFactorEnabled 
                                                ? 'bg-green-900/50 text-green-300 border border-green-600' 
                                                : 'bg-red-900/50 text-red-300 border border-red-600'
                                        }`}>
                                            {twoFactorEnabled ? 'ACTIVE' : 'INACTIVE'}
                                        </span>
                                    </div>

                                    {/* Success/Error Messages */}
                                    {twoFactorSuccess && (
                                        <div className="flex items-center gap-2 bg-green-900/50 border border-green-500 text-green-200 px-4 py-3 rounded-lg mb-4">
                                            <Check size={16} />
                                            <span className="text-sm">{twoFactorSuccess}</span>
                                        </div>
                                    )}

                                    {twoFactorError && (
                                        <div className="flex items-center gap-2 bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg mb-4">
                                            <AlertCircle size={16} />
                                            <span className="text-sm">{twoFactorError}</span>
                                        </div>
                                    )}

                                    {!twoFactorEnabled ? (
                                        /* 2FA Options when disabled */
                                        <div className="space-y-4">
                                            <p className="text-gray-300 text-sm mb-4">
                                                Choose your preferred two-factor authentication method:
                                            </p>
                                            
                                            {/* Email OTP Option */}
                                            <div className="bg-[#0f1611] rounded-lg p-4 border border-gray-700">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-[#35c56a69] rounded-lg">
                                                            <Mail size={18} className="text-[#11a15e]" />
                                                        </div>
                                                        <div>
                                                            <h5 className="text-white font-medium">Email OTP</h5>
                                                            <p className="text-gray-400 text-sm">Receive codes via email</p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={handleEnableEmail2FA}
                                                        disabled={email2FALoading}
                                                        className={`px-4 py-2 bg-[#35c56a69] text-white rounded-lg font-medium transition-all duration-200 cursor-pointer ${
                                                            email2FALoading 
                                                                ? 'opacity-60 cursor-not-allowed' 
                                                                : 'hover:bg-[#35c56a] hover:scale-105'
                                                        }`}
                                                    >
                                                        {email2FALoading ? (
                                                            <div className="flex items-center gap-2">
                                                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                                                                <span>Enabling...</span>
                                                            </div>
                                                        ) : (
                                                            'Enable'
                                                        )}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* TOTP Option */}
                                            <div className="bg-[#0f1611] rounded-lg p-4 border border-gray-700">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-[#35c56a69] rounded-lg">
                                                            <Clock size={18} className="text-[#11a15e]" />
                                                        </div>
                                                        <div>
                                                            <h5 className="text-white font-medium">Authenticator App</h5>
                                                            <p className="text-gray-400 text-sm">Use Google Authenticator, Authy, etc.</p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={handleEnableTOTP2FA}
                                                        className="px-4 py-2 bg-[#35c56a69] text-white rounded-lg font-medium transition-all duration-200 cursor-pointer hover:bg-[#35c56a] hover:scale-105"
                                                    >
                                                        Enable
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        /* 2FA Management when enabled */
                                        <div className="space-y-4">
                                            <p className="text-gray-300 text-sm mb-4">
                                                {twoFactorMethod === 'email' 
                                                    ? 'Your account is protected with email-based two-factor authentication.' 
                                                    : 'Your account is protected with authenticator app-based two-factor authentication.'
                                                }
                                            </p>
                                            
                                            <button
                                                onClick={twoFactorMethod === 'email' ? handleDisableEmail2FA : handleDisableTOTP2FA}
                                                disabled={email2FALoading || totp2FALoading}
                                                className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 cursor-pointer ${
                                                    email2FALoading || totp2FALoading
                                                        ? 'opacity-60 cursor-not-allowed bg-red-600 text-white'
                                                        : 'bg-red-600 hover:bg-red-700 text-white'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <Smartphone size={16} />
                                                    <span>
                                                        {email2FALoading || totp2FALoading ? 'Disabling...' : 'Disable 2FA'}
                                                    </span>
                                                </div>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* TOTP Setup Modal */}
            {showTotpSetup && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 p-4">
                    <div className="bg-[#17211b] rounded-xl w-full max-w-md shadow-2xl">
                        <div className="flex items-center justify-between p-6 border-b border-gray-700">
                            <h3 className="text-xl font-semibold text-white">Setup Authenticator App</h3>
                            <button
                                onClick={closeTotpSetup}
                                className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-700 rounded-lg cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Step 1: QR Code */}
                            <div className="text-center">
                                <h4 className="text-white font-medium mb-3">Step 1: Scan QR Code</h4>
                                <div className="bg-white p-4 rounded-lg inline-block">
                                    <img src={totpQrCode} alt="QR Code" className="w-48 h-48" />
                                </div>
                                <p className="text-gray-400 text-sm mt-3">
                                    Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
                                </p>
                            </div>

                            {/* Step 2: Manual Entry */}
                            <div>
                                <h4 className="text-white font-medium mb-3">Step 2: Manual Entry (Optional)</h4>
                                <div className="bg-[#0f1611] rounded-lg p-3 border border-gray-700">
                                    <p className="text-gray-400 text-xs mb-2">If you can't scan the QR code, enter this code manually:</p>
                                    <div className="flex items-center gap-2">
                                        <code className="bg-gray-800 px-3 py-2 rounded text-white text-sm font-mono flex-1 break-all">
                                            {totpSecret}
                                        </code>
                                        <button
                                            onClick={() => navigator.clipboard.writeText(totpSecret)}
                                            className="px-3 py-2 bg-[#35c56a69] text-white rounded text-sm hover:bg-[#35c56a] transition-colors cursor-pointer"
                                        >
                                            Copy
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Step 3: Verification */}
                            <div>
                                <h4 className="text-white font-medium mb-3">Step 3: Verify Setup</h4>
                                <p className="text-gray-400 text-sm mb-3">
                                    Enter the 6-digit code from your authenticator app to verify the setup:
                                </p>
                                <input
                                    type="text"
                                    value={totpVerificationCode}
                                    onChange={(e) => setTotpVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    placeholder="000000"
                                    className="w-full px-4 py-3 bg-[#0f1611] border border-gray-700 rounded-lg text-white text-center text-lg font-mono tracking-widest focus:outline-none focus:border-[#11a15e]"
                                    maxLength={6}
                                />
                                {totpVerificationError && (
                                    <p className="text-red-400 text-sm mt-2">{totpVerificationError}</p>
                                )}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-3">
                                <button
                                    onClick={closeTotpSetup}
                                    className="flex-1 px-4 py-3 bg-gray-700 text-white rounded-lg font-medium transition-colors cursor-pointer hover:bg-gray-600"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleVerifyTOTP}
                                    disabled={totp2FALoading || totpVerificationCode.length !== 6}
                                    className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all duration-200 cursor-pointer ${
                                        totp2FALoading || totpVerificationCode.length !== 6
                                            ? 'opacity-60 cursor-not-allowed bg-[#35c56a69] text-white'
                                            : 'bg-[#35c56a69] hover:bg-[#35c56a] text-white hover:scale-105'
                                    }`}
                                >
                                    {totp2FALoading ? (
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                            <span>Verifying...</span>
                                        </div>
                                    ) : (
                                        'Verify & Enable'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Settings; 