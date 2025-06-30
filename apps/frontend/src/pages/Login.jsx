import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom';
import '../App.css'
import { Eye, EyeOff, Mail, ArrowLeft, RefreshCw } from 'lucide-react';     
import { useUser } from '../hooks/useUser';
import Logo from '../components/Logo';

/** Password strength check utility */
const passwordChecks = [
  { label: 'At least 8 characters', test: (pw) => pw.length >= 8 },
  { label: 'One uppercase letter', test: (pw) => /[A-Z]/.test(pw) },
  { label: 'One lowercase letter', test: (pw) => /[a-z]/.test(pw) },
  { label: 'One number', test: (pw) => /[0-9]/.test(pw) },
  { label: 'One special character', test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

function Login() {
    const navigate = useNavigate();
    
    const { login, loading: userLoading, isAuthenticated } = useUser();
    
    useEffect(() => {
        document.title = "MongoSnap - Login";
    }, []);

    // Auto-redirect to connect page if user is already authenticated
    useEffect(() => {
        if (!userLoading && isAuthenticated) {
            navigate('/connect');
        }
    }, [userLoading, isAuthenticated, navigate]);
    
    const [showpassword, setShowpassword] = useState(false);
    const [mode, setMode] = useState('login');
    const [showForgot, setShowForgot] = useState(false);
    const [form, setForm] = useState({ name: '', email: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPasswordStrength, setShowPasswordStrength] = useState(false);
    const [success, setSuccess] = useState('');
    const [forgotEmail, setForgotEmail] = useState('');
    const [forgotLoading, setForgotLoading] = useState(false);
    const [forgotError, setForgotError] = useState('');
    const [forgotSuccess, setForgotSuccess] = useState('');
    const [googleLoading, setGoogleLoading] = useState(false);
    const [githubLoading, setGithubLoading] = useState(false);
    const [redirecting, setRedirecting] = useState(false);

    // 2FA States
    const [show2FA, setShow2FA] = useState(false);
    const [twoFactorEmail, setTwoFactorEmail] = useState('');
    const [twoFactorToken, setTwoFactorToken] = useState('');
    const [twoFactorMethod, setTwoFactorMethod] = useState('email'); // 'email' or 'totp'
    const [totpToken, setTotpToken] = useState(''); // For 6-digit TOTP
    const otpRefs = [useRef(), useRef(), useRef(), useRef()];
    const [twoFactorLoading, setTwoFactorLoading] = useState(false);
    const [twoFactorError, setTwoFactorError] = useState('');
    const [resendLoading, setResendLoading] = useState(false);
    const [resendError, setResendError] = useState('');
    const [resendSuccess, setResendSuccess] = useState('');
    const [usingBackupCode, setUsingBackupCode] = useState(false);

    // Popup window reference
    const [popupWindow, setPopupWindow] = useState(null);

    // Listen for messages from popup
    useEffect(() => {
        const handleMessage = (event) => {
            // Only accept messages from our own domain
            if (event.origin !== window.location.origin) return;
            
            if (event.data.type === 'OAUTH_SUCCESS') {
                const { token } = event.data;
                login(token); // Use UserContext login
                setGoogleLoading(false);
                setGithubLoading(false);
                setPopupWindow(null);
                window.location.href = '/connect'; // Redirect to connect
            } else if (event.data.type === 'OAUTH_ERROR') {
                setError(event.data.error || 'OAuth authentication failed');
                setGoogleLoading(false);
                setGithubLoading(false);
                setPopupWindow(null);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [login]);

    // Check if popup is closed and handle timeout
    useEffect(() => {
        if (!popupWindow) return;

        const checkClosed = setInterval(() => {
            if (popupWindow.closed) {
                setPopupWindow(null);
                setGoogleLoading(false);
                setGithubLoading(false);
                clearInterval(checkClosed);
            }
        }, 1000);

        // Timeout after 5 minutes
        const timeout = setTimeout(() => {
            if (popupWindow && !popupWindow.closed) {
                popupWindow.close();
                setError('Authentication timed out. Please try again.');
                setGoogleLoading(false);
                setGithubLoading(false);
                setPopupWindow(null);
            }
        }, 5 * 60 * 1000);

        return () => {
            clearInterval(checkClosed);
            clearTimeout(timeout);
        };
    }, [popupWindow]);

    const handleInput = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');
        const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/signup';
        const payload = mode === 'login'
            ? { email: form.email, password: form.password }
            : { name: form.name, email: form.email, password: form.password };
        try {
            const res = await fetch(`${endpoint}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Something went wrong');
            
            if (mode === 'login') {
                // Check if 2FA is required
                if (data.requires2FA) {
                    setTwoFactorEmail(form.email);
                    setTwoFactorMethod(data.twoFactorMethod || 'email');
                    setShow2FA(true);
                    
                    if (data.twoFactorMethod === 'email') {
                        setSuccess('Please check your email for the verification code.');
                    } else if (data.twoFactorMethod === 'totp') {
                        setSuccess('Please enter the 6-digit code from your authenticator app.');
                    }
                } else {
                    // Use UserContext login function
                    login(data.token, data.user);
                    setSuccess('Login successful! Redirecting...');
                    setRedirecting(true);
                }
            } else {
                setSuccess(data.message);
                setForm({ name: '', email: '', password: '' });
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = async (e) => {
        e.preventDefault();
        setForgotLoading(true);
        setForgotError('');
        setForgotSuccess('');
        
        try {
            const res = await fetch('/api/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: forgotEmail }),
            });
            const data = await res.json();
            
            if (!res.ok) {
                throw new Error(data.message || 'Failed to send reset link');
            }
            
            setForgotSuccess('Password reset link has been sent to your email address. Please check your inbox and follow the instructions to reset your password.');
        } catch (err) {
            setForgotError(err.message);
        } finally {
            setForgotLoading(false);
        }
    };

    const resetForgotModal = () => {
        setShowForgot(false);
        setForgotEmail('');
        setForgotError('');
        setForgotSuccess('');
        setForgotLoading(false);
    };

    const allPasswordChecksPassed = passwordChecks.every(check => check.test(form.password));

    const handleGoogleLogin = () => {
        setGoogleLoading(true);
        setError(''); // Clear any previous errors
        
        const popup = window.open(
            '/api/auth/google', 
            'googleOAuth', 
            'width=500,height=600,scrollbars=yes,resizable=yes,status=yes,location=yes,toolbar=no,menubar=no'
        );
        
        if (!popup) {
            setError('Popup blocked! Please allow popups for this site and try again.');
            setGoogleLoading(false);
            return;
        }
        
        setPopupWindow(popup);
        
        // Focus the popup
        popup.focus();
    };

    const handleGitHubLogin = () => {
        setGithubLoading(true);
        setError(''); // Clear any previous errors
        
        const popup = window.open(
            '/api/auth/github', 
            'githubOAuth', 
            'width=500,height=600,scrollbars=yes,resizable=yes,status=yes,location=yes,toolbar=no,menubar=no'
        );
        
        if (!popup) {
            setError('Popup blocked! Please allow popups for this site and try again.');
            setGithubLoading(false);
            return;
        }
        
        setPopupWindow(popup);
        
        // Focus the popup
        popup.focus();
    };

    const handle2FAVerification = async (e) => {
        e.preventDefault();
        setTwoFactorLoading(true);
        setTwoFactorError('');
        
        try {
            let endpoint, payload;
            
            if (twoFactorMethod === 'email') {
                // For email, we still need to handle the array format
                const otp = Array.isArray(twoFactorToken) ? twoFactorToken.join('').toLowerCase() : twoFactorToken.toLowerCase();
                endpoint = '/api/twofactor/verify-two-factor';
                payload = {
                    email: twoFactorEmail,
                    token: otp
                };
            } else if (twoFactorMethod === 'totp') {
                endpoint = '/api/twofactor/verify-totp-login';
                payload = {
                    email: twoFactorEmail,
                    token: twoFactorToken // This now contains either TOTP code or backup code
                };
            }
            
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            
            const data = await res.json();
            
            if (!res.ok) {
                throw new Error(data.message || 'Verification failed');
            }
            
            // Login successful with 2FA
            login(data.token, data.user);
            setSuccess('Login successful! Redirecting...');
            setRedirecting(true);
        } catch (err) {
            console.error('2FA verification error:', err);
            setTwoFactorError(err.message);
        } finally {
            setTwoFactorLoading(false);
        }
    };

    const handleOTPInput = (e, idx) => {
        let val = e.target.value;
        // Only allow hex chars
        val = val.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
        if (val.length > 1) val = val.slice(-1);
        const newToken = [...twoFactorToken];
        newToken[idx] = val;
        setTwoFactorToken(newToken);
        if (val && idx < 3) {
            otpRefs[idx + 1].current.focus();
        }
    };

    const handleOTPKeyDown = (e, idx) => {
        if (e.key === 'Backspace') {
            if (twoFactorToken[idx]) {
                // Clear current
                const newToken = [...twoFactorToken];
                newToken[idx] = '';
                setTwoFactorToken(newToken);
            } else if (idx > 0) {
                otpRefs[idx - 1].current.focus();
            }
        } else if (e.key === 'ArrowLeft' && idx > 0) {
            otpRefs[idx - 1].current.focus();
        } else if (e.key === 'ArrowRight' && idx < 3) {
            otpRefs[idx + 1].current.focus();
        }
    };

    const handleOTPPaste = (e) => {
        const paste = e.clipboardData.getData('text').replace(/[^0-9a-fA-F]/g, '').toUpperCase();
        if (paste.length === 4) {
            setTwoFactorToken(paste.split(''));
            setTimeout(() => {
                otpRefs[3].current.focus();
            }, 0);
            e.preventDefault();
        }
    };

    const handleResendOTP = async () => {
        setResendLoading(true);
        setResendError('');
        setResendSuccess('');
        
        try {
            const res = await fetch('/api/twofactor/resend-two-factor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: twoFactorEmail }),
            });
            
            const data = await res.json();
            
            if (!res.ok) {
                throw new Error(data.message || 'Failed to resend OTP');
            }
            
            setResendSuccess('New verification code has been sent to your email.');
        } catch (err) {
            setResendError(err.message);
        } finally {
            setResendLoading(false);
        }
    };

    const handleTOTPInput = (e) => {
        let val = e.target.value;
        // Only allow digits
        val = val.replace(/[^0-9]/g, '');
        // Limit to 6 digits
        if (val.length > 6) val = val.slice(0, 6);
        setTotpToken(val);
    };

    const reset2FA = () => {
        setShow2FA(false);
        setTwoFactorEmail('');
        setTwoFactorToken('');
        setTotpToken('');
        setTwoFactorMethod('email');
        setTwoFactorError('');
        setResendError('');
        setResendSuccess('');
        setResendLoading(false);
        setSuccess('');
    };

    // Show loading screen while checking authentication status
    if (userLoading) {
        return (
            <div className='w-full min-h-screen bg-[#101813] flex justify-center items-center'>
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3CBC6B] mx-auto mb-4"></div>
                    <p className="text-white text-lg">Loading...</p>
                </div>
            </div>
        );
    }

    // Show redirecting screen if user is authenticated
    if (isAuthenticated) {
        return (
            <div className='w-full min-h-screen bg-[#101813] flex justify-center items-center'>
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3CBC6B] mx-auto mb-4"></div>
                    <p className="text-white text-lg">Already signed in! Redirecting to connect page...</p>
                </div>
            </div>
        );
    }

    return (
        <div id='main' className='w-full min-h-screen bg-[#101813] flex justify-center items-center'>
            {/* Forgot Password Modal */}
            {showForgot && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                    <div className="bg-[#17211b] rounded-xl p-8 md:w-[90vw] w-[95vw] max-w-md shadow-lg relative flex flex-col items-center">
                        <button 
                            className="absolute top-3 right-3 text-gray-400 hover:text-white text-xl cursor-pointer" 
                            onClick={resetForgotModal}
                        >
                            &times;
                        </button>
                        <h2 className="text-2xl font-bold text-white mb-4">Forgot Password</h2>
                        <p className="text-gray-400 text-sm mb-4 text-center">Enter your email address and we'll send you a link to reset your password.</p>
                        
                        {forgotSuccess ? (
                            <div className="w-full text-center">
                                <div className="flex items-center justify-center mb-4">
                                    <svg className="w-12 h-12 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                    </svg>
                                </div>
                                <p className="text-green-400 mb-4">{forgotSuccess}</p>
                                <button 
                                    onClick={resetForgotModal}
                                    className="w-full h-12 rounded-md bg-[#35c56a69] text-white text-md font-bold uppercase hover:bg-[#35c56a69] hover:scale-102 transition-all duration-300 cursor-pointer"
                                >
                                    Close
                                </button>
                            </div>
                        ) : (
                            <form className="w-full flex flex-col gap-4" onSubmit={handleForgotPassword}>
                                <input 
                                    type="email" 
                                    placeholder="Email Address" 
                                    value={forgotEmail}
                                    onChange={(e) => setForgotEmail(e.target.value)}
                                    className="w-full h-12 rounded-md border-1 border-[#35c56a69] p-2 focus:outline-none focus:border-2 focus:border-green-700 text-md text-white bg-transparent placeholder-gray-500" 
                                />
                                
                                {forgotError && (
                                    <div className="flex items-center gap-2 bg-red-900/80 border border-red-500 text-red-200 px-4 py-2 rounded" role="alert">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-red-400">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span>{forgotError}</span>
                                    </div>
                                )}
                                
                                {forgotLoading && (
                                    <div className="flex items-center gap-2 text-green-300" role="status">
                                        <svg className="animate-spin h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                                        </svg>
                                        <span>Sending reset link...</span>
                                    </div>
                                )}
                                
                                <button 
                                    type="submit" 
                                    disabled={forgotLoading || !forgotEmail}
                                    className={`w-full h-12 rounded-md bg-[#35c56a69] text-white text-md font-bold uppercase hover:bg-[#35c56a69] hover:scale-102 transition-all duration-300 cursor-pointer ${forgotLoading || !forgotEmail ? 'opacity-60 cursor-not-allowed' : ''}`}
                                >
                                    {forgotLoading ? 'Sending...' : 'Send Reset Link'}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* Two-Factor Authentication Modal */}
            {show2FA && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                    <div className="bg-[#17211b] rounded-xl p-8 md:w-[90vw] w-[95vw] max-w-md shadow-lg relative flex flex-col items-center">
                        <button 
                            className="absolute top-3 left-3 text-gray-400 hover:text-white p-2 rounded-lg transition-colors" 
                            onClick={reset2FA}
                        >
                            <ArrowLeft size={20} />
                        </button>
                        
                        <div className="flex items-center justify-center mb-4">
                            <div className="p-3 bg-[#35c56a69] rounded-full">
                                {twoFactorMethod === 'email' ? (
                                    <Mail size={24} className="text-[#11a15e]" />
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#11a15e]">
                                        <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                                        <circle cx="12" cy="5" r="2"/>
                                        <path d="M12 7v4"/>
                                    </svg>
                                )}
                            </div>
                        </div>
                        
                        <div className="flex items-center justify-between p-6 border-b border-gray-700">
                            <h3 className="text-xl font-semibold text-white">
                                {usingBackupCode ? 'Enter Backup Code' : 'Two-Factor Authentication'}
                            </h3>
                        </div>
                        
                        <form className="w-full flex flex-col gap-4" onSubmit={handle2FAVerification}>
                            {twoFactorMethod === 'email' ? (
                                // Email OTP Input
                                <div className="text-center">
                                    <label htmlFor="otp" className="text-white text-sm font-bold mb-2 block">Verification Code</label>
                                    <input
                                        type="text"
                                        value={twoFactorToken}
                                        onChange={(e) => {
                                            // Allow hex chars for email OTP (4 chars max)
                                            setTwoFactorToken(e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 4).toUpperCase());
                                        }}
                                        placeholder="A1B2"
                                        className="w-full px-4 py-3 bg-[#0f1611] border border-gray-700 rounded-lg text-white text-center text-lg font-mono tracking-widest focus:outline-none focus:border-[#11a15e]"
                                        maxLength={4}
                                    />
                                    <p className="text-gray-500 text-xs mt-2">Enter the 4-digit hex code from your email</p>
                                </div>
                            ) : (
                                // TOTP/Backup Code Input
                                <div className="text-center">
                                    <label htmlFor="totp" className="text-white text-sm font-bold mb-2 block">
                                        {usingBackupCode ? 'Backup Code' : 'Authenticator Code'}
                                    </label>
                                    <p className="text-gray-400 text-sm mb-4">
                                        {usingBackupCode 
                                            ? 'Enter one of your 8-character backup codes:' 
                                            : 'Enter the 6-digit code from your authenticator app:'
                                        }
                                    </p>
                                    <input
                                        type="text"
                                        value={twoFactorToken}
                                        onChange={(e) => {
                                            if (usingBackupCode) {
                                                // Allow alphanumeric for backup codes (8 chars max)
                                                setTwoFactorToken(e.target.value.replace(/[^A-Fa-f0-9]/g, '').slice(0, 8).toUpperCase());
                                            } else {
                                                // Allow only digits for TOTP (6 digits max)
                                                setTwoFactorToken(e.target.value.replace(/\D/g, '').slice(0, 6));
                                            }
                                        }}
                                        placeholder={usingBackupCode ? "ABCD1234" : "000000"}
                                        className="w-full px-4 py-3 bg-[#0f1611] border border-gray-700 rounded-lg text-white text-center text-lg font-mono tracking-widest focus:outline-none focus:border-[#11a15e]"
                                        maxLength={usingBackupCode ? 8 : 6}
                                    />
                                </div>
                            )}
                            
                            {twoFactorError && (
                                <div className="flex items-center gap-2 bg-red-900/80 border border-red-500 text-red-200 px-4 py-2 rounded" role="alert">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-red-400">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>{twoFactorError}</span>
                                </div>
                            )}
                            
                            {resendSuccess && (
                                <div className="flex items-center gap-2 bg-green-900/80 border border-green-500 text-green-200 px-4 py-2 rounded" role="status">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-green-400">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span>{resendSuccess}</span>
                                </div>
                            )}
                            
                            {resendError && (
                                <div className="flex items-center gap-2 bg-red-900/80 border border-red-500 text-red-200 px-4 py-2 rounded" role="alert">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-red-400">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>{resendError}</span>
                                </div>
                            )}
                            
                            {twoFactorMethod === 'totp' && (
                                <div className="mt-4">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setUsingBackupCode(!usingBackupCode);
                                            setTwoFactorToken('');
                                            setTwoFactorError('');
                                        }}
                                        className="text-[#35c56a] hover:text-[#4dd47b] text-sm font-medium transition-colors cursor-pointer"
                                    >
                                        {usingBackupCode ? 'Use authenticator app instead' : 'Use backup code instead'}
                                    </button>
                                </div>
                            )}
                            
                            <button
                                onClick={handle2FAVerification}
                                disabled={twoFactorLoading || 
                                    (twoFactorMethod === 'email' && twoFactorToken.length !== 4) ||
                                    (twoFactorMethod === 'totp' && !usingBackupCode && twoFactorToken.length !== 6) || 
                                    (twoFactorMethod === 'totp' && usingBackupCode && twoFactorToken.length !== 8)
                                }
                                className={`w-full px-4 py-3 rounded-lg font-medium transition-all duration-200 cursor-pointer ${
                                    twoFactorLoading || 
                                    (twoFactorMethod === 'email' && twoFactorToken.length !== 4) ||
                                    (twoFactorMethod === 'totp' && !usingBackupCode && twoFactorToken.length !== 6) || 
                                    (twoFactorMethod === 'totp' && usingBackupCode && twoFactorToken.length !== 8)
                                        ? 'opacity-60 cursor-not-allowed bg-[#35c56a69] text-white'
                                        : 'bg-[#35c56a69] hover:bg-[#35c56a] text-white hover:scale-105'
                                }`}
                            >
                                {twoFactorLoading ? (
                                    <div className="flex items-center justify-center gap-2">
                                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                                        </svg>
                                        Verifying...
                                    </div>
                                ) : (
                                    'Verify & Sign In'
                                )}
                            </button>
                        </form>
                        
                        {/* Only show resend for email 2FA */}
                        {twoFactorMethod === 'email' && (
                            <div className="w-full mt-4 pt-4 border-t border-gray-700">
                                <p className="text-gray-400 text-sm text-center mb-3">Didn't receive the code?</p>
                                <button 
                                    onClick={handleResendOTP}
                                    disabled={resendLoading}
                                    className={`w-full h-10 rounded-md border-1 border-[#35c56a69] text-white text-sm font-medium hover:bg-[#35c56a69] transition-all duration-300 cursor-pointer flex items-center justify-center gap-2 ${resendLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
                                >
                                    {resendLoading ? (
                                        <>
                                            <RefreshCw size={16} className="animate-spin" />
                                            Sending...
                                        </>
                                    ) : (
                                        <>
                                            <Mail size={16} />
                                            Resend Code
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
            <div id='container' className='md:w-[85%] w-[95%] mx-auto min-h-full bg-[#121c16] rounded-lg flex md:justify-between md:flex-row flex-col md:gap-0 gap-10 py-10 md:py-5'>
                {/* OAuth Popup Overlay */}
                {(googleLoading || githubLoading) && popupWindow && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                        <div className="bg-[#17211b] rounded-xl p-8 max-w-md w-[90%] shadow-lg text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
                            <h2 className="text-xl font-bold text-white mb-4">OAuth Authentication</h2>
                            <p className="text-gray-400 mb-4">
                                A popup window has opened for authentication. 
                                Please complete the sign-in process in the popup window.
                            </p>
                            <p className="text-sm text-gray-500 mb-4">
                                If you don't see the popup, check your browser's popup blocker settings.
                            </p>
                            <button 
                                onClick={() => {
                                    popupWindow.close();
                                    setGoogleLoading(false);
                                    setGithubLoading(false);
                                    setPopupWindow(null);
                                }}
                                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
                <div id='left' className='md:w-[60%] w-full min-h-full flex flex-col md:pl-10 md:py-5 md:pr-50 px-4 py-3 mb-5 md:mb-0 items-center md:items-start'>
                    <div  className='w-60 h-10 text-[#0da850] rounded-full bg-[#101813] border-1 border-[#35c56a69] flex justify-center items-center '>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-sparkles w-4 h-4 text-primary cz-color-4825622 cz-color-3813676"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/></svg>
                        <h1 className=' text-sm ml-2'>AI Powered Database Assistant</h1>
                    </div>
                   
                   <div className='w-full h-auto pt-8'>
                    <div className='flex items-center mb-4'>
                        <Logo size="xxlarge" />
                        <h1 className='md:text-8xl text-5xl font-bold text-white tracking-wide'>Mongo<span className='text-[#3CBC6B]'>Snap</span></h1>
                    </div>
                    <p className='text-gray-400 md:text-2xl text-sm md:mt-10 mt-5 leading-relaxed'>Transform your database interactions with intelligent natural language processing. Query, analyze, and manage your MongoDB databases like never before.</p>
                    <div id='left-containers' className='w-full h-auto flex gap-5 md:mt-12 mt-8 md:flex-row flex-col'>
                    <div className='w-full h-auto flex flex-col gap-5'>
                    <div id='feature-container-1' className='w-full md:h-32 h-24 bg-[#235337] rounded-xl hover:bg-[#235337e6] hover:scale-102 transition-all duration-300 flex flex-col justify-center px-5'>
                         <h3 className='text-white font-bold text-lg mb-1'>AI-Powered Queries</h3>
                         <p className='text-gray-300 text-sm'>Natural language to MongoDB query translation</p>
                     </div>
                    <div id='feature-container-3' className='w-full md:h-32 h-24 bg-[#235337] rounded-xl hover:bg-[#235337e6] hover:scale-102 transition-all duration-300 flex flex-col justify-center px-5'>
                         <h3 className='text-white font-bold text-lg mb-1'>Secure Access</h3>
                         <p className='text-gray-300 text-sm'>Your data and credentials are protected with high-grade security.</p>
                     </div>
                    </div>
                    <div className='w-full h-auto flex flex-col gap-5'>
                    <div id='feature-container-4' className='w-full md:h-32 h-24 bg-[#235337] rounded-xl hover:bg-[#235337e6] hover:scale-102 transition-all duration-300 flex flex-col justify-center px-5'>
                         <h3 className='text-white font-bold text-lg mb-1'>Preview and Execute Query</h3>
                         <p className='text-gray-300 text-sm'>Review and run your queries directly from here with confidence</p>
                     </div>
                    </div>
                    </div>
                   </div>
                </div>
                {/* <div id='divider-desktop' className='w-[2px] h-150 bg-[#23533784] hidden md:block rounded-full m-auto'></div>
                <div id='divider-mobile' className='w-[90%] h-[2px] bg-[#23533784] md:hidden rounded-full m-auto'></div> */}
                <div id='right' className='md:w-[40%] w-full h-auto flex justify-center items-center md:px-10 md:py-5 px-0 py-3'>
                    <div className='md:w-[95%] w-full h-auto  bg-[#17211b] rounded-3xl  hover:bg-[#17241c]  transition-all duration-300 flex flex-col items-center py-10' >
                        <h1 className='text-4xl font-bold text-white'>{mode === 'login' ? 'Welcome Back' : 'Get Started'}</h1>
                        <p className='text-gray-400 text-lg mt-3'>{mode === 'login' ? 'Sign in to your MongoSnap account' : 'Create an account to get started'}</p>
                        <form className='md:w-[85%] w-[90%] h-auto flex flex-col gap-5 mt-10' onSubmit={handleAuth}>
                            <div className='w-full h-auto flex flex-col gap-5'>
                                {mode === 'signup' && (
                                <div className='w-full h-auto flex flex-col gap-2'>
                                <label htmlFor='name' className='text-white text-sm font-bold'>Name</label>
                                <input type='text' name='name' placeholder='Name' className='w-full placeholder-gray-500 h-12 rounded-md border-1 border-[#35c56a69] p-2 focus:outline-none focus:border-2 focus:border-green-700 text-md text-white font-semibold' id='name' value={form.name} onChange={handleInput} />
                                </div>
                                )}
                                <div className='w-full h-auto flex flex-col gap-2'>
                                <label htmlFor='email' className='text-white text-sm font-bold'>Email Address</label>
                                <input type='email' name='email' placeholder='Email Address' className='w-full placeholder-gray-500 h-12 rounded-md border-1 border-[#35c56a69] p-2 focus:outline-none focus:border-2 focus:border-green-700 text-md text-white font-semibold' id='email' value={form.email} onChange={handleInput} />
                                </div>
                                <div className='w-full h-auto flex flex-col gap-2'>
                                <label htmlFor='password' className='text-white text-sm font-bold'>Password</label>
                                <div className='relative h-12 w-full'>
                                    <input 
                                        type={showpassword ? 'text' : 'password'}
                                        name='password'
                                        placeholder='Password'
                                        className='w-full h-12 placeholder-gray-500 rounded-md border-1 border-[#35c56a69] p-2 pr-10 focus:outline-none focus:border-2 focus:border-green-700 text-md text-white font-semibold}' 
                                        id='password' 
                                        value={form.password}
                                        onChange={handleInput}
                                        onFocus={() => setShowPasswordStrength(true)}
                                         onBlur={() => setShowPasswordStrength(false)}
                                    />
                                    <button
                                        type='button'
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-200 focus:outline-none cursor-pointer"
                                        onClick={() => setShowpassword((prev) => !prev)}
                                        tabIndex={-1}
                                    >
                                        {showpassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                                {/* Password strength indicators */}
                                {mode === 'signup' && showPasswordStrength && (
                                    <ul className="mt-2 space-y-1 text-xs">
                                        {passwordChecks.map((check, idx) => {
                                            const passed = check.test(form.password);
                                            return (
                                                <li key={idx} className={passed ? 'text-green-400 flex items-center gap-1' : 'text-red-400 flex items-center gap-1'}>
                                                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" className="inline-block">
                                                        {passed ? (
                                                            <path d="M5 10l4 4 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                        ) : (
                                                            <circle cx="10" cy="10" r="6" stroke="currentColor" strokeWidth="2" fill="none" />
                                                        )}
                                                    </svg>
                                                    {check.label}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                                </div>
                                {mode === 'login' && (
                                <button type="button" onClick={() => setShowForgot(true)} className='w-auto h-5 text-[#11a15e] text-sm cursor-pointer self-end hover:underline'>Forgot Password?</button>
                                )}
                                {error && (
                                    <div className="flex items-center gap-2 bg-red-900/80 border border-red-500 text-red-200 px-4 py-2 rounded mb-2 animate-shake" role="alert">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-red-400"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        <span>{error}</span>
                                    </div>
                                )}
                                {success && (
                                    <div className="flex items-center gap-2 bg-green-900/80 border border-green-500 text-green-200 px-4 py-2 rounded mb-2" role="status">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-green-400"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                        <span>{success}</span>
                                     
                                    </div>
                                )}
                                {loading && (
                                    <div className="flex items-center gap-2 text-green-300 mb-2" role="status">
                                        <svg className="animate-spin h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>
                                        <span>{redirecting ? 'Redirecting...' : 'Loading...'}</span>
                                    </div>
                                )}
                                <button
                                    disabled={loading || redirecting || (mode === 'signup' && !allPasswordChecksPassed)}
                                    className={`w-full h-12 rounded-md bg-[#35c56a69] text-white text-md font-bold uppercase hover:bg-[#35c56a69] hover:scale-102 transition-all duration-300 cursor-pointer ${loading || redirecting || (mode === 'signup' && !allPasswordChecksPassed) ? 'opacity-60 cursor-not-allowed' : ''}`}
                                >
                                    {redirecting ? 'Redirecting...' : (mode === 'login' ? 'Sign in' : 'Sign up')}
                                </button>
                            </div>
                        </form>
                        <p className='uppercase text-gray-400 text-[12px] md:text-sm mt-5'>or</p>
                        <div className='md:w-[85%] w-[90%] h-auto flex gap-5 mt-5 flex-col'>
                            <button 
                                onClick={handleGoogleLogin} 
                                disabled={googleLoading}
                                className={`w-full h-12 rounded-md border-1 border-[#35c56a69] text-white text-md font-semibold hover:bg-[#35c56a69] hover:scale-102 transition-all duration-300 cursor-pointer flex items-center justify-center gap-3 ${googleLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
                            >
                                {googleLoading ? (
                                    <>
                                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                                        </svg>
                                        Connecting...
                                    </>
                                ) : (
                                    <>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 48 48"><path fill="white" d="M43.611 20.083H42V20H24v8h11.303c-1.627 4.657-6.084 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c2.438 0 4.7.749 6.573 2.027l6.571-6.571C34.047 5.053 29.268 3 24 3C12.954 3 4 11.954 4 23s8.954 20 20 20c11.045 0 19.799-7.969 19.799-19.014c0-1.276-.138-2.254-.314-3.217z"/></svg>
                                        Continue with Google
                                    </>
                                )}
                            </button>
                            <button 
                                onClick={handleGitHubLogin} 
                                disabled={githubLoading}
                                className={`w-full h-12 rounded-md border-1 border-[#35c56a69] text-white text-md font-semibold hover:bg-[#35c56a69] hover:scale-102 transition-all duration-300 cursor-pointer flex items-center justify-center gap-3 ${githubLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
                            >
                                {githubLoading ? (
                                    <>
                                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                                        </svg>
                                        Connecting...
                                    </>
                                ) : (
                                    <>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489c.5.092.682-.217.682-.483c0-.237-.009-.868-.014-1.703c-2.782.604-3.369-1.342-3.369-1.342c-.454-1.154-1.11-1.461-1.11-1.461c-.908-.62.069-.608.069-.608c1.004.07 1.532 1.032 1.532 1.032c.892 1.528 2.341 1.087 2.91.832c.092-.647.35-1.087.636-1.338c-2.221-.253-4.555-1.112-4.555-4.951c0-1.093.39-1.988 1.029-2.688c-.103-.253-.446-1.272.098-2.65c0 0 .84-.27 2.75 1.025A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337c1.909-1.295 2.748-1.025 2.748-1.025c.546 1.378.202 2.397.1 2.65c.64.7 1.028 1.595 1.028 2.688c0 3.848-2.337 4.695-4.566 4.944c.359.309.678.919.678 1.852c0 1.336-.012 2.417-.012 2.747c0 .268.18.579.688.481A10.013 10.013 0 0 0 22 12c0-5.523-4.477-10-10-10"/></svg>
                                        Continue with GitHub
                                    </>
                                )}
                            </button>
                        </div>
                        <a onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} className='text-[#11a15e] text-md mt-5 cursor-pointer focus:outline-none md:hover:underline'>{mode === 'login' ? "Don't have an account?" : 'Already have an account?'} <span className='underline'>{mode === 'login' ? 'Sign up' : 'Sign in'}</span></a>
                        <p className='text-gray-400 text-sm my-4 mx-2 text-center'>By signing in, you agree to our <a className='text-[#11a15e] text-sm mt-5 cursor-pointer focus:outline-none hover:underline'>Terms of Service</a> and <a className='text-[#11a15e] text-sm mt-5 cursor-pointer focus:outline-none hover:underline'>Privacy Policy</a></p>
                    </div>
                </div>
            </div>
         </div>
    )
}
export default Login