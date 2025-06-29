import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import Logo from '../components/Logo';

/** Password strength check utility */
const passwordChecks = [
  { label: 'At least 8 characters', test: (pw) => pw.length >= 8 },
  { label: 'One uppercase letter', test: (pw) => /[A-Z]/.test(pw) },
  { label: 'One lowercase letter', test: (pw) => /[a-z]/.test(pw) },
  { label: 'One number', test: (pw) => /[0-9]/.test(pw) },
  { label: 'One special character', test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

function ResetPassword() {
    const { token } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [form, setForm] = useState({ password: '', confirmPassword: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showPasswordStrength, setShowPasswordStrength] = useState(false);

    // Detect if this is a change password scenario
    const isChangePassword = location.pathname.includes('/change-password/');
    const isLoggedIn = localStorage.getItem('token');

    useEffect(() => {
        document.title = isChangePassword ? "MongoSnap - Change Password" : "MongoSnap - Reset Password";
    }, [isChangePassword]);

    const handleInput = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        if (form.password !== form.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const res = await fetch('/api/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    token: token,
                    password: form.password 
                }),
            });
            const data = await res.json();
            
            if (!res.ok) {
                throw new Error(data.message || `Failed to ${isChangePassword ? 'change' : 'reset'} password`);
            }
            
            if (isChangePassword && isLoggedIn) {
                setSuccess('Password changed successfully! Redirecting to dashboard...');
                setTimeout(() => {
                    navigate('/connect');
                }, 2000);
            } else {
                setSuccess('Password reset successfully! Redirecting to login...');
                setTimeout(() => {
                    navigate('/login');
                }, 2000);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const allPasswordChecksPassed = passwordChecks.every(check => check.test(form.password));
    const passwordsMatch = form.password === form.confirmPassword;

    return (
        <div className="w-full min-h-screen bg-[#101813] flex justify-center items-center">
            <div className="bg-[#17211b] rounded-xl p-8 md:w-[90vw] w-[95vw] max-w-md shadow-lg">
                <div className="text-center mb-8">
                    {/* MongoSnap Logo */}
                    <div className="flex items-center justify-center mb-4">
                        <Logo size="large" />
                        <h1 className="text-5xl font-bold text-white tracking-wide">Mongo<span className="text-[#3CBC6B]">Snap</span></h1>
                    </div>
                    <h1 className="text-4xl font-bold text-white mb-2 mt-4">
                        {isChangePassword ? 'Change Password' : 'Reset Password'}
                    </h1>
                    <p className="text-gray-400">
                        {isChangePassword ? 'Enter your new password below' : 'Enter your new password to reset your account'}
                    </p>
                </div>

                <form onSubmit={handleResetPassword} className="space-y-6">
                    <div>
                        <label htmlFor="password" className="text-white text-sm font-bold block mb-2">
                            New Password
                        </label>
                        <div className="relative">
                            <input 
                                type={showPassword ? 'text' : 'password'}
                                name="password"
                                placeholder="Enter new password"
                                className="w-full h-12 rounded-md border-1 border-[#35c56a69] p-2 pr-10 focus:outline-none focus:border-2 focus:border-green-700 text-md text-white bg-transparent placeholder-gray-500"
                                value={form.password}
                                onChange={handleInput}
                                onFocus={() => setShowPasswordStrength(true)}
                                onBlur={() => setShowPasswordStrength(false)}
                            />
                            <button
                                type="button"
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-200 focus:outline-none cursor-pointer"
                                onClick={() => setShowPassword(prev => !prev)}
                            >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                        
                        {/* Password strength indicators */}
                        {showPasswordStrength && (
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

                    <div>
                        <label htmlFor="confirmPassword" className="text-white text-sm font-bold block mb-2">
                            Confirm New Password
                        </label>
                        <div className="relative">
                            <input 
                                type={showConfirmPassword ? 'text' : 'password'}
                                name="confirmPassword"
                                placeholder="Confirm new password"
                                className="w-full h-12 rounded-md border-1 border-[#35c56a69] p-2 pr-10 focus:outline-none focus:border-2 focus:border-green-700 text-md text-white bg-transparent placeholder-gray-500"
                                value={form.confirmPassword}
                                onChange={handleInput}
                            />
                            <button
                                type="button"
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-200 focus:outline-none cursor-pointer"
                                onClick={() => setShowConfirmPassword(prev => !prev)}
                            >
                                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                        {form.confirmPassword && !passwordsMatch && (
                            <p className="text-red-400 text-xs mt-1">Passwords do not match</p>
                        )}
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 bg-red-900/80 border border-red-500 text-red-200 px-4 py-2 rounded" role="alert">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-red-400">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>{error}</span>
                        </div>
                    )}

                    {success && (
                        <div className="flex items-center gap-2 bg-green-900/80 border border-green-500 text-green-200 px-4 py-2 rounded" role="status">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-green-400">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            <span>{success}</span>
                        </div>
                    )}

                    {loading && (
                        <div className="flex items-center gap-2 text-green-300" role="status">
                            <svg className="animate-spin h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                            </svg>
                            <span>Resetting password...</span>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || !allPasswordChecksPassed || !passwordsMatch || !form.password || !form.confirmPassword}
                        className={`w-full h-12 rounded-md bg-[#35c56a69] text-white text-md font-bold uppercase hover:bg-[#35c56a69] hover:scale-102 transition-all duration-300 cursor-pointer ${
                            loading || !allPasswordChecksPassed || !passwordsMatch || !form.password || !form.confirmPassword 
                                ? 'opacity-60 cursor-not-allowed' 
                                : ''
                        }`}
                    >
                        {loading 
                            ? (isChangePassword ? 'Changing...' : 'Resetting...') 
                            : (isChangePassword ? 'Change Password' : 'Reset Password')
                        }
                    </button>
                </form>

                <div className="text-center mt-6">
                    <a 
                        onClick={() => navigate('/login')} 
                        className="text-[#11a15e] text-sm cursor-pointer hover:underline"
                    >
                        Back to Login
                    </a>
                </div>
            </div>
        </div>
    );
}

export default ResetPassword; 