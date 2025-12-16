import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import './AdminDashboard.css';
import { FaUsers, FaClipboardList, FaSignOutAlt, FaTimes, FaCheck, FaTrash, FaBars, FaChalkboardTeacher, FaUserGraduate, FaUserShield, FaUserPlus, FaSearch, FaUniversity, FaEdit, FaKey } from 'react-icons/fa';
import { auth, db } from '../../firebase';
import { collection, getDocs, query, where, updateDoc, doc, deleteDoc, addDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { sendPasswordResetEmail, getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { initializeApp, deleteApp } from "firebase/app";

const AdminDashboard = () => {
    const { user, role, loading: authLoading } = useAuth();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [activeTab, setActiveTab] = useState('applications'); // applications, create, teachers, students, admins

    // Data State
    const [applications, setApplications] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);

    // Create User Form State
    const [newUser, setNewUser] = useState({
        name: '', email: '', password: '', role: 'student',
        department: '', phone: '', rollNumber: '', className: ''
    });

    // Edit User State
    const [editingUser, setEditingUser] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false);

    // Edit Application State
    const [editingApp, setEditingApp] = useState(null);
    const [showAppEditModal, setShowAppEditModal] = useState(false);

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
        if (role === 'admin') {
            fetchData();
        }
    }, [role, activeTab]);

    const fetchData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'applications') {
                const q = query(collection(db, "applications"), where("status", "==", "pending"));
                const snapshot = await getDocs(q);
                setApplications(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
            } else if (['teachers', 'students', 'admins'].includes(activeTab)) {
                const targetRole = activeTab === 'admins' ? 'admin' : (activeTab === 'teachers' ? 'teacher' : 'student');
                const q = query(collection(db, "users"), where("role", "==", targetRole));
                const snapshot = await getDocs(q);
                setUsers(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
            }
        } catch (error) {
            console.error("Error fetching data:", error);
        }
        setLoading(false);
    };

    const handleLogout = () => auth.signOut();

    const createUserInAuth = async (email, password) => {
        let secondaryApp = null;
        try {
            // Initialize a secondary app with the same config as the main app
            const firebaseConfig = auth.app.options;
            secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
            const secondaryAuth = getAuth(secondaryApp);

            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
            const newUser = userCredential.user;

            await deleteApp(secondaryApp);
            return newUser.uid;
        } catch (error) {
            if (secondaryApp) await deleteApp(secondaryApp);
            throw error;
        }
    };

    const handleApproveApp = async (app) => {
        if (!window.confirm(`Approve application for ${app.name}? This will create a Firestore record linked to a new Auth account.`)) return;
        try {
            // 1. Create Auth User
            const uid = await createUserInAuth(app.email, app.password);

            // 2. Create Firestore Document with UID
            const userData = {
                name: app.name,
                email: app.email,
                role: app.role,
                createdAt: serverTimestamp(),
            };

            if (app.role === 'student') {
                userData.rollNumber = app.rollNumber || '';
                userData.class = app.className || ''; // Note: using 'class' in DB as requested, 'className' in form
            } else {
                userData.department = app.details || '';
            }

            await setDoc(doc(db, "users", uid), userData);

            // 4. If Student, Add to Class Roster (Auto-Enrollment)
            if (app.role === 'student') {
                try {
                    await addDoc(collection(db, "roster_students"), {
                        name: app.name,
                        rollNumber: app.rollNumber,
                        class: app.className,
                        uid: uid
                    });
                } catch (rosterError) {
                    console.error("Error adding to roster:", rosterError);
                    alert("User created, but failed to add to class roster.");
                }
            }

            // 3. Update Application Status
            await updateDoc(doc(db, "applications", app.id), { status: 'approved' });

            alert(`Application Approved!\nUser created with UID: ${uid}`);
            fetchData();
        } catch (error) {
            console.error(error);
            alert("Error approving application: " + error.message);
        }
    };

    const handleRejectApp = async (id) => {
        if (!window.confirm("Reject this application?")) return;
        try {
            await updateDoc(doc(db, "applications", id), { status: 'rejected' });
            fetchData();
        } catch (error) {
            console.error(error);
        }
    };

    const handleDeleteUser = async (id) => {
        if (!window.confirm("Permanently delete this user?")) return;
        try {
            await deleteDoc(doc(db, "users", id));
            fetchData();
        } catch (error) {
            console.error(error);
        }
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        try {
            // 1. Create Auth User
            const uid = await createUserInAuth(newUser.email, newUser.password);

            // 2. Prepare Data
            const userData = {
                name: newUser.name,
                email: newUser.email,
                role: newUser.role,
                createdAt: serverTimestamp(),
            };

            // Add role-specific fields
            if (newUser.role === 'student') {
                userData.class = newUser.className;
                userData.rollNumber = newUser.rollNumber;
            } else {
                userData.department = newUser.department;
                userData.phone = newUser.phone;
            }

            // 3. Write to Firestore
            await setDoc(doc(db, "users", uid), userData);

            alert("User successfully created with login access!");
            setNewUser({ name: '', email: '', password: '', role: 'student', department: '', phone: '', rollNumber: '', className: '' });
        } catch (error) {
            console.error(error);
            alert("Error creating user: " + error.message);
        }
    };

    // --- Edit User Logic ---
    const openEditModal = (user) => {
        setEditingUser({ ...user });
        setShowEditModal(true);
    };

    const handleUpdateUser = async (e) => {
        e.preventDefault();
        try {
            const updates = {
                name: editingUser.name,
                role: editingUser.role,
                department: editingUser.department || '',
                phone: editingUser.phone || ''
            };

            if (editingUser.role === 'student') {
                updates.rollNumber = editingUser.rollNumber || '';
                updates.class = editingUser.class || '';
            }

            await updateDoc(doc(db, "users", editingUser.id), updates);
            alert("User updated successfully!");
            setShowEditModal(false);
            fetchData();
        } catch (error) {
            console.error(error);
            alert("Error updating user: " + error.message);
        }
    };

    // --- Edit Application Logic ---
    const openAppEditModal = (app) => {
        setEditingApp({ ...app });
        setShowAppEditModal(true);
    };

    const handleUpdateApp = async (e) => {
        e.preventDefault();
        try {
            await updateDoc(doc(db, "applications", editingApp.id), {
                name: editingApp.name,
                rollNumber: editingApp.rollNumber || '',
                className: editingApp.className || '',
                password: editingApp.password || '', // Allowing password edit
                details: editingApp.details || ''
            });
            alert("Application updated successfully!");
            setShowAppEditModal(false);
            fetchData();
        } catch (error) {
            console.error(error);
            alert("Error updating application: " + error.message);
        }
    };

    const handleResetPassword = async () => {
        if (!editingUser?.email) return alert("User has no email specified.");
        if (!window.confirm(`Send password reset email to ${editingUser.email}?`)) return;
        try {
            await sendPasswordResetEmail(auth, editingUser.email);
            alert(`Password reset email sent to ${editingUser.email}.`);
        } catch (error) {
            console.error(error);
            alert("Error sending reset email: " + error.message);
        }
    };

    if (authLoading) return <div className="flex items-center justify-center h-screen bg-gray-900 text-blue-400">Loading...</div>;
    if (!user || role !== 'admin') return <div className="min-h-screen flex items-center justify-center text-red-500 bg-gray-900 font-bold">Access Denied</div>;

    const SidebarItem = ({ id, label, icon: Icon }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${activeTab === id
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                }`}
        >
            <Icon className={activeTab === id ? 'text-white' : 'text-gray-500'} />
            <span className="font-medium text-sm">{label}</span>
        </button>
    );

    return (
        <div className="flex h-screen bg-[#0f172a] text-gray-100 font-sans overflow-hidden">
            {/* Sidebar */}
            <aside className={`fixed md:relative z-30 h-full w-64 bg-[#1e293b] border-r border-slate-700/50 flex flex-col transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>

                {/* Brand */}
                <div className="p-6 border-b border-slate-700/50 flex items-center gap-3">
                    <div className="w-8 h-8 bg-red-500 rounded flex items-center justify-center text-white font-bold shadow-lg shadow-red-500/30">
                        <FaUniversity size={14} />
                    </div>
                    <div>
                        <h1 className="font-bold text-white text-lg leading-tight">EduTrack</h1>
                        <p className="text-[10px] text-gray-400 uppercase tracking-widest">Admin Panel</p>
                    </div>
                    {isMobile && <button onClick={() => setIsSidebarOpen(false)} className="ml-auto text-gray-400"><FaTimes /></button>}
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-6">

                    {/* Actions Section */}
                    <div>
                        <h3 className="px-4 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Actions</h3>
                        <div className="space-y-1">
                            <SidebarItem id="applications" label="Review Applications" icon={FaClipboardList} />
                            <SidebarItem id="create" label="Manual Create" icon={FaUserPlus} />
                        </div>
                    </div>

                    {/* Database Section */}
                    <div>
                        <h3 className="px-4 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Database</h3>
                        <div className="space-y-1">
                            <SidebarItem id="teachers" label="Teachers" icon={FaChalkboardTeacher} />
                            <SidebarItem id="students" label="Students" icon={FaUserGraduate} />
                            <SidebarItem id="admins" label="Admins" icon={FaUserShield} />
                        </div>
                    </div>
                </nav>

                {/* Footer */}
                <div className="p-4 border-t border-slate-700/50">
                    <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-red-500/30 text-red-400 rounded-lg hover:bg-red-500/10 transition-colors text-sm font-medium">
                        <FaSignOutAlt /> Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-full relative overflow-hidden bg-[#0f172a]">
                {/* Header */}
                <header className="h-16 border-b border-slate-700/50 bg-[#1e293b]/50 backdrop-blur-sm flex items-center justify-between px-6 shrink-0">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden text-gray-400 hover:text-white">
                            <FaBars size={20} />
                        </button>
                        <h2 className="text-xl font-bold text-white">
                            {activeTab === 'applications' && 'Review Applications'}
                            {activeTab === 'create' && 'Create New User'}
                            {activeTab === 'teachers' && 'Manage Teachers'}
                            {activeTab === 'students' && 'Manage Students'}
                            {activeTab === 'admins' && 'Manage Admins'}
                        </h2>
                    </div>
                </header>

                {/* Content Area */}
                <div className="flex-1 overflow-auto p-6 md:p-8">
                    {loading ? (
                        <div className="flex items-center justify-center h-64 text-gray-500">
                            <div className="border-t-2 border-blue-500 rounded-full w-8 h-8 animate-spin mr-3"></div>
                            Loading data...
                        </div>
                    ) : (
                        <>
                            {/* Applications View */}
                            {activeTab === 'applications' && (
                                <div className="bg-[#1e293b] rounded-xl border border-slate-700/50 overflow-hidden shadow-xl">
                                    <div className="p-6 border-b border-slate-700/50">
                                        <h3 className="text-lg font-bold text-white">Pending Applications</h3>
                                    </div>
                                    {applications.length === 0 ? (
                                        <div className="p-12 text-center text-gray-500">
                                            <FaClipboardList className="mx-auto text-4xl mb-4 opacity-20" />
                                            <p>No pending applications found.</p>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left">
                                                <thead className="bg-slate-800/50 text-gray-400 text-xs uppercase">
                                                    <tr>
                                                        <th className="p-4">Applicant</th>
                                                        <th className="p-4">Applying As</th>
                                                        <th className="p-4">Details</th>
                                                        <th className="p-4 text-right">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-700/50">
                                                    {applications.map(app => (
                                                        <tr key={app.id} className="hover:bg-slate-800/50 transition-colors">
                                                            <td className="p-4">
                                                                <div className="font-bold text-white">{app.name}</div>
                                                                <div className="text-xs text-gray-500">{app.email}</div>
                                                            </td>
                                                            <td className="p-4">
                                                                <span className="px-2 py-1 rounded-md bg-blue-500/10 text-blue-400 text-xs font-bold uppercase border border-blue-500/20">
                                                                    {app.role}
                                                                </span>
                                                            </td>
                                                            <td className="p-4 text-gray-400 text-sm max-w-xs truncate">{app.details}</td>
                                                            <td className="p-4 flex justify-end gap-2">
                                                                <button onClick={() => openAppEditModal(app)} className="p-2 hover:bg-blue-500/20 text-blue-500 rounded transition-colors" title="Edit Details">
                                                                    <FaEdit />
                                                                </button>
                                                                <button onClick={() => handleApproveApp(app)} className="p-2 hover:bg-green-500/20 text-green-500 rounded transition-colors" title="Approve">
                                                                    <FaCheck />
                                                                </button>
                                                                <button onClick={() => handleRejectApp(app.id)} className="p-2 hover:bg-red-500/20 text-red-500 rounded transition-colors" title="Reject">
                                                                    <FaTimes />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Teachers/Students/Admins View */}
                            {['teachers', 'students', 'admins'].includes(activeTab) && (
                                <div className="bg-[#1e293b] rounded-xl border border-slate-700/50 overflow-hidden shadow-xl">
                                    <div className="p-6 border-b border-slate-700/50 flex justify-between items-center">
                                        <h3 className="text-lg font-bold text-white">Registered users</h3>
                                        <div className="relative">
                                            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                            <input type="text" placeholder="Search..." className="pl-9 pr-4 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-blue-500" />
                                        </div>
                                    </div>
                                    {users.length === 0 ? (
                                        <div className="p-12 text-center text-gray-500">
                                            <p>No records found.</p>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left">
                                                <thead className="bg-slate-800/50 text-gray-400 text-xs uppercase">
                                                    <tr>
                                                        <th className="p-4">Name</th>
                                                        <th className="p-4">Contact</th>
                                                        <th className="p-4">Role</th>
                                                        <th className="p-4 text-right">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-700/50">
                                                    {users.map(u => (
                                                        <tr key={u.id} className="hover:bg-slate-800/50 transition-colors">
                                                            <td className="p-4 font-medium text-white">{u.name}</td>
                                                            <td className="p-4 text-gray-400 text-sm">{u.email}</td>
                                                            <td className="p-4">
                                                                <span className="capitalize px-2 py-1 rounded bg-slate-700 text-gray-300 text-xs">{u.role}</span>
                                                            </td>
                                                            <td className="p-4 text-right flex justify-end gap-2">
                                                                <button onClick={() => openEditModal(u)} className="p-2 text-blue-400 hover:bg-blue-500/10 rounded transition-colors" title="Edit">
                                                                    <FaEdit />
                                                                </button>
                                                                <button onClick={() => handleDeleteUser(u.id)} className="p-2 text-red-400 hover:bg-red-500/10 rounded transition-colors" title="Delete">
                                                                    <FaTrash />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Create User View */}
                            {activeTab === 'create' && (
                                <div className="max-w-2xl mx-auto">
                                    <div className="bg-[#1e293b] rounded-xl border border-slate-700/50 overflow-hidden shadow-xl p-8">
                                        <div className="flex items-center gap-4 mb-8">
                                            <div className="w-12 h-12 bg-blue-600/20 rounded-full flex items-center justify-center text-blue-500">
                                                <FaUserPlus size={24} />
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-bold text-white">Create New User</h3>
                                                <p className="text-gray-500 text-sm">Add a new user to the system manually</p>
                                            </div>
                                        </div>

                                        <form onSubmit={handleCreateUser} className="space-y-5">
                                            <div className="grid grid-cols-2 gap-5">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase">Full Name</label>
                                                    <input required type="text" className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all" value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase">Email Address</label>
                                                    <input required type="email" className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-5">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase">Role</label>
                                                    <select className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-blue-500 outline-none appearance-none" value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
                                                        <option value="student">Student</option>
                                                        <option value="teacher">Teacher</option>
                                                        <option value="admin">Admin</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase">Password</label>
                                                    <input required type="password" placeholder="Default Password" className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-blue-500 outline-none" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
                                                </div>
                                            </div>

                                            {newUser.role === 'student' ? (
                                                <div className="grid grid-cols-2 gap-5">
                                                    <div>
                                                        <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase">Roll Number</label>
                                                        <input required type="text" placeholder="e.g. CS-370" className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-blue-500 outline-none"
                                                            value={newUser.rollNumber} onChange={e => setNewUser({ ...newUser, rollNumber: e.target.value })} />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase">Class / Section</label>
                                                        <input required type="text" placeholder="e.g. BSCS-3B" className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-blue-500 outline-none"
                                                            value={newUser.className} onChange={e => setNewUser({ ...newUser, className: e.target.value })} />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase">Department</label>
                                                    <input type="text" placeholder="e.g. Computer Science" className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-blue-500 outline-none"
                                                        value={newUser.department} onChange={e => setNewUser({ ...newUser, department: e.target.value })} />
                                                </div>
                                            )}

                                            <div className="pt-4">
                                                <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg shadow-blue-600/20 transition-all transform active:scale-95">
                                                    Create User
                                                </button>
                                                <p className="mt-3 text-center text-xs text-gray-500">
                                                    Note: This creates a fully synchronized user account (Auth + Database).
                                                </p>
                                            </div>
                                        </form>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </main>
            {/* Edit User Modal */}
            {showEditModal && editingUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-[#1e293b] border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
                            <h3 className="text-xl font-bold text-white">Edit User</h3>
                            <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-white transition-colors"><FaTimes size={20} /></button>
                        </div>
                        <div className="p-6">
                            <form onSubmit={handleUpdateUser} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">Name</label>
                                    <input type="text" className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-blue-500 outline-none" value={editingUser.name} onChange={e => setEditingUser({ ...editingUser, name: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">Email (Read Only)</label>
                                    <input type="email" disabled className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-gray-500 cursor-not-allowed" value={editingUser.email} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">Role</label>
                                    <select className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-blue-500 outline-none" value={editingUser.role} onChange={e => setEditingUser({ ...editingUser, role: e.target.value })}>
                                        <option value="student">Student</option>
                                        <option value="teacher">Teacher</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                </div>
                                {editingUser.role === 'student' ? (
                                    <>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">Roll Number</label>
                                            <input type="text" className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-blue-500 outline-none" value={editingUser.rollNumber || ''} onChange={e => setEditingUser({ ...editingUser, rollNumber: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">Class</label>
                                            <input type="text" className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-blue-500 outline-none" value={editingUser.class || ''} onChange={e => setEditingUser({ ...editingUser, class: e.target.value })} />
                                        </div>
                                    </>
                                ) : (
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">Department / Details</label>
                                        <input type="text" className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-blue-500 outline-none" value={editingUser.department} onChange={e => setEditingUser({ ...editingUser, department: e.target.value })} />
                                    </div>
                                )}

                                <div className="pt-4 flex gap-3">
                                    <button type="button" onClick={handleResetPassword} className="flex-1 py-2 bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-500 border border-yellow-600/50 rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2">
                                        <FaKey /> Reset Password
                                    </button>
                                    <button type="submit" className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-sm transition-colors shadow-lg">
                                        Update User
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Application Edit Modal */}
            {showAppEditModal && editingApp && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-[#1e293b] border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
                            <h3 className="text-xl font-bold text-white">Edit Application</h3>
                            <button onClick={() => setShowAppEditModal(false)} className="text-gray-400 hover:text-white transition-colors"><FaTimes size={20} /></button>
                        </div>
                        <div className="p-6">
                            <form onSubmit={handleUpdateApp} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">Name</label>
                                    <input type="text" className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-blue-500 outline-none" value={editingApp.name} onChange={e => setEditingApp({ ...editingApp, name: e.target.value })} />
                                </div>
                                {editingApp.role === 'student' && (
                                    <>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">Roll Number</label>
                                            <input type="text" className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-blue-500 outline-none" value={editingApp.rollNumber || ''} onChange={e => setEditingApp({ ...editingApp, rollNumber: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">Class</label>
                                            <input type="text" className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-blue-500 outline-none" value={editingApp.className || ''} onChange={e => setEditingApp({ ...editingApp, className: e.target.value })} />
                                        </div>
                                    </>
                                )}
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">Requested Password</label>
                                    <input type="text" className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-blue-500 outline-none font-mono" value={editingApp.password} onChange={e => setEditingApp({ ...editingApp, password: e.target.value })} />
                                </div>

                                <div className="pt-4">
                                    <button type="submit" className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-sm transition-colors shadow-lg">
                                        Save Changes
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
