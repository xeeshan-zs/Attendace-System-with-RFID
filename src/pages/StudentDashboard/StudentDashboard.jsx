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
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    // Calendar State
    const [currentDate, setCurrentDate] = useState(new Date());
    // Store unique dates where class happened
    const [classDates, setClassDates] = useState(new Set());
    // Store unique dates where student was present
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

    // Helper to normalize keys (column headers)
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

    // Helper to normalize values for comparison (remove spaces/symbols, lowercase)
    // "BSCS 3-B" -> "bscs3b"
    // "BSCS-3B" -> "bscs3b"
    const normalizeValue = (val) => String(val || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    const loadData = async () => {
        setLoading(true);
        try {
            const rawData = await fetchAttendance();

            if (!userData || !userData.class) {
                setLoading(false);
                return;
            }

            // aggressive normalization for user data
            const userRoll = normalizeValue(userData.rollNumber);
            const userClass = normalizeValue(userData.class);

            console.log(`Searching for User: [${userRoll}] in Class: [${userClass}]`);

            // Normalize and Filter
            const processedData = rawData.map(normalizeRecord);

            // 1. Identify Class Total Days
            const classRecords = processedData.filter(r => {
                const rClass = normalizeValue(r.class);
                return rClass === userClass;
            });

            const uniqueClassDatesSet = new Set(classRecords.map(r => r.date));
            const totalClassDays = uniqueClassDatesSet.size;
            setClassDates(uniqueClassDatesSet);

            console.log(`Found ${classRecords.length} records for class ${userClass}`);
            console.log(`Class Active Dates:`, Array.from(uniqueClassDatesSet));

            // 2. Identify Student Present Days
            const myAttendance = classRecords.filter(record => {
                const rRoll = normalizeValue(record.rollNumber);
                return rRoll === userRoll;
            });
            const uniqueMyDatesSet = new Set(myAttendance.map(r => r.date));
            setMyPresentDates(uniqueMyDatesSet);

            console.log(`Found ${myAttendance.length} records for student ${userRoll}`);

            // Sort logic
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

    // Calendar Helpers
    const getDaysInMonth = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 = Sunday
        return { daysInMonth, firstDayOfMonth, year, month };
    };

    const changeMonth = (increment) => {
        const newDate = new Date(currentDate);
        newDate.setMonth(newDate.getMonth() + increment);
        setCurrentDate(newDate);
    };

    const formatDateKey = (day, month, year) => {
        // Match format DD-MM-YYYY
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

        // Empty slots for days before start of month
        for (let i = 0; i < firstDayOfMonth; i++) {
            days.push(<div key={`empty-${i}`} className="h-10 md:h-14"></div>);
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const dateParams = new Date(year, month, d);
            const dayOfWeek = dateParams.getDay(); // 0=Sun, 6=Sat
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

            const dateKey = formatDateKey(d, month, year);
            const isPresent = myPresentDates.has(dateKey);
            const isClassHeld = classDates.has(dateKey);
            const isAbsent = isClassHeld && !isPresent;

            let bgClass = "bg-white";
            let textClass = "text-gray-700";
            let borderClass = "border-gray-100";
            let statusIcon = null;

            if (isPresent) {
                bgClass = "bg-green-100";
                textClass = "text-green-700 font-bold";
                borderClass = "border-green-200";
                statusIcon = <FaCheckCircle size={10} />;
            } else if (isAbsent) {
                bgClass = "bg-red-50";
                textClass = "text-red-600 font-bold";
                borderClass = "border-red-100";
                statusIcon = <FaTimesCircle size={10} />;
            } else if (isWeekend) {
                bgClass = "bg-gray-100";
                textClass = "text-gray-400";
            }

            days.push(
                <div key={d} className={`h-10 md:h-14 md:p-1 flex flex-col items-center justify-center rounded-lg border ${bgClass} ${borderClass} ${textClass} text-xs md:text-sm relative group transition-all hover:brightness-95`}>
                    <span>{d}</span>
                    {statusIcon && <span className="mt-1 md:hidden">{statusIcon}</span>}
                    {statusIcon && <span className="hidden md:block absolute bottom-1 right-1">{statusIcon}</span>}

                    {/* Tooltip */}
                    <div className="absolute opacity-0 group-hover:opacity-100 bottom-full mb-2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10 pointer-events-none transition-opacity">
                        {isPresent ? 'Present' : isAbsent ? 'Absent' : isWeekend ? 'Weekend' : 'No Class'}
                    </div>
                </div>
            );
        }

        return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-6 animate-fadeIn">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                        <FaCalendarAlt className="text-blue-500" /> Attendance Calendar
                    </h3>
                    <div className="flex items-center gap-4 bg-gray-50 rounded-lg p-1">
                        <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-white rounded-md shadow-sm transition-all text-gray-600"><FaChevronLeft /></button>
                        <span className="font-bold text-gray-700 w-32 text-center select-none">{monthNames[month]} {year}</span>
                        <button onClick={() => changeMonth(1)} className="p-2 hover:bg-white rounded-md shadow-sm transition-all text-gray-600"><FaChevronRight /></button>
                    </div>
                </div>

                <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <div className="text-red-300">Sun</div>
                    <div>Mon</div>
                    <div>Tue</div>
                    <div>Wed</div>
                    <div>Thu</div>
                    <div>Fri</div>
                    <div className="text-red-300">Sat</div>
                </div>
                <div className="grid grid-cols-7 gap-2 md:gap-3">
                    {days}
                </div>

                <div className="mt-6 flex gap-4 text-xs text-gray-500 justify-center flex-wrap">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-green-100 border border-green-200"></div> Present</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-red-50 border border-red-100"></div> Absent</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-gray-100 border border-gray-100"></div> Weekend/Holiday</div>
                </div>
            </div>
        );
    };

    if (authLoading) return <div className="min-h-screen flex items-center justify-center text-blue-600 font-bold loading-pulse">Loading profile...</div>;
    if (!user) return <div className="min-h-screen flex items-center justify-center text-red-600 font-bold">Please log in.</div>;
    if (role !== 'student') return <div className="min-h-screen flex items-center justify-center text-red-600 font-bold">Access restricted to students.</div>;

    const renderDashboard = () => (
        <div className="space-y-6 animate-fadeIn pb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Dashboard Overview</h2>
            {/* Analytics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all group">
                    <div className="flex justify-between items-start mb-2">
                        <div className="bg-blue-50 p-3 rounded-lg text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            <FaCalendarCheck size={20} />
                        </div>
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Total Days</p>
                        <p className="text-2xl font-bold text-gray-800">{stats.totalClassDays}</p>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all group">
                    <div className="flex justify-between items-start mb-2">
                        <div className="bg-green-50 p-3 rounded-lg text-green-600 group-hover:bg-green-600 group-hover:text-white transition-colors">
                            <FaCheckCircle size={20} />
                        </div>
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Present</p>
                        <p className="text-2xl font-bold text-gray-800">{stats.present}</p>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all group">
                    <div className="flex justify-between items-start mb-2">
                        <div className="bg-red-50 p-3 rounded-lg text-red-600 group-hover:bg-red-600 group-hover:text-white transition-colors">
                            <FaTimesCircle size={20} />
                        </div>
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Absent</p>
                        <p className="text-2xl font-bold text-gray-800">{stats.absent}</p>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all group">
                    <div className="flex justify-between items-start mb-2">
                        <div className="bg-purple-50 p-3 rounded-lg text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                            <FaPercentage size={20} />
                        </div>
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Rate</p>
                        <p className={`text-2xl font-bold ${parseFloat(stats.percentage) >= 75 ? 'text-green-600' : 'text-orange-500'}`}>{stats.percentage}%</p>
                    </div>
                </div>
            </div>

            {renderCalendar()}
        </div>
    );

    const renderHistory = () => (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 animate-fadeIn">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <FaHistory className="text-blue-500" /> Full Attendance History
            </h2>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-sm uppercase tracking-wider">
                            <th className="p-4 font-semibold">Status</th>
                            <th className="p-4 font-semibold">Date</th>
                            <th className="p-4 font-semibold">Time</th>
                            <th className="p-4 font-semibold">Verified</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading ? (
                            <tr><td colSpan="4" className="p-8 text-center text-gray-500">Loading records...</td></tr>
                        ) : attendance.length === 0 ? (
                            <tr><td colSpan="4" className="p-8 text-center text-gray-500">No records found.</td></tr>
                        ) : (
                            attendance.map((record, index) => (
                                <tr key={index} className="hover:bg-gray-50 transition-colors">
                                    <td className="p-4">
                                        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold uppercase inline-flex items-center gap-1">
                                            <FaCheckCircle size={10} /> Present
                                        </span>
                                    </td>
                                    <td className="p-4 font-medium text-gray-800">{record.date}</td>
                                    <td className="p-4 text-gray-600 font-mono">{record.time}</td>
                                    <td className="p-4 text-blue-500">
                                        <FaCheckDouble />
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    return (
        <div className="flex h-screen bg-gray-50 text-gray-800 overflow-hidden font-sans">
            {/* Sidebar */}
            <aside
                className={`fixed md:relative z-20 bg-white h-full w-72 shadow-xl transform transition-transform duration-300 ease-in-out flex flex-col justify-between ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0 md:w-72'
                    } ${isMobile && !isSidebarOpen ? '-translate-x-full' : ''}`}
            >
                <div>
                    {/* Logo Area */}
                    <div className="p-6 border-b border-gray-100 flex items-center gap-3">
                        <div className="bg-blue-600 text-white p-2 rounded-lg shadow-lg shadow-blue-600/20">
                            <FaUniversity size={24} />
                        </div>
                        <h1 className="text-xl font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent tracking-tight">
                            EduTrack
                        </h1>
                        {isMobile && (
                            <button onClick={() => setIsSidebarOpen(false)} className="ml-auto text-gray-400 hover:text-gray-600">
                                <FaTimes />
                            </button>
                        )}
                    </div>

                    {/* Navigation */}
                    <nav className="p-4 space-y-2 mt-4">
                        <div className="px-4 pb-2 text-xs font-bold text-gray-400 uppercase tracking-wider">Menu</div>
                        <button
                            onClick={() => { setActiveTab('dashboard'); if (isMobile) setIsSidebarOpen(false); }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'dashboard'
                                ? 'bg-blue-50 text-blue-600 shadow-sm ring-1 ring-blue-100'
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                }`}
                        >
                            <FaChartLine size={18} /> Dashboard
                        </button>
                        <button
                            onClick={() => { setActiveTab('history'); if (isMobile) setIsSidebarOpen(false); }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'history'
                                ? 'bg-blue-50 text-blue-600 shadow-sm ring-1 ring-blue-100'
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                }`}
                        >
                            <FaHistory size={18} /> Attendance History
                        </button>
                    </nav>
                </div>

                {/* Bottom Section */}
                <div className="p-4 border-t border-gray-100 bg-gray-50/50">
                    <div className="mb-4 bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg shadow-md">
                                {userData?.name?.charAt(0) || "S"}
                            </div>
                            <div className="overflow-hidden">
                                <p className="text-sm font-bold text-gray-800 truncate">{userData?.name || "Student"}</p>
                                <p className="text-xs text-gray-500 truncate">{userData?.rollNumber || "Roll No."}</p>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-red-100 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors group"
                    >
                        <FaSignOutAlt className="group-hover:-translate-x-1 transition-transform" /> Sign Out
                    </button>
                </div>
            </aside>

            {/* Overlay for mobile */}
            {isMobile && isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/20 z-10 backdrop-blur-sm"
                    onClick={() => setIsSidebarOpen(false)}
                ></div>
            )}

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-full relative w-full overflow-hidden bg-gray-50">
                {/* Header */}
                <header className="bg-white h-16 border-b border-gray-100 flex items-center justify-between px-4 md:px-8 shadow-sm z-10">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg md:hidden"
                        >
                            <FaBars size={20} />
                        </button>
                        <h2 className="text-xl font-bold text-gray-800 hidden md:block">
                            {activeTab === 'dashboard' ? 'Overview' : 'My Records'}
                        </h2>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="hidden md:inline-flex text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full border border-gray-200 items-center gap-2">
                            Class <span className="font-bold text-gray-700 bg-white px-2 rounded shadow-sm">{userData?.class || "N/A"}</span>
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
