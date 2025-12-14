import React, { useState } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { FaUserLock, FaSignInAlt, FaUniversity, FaEnvelope, FaLock, FaCircle, FaPaperPlane, FaTimes, FaInfoCircle } from 'react-icons/fa';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [info, setInfo] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    // Application Modal State
    const [showAppModal, setShowAppModal] = useState(false);
    const [appForm, setAppForm] = useState({
        name: '', email: '', password: '', role: 'student', details: '', message: '', rollNumber: '', className: ''
    });
    const [appLoading, setAppLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setInfo('');
        setLoading(true);
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Check role
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                const role = userDoc.data().role;
                if (role === 'teacher') {
                    navigate('/teacher');
                } else if (role === 'student') {
                    navigate('/student');
                } else if (role === 'admin') {
                    navigate('/admin');
                } else {
                    navigate('/teacher'); // Default
                }
            } else {
                setError("User data not found.");
            }
        } catch (err) {
            setError("Failed to login. Please check your credentials.");
            console.error(err);
        }
        setLoading(false);
    };

    const handleForgotPassword = async () => {
        if (!email) {
            setError("Please enter your email address first.");
            return;
        }
        try {
            await sendPasswordResetEmail(auth, email);
            setInfo("Password reset link sent! Check your email.");
            setError('');
        } catch (err) {
            console.error(err);
            setError("Failed to send reset email. " + err.message);
        }
    };

    const handleAppSubmit = async (e) => {
        e.preventDefault();
        setAppLoading(true);
        try {
            await addDoc(collection(db, "applications"), {
                ...appForm,
                timestamp: serverTimestamp(),
                status: 'pending'
            });
            alert("Application submitted successfully! The admin will review it shortly.");
            setShowAppModal(false);
            setAppForm({ name: '', email: '', password: '', role: 'student', details: '', message: '', rollNumber: '', className: '' });
        } catch (err) {
            console.error(err);
            alert("Failed to submit application.");
        }
        setAppLoading(false);
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-gray-900 relative overflow-hidden">

            {/* Animated Background */}
            <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 animate-gradient"></div>

            {/* Floating Orbs */}
            <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob"></div>
            <div className="absolute top-0 -right-4 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-2000"></div>
            <div className="absolute -bottom-8 left-20 w-72 h-72 bg-indigo-500 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-4000"></div>

            {/* Grid Pattern Overlay */}
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5"></div>

            {/* About Us Navigation */}
            <div className="absolute top-6 right-6 z-20">
                <button
                    onClick={() => navigate('/about-us')}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 backdrop-blur-md text-gray-300 hover:text-white transition-all duration-300"
                >
                    <FaInfoCircle />
                    <span className="font-medium">About Us</span>
                </button>
            </div>

            {/* Glass Card */}
            <div className="relative z-10 w-full max-w-md p-6 mx-4">
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-2xl overflow-hidden p-8 transform transition-all hover:scale-[1.01] duration-300">

                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="mx-auto w-16 h-16 bg-gradient-to-tr from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg mb-4 transform rotate-3 hover:rotate-6 transition-transform">
                            <FaUniversity className="text-white text-3xl" />
                        </div>
                        <h1 className="text-3xl font-bold text-white tracking-tight">Welcome Back</h1>
                        <p className="text-blue-200 mt-2 text-sm">EduTrack Smart Attendance System</p>
                    </div>

                    {/* Messages */}
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/50 text-red-200 p-3 rounded-lg text-sm mb-6 flex items-center gap-2 animate-pulse">
                            <FaCircle className="text-[10px]" /> {error}
                        </div>
                    )}
                    {info && (
                        <div className="bg-green-500/10 border border-green-500/50 text-green-200 p-3 rounded-lg text-sm mb-6 flex items-center gap-2 animate-pulse">
                            <FaCircle className="text-[10px]" /> {info}
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <FaEnvelope className="text-blue-300 group-focus-within:text-blue-400 transition-colors" />
                            </div>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full pl-11 pr-4 py-3 bg-gray-900/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                placeholder="Email Address"
                            />
                        </div>

                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <FaLock className="text-blue-300 group-focus-within:text-blue-400 transition-colors" />
                            </div>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full pl-11 pr-4 py-3 bg-gray-900/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                placeholder="Password"
                            />
                        </div>

                        <div className="flex items-center justify-between text-xs text-blue-200">
                            <label className="flex items-center cursor-pointer hover:text-white transition-colors">
                                <input type="checkbox" className="form-checkbox h-4 w-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-offset-gray-900 focus:ring-blue-500" />
                                <span className="ml-2">Remember me</span>
                            </label>
                            <button type="button" onClick={handleForgotPassword} className="hover:text-white transition-colors hover:underline">
                                Forgot password?
                            </button>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-600/30 transform transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 flex items-center justify-center gap-2 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Signing in...
                                </span>
                            ) : (
                                <>
                                    <FaSignInAlt /> Log in
                                </>
                            )}
                        </button>
                    </form>

                    {/* Footer - Application Link */}
                    <div className="mt-8 text-center text-sm text-gray-400">
                        <p>
                            Don't have an account?{' '}
                            <button onClick={() => setShowAppModal(true)} className="text-blue-400 font-bold hover:text-white transition-colors hover:underline">
                                Apply for one
                            </button>
                        </p>
                    </div>
                </div>
            </div>

            {/* Application Modal */}
            {showAppModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
                    <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-lg p-6 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500"></div>
                        <button onClick={() => setShowAppModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white">
                            <FaTimes size={20} />
                        </button>

                        <h2 className="text-2xl font-bold text-white mb-2">Apply for Account</h2>
                        <p className="text-gray-400 text-sm mb-6">Submit your details. An admin will review your application.</p>

                        <form onSubmit={handleAppSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1">Full Name</label>
                                    <input
                                        type="text" required
                                        value={appForm.name} onChange={e => setAppForm({ ...appForm, name: e.target.value })}
                                        className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1">Email</label>
                                    <input
                                        type="email" required
                                        value={appForm.email} onChange={e => setAppForm({ ...appForm, email: e.target.value })}
                                        className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-blue-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1">Desired Password</label>
                                <input
                                    type="password" required minLength={6}
                                    placeholder="At least 6 characters"
                                    value={appForm.password} onChange={e => setAppForm({ ...appForm, password: e.target.value })}
                                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-blue-500 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1">Applying As</label>
                                <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-700">
                                    {['student', 'teacher'].map(r => (
                                        <button
                                            key={r} type="button"
                                            onClick={() => setAppForm({ ...appForm, role: r })}
                                            className={`flex-1 py-1.5 rounded-md text-sm font-bold capitalize transition-all ${appForm.role === r ? 'bg-blue-600 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}
                                        >
                                            {r}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {appForm.role === 'student' ? (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 mb-1">Roll Number</label>
                                        <input
                                            type="text" required
                                            placeholder="e.g. CS-370"
                                            value={appForm.rollNumber} onChange={e => setAppForm({ ...appForm, rollNumber: e.target.value })}
                                            className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-blue-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 mb-1">Class</label>
                                        <input
                                            type="text" required
                                            placeholder="e.g. BSCS-3B"
                                            value={appForm.className} onChange={e => setAppForm({ ...appForm, className: e.target.value })}
                                            className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-blue-500 outline-none"
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1">Subject / Department</label>
                                    <input
                                        type="text" required
                                        placeholder="e.g. Computer Science"
                                        value={appForm.details} onChange={e => setAppForm({ ...appForm, details: e.target.value })}
                                        className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-blue-500 outline-none"
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1">Message (Optional)</label>
                                <textarea
                                    rows="2"
                                    value={appForm.message} onChange={e => setAppForm({ ...appForm, message: e.target.value })}
                                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-blue-500 outline-none resize-none"
                                    placeholder="Any extra info..."
                                ></textarea>
                            </div>

                            <button
                                type="submit"
                                disabled={appLoading}
                                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl shadow-lg transition-transform hover:-translate-y-1 flex items-center justify-center gap-2 mt-4"
                            >
                                {appLoading ? 'Sending...' : <><FaPaperPlane /> Submit Application</>}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Login;
