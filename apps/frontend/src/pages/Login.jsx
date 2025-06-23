import React, { useEffect, useState } from 'react'
import '../App.css'
import { Eye, EyeOff } from 'lucide-react';     

/** Password strength check utility */
const passwordChecks = [
  { label: 'At least 8 characters', test: (pw) => pw.length >= 8 },
  { label: 'One uppercase letter', test: (pw) => /[A-Z]/.test(pw) },
  { label: 'One lowercase letter', test: (pw) => /[a-z]/.test(pw) },
  { label: 'One number', test: (pw) => /[0-9]/.test(pw) },
  { label: 'One special character', test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

function Login() {
    useEffect(() => {
        document.title = "MongoPilot - Login";
    }, []);
    const [showpassword, setShowpassword] = useState(false);
    const [mode, setMode] = useState('login');
    const [showForgot, setShowForgot] = useState(false);
    const [form, setForm] = useState({ name: '', email: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPasswordStrength, setShowPasswordStrength] = useState(false);
    const [success, setSuccess] = useState('');

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
            const res = await fetch(`http://192.168.1.10:4000${endpoint}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Something went wrong');
            setSuccess(data.message);
            localStorage.setItem('token', data.token);
            // Optionally: save user info, redirect, etc.
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const allPasswordChecksPassed = passwordChecks.every(check => check.test(form.password));

    return (
        <div id='main' className='w-full min-h-screen bg-[#101813] flex justify-center items-center'>
            {/* Forgot Password Modal */}
            {showForgot && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                    <div className="bg-[#17211b] rounded-xl p-8 md:w-[90vw] w-[95vw] max-w-md shadow-lg relative flex flex-col items-center">
                        <button className="absolute top-3 right-3 text-gray-400 hover:text-white text-xl cursor-pointer" onClick={() => setShowForgot(false)}>&times;</button>
                        <h2 className="text-2xl font-bold text-white mb-4">Forgot Password</h2>
                        <p className="text-gray-400 text-sm mb-4 text-center">Enter your email address and we'll send you a link to reset your password.</p>
                        <form className="w-full flex flex-col gap-4">
                            <input type="email" placeholder="Email Address" className="w-full h-12 rounded-md border-1 border-[#35c56a69] p-2 focus:outline-none focus:border-2 focus:border-green-700 text-md text-white bg-transparent placeholder-gray-500" />
                            <button type="submit" className="w-full h-12 rounded-md bg-[#35c56a69] text-white text-md font-bold uppercase hover:bg-[#35c56a69] hover:scale-102 transition-all duration-300 cursor-pointer">Send Reset Link</button>
                        </form>
                    </div>
                </div>
            )}
            <div id='container' className='md:w-[85%] w-[95%] mx-auto min-h-full bg-[#121c16] rounded-lg flex md:justify-between md:flex-row flex-col md:gap-0 gap-10 py-10 md:py-5'>
                <div id='left' className='md:w-[60%] w-full min-h-full flex flex-col md:pl-10 md:py-5 md:pr-50 px-4 py-3 mb-5 md:mb-0 items-center md:items-start'>
                    <div  className='w-60 h-10 text-[#0da850] rounded-full bg-[#101813] border-1 border-[#35c56a69] flex justify-center items-center '>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-sparkles w-4 h-4 text-primary cz-color-4825622 cz-color-3813676"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/></svg>
                        <h1 className=' text-sm ml-2'>AI Powered Database Assistant</h1>
                    </div>
                   
                   <div className='w-full h-auto pt-8'>
                    <h1 className='md:text-8xl text-5xl font-bold text-white tracking-wide'>Mongo<span className='text-[#3CBC6B]'>Pilot</span></h1>
                    <p className='text-gray-400 md:text-2xl text-sm md:mt-10 mt-5 leading-relaxed'>Transform your database interactions with intelligent natural language processing. Query, analyze, and manage your MongoDB databases like never before.</p>
                    <div id='left-containers' className='w-full h-auto flex gap-5 md:mt-12 mt-8 md:flex-row flex-col'>
                    <div className='w-full h-auto flex flex-col gap-5'>
                    <div id='feature-container-1' className='w-full md:h-32 h-24 bg-[#235337] rounded-xl hover:bg-[#235337e6] hover:scale-102 transition-all duration-300 flex flex-col justify-center px-5'>
                         <h3 className='text-white font-bold text-lg mb-1'>AI-Powered Queries</h3>
                         <p className='text-gray-300 text-sm'>Natural language to MongoDB query translation</p>
                     </div>
                    <div id='feature-container-2' className='w-full md:h-32 h-24 bg-[#235337] rounded-xl hover:bg-[#235337e6] hover:scale-102 transition-all duration-300 flex flex-col justify-center px-5'>
                         <h3 className='text-white font-bold text-lg mb-1'>Safe-by-Design with Undo</h3>
                         <p className='text-gray-300 text-sm'>Make changes fearlessly. Undo anytime.</p>
                     </div>
                    </div>
                    <div className='w-full h-auto flex flex-col gap-5'>
                    <div id='feature-container-3' className='w-full md:h-32 h-24 bg-[#235337] rounded-xl hover:bg-[#235337e6] hover:scale-102 transition-all duration-300 flex flex-col justify-center px-5'>
                         <h3 className='text-white font-bold text-lg mb-1'>Secure Access</h3>
                         <p className='text-gray-300 text-sm'>Your data and credentials are protected with high-grade security.</p>
                     </div>
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
                        <p className='text-gray-400 text-lg mt-3'>{mode === 'login' ? 'Sign in to your MongoPilot account' : 'Create an account to get started'}</p>
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
                                        <span>Loading...</span>
                                    </div>
                                )}
                                <button
                                    disabled={loading || (mode === 'signup' && !allPasswordChecksPassed)}
                                    className={`w-full h-12 rounded-md bg-[#35c56a69] text-white text-md font-bold uppercase hover:bg-[#35c56a69] hover:scale-102 transition-all duration-300 cursor-pointer ${loading || (mode === 'signup' && !allPasswordChecksPassed) ? 'opacity-60 cursor-not-allowed' : ''}`}
                                >
                                    {mode === 'login' ? 'Sign in' : 'Sign up'}
                                </button>
                            </div>
                        </form>
                        <p className='uppercase text-gray-400 text-[12px] md:text-sm mt-5'>or</p>
                        <div className='md:w-[85%] w-[90%] h-auto flex gap-5 mt-5 flex-col'>
                            <button className='w-full h-12 rounded-md border-1 border-[#35c56a69] text-white text-md font-semibold  hover:bg-[#35c56a69] hover:scale-102 transition-all duration-300 cursor-pointer flex items-center justify-center gap-3'>
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 48 48"><path fill="white" d="M43.611 20.083H42V20H24v8h11.303c-1.627 4.657-6.084 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c2.438 0 4.7.749 6.573 2.027l6.571-6.571C34.047 5.053 29.268 3 24 3C12.954 3 4 11.954 4 23s8.954 20 20 20c11.045 0 19.799-7.969 19.799-19.014c0-1.276-.138-2.254-.314-3.217z"/></svg>
                               Continue with Google
                            </button>
                            <button className='w-full h-12 rounded-md border-1 border-[#35c56a69] text-white text-md font-semibold hover:bg-[#35c56a69] hover:scale-102 transition-all duration-300 cursor-pointer flex items-center justify-center gap-3'>
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489c.5.092.682-.217.682-.483c0-.237-.009-.868-.014-1.703c-2.782.604-3.369-1.342-3.369-1.342c-.454-1.154-1.11-1.461-1.11-1.461c-.908-.62.069-.608.069-.608c1.004.07 1.532 1.032 1.532 1.032c.892 1.528 2.341 1.087 2.91.832c.092-.647.35-1.087.636-1.338c-2.221-.253-4.555-1.112-4.555-4.951c0-1.093.39-1.988 1.029-2.688c-.103-.253-.446-1.272.098-2.65c0 0 .84-.27 2.75 1.025A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337c1.909-1.295 2.748-1.025 2.748-1.025c.546 1.378.202 2.397.1 2.65c.64.7 1.028 1.595 1.028 2.688c0 3.848-2.337 4.695-4.566 4.944c.359.309.678.919.678 1.852c0 1.336-.012 2.417-.012 2.747c0 .268.18.579.688.481A10.013 10.013 0 0 0 22 12c0-5.523-4.477-10-10-10"/></svg>
                                Continue with Github
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