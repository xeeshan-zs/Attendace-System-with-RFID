import React, { useState, useEffect, useMemo } from 'react';
import { fetchAttendance, addAttendance, deleteAttendance, formatDateDDMMYYYY } from '../../services/sheetsApi';
import { useAuth } from '../../hooks/useAuth';
import './TeacherDashboard.css';
import { FaTrash, FaPlus, FaChalkboardTeacher, FaSignOutAlt, FaCalendarCheck, FaUsers, FaHistory, FaCheck, FaTimes, FaEdit, FaEraser } from 'react-icons/fa';
import { auth, db } from '../../firebase';
import { collection, addDoc, getDocs, query, where, deleteDoc, doc, updateDoc, writeBatch } from 'firebase/firestore';

const TeacherDashboard = () => {
    const { user, role, loading: authLoading } = useAuth();

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
            // Record.date is already normalized to DD-MM-YYYY by sheetsApi.js
            // selectedDate is YYYY-MM-DD (from input).
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


    if (authLoading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
    if (!user || role !== 'teacher') return <div className="access-denied">Access Denied.</div>;


    return (
        <div className="dashboard-container">
            {/* Sidebar */}
            <aside className="sidebar">
                <div className="sidebar-header">
                    <FaChalkboardTeacher />
                    <span>Teacher Panel</span>
                </div>
                <nav className="sidebar-nav">
                    <div className={`nav-item ${activeTab === 'take-attendance' ? 'active' : ''}`} onClick={() => setActiveTab('take-attendance')}>
                        <FaCheck />
                        <span>Take Attendance</span>
                    </div>
                    <div className={`nav-item ${activeTab === 'roster' ? 'active' : ''}`} onClick={() => setActiveTab('roster')}>
                        <FaUsers />
                        <span>Manage Roster</span>
                    </div>
                    <div className={`nav-item ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
                        <FaHistory />
                        <span>Attendance History</span>
                    </div>
                </nav>
                <div className="p-4 border-t border-slate-700">
                    <div className="nav-item" onClick={handleLogout}>
                        <FaSignOutAlt />
                        <span>Logout</span>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="main-content">
                <header className="top-bar">
                    <h1 className="text-xl font-bold text-gray-800">
                        {activeTab === 'take-attendance' && "Take Attendance"}
                        {activeTab === 'roster' && "Manage Class Roster"}
                        {activeTab === 'history' && "Attendance History"}
                    </h1>
                    <div className="text-sm text-gray-600">{user.email}</div>
                </header>

                <div className="content-area">
                    {/* Common Filters for Take Attendance & History */}
                    {(activeTab === 'take-attendance' || activeTab === 'history') && (
                        <div className="class-selector">
                            <div className="flex-1">
                                <label className="form-label">Date</label>
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="form-input"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="form-label">Select Class</label>
                                <select
                                    value={selectedClass}
                                    onChange={(e) => setSelectedClass(e.target.value)}
                                    className="form-input"
                                >
                                    <option value="">-- Select Class --</option>
                                    {uniqueClasses.map((cls, idx) => (
                                        <option key={idx} value={cls}>{cls}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    {/* --- TAB: TAKE ATTENDANCE --- */}
                    {activeTab === 'take-attendance' && (
                        <div>
                            {!selectedClass ? (
                                <div className="text-center py-10 text-gray-500">Please select a class to mark attendance.</div>
                            ) : filteredRoster.length === 0 ? (
                                <div className="text-center py-10 text-gray-500">
                                    No students found in roster for {selectedClass}.
                                    <button onClick={() => setActiveTab('roster')} className="text-blue-600 underline ml-2">Add students</button>
                                </div>
                            ) : (
                                <>
                                    <div className="student-list-grid mb-8">
                                        {filteredRoster.map(student => {
                                            const isPresent = !!attendanceState[student.rollNumber];
                                            return (
                                                <div
                                                    key={student.id}
                                                    onClick={() => toggleAttendance(student.rollNumber)}
                                                    className={`student-card cursor-pointer ${isPresent ? 'present' : 'absent'}`}
                                                >
                                                    <div>
                                                        <h4 className="font-bold text-gray-800">{student.name}</h4>
                                                        <p className="text-sm text-gray-500">{student.rollNumber}</p>
                                                    </div>
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isPresent ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
                                                        {isPresent ? <FaCheck /> : <FaTimes />}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="sticky bottom-4 flex justify-center">
                                        <button
                                            onClick={submitAttendance}
                                            disabled={loading}
                                            className="btn-success w-full max-w-md shadow-2xl"
                                        >
                                            {loading ? "Submitting..." : `Submit Attendance for ${Object.keys(attendanceState).filter(k => attendanceState[k]).length} Students`}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* --- TAB: ROSTER --- */}
                    {activeTab === 'roster' && (
                        <div>
                            <div className="mb-6 flex flex-wrap justify-between items-end gap-4">
                                <div className="flex gap-4 items-end">
                                    <div>
                                        <label className="form-label">Filter by Class</label>
                                        <select
                                            value={selectedClass}
                                            onChange={(e) => setSelectedClass(e.target.value)}
                                            className="form-input w-48"
                                        >
                                            <option value="">All Classes</option>
                                            {uniqueClasses.map((cls, idx) => (
                                                <option key={idx} value={cls}>{cls}</option>
                                            ))}
                                        </select>
                                    </div>
                                    {selectedClass && (
                                        <button onClick={handleDeleteClass} className="bg-red-100 text-red-600 px-4 py-2 rounded-lg hover:bg-red-200 flex items-center gap-2 mb-0.5">
                                            <FaEraser /> Delete Class "{selectedClass}"
                                        </button>
                                    )}
                                </div>
                                <button onClick={openAddStudentModal} className="btn-primary">
                                    <FaPlus /> Add Student
                                </button>
                            </div>

                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="table-header">
                                        <tr>
                                            <th className="table-th">Roll No</th>
                                            <th className="table-th">Name</th>
                                            <th className="table-th">Class</th>
                                            <th className="table-th">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {((selectedClass ? filteredRoster : roster).length === 0) ? (
                                            <tr><td colSpan="4" className="text-center py-8">Roster is empty.</td></tr>
                                        ) : (
                                            (selectedClass ? filteredRoster : roster).map(student => (
                                                <tr key={student.id} className="table-row">
                                                    <td className="table-td font-bold">{student.rollNumber}</td>
                                                    <td className="table-td">{student.name}</td>
                                                    <td className="table-td">
                                                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-md text-xs font-bold">{student.class}</span>
                                                    </td>
                                                    <td className="table-td flex gap-2">
                                                        <button onClick={() => openEditStudentModal(student)} className="text-blue-500 hover:text-blue-700 p-1" title="Edit">
                                                            <FaEdit />
                                                        </button>
                                                        <button onClick={() => handleDeleteStudent(student.id)} className="text-red-500 hover:text-red-700 p-1" title="Delete">
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
                        <div>
                            <div className="stats-grid">
                                <div className="stat-card">
                                    <h3 className="text-gray-500 text-sm font-medium">Filtered Present</h3>
                                    <p className="text-3xl font-bold text-blue-600 mt-2">{filteredHistory.length}</p>
                                </div>
                            </div>
                            <div className="data-table-container">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="table-header">
                                        <tr>
                                            <th className="table-th">Date</th>
                                            <th className="table-th">Time</th>
                                            <th className="table-th">Roll No</th>
                                            <th className="table-th">Name</th>
                                            <th className="table-th">Class</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {filteredHistory.length === 0 ? (
                                            <tr><td colSpan="5" className="text-center py-8">No records found.</td></tr>
                                        ) : (
                                            filteredHistory.map((record, index) => (
                                                <tr key={index} className="table-row">
                                                    <td className="table-td">{record.date}</td>
                                                    <td className="table-td text-gray-500 text-xs">{record.time}</td>
                                                    <td className="table-td font-medium">{record.rollNumber}</td>
                                                    <td className="table-td">{record.name}</td>
                                                    <td className="table-td">{record.class}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                </div>
            </main>

            {/* Add/Edit Student Modal (Roster) */}
            {showRosterModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2 className="text-xl font-bold mb-4">{isEditing ? "Edit Student" : "Add Student to Roster"}</h2>
                        <form onSubmit={handleRosterSubmit}>
                            <div className="form-group">
                                <label className="form-label">Name</label>
                                <input type="text" required value={rosterForm.name} onChange={e => setRosterForm({ ...rosterForm, name: e.target.value })} className="form-input" placeholder="Full Name" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Roll Number</label>
                                <input type="text" required value={rosterForm.rollNumber} onChange={e => setRosterForm({ ...rosterForm, rollNumber: e.target.value })} className="form-input" placeholder="e.g. CS-101" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Class</label>
                                <input type="text" required value={rosterForm.class} onChange={e => setRosterForm({ ...rosterForm, class: e.target.value })} className="form-input" placeholder="e.g. BSCS 3-B" />
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={() => setShowRosterModal(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
                                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">{isEditing ? "Update" : "Add to Roster"}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeacherDashboard;
