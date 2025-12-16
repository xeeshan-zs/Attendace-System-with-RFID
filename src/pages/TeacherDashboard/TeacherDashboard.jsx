import React, { useState, useEffect, useMemo } from 'react';
import { fetchAttendance, addAttendance, deleteAttendance, formatDateDDMMYYYY } from '../../services/sheetsApi';
import { useAuth } from '../../hooks/useAuth';
import './TeacherDashboard.css';
import {
    FaTrash, FaPlus, FaChalkboardTeacher, FaSignOutAlt,
    FaCalendarCheck, FaUsers, FaHistory, FaCheck, FaTimes,
    FaEdit, FaEraser, FaUniversity, FaBars, FaSearch
} from 'react-icons/fa';
import { auth, db } from '../../firebase';
import { collection, addDoc, getDocs, query, where, deleteDoc, doc, updateDoc, writeBatch } from 'firebase/firestore';

const TeacherDashboard = () => {
    const { user, role, loading: authLoading } = useAuth();
    const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 768);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    // Global State
    const [activeTab, setActiveTab] = useState('take-attendance'); // 'take-attendance' | 'roster' | 'history'
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Data State
    const [attendance, setAttendance] = useState([]); // From Sheets (History)
    const [roster, setRoster] = useState([]); // From Firestore
    const [loading, setLoading] = useState(false);

    // Filter/Selection State
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedClass, setSelectedClass] = useState("");

    // Marking State (Map of rollNumber -> status: true(present)/false(absent))
    const [attendanceState, setAttendanceState] = useState({});

    // Roster Form State
    const [showRosterModal, setShowRosterModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentStudentId, setCurrentStudentId] = useState(null);
    const [rosterForm, setRosterForm] = useState({ name: '', rollNumber: '', class: '' });

    useEffect(() => {
        if (role === 'teacher') {
            loadInitialData();
        }
    }, [role, refreshTrigger]);

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

    // Helper: Check Date Permissions
    const getDateStatus = (dateStr) => {
        if (!dateStr) return { allowed: false, message: "Select a date" };

        const inputDate = new Date(dateStr);
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);

        // Reset times for accurate date comparison
        inputDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        yesterday.setHours(0, 0, 0, 0);

        const isToday = inputDate.getTime() === today.getTime();
        const isYesterday = inputDate.getTime() === yesterday.getTime();

        if (isToday) return { allowed: true, isToday: true };
        if (isYesterday) return { allowed: true, isYesterday: true, message: "Editing Yesterday's Attendance" };

        return { allowed: false, message: "You can only mark attendance for Today or Edit Yesterday." };
    };

    const dateStatus = useMemo(() => getDateStatus(selectedDate), [selectedDate]);

    const loadInitialData = async () => {
        setLoading(true);
        try {
            // 1. Load Sheets Data (History)
            const sheetsData = await fetchAttendance();
            setAttendance(sheetsData);

            // 2. Load Firestore Data (Database Roster)
            const q = query(collection(db, "roster_students"));
            const querySnapshot = await getDocs(q);
            const firestoreRoster = [];
            querySnapshot.forEach((doc) => {
                firestoreRoster.push({ id: doc.id, ...doc.data() });
            });

            // 3. Merge & Deduplicate (Firestore takes precedence)
            const combinedMap = new Map();

            // First: Add students from Sheets (History)
            // We use 'rollNumber' as the unique key.
            sheetsData.forEach(record => {
                if (record.rollNumber && !combinedMap.has(record.rollNumber)) {
                    combinedMap.set(record.rollNumber, {
                        id: `sheet-${record.rollNumber}`, // Temporary ID for sheet-only records
                        name: record.name,
                        rollNumber: record.rollNumber,
                        class: record.class,
                        source: 'sheet' // internal flag
                    });
                }
            });

            // Second: Overwrite with Firestore students (Database)
            firestoreRoster.forEach(student => {
                combinedMap.set(student.rollNumber, {
                    ...student,
                    source: 'firestore'
                });
            });

            // Convert back to array and sort by Class then Roll Number
            const combinedRoster = Array.from(combinedMap.values()).sort((a, b) => {
                if (a.class !== b.class) return a.class.localeCompare(b.class);
                return a.rollNumber.localeCompare(b.rollNumber);
            });

            setRoster(combinedRoster);

        } catch (error) {
            console.error("Error loading data:", error);
            alert("Failed to load dashboard data.");
        }
        setLoading(false);
    };

    // Derived State: Unique Classes
    const uniqueClasses = useMemo(() => {
        const rosterClasses = roster.map(r => r.class);
        const historyClasses = attendance.map(a => a.class);
        return [...new Set([...rosterClasses, ...historyClasses])].filter(c => c).sort();
    }, [roster, attendance]);

    // Derived State: Filtered Roster for "Take Attendance"
    const filteredRoster = useMemo(() => {
        if (!selectedClass) return [];
        return roster.filter(student => student.class === selectedClass);
    }, [roster, selectedClass]);

    // Derived State: Filtered History
    const filteredHistory = useMemo(() => {
        return attendance.filter(record => {
            const dateObj = new Date(selectedDate);
            const formattedInputDate = formatDateDDMMYYYY(dateObj);

            const dateMatch = selectedDate ? record.date === formattedInputDate : true;
            const classMatch = selectedClass ? record.class === selectedClass : true;
            return dateMatch && classMatch;
        });
    }, [attendance, selectedDate, selectedClass]);


    // Derived State: Check if attendance is already marked for selected class/date
    const isAttendanceMarked = useMemo(() => {
        if (!selectedClass || !selectedDate || !attendance.length) return false;
        const dateObj = new Date(selectedDate);
        const formattedInputDate = formatDateDDMMYYYY(dateObj);

        return attendance.some(record =>
            record.class === selectedClass &&
            record.date === formattedInputDate
        );
    }, [attendance, selectedClass, selectedDate]);

    // Handlers
    const handleLogout = () => auth.signOut();

    // Roster Management
    const openAddStudentModal = () => {
        setIsEditing(false);
        setRosterForm({ name: '', rollNumber: '', class: selectedClass || '' });
        setShowRosterModal(true);
    };

    const openEditStudentModal = (student) => {
        setIsEditing(true);
        setCurrentStudentId(student.id);
        setRosterForm({ name: student.name, rollNumber: student.rollNumber, class: student.class });
        setShowRosterModal(true);
    };

    const handleRosterSubmit = async (e) => {
        e.preventDefault();
        try {
            if (isEditing && currentStudentId) {
                // Update existing
                const docRef = doc(db, "roster_students", currentStudentId);
                await updateDoc(docRef, rosterForm);
                alert("Student updated!");
            } else {
                // Add new
                await addDoc(collection(db, "roster_students"), rosterForm);
                alert("Student added to roster!");
            }
            setShowRosterModal(false);
            setRosterForm({ name: '', rollNumber: '', class: '' });
            setRefreshTrigger(p => p + 1);
        } catch (error) {
            console.error(error);
            alert("Operation failed.");
        }
    };

    const handleDeleteStudent = async (id) => {
        if (window.confirm("Delete this student from roster?")) {
            try {
                await deleteDoc(doc(db, "roster_students", id));
                setRefreshTrigger(p => p + 1);
            } catch (error) {
                console.error(error);
            }
        }
    };

    const handleDeleteClass = async () => {
        if (!selectedClass) return;
        if (window.confirm(`ARE YOU SURE? This will delete ALL students in "${selectedClass}" from the roster. This cannot be undone.`)) {
            try {
                const studentsToDelete = roster.filter(s => s.class === selectedClass);
                const batch = writeBatch(db);
                studentsToDelete.forEach(s => {
                    const docRef = doc(db, "roster_students", s.id);
                    batch.delete(docRef);
                });
                await batch.commit();
                alert(`Class ${selectedClass} deleted.`);
                setSelectedClass("");
                setRefreshTrigger(p => p + 1);
            } catch (error) {
                console.error(error);
                alert("Failed to delete class.");
            }
        }
    };

    // Attendance Marking
    const toggleAttendance = (rollNumber) => {
        setAttendanceState(prev => ({
            ...prev,
            [rollNumber]: !prev[rollNumber]
        }));
    };

    // Helper: Format Time Readable
    const formatTimeReadable = (timeStr) => {
        if (!timeStr) return "--:--";

        // Case 1: Handle ISO Date Strings (e.g. from Sheets JSON)
        if (timeStr.includes('T') || timeStr.includes('-')) {
            const d = new Date(timeStr);
            if (!isNaN(d.getTime())) {
                return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
            }
        }

        // Case 2: Already 12-hour format
        if (/AM|PM/i.test(timeStr)) return timeStr;

        // Case 3: Simple 24-hour HH:mm string
        const parts = timeStr.split(':');
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

    const submitAttendance = async () => {
        if (!selectedClass) return alert("Select a class first");

        const studentsToMark = filteredRoster.filter(s => attendanceState[s.rollNumber]);

        if (studentsToMark.length === 0) {
            if (!window.confirm("No students marked present. Submit anyway?")) return;
        }

        if (!window.confirm(`Marking ${studentsToMark.length} students as Present for ${selectedClass}?`)) return;

        setLoading(true);
        const dateObj = new Date(selectedDate);
        const formattedDate = formatDateDDMMYYYY(dateObj);
        // FORCE 12-Hour Format: 11:30 PM
        const time = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

        const promises = studentsToMark.map(student => {
            return addAttendance({
                date: formattedDate,
                time: time,
                rollNumber: student.rollNumber,
                name: student.name,
                class: student.class
            });
        });

        await Promise.all(promises);
        setLoading(false);
        // Standardize reset without alert (same as bulk action philosophy)
        alert("Attendance submitted successfully!");
        setAttendanceState({});
        setRefreshTrigger(p => p + 1);
        setActiveTab('history');
    };


    if (authLoading) return <div className="flex items-center justify-center h-screen bg-gray-900 text-blue-400 font-bold loading-pulse">Loading...</div>;
    if (!user || role !== 'teacher') return <div className="min-h-screen flex items-center justify-center text-red-400 font-bold bg-gray-900">Access Denied.</div>;


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
                        <div className="bg-blue-600 text-white p-2 rounded-lg shadow-lg">
                            <FaUniversity size={24} />
                        </div>
                        <h1 className="text-xl font-extrabold text-white tracking-tight">
                            EduTrack
                        </h1>
                        <span className="text-xs bg-white/10 text-gray-300 px-2 py-0.5 rounded border border-white/10 uppercase font-bold tracking-wider">Teacher</span>
                        {isMobile && (
                            <button onClick={() => setIsSidebarOpen(false)} className="ml-auto text-gray-400 hover:text-white">
                                <FaTimes />
                            </button>
                        )}
                    </div>

                    {/* Navigation */}
                    <nav className="p-4 space-y-2 mt-4">
                        <div className="px-4 pb-2 text-xs font-bold text-gray-500 uppercase tracking-wider">Classroom</div>

                        <button
                            onClick={() => { setActiveTab('take-attendance'); if (isMobile) setIsSidebarOpen(false); }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'take-attendance'
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                                : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                }`}
                        >
                            <FaCheck size={18} /> Take Attendance
                        </button>

                        <button
                            onClick={() => { setActiveTab('roster'); if (isMobile) setIsSidebarOpen(false); }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'roster'
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                                : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                }`}
                        >
                            <FaUsers size={18} /> Manage Roster
                        </button>

                        <button
                            onClick={() => { setActiveTab('history'); if (isMobile) setIsSidebarOpen(false); }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'history'
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                                : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                }`}
                        >
                            <FaHistory size={18} /> History
                        </button>
                    </nav>
                </div>

                {/* Bottom Section */}
                <div className="p-4 border-t border-white/10 bg-black/20">
                    <div className="mb-4 bg-white/5 p-3 rounded-xl border border-white/10">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
                                <FaChalkboardTeacher />
                            </div>
                            <div className="overflow-hidden">
                                <p className="text-sm font-bold text-white truncate">Teacher</p>
                                <p className="text-xs text-gray-400 truncate">{user?.email}</p>
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
                    className="fixed inset-0 bg-black/60 z-10 backdrop-blur-sm"
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
                        <h2 className="text-xl font-bold text-white capitalize">
                            {activeTab === 'take-attendance' && "Take Attendance"}
                            {activeTab === 'roster' && "Manage Class Roster"}
                            {activeTab === 'history' && "Attendance History"}
                        </h2>
                    </div>
                </header>

                <div className="flex-1 overflow-auto p-4 md:p-8">
                    <div className="max-w-6xl mx-auto">

                        {/* Common Filters */}
                        {(activeTab === 'take-attendance' || activeTab === 'history') && (
                            <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/10 mb-6 flex flex-wrap items-end gap-6 animate-fadeIn">
                                <div className="flex-1 min-w-[200px]">
                                    <label className="block text-sm font-bold text-gray-300 mb-2">Date</label>
                                    <input
                                        type="date"
                                        value={selectedDate}
                                        onChange={(e) => setSelectedDate(e.target.value)}
                                        className="w-full px-4 py-2 bg-gray-900/50 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    />
                                </div>
                                <div className="flex-1 min-w-[200px]">
                                    <label className="block text-sm font-bold text-gray-300 mb-2">Select Class</label>
                                    <div className="relative">
                                        <select
                                            value={selectedClass}
                                            onChange={(e) => setSelectedClass(e.target.value)}
                                            className="w-full px-4 py-2 bg-gray-900/50 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all appearance-none cursor-pointer"
                                        >
                                            <option value="">-- Choose --</option>
                                            {uniqueClasses.map((cls, idx) => (
                                                <option key={idx} value={cls}>{cls}</option>
                                            ))}
                                        </select>
                                        <FaSearch className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* --- TAB: TAKE ATTENDANCE --- */}
                        {activeTab === 'take-attendance' && (
                            <div className="animate-fadeIn">
                                {isAttendanceMarked && (
                                    <div className="mb-6 bg-yellow-500/10 border border-yellow-500/20 text-yellow-200 p-4 rounded-xl flex items-center gap-3 animate-pulse">
                                        <div className="bg-yellow-500/20 p-2 rounded-full">
                                            <FaCalendarCheck size={20} className="text-yellow-400" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm">Attendance Already Marked!</p>
                                            <p className="text-xs text-yellow-200/70">Records exist for {selectedClass} on this date. Submitting again will add duplicates or update timestamps.</p>
                                        </div>
                                    </div>
                                )}

                                {!selectedClass ? (
                                    <div className="text-center py-20 bg-white/5 backdrop-blur-md rounded-2xl border border-dashed border-white/20">
                                        <FaChalkboardTeacher className="mx-auto text-gray-500 text-6xl mb-4" />
                                        <p className="text-gray-400 text-lg font-medium">Please select a class above to start marking attendance.</p>
                                    </div>


                                ) : filteredRoster.length === 0 ? (
                                    <div className="text-center py-20 bg-white/5 backdrop-blur-md rounded-2xl border border-dashed border-white/20">
                                        <FaUsers className="mx-auto text-gray-500 text-6xl mb-4" />
                                        <p className="text-gray-400 text-lg font-medium">No students found in roster for <span className="text-blue-400 font-bold">{selectedClass}</span>.</p>
                                        <button onClick={() => setActiveTab('roster')} className="mt-4 text-blue-400 font-bold hover:underline">Add students to roster &rarr;</button>
                                    </div>
                                ) : (
                                    <>
                                        {/* Bulk Actions */}
                                        <div className="flex flex-wrap gap-3 mb-6 justify-end">
                                            <button
                                                onClick={() => {
                                                    const newState = { ...attendanceState };
                                                    filteredRoster.forEach(s => newState[s.rollNumber] = true);
                                                    setAttendanceState(newState);
                                                }}
                                                className="px-4 py-2 bg-green-600/20 text-green-400 hover:bg-green-600/30 border border-green-600/30 rounded-lg flex items-center gap-2 font-bold text-sm transition-all"
                                            >
                                                <FaCheck /> Mark All Present
                                            </button>
                                            <button
                                                onClick={() => {
                                                    const newState = { ...attendanceState };
                                                    filteredRoster.forEach(s => delete newState[s.rollNumber]);
                                                    setAttendanceState(newState);
                                                }}
                                                className="px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 rounded-lg flex items-center gap-2 font-bold text-sm transition-all"
                                            >
                                                <FaTimes /> Unmark All
                                            </button>
                                        </div>

                                        {!dateStatus.allowed && (
                                            <div className="mb-6 bg-red-500/10 border border-red-500/20 text-red-300 p-4 rounded-xl flex items-center gap-3 animate-pulse">
                                                <FaTimes className="text-red-400 text-xl" />
                                                <span className="font-bold">{dateStatus.message}</span>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-24">
                                            {filteredRoster.map(student => {
                                                // Check if already in history (e.g. RFID or previous manual)
                                                const existingRecord = filteredHistory.find(r => r.rollNumber === student.rollNumber);
                                                const isAlreadyMarked = !!existingRecord;

                                                // Check local selection state
                                                const isSelected = !!attendanceState[student.rollNumber];

                                                // Final "Present" visual state is either or
                                                const isPresent = isAlreadyMarked || isSelected;

                                                return (
                                                    <div
                                                        key={student.id}
                                                        onClick={() => {
                                                            if (!dateStatus.allowed) return;
                                                            if (isAlreadyMarked) return; // Prevent toggling if already saved
                                                            toggleAttendance(student.rollNumber);
                                                        }}
                                                        className={`relative p-5 rounded-2xl border transition-all duration-200 group backdrop-blur-sm
                                                ${!dateStatus.allowed || isAlreadyMarked ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}
                                                ${isPresent
                                                                ? 'bg-green-500/20 border-green-500/50 shadow-lg shadow-green-900/20 ring-1 ring-green-500/50'
                                                                : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-blue-500/50 hover:shadow-lg'
                                                            }`}
                                                    >
                                                        <div className="flex justify-between items-start mb-3">
                                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold transition-colors
                                                        ${isPresent ? 'bg-green-500 text-white' : 'bg-gray-800 text-gray-500 group-hover:bg-blue-500/20 group-hover:text-blue-400'}`}>
                                                                {isPresent ? <FaCheck /> : <FaTimes />}
                                                            </div>
                                                            <span className="text-xs font-mono text-gray-400 bg-black/20 px-2 py-1 rounded-md border border-white/5">
                                                                {student.rollNumber}
                                                            </span>
                                                        </div>
                                                        <h4 className={`font-bold text-lg mb-1 ${isPresent ? 'text-green-400' : 'text-gray-200'}`}>{student.name}</h4>

                                                        {/* Status Message */}
                                                        <div className="min-h-[20px]">
                                                            {isAlreadyMarked ? (
                                                                <p className="text-xs font-bold text-yellow-300 flex items-center gap-1">
                                                                    <FaUniversity size={10} /> Saved: {formatTimeReadable(existingRecord.time)}
                                                                </p>
                                                            ) : isSelected ? (
                                                                <p className="text-xs font-medium text-green-300/80">Marked to Submit</p>
                                                            ) : (
                                                                <p className="text-xs font-medium text-gray-500">Absent</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Floating Action Button for Submit */}
                                        <div className="fixed bottom-8 left-0 right-0 max-w-6xl mx-auto px-4 pointer-events-none flex justify-center z-20">
                                            <button
                                                onClick={submitAttendance}
                                                disabled={loading || !dateStatus.allowed}
                                                className="pointer-events-auto bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-full shadow-2xl flex items-center gap-3 font-bold text-lg transition-all transform hover:-translate-y-1 active:scale-95 disabled:opacity-50 disabled:grayscale disabled:translate-y-0 shadow-blue-900/50 ring-2 ring-blue-400/50 ring-offset-2 ring-offset-gray-900"
                                            >
                                                {loading ? (
                                                    <span>Saving...</span>
                                                ) : (
                                                    <>
                                                        <FaCheck /> Submit Attendance ({Object.keys(attendanceState).filter(k => attendanceState[k]).length})
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* --- TAB: ROSTER --- */}
                        {activeTab === 'roster' && (
                            <div className="animate-fadeIn">
                                <div className="mb-6 flex flex-wrap justify-between items-end gap-4">
                                    <div className="flex gap-4 items-end flex-wrap">
                                        <div className="min-w-[200px]">
                                            <label className="block text-sm font-bold text-gray-300 mb-2">Filter by Class</label>
                                            <select
                                                value={selectedClass}
                                                onChange={(e) => setSelectedClass(e.target.value)}
                                                className="w-full px-4 py-2 bg-gray-900/50 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                            >
                                                <option value="">All Classes</option>
                                                {uniqueClasses.map((cls, idx) => (
                                                    <option key={idx} value={cls}>{cls}</option>
                                                ))}
                                            </select>
                                        </div>
                                        {selectedClass && (
                                            <button
                                                onClick={handleDeleteClass}
                                                className="bg-red-500/10 text-red-400 px-4 py-2 rounded-lg hover:bg-red-500/20 border border-red-500/20 flex items-center gap-2 transition-colors mb-0.5"
                                            >
                                                <FaEraser /> Delete Class
                                            </button>
                                        )}
                                    </div>
                                    <button
                                        onClick={openAddStudentModal}
                                        className="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-500 shadow-lg shadow-blue-600/30 flex items-center gap-2 font-bold transition-transform hover:-translate-y-0.5"
                                    >
                                        <FaPlus /> Add Student
                                    </button>
                                </div>

                                <div className="hidden md:block bg-white/10 backdrop-blur-md rounded-xl shadow-lg border border-white/10 overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-white/10 text-gray-400 text-sm uppercase tracking-wider bg-white/5">
                                                <th className="p-4 font-semibold">Roll No</th>
                                                <th className="p-4 font-semibold">Name</th>
                                                <th className="p-4 font-semibold">Class</th>
                                                <th className="p-4 font-semibold w-32">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {((selectedClass ? filteredRoster : roster).length === 0) ? (
                                                <tr><td colSpan="4" className="p-8 text-center text-gray-500">Roster is empty.</td></tr>
                                            ) : (
                                                (selectedClass ? filteredRoster : roster).map(student => (
                                                    <tr key={student.id} className="hover:bg-white/5 transition-colors">
                                                        <td className="p-4 font-mono font-medium text-gray-300">{student.rollNumber}</td>
                                                        <td className="p-4 font-bold text-white">{student.name}</td>
                                                        <td className="p-4">
                                                            <span className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded-md text-xs font-bold ring-1 ring-blue-400/30">{student.class}</span>
                                                        </td>
                                                        <td className="p-4 flex gap-2">
                                                            <button onClick={() => openEditStudentModal(student)} className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors" title="Edit">
                                                                <FaEdit />
                                                            </button>
                                                            <button onClick={() => handleDeleteStudent(student.id)} className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors" title="Delete">
                                                                <FaTrash />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile Card View */}
                                <div className="md:hidden space-y-3">
                                    {((selectedClass ? filteredRoster : roster).length === 0) ? (
                                        <div className="p-8 text-center text-gray-500 bg-white/5 rounded-xl border border-white/10">Roster is empty.</div>
                                    ) : (
                                        (selectedClass ? filteredRoster : roster).map(student => (
                                            <div key={student.id} className="bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-xl flex items-center justify-between shadow-sm">
                                                <div>
                                                    <h4 className="font-bold text-white text-lg">{student.name}</h4>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-xs font-mono text-gray-400 bg-black/20 px-2 py-0.5 rounded">{student.rollNumber}</span>
                                                        <span className="text-xs font-bold text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">{student.class}</span>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => openEditStudentModal(student)}
                                                        className="p-3 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors"
                                                    >
                                                        <FaEdit size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteStudent(student.id)}
                                                        className="p-3 text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors"
                                                    >
                                                        <FaTrash size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}

                        {/* --- TAB: HISTORY --- */}
                        {activeTab === 'history' && (
                            <div className="animate-fadeIn">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                                    <div className="bg-white/10 backdrop-blur-md p-6 rounded-xl border border-white/10 flex items-center justify-between">
                                        <div>
                                            <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider">Filtered Present</h3>
                                            <p className="text-3xl font-extrabold text-white mt-2">{filteredHistory.length}</p>
                                        </div>
                                        <div className="bg-green-500/20 p-3 rounded-lg text-green-400">
                                            <FaCheck size={24} />
                                        </div>
                                    </div>
                                </div>
                                <div className="hidden md:block bg-white/10 backdrop-blur-md rounded-xl shadow-lg border border-white/10 overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-white/10 text-gray-400 text-sm uppercase tracking-wider bg-white/5">
                                                <th className="p-4 font-semibold">Date</th>
                                                <th className="p-4 font-semibold">Time</th>
                                                <th className="p-4 font-semibold">Roll No</th>
                                                <th className="p-4 font-semibold">Name</th>
                                                <th className="p-4 font-semibold">Class</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {filteredHistory.length === 0 ? (
                                                <tr><td colSpan="5" className="p-8 text-center text-gray-500">No records found.</td></tr>
                                            ) : (
                                                filteredHistory.map((record, index) => (
                                                    <tr key={index} className="hover:bg-white/5 transition-colors">
                                                        <td className="p-4 font-medium text-white">{record.date}</td>
                                                        <td className="p-4 text-gray-400 text-xs font-mono">{formatTimeReadable(record.time)}</td>
                                                        <td className="p-4 font-mono text-gray-300">{record.rollNumber}</td>
                                                        <td className="p-4 text-white">{record.name}</td>
                                                        <td className="p-4 text-gray-300">{record.class}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile Card View */}
                                <div className="md:hidden space-y-3">
                                    {filteredHistory.length === 0 ? (
                                        <div className="p-8 text-center text-gray-500 bg-white/5 rounded-xl border border-white/10">No records found.</div>
                                    ) : (
                                        filteredHistory.map((record, index) => (
                                            <div key={index} className="bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-xl flex flex-col gap-2 shadow-sm">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h4 className="font-bold text-white text-lg">{record.name}</h4>
                                                        <span className="text-xs font-mono text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">{record.rollNumber}</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-gray-400 text-xs font-bold uppercase tracking-wider">{record.date}</div>
                                                        <div className="text-white font-mono text-sm">{formatTimeReadable(record.time)}</div>
                                                    </div>
                                                </div>
                                                <div className="mt-1 pt-2 border-t border-white/5 flex justify-between items-center">
                                                    <span className="text-xs text-gray-500 uppercase font-bold">Class</span>
                                                    <span className="text-sm text-gray-300 bg-white/5 px-2 py-1 rounded">{record.class}</span>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </main >

            {/* Add/Edit Student Modal (Roster) */}
            {
                showRosterModal && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
                        <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-md p-6 transform transition-all">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-white">{isEditing ? "Edit Student" : "Add Student to Roster"}</h2>
                                <button onClick={() => setShowRosterModal(false)} className="text-gray-400 hover:text-white transition-colors">
                                    <FaTimes size={20} />
                                </button>
                            </div>
                            <form onSubmit={handleRosterSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-300 mb-2">Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={rosterForm.name}
                                        onChange={e => setRosterForm({ ...rosterForm, name: e.target.value })}
                                        className="w-full px-4 py-2 bg-gray-900/50 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                        placeholder="Full Name"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-300 mb-2">Roll Number</label>
                                    <input
                                        type="text"
                                        required
                                        value={rosterForm.rollNumber}
                                        onChange={e => setRosterForm({ ...rosterForm, rollNumber: e.target.value })}
                                        className="w-full px-4 py-2 bg-gray-900/50 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                        placeholder="e.g. CS-101"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-300 mb-2">Class</label>
                                    <input
                                        type="text"
                                        required
                                        value={rosterForm.class}
                                        onChange={e => setRosterForm({ ...rosterForm, class: e.target.value })}
                                        className="w-full px-4 py-2 bg-gray-900/50 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                        placeholder="e.g. BSCS 3-B"
                                    />
                                </div>
                                <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-gray-700">
                                    <button
                                        type="button"
                                        onClick={() => setShowRosterModal(false)}
                                        className="px-4 py-2 rounded-lg text-gray-400 hover:bg-gray-700 font-medium transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 font-bold shadow-lg shadow-blue-600/20 transition-all"
                                    >
                                        {isEditing ? "Update Student" : "Add to Roster"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default TeacherDashboard;
