import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaGithub, FaLinkedin } from 'react-icons/fa';

const TeamCard = ({ name, role, contribution, image }) => (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden transform hover:-translate-y-2 group">
        <div className="relative h-64 overflow-hidden">
            <img
                src={image}
                alt={name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/40 to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-300" />

            <div className="absolute bottom-0 left-0 p-6 translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                <h3 className="text-xl font-bold text-white mb-1">{name}</h3>
                <p className="text-blue-400 font-medium text-sm">{role}</p>
            </div>
        </div>
        <div className="p-6 pt-2">
            <p className="text-gray-300 text-sm leading-relaxed mb-4">{contribution}</p>
            <div className="flex gap-3">
                <button className="text-gray-400 hover:text-white transition-colors"><FaGithub size={20} /></button>
                <button className="text-gray-400 hover:text-blue-400 transition-colors"><FaLinkedin size={20} /></button>
            </div>
        </div>
    </div>
);

const AboutUs = () => {
    const navigate = useNavigate();

    const team = [
        {
            name: "Zeeshan Sarfraz",
            role: "Team Lead & Full Stack Developer",
            contribution: "Conceptualized the project, designed the architecture, and developed this website. Led the team to success.",
            image: "/assets/team_zeeshan.png"
        },
        {
            name: "Urooj Nisar",
            role: "Hardware Engineer",
            contribution: "Designed and implemented the RFID attendance circuit. Ensured seamless hardware integration.",
            image: "/assets/team_urooj.png"
        },
        {
            name: "Eman Fatima",
            role: "Data & Integration Specialist",
            contribution: "Created the Google Sheet database and established its linkage to the ESP8266 and the website.",
            image: "/assets/team_eman.png"
        }
    ];

    return (
        <div className="min-h-screen bg-gray-900 font-sans text-gray-100 relative overflow-hidden">
            {/* Animated Background */}
            <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 animate-gradient z-0"></div>

            {/* Floating Orbs */}
            <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob"></div>
            <div className="absolute top-0 -right-4 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-2000"></div>
            <div className="absolute -bottom-8 left-20 w-72 h-72 bg-indigo-500 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-4000"></div>
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 z-0"></div>

            {/* Navbar */}
            <nav className="relative z-50 bg-white/5 backdrop-blur-xl border-b border-white/10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
                    <div className="flex items-center space-x-3 cursor-pointer" onClick={() => navigate('/')}>
                        <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold shadow-lg">
                            <span className="text-lg">AT</span>
                        </div>
                        <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                            Attendance System
                        </span>
                    </div>
                    <button
                        onClick={() => navigate('/')}
                        className="group flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-all duration-300"
                    >
                        <FaArrowLeft className="text-gray-400 group-hover:-translate-x-1 transition-transform" />
                        <span className="text-gray-300 group-hover:text-white font-medium">Back to Home</span>
                    </button>
                </div>
            </nav>

            {/* Content */}
            <div className="relative z-10">
                {/* Hero Section */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14 text-center">
                    <div className="inline-block px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-bold mb-6">
                        Meet the Creators
                    </div>
                    <h1 className="text-4xl md:text-6xl font-extrabold text-white mb-6 tracking-tight">
                        About The <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">Project</span>
                    </h1>
                    <p className="mt-6 max-w-2xl mx-auto text-xl text-gray-400 leading-relaxed">
                        A smart attendance solution leveraging RFID technology to provide real-time data tracking, visualization, and manipulation.
                    </p>
                </div>

                {/* Project Info Section */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="bg-white/5 backdrop-blur-lg rounded-3xl p-8 md:p-12 border border-white/10 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-purple-600/20 rounded-full blur-3xl"></div>

                        <div className="grid md:grid-cols-2 gap-12 items-center relative z-10">
                            <div>
                                <h2 className="text-3xl font-bold text-white mb-8">How It Works</h2>
                                <div className="space-y-6">
                                    {[
                                        { text: "Students tap their RFID cards on the scanner", color: "text-green-400", bg: "bg-green-500/10" },
                                        { text: "Data is transmitted via ESP8266 to Google Sheets", color: "text-blue-400", bg: "bg-blue-500/10" },
                                        { text: "Website fetches and visualizes records in real-time", color: "text-purple-400", bg: "bg-purple-500/10" }
                                    ].map((item, i) => (
                                        <div key={i} className="flex items-center p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                                            <div className={`flex-shrink-0 w-10 h-10 rounded-lg ${item.bg} flex items-center justify-center ${item.color}`}>
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                            </div>
                                            <p className="ml-4 text-gray-300 font-medium">{item.text}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="relative group">
                                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl transform rotate-2 group-hover:rotate-1 transition-transform opacity-50 blur-sm"></div>
                                <div className="relative bg-gray-900 border border-white/10 rounded-2xl p-8 text-white overflow-hidden shadow-2xl">
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center border border-white/10">
                                            <span className="font-bold text-xl">🚀</span>
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold">Our Mission</h3>
                                            <p className="text-xs text-gray-500 uppercase tracking-widest">Innovation & Efficiency</p>
                                        </div>
                                    </div>
                                    <p className="text-gray-300 italic text-lg leading-relaxed">
                                        "We aimed to eliminate manual errors and streamline the attendance process. This project represents the perfect synergy of hardware and software engineering."
                                    </p>
                                    <div className="mt-6 flex items-center gap-2">
                                        <div className="h-0.5 flex-1 bg-white/10"></div>
                                        <span className="text-sm text-gray-500">Zeeshan Sarfraz</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Team Section */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold text-white mb-4">Meet the Team</h2>
                        <p className="text-gray-400">The brilliant minds behind this project</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10">
                        {team.map((member, index) => (
                            <TeamCard key={index} {...member} />
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <footer className="border-t border-white/10 bg-gray-900/50 backdrop-blur-xl py-12">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center">
                        <p className="text-center text-gray-500 mb-2">
                            &copy; {new Date().getFullYear()} Attendance System. All rights reserved.
                        </p>
                        <p className="text-center text-gray-600 text-sm flex items-center gap-1">
                            Developed by <span className="text-red-500"></span> Zeeshan Sarfraz
                        </p>
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default AboutUs;
