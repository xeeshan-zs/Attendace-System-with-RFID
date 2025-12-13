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
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

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
            if (window.innerWidth < 768) setIsSidebarOpen(false);
            else setIsSidebarOpen(true);
        };
        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const loadInitialData = async () => {
        setLoading(true);
        // Load Sheets Data
        const sheetsData = await fetchAttendance();
        setAttendance(sheetsData);

        // Load Roster Data
        try {
            const q = query(collection(db, "roster_students"));
            const querySnapshot = await getDocs(q);
            const loadedRoster = [];
            querySnapshot.forEach((doc) => {
                loadedRoster.push({ id: doc.id, ...doc.data() });
            });
            setRoster(loadedRoster);
        } catch (error) {
            console.error("Error loading roster:", error);
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
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

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
        alert("Attendance submitted successfully!");
        setAttendanceState({});
        setRefreshTrigger(p => p + 1);
        setActiveTab('history');
    };


    if (authLoading) return <div className="flex items-center justify-center h-screen text-blue-600 font-bold loading-pulse">Loading...</div>;
    if (!user || role !== 'teacher') return <div className="min-h-screen flex items-center justify-center text-red-600 font-bold bg-gray-50">Access Denied.</div>;


    return (
        <div className="flex h-screen bg-gray-50 text-gray-800 overflow-hidden font-sans">
            {/* Sidebar */}
            <aside
                className={`fixed md:relative z-20 bg-white h-full w-72 shadow-xl transform transition-transform duration-300 ease-in-out flex flex-col justify-between 
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0 md:w-72'}`}
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
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded border border-gray-200 uppercase font-bold tracking-wider">Teacher</span>
                    </div>

                    {/* Navigation */}
                    <nav className="p-4 space-y-2 mt-4">
                        <div className="px-4 pb-2 text-xs font-bold text-gray-400 uppercase tracking-wider">Classroom</div>

                        <button
                            onClick={() => setActiveTab('take-attendance')}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'take-attendance'
                                ? 'bg-blue-50 text-blue-600 shadow-sm ring-1 ring-blue-100'
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                }`}
                        >
                            <FaCheck size={18} /> Take Attendance
                        </button>

                        <button
                            onClick={() => setActiveTab('roster')}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'roster'
                                ? 'bg-blue-50 text-blue-600 shadow-sm ring-1 ring-blue-100'
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                }`}
                        >
                            <FaUsers size={18} /> Manage Roster
                        </button>

                        <button
                            onClick={() => setActiveTab('history')}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'history'
                                ? 'bg-blue-50 text-blue-600 shadow-sm ring-1 ring-blue-100'
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                }`}
                        >
                            <FaHistory size={18} /> History
                        </button>
                    </nav>
                </div>

                {/* Bottom Section */}
                <div className="p-4 border-t border-gray-100 bg-gray-50/50">
                    <div className="mb-4 bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
                                <FaChalkboardTeacher />
                            </div>
                            <div className="overflow-hidden">
                                <p className="text-sm font-bold text-gray-800 truncate">Teacher</p>
                                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
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

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-full relative w-full overflow-hidden bg-gray-50">
                {/* Header */}
                <header className="bg-white h-16 border-b border-gray-100 flex items-center justify-between px-4 md:px-8 shadow-sm z-10">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg md:hidden"
                        >
                            <FaBars size={20} />
                        </button>
                        <h2 className="text-xl font-bold text-gray-800 capitalize">
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
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6 flex flex-wrap items-end gap-6 animate-fadeIn">
                                <div className="flex-1 min-w-[200px]">
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Date</label>
                                    <input
                                        type="date"
                                        value={selectedDate}
                                        onChange={(e) => setSelectedDate(e.target.value)}
                                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
                                    />
                                </div>
                                <div className="flex-1 min-w-[200px]">
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Select Class</label>
                                    <div className="relative">
                                        <select
                                            value={selectedClass}
                                            onChange={(e) => setSelectedClass(e.target.value)}
                                            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all appearance-none cursor-pointer"
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
                                {!selectedClass ? (
                                    <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
                                        <FaChalkboardTeacher className="mx-auto text-gray-300 text-6xl mb-4" />
                                        <p className="text-gray-500 text-lg font-medium">Please select a class above to start marking attendance.</p>
                                    </div>
                                ) : filteredRoster.length === 0 ? (
                                    <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
                                        <FaUsers className="mx-auto text-gray-300 text-6xl mb-4" />
                                        <p className="text-gray-500 text-lg font-medium">No students found in roster for <span className="text-blue-600 font-bold">{selectedClass}</span>.</p>
                                        <button onClick={() => setActiveTab('roster')} className="mt-4 text-blue-600 font-bold hover:underline">Add students to roster &rarr;</button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-24">
                                            {filteredRoster.map(student => {
                                                const isPresent = !!attendanceState[student.rollNumber];
                                                return (
                                                    <div
                                                        key={student.id}
                                                        onClick={() => toggleAttendance(student.rollNumber)}
                                                        className={`relative p-5 rounded-2xl border cursor-pointer transition-all duration-200 group
                                                        ${isPresent
                                                                ? 'bg-green-50 border-green-200 shadow-green-100 ring-2 ring-green-500 ring-offset-2'
                                                                : 'bg-white border-gray-200 hover:shadow-lg hover:border-blue-300'
                                                            }`}
                                                    >
                                                        <div className="flex justify-between items-start mb-3">
                                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold transition-colors
                                                                ${isPresent ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-500'}`}>
                                                                {isPresent ? <FaCheck /> : <FaTimes />}
                                                            </div>
                                                            <span className="text-xs font-mono text-gray-400 bg-gray-50 px-2 py-1 rounded-md border border-gray-100">
                                                                {student.rollNumber}
                                                            </span>
                                                        </div>
                                                        <h4 className={`font-bold text-lg mb-1 ${isPresent ? 'text-green-800' : 'text-gray-800'}`}>{student.name}</h4>
                                                        <p className={`text-xs font-medium ${isPresent ? 'text-green-600' : 'text-gray-400'}`}>
                                                            {isPresent ? 'Marked Present' : 'Marked Absent'}
                                                        </p>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Floating Action Button for Submit */}
                                        <div className="fixed bottom-8 left-0 right-0 max-w-6xl mx-auto px-4 pointer-events-none flex justify-center z-20">
                                            <button
                                                onClick={submitAttendance}
                                                disabled={loading}
                                                className="pointer-events-auto bg-gray-900 hover:bg-black text-white px-8 py-4 rounded-full shadow-2xl flex items-center gap-3 font-bold text-lg transition-all transform hover:-translate-y-1 active:scale-95 disabled:opacity-70 disabled:translate-y-0"
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
                                            <label className="block text-sm font-bold text-gray-700 mb-2">Filter by Class</label>
                                            <select
                                                value={selectedClass}
                                                onChange={(e) => setSelectedClass(e.target.value)}
                                                className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none"
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
                                                className="bg-red-50 text-red-600 px-4 py-2 rounded-lg hover:bg-red-100 border border-red-100 flex items-center gap-2 transition-colors mb-0.5"
                                            >
                                                <FaEraser /> Delete Class
                                            </button>
                                        )}
                                    </div>
                                    <button
                                        onClick={openAddStudentModal}
                                        className="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-600/20 flex items-center gap-2 font-bold transition-transform hover:-translate-y-0.5"
                                    >
                                        <FaPlus /> Add Student
                                    </button>
                                </div>

                                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-sm uppercase tracking-wider">
                                                <th className="p-4 font-semibold">Roll No</th>
                                                <th className="p-4 font-semibold">Name</th>
                                                <th className="p-4 font-semibold">Class</th>
                                                <th className="p-4 font-semibold w-32">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {((selectedClass ? filteredRoster : roster).length === 0) ? (
                                                <tr><td colSpan="4" className="p-8 text-center text-gray-500">Roster is empty.</td></tr>
                                            ) : (
                                                (selectedClass ? filteredRoster : roster).map(student => (
                                                    <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                                                        <td className="p-4 font-mono font-medium text-gray-600">{student.rollNumber}</td>
                                                        <td className="p-4 font-bold text-gray-800">{student.name}</td>
                                                        <td className="p-4">
                                                            <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-md text-xs font-bold ring-1 ring-blue-100/50">{student.class}</span>
                                                        </td>
                                                        <td className="p-4 flex gap-2">
                                                            <button onClick={() => openEditStudentModal(student)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                                                                <FaEdit />
                                                            </button>
                                                            <button onClick={() => handleDeleteStudent(student.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                                                                <FaTrash />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* --- TAB: HISTORY --- */}
                        {activeTab === 'history' && (
                            <div className="animate-fadeIn">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                                        <div>
                                            <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider">Total Present</h3>
                                            <p className="text-3xl font-extrabold text-gray-800 mt-2">{filteredHistory.length}</p>
                                        </div>
                                        <div className="bg-green-50 p-3 rounded-lg text-green-600">
                                            <FaCheck size={24} />
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-sm uppercase tracking-wider">
                                                <th className="p-4 font-semibold">Date</th>
                                                <th className="p-4 font-semibold">Time</th>
                                                <th className="p-4 font-semibold">Roll No</th>
                                                <th className="p-4 font-semibold">Name</th>
                                                <th className="p-4 font-semibold">Class</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {filteredHistory.length === 0 ? (
                                                <tr><td colSpan="5" className="p-8 text-center text-gray-500">No records found.</td></tr>
                                            ) : (
                                                filteredHistory.map((record, index) => (
                                                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                                                        <td className="p-4 font-medium text-gray-800">{record.date}</td>
                                                        <td className="p-4 text-gray-500 text-xs font-mono">{record.time}</td>
                                                        <td className="p-4 font-mono text-gray-600">{record.rollNumber}</td>
                                                        <td className="p-4 text-gray-800">{record.name}</td>
                                                        <td className="p-4 text-gray-600">{record.class}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </main>

            {/* Add/Edit Student Modal (Roster) */}
            {showRosterModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 transform transition-all">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-gray-800">{isEditing ? "Edit Student" : "Add Student to Roster"}</h2>
                            <button onClick={() => setShowRosterModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                <FaTimes size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleRosterSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Name</label>
                                <input
                                    type="text"
                                    required
                                    value={rosterForm.name}
                                    onChange={e => setRosterForm({ ...rosterForm, name: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none"
                                    placeholder="Full Name"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Roll Number</label>
                                <input
                                    type="text"
                                    required
                                    value={rosterForm.rollNumber}
                                    onChange={e => setRosterForm({ ...rosterForm, rollNumber: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none"
                                    placeholder="e.g. CS-101"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Class</label>
                                <input
                                    type="text"
                                    required
                                    value={rosterForm.class}
                                    onChange={e => setRosterForm({ ...rosterForm, class: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none"
                                    placeholder="e.g. BSCS 3-B"
                                />
                            </div>
                            <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-gray-50">
                                <button
                                    type="button"
                                    onClick={() => setShowRosterModal(false)}
                                    className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold shadow-lg shadow-blue-600/20 transition-all"
                                >
                                    {isEditing ? "Update Student" : "Add to Roster"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeacherDashboard;
