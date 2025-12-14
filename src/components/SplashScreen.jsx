import React, { useEffect, useState } from 'react';
import { FaUniversity } from 'react-icons/fa';

const SplashScreen = ({ onFinish }) => {
    const [fade, setFade] = useState(false);

    useEffect(() => {
        // Trigger fade out before finishing
        const timer = setTimeout(() => {
            setFade(true);
        }, 2200); // Start fading out a bit before unmounting

        const finishTimer = setTimeout(() => {
            onFinish();
        }, 2500); // Total duration

        return () => {
            clearTimeout(timer);
            clearTimeout(finishTimer);
        };
    }, [onFinish]);

    return (
        <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-900 transition-opacity duration-300 ${fade ? 'opacity-0' : 'opacity-100'}`}>
            {/* Background Effects */}
            <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-blue-900/20 to-purple-900/20"></div>

            <div className="relative z-10 flex flex-col items-center animate-bounce-slow">
                <div className="w-20 h-20 bg-gradient-to-tr from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-2xl mb-6 animate-pulse">
                    <FaUniversity className="text-white text-4xl" />
                </div>
                <h1 className="text-4xl font-bold text-white tracking-tight mb-2">EduTrack</h1>
                <p className="text-blue-200 text-sm tracking-widest uppercase">Smart Attendance</p>
            </div>

            <div className="absolute bottom-10 text-center">
                <p className="text-gray-500 text-xs uppercase tracking-widest mb-1">Developed by</p>
                <div className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent font-bold text-lg">
                    Zeeshan Sarfraz
                </div>
            </div>

            <style>{`
                @keyframes bounce-slow {
                    0%, 100% { transform: translateY(-3%); }
                    50% { transform: translateY(3%); }
                }
                .animate-bounce-slow {
                    animation: bounce-slow 2s infinite ease-in-out;
                }
            `}</style>
        </div>
    );
};

export default SplashScreen;
