import React, { useState, useEffect } from 'react';
import { fetchAttendance } from '../../services/sheetsApi';
import { useAuth } from '../../hooks/useAuth';
import './StudentDashboard.css';
import {
    FaUserGraduate, FaHistory, FaCheckCircle, FaCalendarAlt, FaCalendarCheck,
    FaPercentage, FaChartLine, FaSignOutAlt, FaBars, FaTimes, FaUniversity,
    FaChevronLeft, FaChevronRight, FaTimesCircle, FaCheckDouble
} from 'react-icons/fa';
import { auth } from '../../firebase';

const StudentDashboard = () => {
    const { user, userData, role, loading: authLoading } = useAuth();
    const [attendance, setAttendance] = useState([]);
    const [stats, setStats] = useState({ present: 0, totalClassDays: 0, percentage: 0, absent: 0 });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('dashboard');
    const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 768);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    // Calendar State
    const [currentDate, setCurrentDate] = useState(new Date());
    const [classDates, setClassDates] = useState(new Set());
    const [myPresentDates, setMyPresentDates] = useState(new Set());

    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            if (mobile) setIsSidebarOpen(false);
            else setIsSidebarOpen(true);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (user && userData?.rollNumber) {
            loadData();
        } else if (user && !userData?.rollNumber) {
            setLoading(false);
        }
    }, [user, userData]);

    const normalizeRecord = (record) => {
        const newRecord = {};
        Object.keys(record).forEach(key => {
            const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (cleanKey === 'rollnumber' || cleanKey === 'rollno' || cleanKey === 'roll') {
                newRecord.rollNumber = record[key];
            } else if (cleanKey === 'class' || cleanKey === 'grade') {
                newRecord.class = record[key];
            } else if (cleanKey === 'date') {
                newRecord.date = record[key];
            } else if (cleanKey === 'time') {
                newRecord.time = record[key];
            } else {
                newRecord[key] = record[key];
            }
        });
        return newRecord;
    };

    const normalizeValue = (val) => String(val || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    const loadData = async () => {
        setLoading(true);
        try {
            const rawData = await fetchAttendance();

            if (!userData || !userData.class) {
                setLoading(false);
                return;
            }

            const userRoll = normalizeValue(userData.rollNumber);
            const userClass = normalizeValue(userData.class);

            const processedData = rawData.map(normalizeRecord);

            const classRecords = processedData.filter(r => {
                const rClass = normalizeValue(r.class);
                return rClass === userClass;
            });

            const uniqueClassDatesSet = new Set(classRecords.map(r => r.date));
            const totalClassDays = uniqueClassDatesSet.size;
            setClassDates(uniqueClassDatesSet);

            const myAttendance = classRecords.filter(record => {
                const rRoll = normalizeValue(record.rollNumber);
                return rRoll === userRoll;
            });
            const uniqueMyDatesSet = new Set(myAttendance.map(r => r.date));
            setMyPresentDates(uniqueMyDatesSet);

            myAttendance.sort((a, b) => {
                if (!a.date || !b.date) return 0;
                const [d1, m1, y1] = a.date.split('-');
                const [d2, m2, y2] = b.date.split('-');
                return new Date(`${y2}-${m2}-${d2}`) - new Date(`${y1}-${m1}-${d1}`);
            });

            const presentDays = uniqueMyDatesSet.size;
            const absentDays = Math.max(0, totalClassDays - presentDays);
            const percent = totalClassDays > 0 ? ((presentDays / totalClassDays) * 100).toFixed(1) : 0;

            setAttendance(myAttendance);
            setStats({
                present: presentDays,
                totalClassDays: totalClassDays,
                percentage: percent,
                absent: absentDays
            });
        } catch (error) {
            console.error("Failed to load student data", error);
        }
        setLoading(false);
    };

    const handleLogout = () => auth.signOut();

    const getDaysInMonth = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        return { daysInMonth, firstDayOfMonth, year, month };
    };

    const changeMonth = (increment) => {
        const newDate = new Date(currentDate);
        newDate.setMonth(newDate.getMonth() + increment);
        setCurrentDate(newDate);
    };

    const formatDateKey = (day, month, year) => {
        const d = String(day).padStart(2, '0');
        const m = String(month + 1).padStart(2, '0');
        return `${d}-${m}-${year}`;
    };

    const renderCalendar = () => {
        const { daysInMonth, firstDayOfMonth, year, month } = getDaysInMonth(currentDate);
        const days = [];
        const monthNames = ["January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ];

        for (let i = 0; i < firstDayOfMonth; i++) {
            days.push(<div key={`empty-${i}`} className="h-10 md:h-14"></div>);
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const dateParams = new Date(year, month, d);
            const dayOfWeek = dateParams.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

            const dateKey = formatDateKey(d, month, year);
            const isPresent = myPresentDates.has(dateKey);
            const isClassHeld = classDates.has(dateKey);
            const isAbsent = isClassHeld && !isPresent;

            let bgClass = "bg-white/5";
            let textClass = "text-gray-300";
            let borderClass = "border-white/10";
            let statusIcon = null;

            if (isPresent) {
                bgClass = "bg-green-500/20";
                textClass = "text-green-400 font-bold";
                borderClass = "border-green-500/30";
                statusIcon = <FaCheckCircle size={10} />;
            } else if (isAbsent) {
                bgClass = "bg-red-500/20";
                textClass = "text-red-400 font-bold";
                borderClass = "border-red-500/30";
                statusIcon = <FaTimesCircle size={10} />;
            } else if (isWeekend) {
                bgClass = "bg-gray-800/50";
                textClass = "text-gray-600";
            }

            days.push(
                <div key={d} className={`h-10 md:h-14 md:p-1 flex flex-col items-center justify-center rounded-lg border ${bgClass} ${borderClass} ${textClass} text-xs md:text-sm relative group transition-all hover:brightness-125`}>
                    <span>{d}</span>
                    {statusIcon && <span className="mt-1 md:hidden">{statusIcon}</span>}
                    {statusIcon && <span className="hidden md:block absolute bottom-1 right-1">{statusIcon}</span>}

                    <div className="absolute opacity-0 group-hover:opacity-100 bottom-full mb-2 bg-black/80 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10 pointer-events-none transition-opacity">
                        {isPresent ? 'Present' : isAbsent ? 'Absent' : isWeekend ? 'Weekend' : 'No Class'}
                    </div>
                </div>
            );
        }

        return (
            <div className="bg-white/10 backdrop-blur-md rounded-xl shadow-lg border border-white/10 p-4 md:p-6 animate-fadeIn">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-lg text-white flex items-center gap-2">
                        <FaCalendarAlt className="text-blue-400" /> Attendance Calendar
                    </h3>
                    <div className="flex items-center gap-4 bg-black/20 rounded-lg p-1">
                        <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-white/10 rounded-md transition-all text-gray-300"><FaChevronLeft /></button>
                        <span className="font-bold text-white w-32 text-center select-none">{monthNames[month]} {year}</span>
                        <button onClick={() => changeMonth(1)} className="p-2 hover:bg-white/10 rounded-md transition-all text-gray-300"><FaChevronRight /></button>
                    </div>
                </div>

                <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <div className="text-red-400">Sun</div>
                    <div>Mon</div>
                    <div>Tue</div>
                    <div>Wed</div>
                    <div>Thu</div>
                    <div>Fri</div>
                    <div className="text-red-400">Sat</div>
                </div>
                <div className="grid grid-cols-7 gap-2 md:gap-3">
                    {days}
                </div>

                <div className="mt-6 flex gap-4 text-xs text-gray-400 justify-center flex-wrap">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-green-500/20 border border-green-500/30"></div> Present</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-red-500/20 border border-red-500/30"></div> Absent</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-gray-800/50 border border-white/10"></div> Weekend/Holiday</div>
                </div>
            </div>
        );
    };

    if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-blue-400 font-bold loading-pulse">Loading profile...</div>;
    if (!user) return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-red-400 font-bold">Please log in.</div>;
    if (role !== 'student') return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-red-400 font-bold">Access restricted to students.</div>;

    const renderDashboard = () => (
        <div className="space-y-6 animate-fadeIn pb-8">
            <h2 className="text-2xl font-bold text-white mb-4">Dashboard Overview</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-white/10 backdrop-blur-md p-5 rounded-xl border border-white/10 hover:bg-white/20 transition-all group">
                    <div className="flex justify-between items-start mb-2">
                        <div className="bg-blue-500/20 p-3 rounded-lg text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                            <FaCalendarCheck size={20} />
                        </div>
                    </div>
                    <div>
                        <p className="text-xs text-blue-200/60 uppercase font-bold tracking-wider">Total Days</p>
                        <p className="text-2xl font-bold text-white">{stats.totalClassDays}</p>
                    </div>
                </div>
                <div className="bg-white/10 backdrop-blur-md p-5 rounded-xl border border-white/10 hover:bg-white/20 transition-all group">
                    <div className="flex justify-between items-start mb-2">
                        <div className="bg-green-500/20 p-3 rounded-lg text-green-400 group-hover:bg-green-500 group-hover:text-white transition-colors">
                            <FaCheckCircle size={20} />
                        </div>
                    </div>
                    <div>
                        <p className="text-xs text-green-200/60 uppercase font-bold tracking-wider">Present</p>
                        <p className="text-2xl font-bold text-white">{stats.present}</p>
                    </div>
                </div>
                <div className="bg-white/10 backdrop-blur-md p-5 rounded-xl border border-white/10 hover:bg-white/20 transition-all group">
                    <div className="flex justify-between items-start mb-2">
                        <div className="bg-red-500/20 p-3 rounded-lg text-red-400 group-hover:bg-red-500 group-hover:text-white transition-colors">
                            <FaTimesCircle size={20} />
                        </div>
                    </div>
                    <div>
                        <p className="text-xs text-red-200/60 uppercase font-bold tracking-wider">Absent</p>
                        <p className="text-2xl font-bold text-white">{stats.absent}</p>
                    </div>
                </div>
                <div className="bg-white/10 backdrop-blur-md p-5 rounded-xl border border-white/10 hover:bg-white/20 transition-all group">
                    <div className="flex justify-between items-start mb-2">
                        <div className="bg-purple-500/20 p-3 rounded-lg text-purple-400 group-hover:bg-purple-500 group-hover:text-white transition-colors">
                            <FaPercentage size={20} />
                        </div>
                    </div>
                    <div>
                        <p className="text-xs text-purple-200/60 uppercase font-bold tracking-wider">Rate</p>
                        <p className={`text-2xl font-bold ${parseFloat(stats.percentage) >= 75 ? 'text-green-400' : 'text-orange-400'}`}>{stats.percentage}%</p>
                    </div>
                </div>
            </div>

            {renderCalendar()}
        </div>
    );

    const formatTimeReadable = (timeStr) => {
        if (!timeStr) return "--:--";

        // Case 1: Handle ISO Date Strings (e.g. from Sheets JSON)
        if (String(timeStr).includes('T') || String(timeStr).includes('-')) {
            const d = new Date(timeStr);
            if (!isNaN(d.getTime())) {
                return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
            }
        }

        // Case 2: Already 12-hour format
        if (/AM|PM/i.test(timeStr)) return timeStr;

        // Case 3: Simple 24-hour HH:mm string
        const parts = String(timeStr).split(':');
        if (parts.length >= 2) {
            let hours = parseInt(parts[0], 10);
            let minutes = parseInt(parts[1], 10);

            if (!isNaN(hours) && !isNaN(minutes)) {
                const ampm = hours >= 12 ? 'PM' : 'AM';
                hours = hours % 12;
                hours = hours ? hours : 12; // 0 becomes 12
                const mStr = minutes.toString().padStart(2, '0');
                return `${hours}:${mStr} ${ampm}`;
            }
        }

        return timeStr;
    };

    const renderHistory = () => (
        <div className="bg-white/10 backdrop-blur-md rounded-xl shadow-lg border border-white/10 p-6 animate-fadeIn">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <FaHistory className="text-blue-400" /> Full Attendance History
            </h2>

            {/* Desktop View (Table) */}
            <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-white/10 text-gray-400 text-sm uppercase tracking-wider">
                            <th className="p-4 font-semibold">Status</th>
                            <th className="p-4 font-semibold">Date</th>
                            <th className="p-4 font-semibold">Time</th>
                            <th className="p-4 font-semibold">Verified</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {loading ? (
                            <tr><td colSpan="4" className="p-8 text-center text-gray-400">Loading records...</td></tr>
                        ) : attendance.length === 0 ? (
                            <tr><td colSpan="4" className="p-8 text-center text-gray-400">No records found.</td></tr>
                        ) : (
                            attendance.map((record, index) => (
                                <tr key={index} className="hover:bg-white/5 transition-colors">
                                    <td className="p-4">
                                        <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-bold uppercase inline-flex items-center gap-1 border border-green-500/30">
                                            <FaCheckCircle size={10} /> Present
                                        </span>
                                    </td>
                                    <td className="p-4 font-medium text-white">{record.date}</td>
                                    <td className="p-4 text-gray-300 font-mono">{formatTimeReadable(record.time)}</td>
                                    <td className="p-4 text-blue-400">
                                        <FaCheckDouble />
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Mobile View (Cards) */}
            <div className="md:hidden space-y-3">
                {loading ? (
                    <div className="p-8 text-center text-gray-400">Loading records...</div>
                ) : attendance.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">No records found.</div>
                ) : (
                    attendance.map((record, index) => (
                        <div key={index} className="bg-white/5 border border-white/10 p-4 rounded-xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                {/* Date Box */}
                                <div className="bg-black/20 p-2 rounded-lg text-center min-w-[50px]">
                                    <p className="text-xs text-gray-400 font-bold uppercase">{new Date(record.date.split('-').reverse().join('-')).toLocaleString('en-us', { month: 'short' })}</p>
                                    <p className="text-lg font-bold text-white leading-none">{record.date.split('-')[0]}</p>
                                </div>

                                <div>
                                    <p className="text-sm font-bold text-white flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-green-500"></span> Present
                                    </p>
                                    <p className="text-xs text-gray-400 font-mono mt-0.5">
                                        {formatTimeReadable(record.time)}
                                    </p>
                                </div>
                            </div>

                            <div className="text-blue-400 bg-blue-500/10 p-2 rounded-full">
                                <FaCheckDouble size={14} />
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );

    return (
        <div className="flex h-screen bg-gray-900 text-gray-100 overflow-hidden font-sans relative">

            {/* Animated Background */}
            <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-gray-900 via-blue-900/50 to-purple-900/50 animate-gradient z-0"></div>
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 z-0"></div>

            {/* Sidebar */}
            <aside
                className={`fixed md:relative z-50 h-full w-72 shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col justify-between
                bg-white/5 backdrop-blur-xl border-r border-white/10
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0 md:w-72'} 
                ${isMobile && !isSidebarOpen ? '-translate-x-full' : ''}`}
            >
                <div>
                    {/* Logo Area */}
                    <div className="p-6 border-b border-white/10 flex items-center gap-3">
                        <div className="bg-gradient-to-tr from-blue-600 to-purple-600 text-white p-2 rounded-lg shadow-lg">
                            <FaUniversity size={24} />
                        </div>
                        <h1 className="text-xl font-extrabold text-white tracking-tight">
                            EduTrack
                        </h1>
                        {isMobile && (
                            <button onClick={() => setIsSidebarOpen(false)} className="ml-auto text-gray-400 hover:text-white">
                                <FaTimes />
                            </button>
                        )}
                    </div>

                    {/* Navigation */}
                    <nav className="p-4 space-y-2 mt-4">
                        <div className="px-4 pb-2 text-xs font-bold text-gray-500 uppercase tracking-wider">Menu</div>
                        <button
                            onClick={() => { setActiveTab('dashboard'); if (isMobile) setIsSidebarOpen(false); }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'dashboard'
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                                : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                }`}
                        >
                            <FaChartLine size={18} /> Dashboard
                        </button>
                        <button
                            onClick={() => { setActiveTab('history'); if (isMobile) setIsSidebarOpen(false); }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'history'
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                                : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                }`}
                        >
                            <FaHistory size={18} /> Attendance History
                        </button>
                    </nav>
                </div>

                {/* Bottom Section */}
                <div className="p-4 border-t border-white/10 bg-black/20">
                    <div className="mb-4 bg-white/5 p-3 rounded-xl border border-white/10">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg shadow-md">
                                {userData?.name?.charAt(0) || "S"}
                            </div>
                            <div className="overflow-hidden">
                                <p className="text-sm font-bold text-white truncate">{userData?.name || "Student"}</p>
                                <p className="text-xs text-gray-400 truncate">{userData?.rollNumber || "Roll No."}</p>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-red-500/30 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/10 transition-colors group"
                    >
                        <FaSignOutAlt className="group-hover:-translate-x-1 transition-transform" /> Sign Out
                    </button>
                </div>
            </aside>

            {/* Overlay for mobile */}
            {isMobile && isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
                    onClick={() => setIsSidebarOpen(false)}
                ></div>
            )}

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-full relative w-full overflow-hidden z-10">
                {/* Header */}
                <header className="h-16 border-b border-white/10 flex items-center justify-between px-4 md:px-8 bg-white/5 backdrop-blur-md sticky top-0 z-20">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg md:hidden transition-colors"
                        >
                            <FaBars size={20} />
                        </button>
                        <h2 className="text-xl font-bold text-white hidden md:block">
                            {activeTab === 'dashboard' ? 'Overview' : 'My Records'}
                        </h2>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="hidden md:inline-flex text-sm text-gray-300 bg-white/5 px-3 py-1 rounded-full border border-white/10 items-center gap-2">
                            Class <span className="font-bold text-white bg-white/10 px-2 rounded shadow-sm">{userData?.class || "N/A"}</span>
                        </span>
                    </div>
                </header>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-auto p-4 md:p-8">
                    <div className="max-w-6xl mx-auto">
                        {activeTab === 'dashboard' ? renderDashboard() : renderHistory()}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default StudentDashboard;
