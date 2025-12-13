import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { FaUserLock, FaSignInAlt, FaUniversity, FaCheckDouble } from 'react-icons/fa';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
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
                    // Default
                    navigate('/teacher');
                }
            } else {
                setError("User data not found.");
            }
        } catch (err) {
            setError("Failed to login. Check credentials.");
            console.error(err);
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen flex w-full">
            {/* Left Panel - Hero Section */}
            <div className="hidden md:flex w-1/2 bg-gradient-to-br from-blue-600 to-indigo-800 text-white flex-col justify-between p-12 relative overflow-hidden">
                <div className="relative z-10">
                    <div className="flex items-center gap-3 text-2xl font-bold mb-8">
                        <FaUniversity className="text-blue-300" />
                        <span>EduTrack</span>
                    </div>
                    <h1 className="text-5xl font-extrabold leading-tight mb-6">
                        Smart Attendance <br /> Management System
                    </h1>
                    <p className="text-blue-100 text-lg max-w-md leading-relaxed">
                        Streamline your academic tracking with our RFID-integrated solution. Real-time updates, secure authentication, and comprehensive analytics for students and faculty.
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-6 relative z-10 mt-12">
                    <div className="bg-white/10 backdrop-blur-md p-6 rounded-xl border border-white/20">
                        <FaCheckDouble className="text-3xl text-green-300 mb-4" />
                        <h3 className="font-bold text-lg">Real-time Tracking</h3>
                        <p className="text-sm text-blue-100 opacity-80">Instant attendance updates via RFID technology.</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-md p-6 rounded-xl border border-white/20">
                        <FaUserLock className="text-3xl text-yellow-300 mb-4" />
                        <h3 className="font-bold text-lg">Secure Access</h3>
                        <p className="text-sm text-blue-100 opacity-80">Role-based dashboards for Admin, Teachers, and Students.</p>
                    </div>
                </div>

                {/* Decorative Circles */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/20 rounded-full blur-2xl translate-y-1/2 -translate-x-1/4"></div>
            </div>

            {/* Right Panel - Login Form */}
            <div className="w-full md:w-1/2 bg-white flex items-center justify-center p-8">
                <div className="w-full max-w-md space-y-8">
                    <div className="text-center md:text-left">
                        <div className="inline-block p-3 rounded-full bg-blue-50 text-blue-600 mb-4 md:hidden">
                            <FaUniversity size={32} />
                        </div>
                        <h2 className="text-3xl font-bold text-gray-900">Welcome Back</h2>
                        <p className="text-gray-500 mt-2">Please enter your details to sign in.</p>
                    </div>

                    {error && (
                        <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm flex items-center gap-2 border border-red-100">
                            <span className="font-bold">Error:</span> {error}
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                            <input
                                type="email"
                                required
                                className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-gray-50 focus:bg-white"
                                placeholder="student@university.edu"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                            <input
                                type="password"
                                required
                                className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-gray-50 focus:bg-white"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>

                        <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center">
                                <input id="remember-me" type="checkbox" className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                                <label htmlFor="remember-me" className="ml-2 block text-gray-500">Remember me</label>
                            </div>
                            <a href="#" className="font-medium text-blue-600 hover:text-blue-500">Forgot password?</a>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                            {loading ? 'Signing in...' : <><FaSignInAlt /> Sign In</>}
                        </button>
                    </form>

                    <p className="text-center text-sm text-gray-500">
                        Don't have an account? <span className="text-blue-600 font-medium cursor-pointer hover:underline">Contact Admin</span>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
