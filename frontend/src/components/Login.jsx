import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { Eye, EyeOff, User, Lock, Loader2, ArrowLeft, KeyRound, Circle, CheckCircle } from 'lucide-react';

// ── BRANDING IMAGE PANEL IMPORT ──────────────────────────────────────────────
import mibotImage from '../assets/mibot_mobilityx.png';

export default function Login() {
    const navigate = useNavigate();
    const { login } = useAuth();

    // Active View Controllers: 'login' | 'forgot' | 'otp' | 'reset'
    const [viewMode, setViewMode] = useState('login');

    // Form inputs state
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // Recovery flow unique state
    const [otpCode, setOtpCode] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');

    // Status metrics
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // ── MAIN CORE LOGIN HANDLER ──────────────────────────────────────────────
    const handleLoginSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!email || !password) { setError('Please enter both email and password'); return; }

        setIsLoading(true);
        try {
            const success = await login(email, password);
            if (success) {
                const saved = JSON.parse(localStorage.getItem('user') || '{}');
                const role = saved?.role;

                // Handles baseline app view redirections
                if (role === 'client') {
                    if (typeof navigate === 'function') navigate('/safety');
                } else if (role === 'admin' || role === 'superadmin') {
                    if (typeof navigate === 'function') navigate('/admin-dashboard');
                }
            }
        } catch (err) {
            setError(err.message || 'Connection to server failed.');
        } finally {
            setIsLoading(false);
        }
    };

    // ── RECOVERY ACTION FLOWS ──────────────────────────────────────────────────

    // Step 1: Request OTP Generation with absolute corporate domain blocking safeguards
    const handleForgotPasswordSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');
        
        const cleanEmail = String(email).trim().toLowerCase();
        if (!cleanEmail) { setError('Please provide your account email address'); return; }

        // ── STRICTION UI GUARD: IMMEDIATELY DROP ADMINISTRATIVE RESET REQUESTS ──
        if (cleanEmail.includes('oiltech.in') || cleanEmail.includes('technomech.com')) {
            setError('ACCESS DENIED: Administrative password recovery operations must be performed via the Central Admin Portal.');
            return;
        }

        setIsLoading(true);
        try {
            await api.post('/auth/forgot-password', { email: cleanEmail });
            setSuccessMessage('A 6-digit security OTP code was routed to your email address.');
            setViewMode('otp'); 
        } catch (err) {
            // Front-end restriction intercept gate processing
            const backendErrorMsg = err.response?.data?.detail || 'Failed to dispatch verification email.';
            setError(backendErrorMsg);
        } finally {
            setIsLoading(false);
        }
    };

    // Step 2: Verification of the OTP code
    const handleVerifyOtpSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');
        if (!otpCode) { setError('Please provide the 6-digit confirmation key.'); return; }

        setIsLoading(true);
        try {
            await api.post('/auth/verify-otp', { email, otp: otpCode });
            setSuccessMessage('OTP Identity confirmation verified successfully.');
            setViewMode('reset'); 
        } catch (err) {
            setError(err.response?.data?.detail || 'Invalid or expired OTP signature key.');
        } finally {
            setIsLoading(false);
        }
    };

    // Step 3: Password Complexity Rule Checks
    const checkRules = {
        length: newPassword.length >= 8, 
        upper: /[A-Z]/.test(newPassword), 
        lower: /[a-z]/.test(newPassword), 
        number: /\d/.test(newPassword), 
        special: /[@$!%*?&]/.test(newPassword) 
    };

    // Step 4: Complete Reset Password operation
    const handleResetPasswordSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');

        if (!newPassword || !confirmNewPassword) { setError('All authorization entries required.'); return; }
        if (newPassword !== confirmNewPassword) { setError('Password verification fields do not match.'); return; }

        // Strict system validation matching the complexity profile
        if (!Object.values(checkRules).every(Boolean)) {
            setError('Password does not satisfy all mandatory cryptographic rules.');
            return;
        }

        setIsLoading(true);
        try {
            await api.post('/auth/reset-password', {
                email,
                otp: otpCode,
                new_password: newPassword
            });
            alert('Your password has been successfully updated! Returning to the login screen.');

            // Clean state parameters and redirect to baseline view
            setViewMode('login'); 
            setPassword(''); 
            setNewPassword(''); 
            setConfirmNewPassword(''); 
            setOtpCode(''); 
        } catch (err) {
            setError(err.response?.data?.detail || 'Credentials synchronization rejected.');
        } finally {
            setIsLoading(false);
        }
    };

    // UI Helper Reset
    const changeView = (targetView) => {
        setError('');
        setSuccessMessage('');
        setViewMode(targetView);
    };

    return (
        <div className="h-screen w-full flex overflow-hidden bg-white font-sans select-none">
            {/* Left — Branding Gradient Banner Panel with Integrated mibot_mobilityx Image */}
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-b from-[#1a73e8] via-[#00c6ff] to-[#0072ff] p-12 flex-col justify-between relative">
                <div className="z-10">
                    <div className="w-32 h-12 flex items-center justify-center border-2 border-dashed border-white/20 rounded-lg text-white font-bold tracking-widest text-sm">
                        MiBOT
                    </div>
                    <div className="mt-5">
                        <h1 className="text-white text-3xl font-medium leading-snug max-w-md">
                            "Real-Time Site Command: Integrated Surveillance and Predictive Safety Management System."
                        </h1>
                    </div>
                </div>
                
                <div className="flex-1 flex items-center justify-center z-10">
                    <div className="w-full max-w-lg p-1 bg-white/10 rounded-[40px] shadow-2xl backdrop-blur-sm border border-white/20">
                        <img
                            src={mibotImage}
                            alt="MiBOT MobilityX Unit"
                            className="rounded-[38px] w-full aspect-square object-cover"
                        />
                    </div>
                </div>
            </div>

            {/* Right — Dynamic Interactive Core Panel */}
            <div className="w-full lg:w-1/2 h-full flex items-center justify-center p-6 sm:p-12 overflow-y-auto">
                <div className="w-full max-w-[460px] flex flex-col justify-between h-full max-h-[750px]">
                    <div className="my-auto w-full">

                        {/* View State: Default Login View */}
                        {viewMode === 'login' && (
                            <>
                                <div className="mb-10 text-left">
                                    <h2 className="text-[#1a365d] text-3xl font-extrabold mb-4 tracking-tight leading-tight">
                                        Robot Management Solution
                                    </h2>
                                    <p className="text-slate-500 text-base leading-relaxed">
                                        Intelligent for Advanced Safety Measurement and Continuous Surveillance.
                                    </p>
                                </div>

                                <form onSubmit={handleLoginSubmit} className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-slate-700 font-bold text-sm">Email address</label>
                                        <div className="relative group">
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center justify-center w-9 h-8 rounded-full bg-slate-100 group-focus-within:bg-[#e0f7fa] transition-all">
                                                <User size={18} className="text-slate-500 group-focus-within:text-[#00acc1]" />
                                            </div>
                                            <input
                                                type="email"
                                                placeholder="Enter your email"
                                                autoComplete="email"
                                                value={email}
                                                onChange={e => setEmail(e.target.value)}
                                                className="w-full pl-14 pr-4 py-4.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none transition-all focus:border-[#00acc1] focus:ring-1 focus:ring-[#00acc1] text-sm font-semibold text-slate-800 shadow-inner"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center px-0.5">
                                            <label className="text-slate-700 font-bold text-sm">Password</label>
                                            <button
                                                type="button"
                                                onClick={() => changeView('forgot')}
                                                className="text-xs font-bold text-[#00a8cc] hover:text-[#4b0082] transition-colors"
                                            >
                                                Forgot Password?
                                            </button>
                                        </div>
                                        <div className="relative group">
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#00acc1] transition-all">
                                                <Lock size={18} />
                                            </div>
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                placeholder="••••••••"
                                                autoComplete="current-password"
                                                value={password}
                                                onChange={e => setPassword(e.target.value)}
                                                className="w-full pl-14 pr-12 py-4.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none transition-all focus:border-[#00acc1] focus:ring-1 focus:ring-[#00acc1] text-sm font-semibold text-slate-800 shadow-inner"
                                                required
                                            />
                                            <button type="button" onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#00acc1]">
                                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>
                                    </div>

                                    {error && <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-100 font-medium">{error}</div>}

                                    <button type="submit" disabled={isLoading}
                                        className="w-full h-15 bg-gradient-to-r from-[#4b0082] to-[#00a8cc] text-white font-extrabold rounded-2xl shadow-lg hover:shadow-xl active:scale-[0.98] transition-all text-base uppercase tracking-wider flex items-center justify-center disabled:opacity-70">
                                        {isLoading ? <Loader2 className="animate-spin mr-2" /> : 'Log In'}
                                    </button>
                                </form>
                            </>
                        )}

                        {/* View State: Requesting Password Reset (Forgot Password View) */}
                        {viewMode === 'forgot' && (
                            <>
                                <div className="mb-8">
                                    <button onClick={() => changeView('login')} className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-black mb-4 transition-colors">
                                        <ArrowLeft size={14} /> Back to Login
                                    </button>
                                    <h2 className="text-[#1a365d] text-3xl font-black uppercase tracking-tight mb-2">Account Recovery</h2>
                                    <p className="text-slate-500 text-sm leading-relaxed">Please provide your system email address. We will verify your profile and dispatch a secure security OTP.</p>
                                </div>

                                <form onSubmit={handleForgotPasswordSubmit} className="space-y-5">
                                    <div className="space-y-2">
                                        <label className="text-slate-700 font-bold text-sm">Account Email Address</label>
                                        <div className="relative group">
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#00acc1]">
                                                <User size={16} />
                                            </div>
                                            <input
                                                type="email"
                                                placeholder="your-account@domain.com"
                                                value={email}
                                                onChange={e => setEmail(e.target.value)}
                                                className="w-full pl-14 pr-4 py-4.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-[#00acc1] text-sm font-semibold text-slate-800"
                                                required
                                            />
                                        </div>
                                    </div>

                                    {error && <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-100 font-medium">{error}</div>}

                                    <button type="submit" disabled={isLoading} className="w-full h-15 bg-[#4b0082] hover:bg-black text-white font-extrabold rounded-2xl shadow-lg flex items-center justify-center text-base uppercase tracking-wider transition-colors disabled:bg-slate-200">
                                        {isLoading ? <Loader2 className="animate-spin mr-2" /> : 'Send Verification OTP'}
                                    </button>
                                </form>
                            </>
                        )}

                        {/* View State: Entering the 6-Digit OTP */}
                        {viewMode === 'otp' && (
                            <>
                                <div className="mb-8">
                                    <button onClick={() => changeView('forgot')} className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-black mb-4 transition-colors">
                                        <ArrowLeft size={14} /> Change Email
                                    </button>
                                    <h2 className="text-[#1a365d] text-3xl font-black uppercase tracking-tight mb-2">Security Verification</h2>
                                    <p className="text-slate-500 text-sm leading-relaxed">Please insert the authentication token code forwarded to <strong className="text-slate-800">{email}</strong>.</p>
                                </div>

                                <form onSubmit={handleVerifyOtpSubmit} className="space-y-5">
                                    <div className="space-y-2">
                                        <label className="text-slate-700 font-bold text-sm">6-Digit Identity Code</label>
                                        <div className="relative group">
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#00acc1]">
                                                <KeyRound size={16} />
                                            </div>
                                            <input
                                                type="text"
                                                maxLength={6}
                                                placeholder="123456"
                                                value={otpCode}
                                                onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                                                className="w-full pl-14 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl tracking-[0.5em] text-center font-black text-xl outline-none focus:border-[#00acc1] transition-all"
                                                required
                                            />
                                        </div>
                                    </div>

                                    {successMessage && <div className="bg-emerald-50 text-emerald-600 p-4 rounded-xl text-xs border border-emerald-100 font-bold uppercase tracking-wide">{successMessage}</div>}
                                    {error && <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-100 font-medium">{error}</div>}

                                    <button type="submit" disabled={isLoading} className="w-full h-15 bg-gradient-to-r from-[#4b0082] to-[#00a8cc] text-white font-extrabold rounded-2xl shadow-lg flex items-center justify-center text-base uppercase tracking-wider transition-all disabled:bg-slate-200">
                                        {isLoading ? <Loader2 className="animate-spin mr-2" /> : 'Confirm Code Credentials'}
                                    </button>
                                </form>
                            </>
                        )}

                        {/* View State: Resetting Password with Real-time Validation Checks */}
                        {viewMode === 'reset' && (
                            <>
                                <div className="mb-6">
                                    <h2 className="text-[#1a365d] text-3xl font-black uppercase tracking-tight mb-2">Create New Password</h2>
                                    <p className="text-slate-500 text-sm">Establish a new credential signature configuration for your security profile account user template.</p>
                                </div>

                                <div className="grid grid-cols-2 gap-x-4 gap-y-2 px-2 py-1 mb-6 select-none bg-slate-50 p-4 rounded-2xl border border-slate-100 font-mono">
                                    <div className={`flex items-center gap-2 text-xs font-bold tracking-wide uppercase transition-colors duration-200 ${checkRules.length ? 'text-indigo-600' : 'text-slate-400'}`}>
                                        {checkRules.length ? <CheckCircle size={14} className="fill-indigo-50" /> : <Circle size={14} className="text-slate-200" />}
                                        8+ Characters
                                    </div>
                                    <div className={`flex items-center gap-2 text-xs font-bold tracking-wide uppercase transition-colors duration-200 ${checkRules.upper ? 'text-indigo-600' : 'text-slate-400'}`}>
                                        {checkRules.upper ? <CheckCircle size={14} className="fill-indigo-50" /> : <Circle size={14} className="text-slate-200" />}
                                        Upper Case
                                    </div>
                                    <div className={`flex items-center gap-2 text-xs font-bold tracking-wide uppercase transition-colors duration-200 ${checkRules.lower ? 'text-indigo-600' : 'text-slate-400'}`}>
                                        {checkRules.lower ? <CheckCircle size={14} className="fill-indigo-50" /> : <Circle size={14} className="text-slate-200" />}
                                        Lower Case
                                    </div>
                                    <div className={`flex items-center gap-2 text-xs font-bold tracking-wide uppercase transition-colors duration-200 ${checkRules.number ? 'text-indigo-600' : 'text-slate-400'}`}>
                                        {checkRules.number ? <CheckCircle size={14} className="fill-indigo-50" /> : <Circle size={14} className="text-slate-200" />}
                                        One Number
                                    </div>
                                    <div className={`col-span-2 flex items-center gap-2 text-xs font-bold tracking-wide uppercase transition-colors duration-200 ${checkRules.special ? 'text-indigo-600' : 'text-slate-400'}`}>
                                        {checkRules.special ? <CheckCircle size={14} className="fill-indigo-50" /> : <Circle size={14} className="text-slate-200" />}
                                        Special Symbol
                                    </div>
                                </div>

                                <form onSubmit={handleResetPasswordSubmit} className="space-y-5">
                                    <div className="space-y-2">
                                        <label className="text-slate-700 font-bold text-sm">New Password</label>
                                        <div className="relative group">
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                                <Lock size={16} />
                                            </div>
                                            <input
                                                type="password"
                                                placeholder="••••••••"
                                                value={newPassword}
                                                onChange={e => setNewPassword(e.target.value)}
                                                className="w-full pl-14 pr-4 py-4.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-[#00acc1] text-sm font-semibold text-slate-800"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-slate-700 font-bold text-sm">Confirm New Password</label>
                                        <div className="relative group">
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                                <Lock size={16} />
                                            </div>
                                            <input
                                                type="password"
                                                placeholder="••••••••"
                                                value={confirmNewPassword}
                                                onChange={e => setConfirmNewPassword(e.target.value)}
                                                className="w-full pl-14 pr-4 py-4.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-[#00acc1] text-sm font-semibold text-slate-800"
                                                required
                                            />
                                        </div>
                                    </div>

                                    {error && <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-100 font-medium">{error}</div>}

                                    <button type="submit" disabled={isLoading} className="w-full h-15 bg-gradient-to-r from-[#00acc1] to-[#4b0082] text-white font-extrabold rounded-2xl shadow-lg flex items-center justify-center text-base uppercase tracking-wider transition-all disabled:bg-slate-200">
                                        {isLoading ? <Loader2 className="animate-spin mr-2" /> : 'Apply Security Reset'}
                                    </button>
                                </form>
                            </>
                        )}

                    </div>

                    {/* ── FOOTER BRANDING SUB-PANEL ────────────────────────────────── */}
                    <div className="mt-8 pt-4 border-t border-slate-100 text-center text-xs text-slate-400">
                        <p className="font-medium">
                            Powered by <span className="text-slate-600 font-bold">MiBOT Ventures India Pvt Ltd</span>
                        </p>
                        <p className="mt-1">
                            Need assistance? Contact{' '}
                            <a 
                                href="mailto:info@mi-bot.com" 
                                className="text-[#00acc1] font-semibold hover:underline"
                            >
                                info@mi-bot.com
                            </a>
                        </p>
                    </div>
                    
                </div>
            </div>
        </div>
    );
}