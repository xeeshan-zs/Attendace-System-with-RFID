import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import './AdminDashboard.css';
import {
    FaUserPlus, FaUsers, FaTrash, FaEdit, FaChalkboardTeacher,
    FaUserGraduate, FaSignOutAlt, FaUniversity, FaBars, FaTimes, FaUserShield, FaSearch,
    FaClipboardList, FaCheck, FaBan, FaSave, FaArrowLeft
} from 'react-icons/fa';
import { auth, db } from '../../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, where, serverTimestamp } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';

const AdminDashboard = () => {
    const { user, role, loading: authLoading } = useAuth();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    const [activeTab, setActiveTab] = useState('review-applications'); // 'review-applications' | 'create-user' | ...

    // Data State
    const [teachers, setTeachers] = useState([]);
    const [students, setStudents] = useState([]);
    const [admins, setAdmins] = useState([]);
    const [applications, setApplications] = useState([]);
    const [loading, setLoading] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Form State for manual creation & editing
    const [isEditing, setIsEditing] = useState(false);
    const [editUserId, setEditUserId] = useState(null);
    const [formData, setFormData] = useState({
        email: '', password: '', role: 'student', name: '', rollNumber: '', class: '', subject: ''
    });
    const [formError, setFormError] = useState('');
    const [formSuccess, setFormSuccess] = useState('');

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
            fetchAllData();
        }
    }, [role, refreshTrigger]);

    const fetchAllData = async () => {
        setLoading(true);
        try {
            // Fetch Users
            const usersCollection = collection(db, 'users');
            const data = await getDocs(usersCollection);
            const allUsers = data.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            setTeachers(allUsers.filter(u => u.role === 'teacher'));
            setStudents(allUsers.filter(u => u.role === 'student'));
            setAdmins(allUsers.filter(u => u.role === 'admin'));

            // Fetch Applications
            const appCollection = collection(db, 'applications');
            const appQuery = query(appCollection, where('status', '==', 'pending'));
            const appData = await getDocs(appQuery);
            setApplications(appData.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        } catch (error) {
            console.error("Error fetching data:", error);
        }
        setLoading(false);
    };

    // --- APPLICATION LOGIC ---
    const generateTempPassword = (name) => {
        const cleanName = name.replace(/[^a-zA-Z]/g, '').slice(0, 4).toLowerCase();
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        return `${cleanName}@${randomNum}`;
    };

    const handleApproveApplication = async (app) => {
        if (!window.confirm(`Approve application for ${app.name}?`)) return;
        setLoading(true);
        const tempPassword = generateTempPassword(app.name);

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, app.email, tempPassword);
            const newUser = userCredential.user;

            const userData = {
                uid: newUser.uid,
                email: app.email,
                role: app.role,
                name: app.name,
                createdAt: new Date().toISOString()
            };
            if (app.role === 'student' && app.details) {
                const [roll, cls] = app.details.includes(',') ? app.details.split(',') : [app.details, ''];
                userData.rollNumber = roll.trim();
                userData.class = cls ? cls.trim() : 'N/A';
            } else if (app.role === 'teacher') {
                userData.subject = app.details;
            }

            await addDoc(collection(db, "users"), userData);
            await deleteDoc(doc(db, "applications", app.id));

            const subject = "Welcome to EduTrack - Application Approved";
            const body = `Hello ${app.name},\n\nYour application to join EduTrack as a ${app.role} has been APPROVED.\n\nHere are your login credentials:\nEmail: ${app.email}\nPassword: ${tempPassword}\n\nPlease login and change your password immediately.\n\nRegards,\nAdmin`;
            window.location.href = `mailto:${app.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

            alert(`User created! Credentials: ${app.email} / ${tempPassword}. You may need to relogin as Admin.`);

        } catch (error) {
            console.error(error);
            alert("Error approving: " + error.message);
        }
        setLoading(false);
    };

    const handleRejectApplication = async (app) => {
        if (!window.confirm(`Reject application for ${app.name}?`)) return;
        try {
            await deleteDoc(doc(db, "applications", app.id));
            const subject = "EduTrack Application Update";
            const body = `Hello ${app.name},\n\nUnfortunately, your application to join EduTrack has been declined at this time.\n\nRegards,\nAdmin`;
            window.location.href = `mailto:${app.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            setRefreshTrigger(p => p + 1);
        } catch (error) {
            console.error(error);
            alert("Error rejecting: " + error.message);
        }
    };


    // --- CRUD LOGIC (Create / Update / Delete) ---

    const resetForm = () => {
        setFormData({ email: '', password: '', role: 'student', name: '', rollNumber: '', class: '', subject: '' });
        setIsEditing(false);
        setEditUserId(null);
        setFormError('');
        setFormSuccess('');
    };

    const openEditUser = (user) => {
        setIsEditing(true);
        setEditUserId(user.id);
        const dataToEdit = {
            email: user.email,
            password: '', // Can't edit password here directly
            role: user.role,
            name: user.name,
            rollNumber: user.rollNumber || '',
            class: user.class || '',
            subject: user.subject || ''
        };
        setFormData(dataToEdit);
        setActiveTab('create-user'); // Switch to form tab
        if (isMobile) setIsSidebarOpen(false);
    };

    const handleCreateOrUpdateUser = async (e) => {
        e.preventDefault();
        setFormError(''); setFormSuccess('');
        setLoading(true);

        try {
            if (isEditing && editUserId) {
                // UPDATE
                const userRef = doc(db, "users", editUserId);
                const updates = {
                    name: formData.name,
                    role: formData.role
                };
                if (formData.role === 'student') {
                    updates.rollNumber = formData.rollNumber;
                    updates.class = formData.class;
                } else if (formData.role === 'teacher') {
                    updates.subject = formData.subject;
                }

                await updateDoc(userRef, updates);
                setFormSuccess("User updated successfully!");
                setTimeout(() => resetForm(), 2000);

            } else {
                // CREATE
                const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
                const newUser = userCredential.user;

                const userData = {
                    uid: newUser.uid,
                    email: formData.email,
                    role: formData.role,
                    name: formData.name,
                    createdAt: new Date().toISOString()
                };

                if (formData.role === 'student') {
                    userData.rollNumber = formData.rollNumber;
                    userData.class = formData.class;
                } else if (formData.role === 'teacher') {
                    userData.subject = formData.subject;
                }

                await addDoc(collection(db, "users"), userData);
                setFormSuccess(`User ${formData.email} created!`);
                setFormData({ ...formData, email: '', password: '', name: '', rollNumber: '', class: '', subject: '' });
            }
            setRefreshTrigger(p => p + 1);
        } catch (error) {
            setFormError(error.message);
        }
        setLoading(false);
    };

    const handleDeleteUser = async (id) => {
        if (window.confirm("Delete user from database?")) {
            try {
                await deleteDoc(doc(db, "users", id));
                setRefreshTrigger(p => p + 1);
            } catch (error) {
                alert("Failed to delete.");
            }
        }
    };

    const handleLogout = () => auth.signOut();

    if (authLoading) return <div className="flex items-center justify-center h-screen bg-gray-900 text-blue-400 font-bold loading-pulse">Loading...</div>;
    if (!user || role !== 'admin') return <div className="min-h-screen flex items-center justify-center flex-col gap-4 bg-gray-900">
        <div className="text-red-400 font-bold">Access Denied or Session Expired.</div>
        <button onClick={() => window.location.reload()} className="bg-blue-600 text-white px-4 py-2 rounded">Go to Login</button>
    </div>;

    const renderUserTable = (users, type) => (
        <div className="bg-white/10 backdrop-blur-md rounded-xl shadow-lg border border-white/10 overflow-hidden animate-fadeIn">
            <div className="p-6 border-b border-white/10 flex justify-between items-center">
                <h3 className="font-bold text-white text-lg flex items-center gap-2">
                    {type === 'teacher' && <FaChalkboardTeacher />}
                    {type === 'student' && <FaUserGraduate />}
                    {type === 'admin' && <FaUserShield />}
                    Manage {type === 'teacher' ? 'Teachers' : type === 'student' ? 'Students' : 'Admins'}
                </h3>
                <span className="bg-white/5 text-gray-300 text-xs px-3 py-1 rounded-full border border-white/10">{users.length} Total</span>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-white/5 text-gray-400 text-sm uppercase tracking-wider">
                            <th className="p-4 font-semibold">Name</th>
                            <th className="p-4 font-semibold">Email</th>
                            {type === 'student' && <th className="p-4 font-semibold">Details</th>}
                            {type === 'teacher' && <th className="p-4 font-semibold">Subject</th>}
                            <th className="p-4 font-semibold text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {users.map((u) => (
                            <tr key={u.id} className="hover:bg-white/5 transition-colors">
                                <td className="p-4 font-bold text-white">{u.name || "N/A"}</td>
                                <td className="p-4 text-gray-300">{u.email}</td>
                                {type === 'student' && <td className="p-4 text-gray-300 text-sm"><span className="block">Roll: {u.rollNumber}</span><span className="block text-gray-500">Class: {u.class}</span></td>}
                                {type === 'teacher' && <td className="p-4 text-gray-300">{u.subject || "N/A"}</td>}
                                <td className="p-4 text-right flex justify-end gap-2">
                                    <button onClick={() => openEditUser(u)} className="text-blue-400 hover:bg-blue-500/20 p-2 rounded-lg transition-colors" title="Edit User"><FaEdit /></button>
                                    <button onClick={() => handleDeleteUser(u.id)} className="text-red-400 hover:bg-red-500/20 p-2 rounded-lg transition-colors" title="Delete User"><FaTrash /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    return (
        <div className="flex h-screen bg-gray-900 text-gray-100 overflow-hidden font-sans relative">

            {/* Animated Background */}
            <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-gray-900 via-blue-900/50 to-purple-900/50 animate-gradient z-0"></div>
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 z-0"></div>

            {/* Sidebar */}
            <aside className={`fixed md:relative z-20 h-full w-72 shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col justify-between 
                bg-white/5 backdrop-blur-xl border-r border-white/10
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0 md:w-72'} 
                ${isMobile && !isSidebarOpen ? '-translate-x-full' : ''}`}>
                <div>
                    <div className="p-6 border-b border-white/10 flex items-center gap-3">
                        <div className="bg-gradient-to-tr from-red-600 to-orange-600 text-white p-2 rounded-lg shadow-lg"><FaUniversity size={24} /></div>
                        <h1 className="text-xl font-extrabold text-white tracking-tight">EduTrack <span className="text-xs font-normal opacity-70 block">Admin Panel</span></h1>
                        {isMobile && <button onClick={() => setIsSidebarOpen(false)} className="ml-auto text-gray-400 hover:text-white"><FaTimes /></button>}
                    </div>

                    <nav className="p-4 space-y-2 mt-4">
                        <div className="px-4 pb-2 text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</div>

                        <div className="relative">
                            <button onClick={() => { setActiveTab('review-applications'); if (isMobile) setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'review-applications' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
                                <FaClipboardList size={18} /> Review Applications
                            </button>
                            {applications.length > 0 && <span className="absolute right-2 top-3 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">{applications.length}</span>}
                        </div>

                        <button onClick={() => { setActiveTab('create-user'); resetForm(); if (isMobile) setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'create-user' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
                            <FaUserPlus size={18} /> {isEditing ? 'Editing User' : 'Manual Create'}
                        </button>

                        <div className="px-4 pb-2 mt-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Database</div>
                        <button onClick={() => setActiveTab('manage-teachers')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium ${activeTab === 'manage-teachers' ? 'bg-blue-600' : 'text-gray-400 hover:text-white'}`}><FaChalkboardTeacher /> Teachers</button>
                        <button onClick={() => setActiveTab('manage-students')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium ${activeTab === 'manage-students' ? 'bg-blue-600' : 'text-gray-400 hover:text-white'}`}><FaUserGraduate /> Students</button>
                        <button onClick={() => setActiveTab('manage-admins')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium ${activeTab === 'manage-admins' ? 'bg-blue-600' : 'text-gray-400 hover:text-white'}`}><FaUserShield /> Admins</button>
                    </nav>
                </div>
                <div className="p-4 border-t border-white/10 bg-black/20">
                    <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-red-500/30 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/10 transition-colors"><FaSignOutAlt /> Sign Out</button>
                </div>
            </aside>

            {isMobile && isSidebarOpen && <div className="fixed inset-0 bg-black/60 z-10 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)}></div>}

            <main className="flex-1 flex flex-col h-full relative w-full overflow-hidden z-10">
                <header className="h-16 border-b border-white/10 flex items-center justify-between px-4 md:px-8 bg-white/5 backdrop-blur-md sticky top-0 z-20">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-gray-400 md:hidden"><FaBars size={20} /></button>
                        <h2 className="text-xl font-bold text-white capitalize">{activeTab.replace('-', ' ')}</h2>
                    </div>
                </header>

                <div className="flex-1 overflow-auto p-4 md:p-8">
                    <div className="max-w-5xl mx-auto">

                        {activeTab === 'review-applications' && (
                            <div className="animate-fadeIn space-y-6">
                                <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/10">
                                    <h3 className="text-2xl font-bold text-white mb-4">Pending Applications</h3>
                                    {applications.length === 0 ? (
                                        <p className="text-gray-400 text-center py-8">No pending applications.</p>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {applications.map(app => (
                                                <div key={app.id} className="bg-black/20 p-5 rounded-xl border border-white/5 hover:border-blue-500/30 transition-all group">
                                                    <div className="flex justify-between items-start mb-3">
                                                        <span className={`text-xs font-bold uppercase px-2 py-1 rounded border ${app.role === 'student' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-purple-500/10 text-purple-400 border-purple-500/20'}`}>{app.role}</span>
                                                        <span className="text-xs text-gray-500">{new Date(app.timestamp?.seconds * 1000).toLocaleDateString()}</span>
                                                    </div>
                                                    <h4 className="text-lg font-bold text-white mb-1">{app.name}</h4>
                                                    <p className="text-sm text-gray-300 mb-2 truncate">{app.email}</p>
                                                    <div className="bg-white/5 p-2 rounded text-xs text-gray-400 mb-4 h-16 overflow-y-auto"><p className="font-mono">{app.details}</p></div>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => handleApproveApplication(app)} className="flex-1 bg-green-600 hover:bg-green-500 text-white py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2"><FaCheck /> Approve</button>
                                                        <button onClick={() => handleRejectApplication(app)} className="flex-1 bg-red-600/20 hover:bg-red-600 text-red-200 hover:text-white py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 border border-red-500/20"><FaBan /> Reject</button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'create-user' && (
                            <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 p-6">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-2xl font-bold text-white">{isEditing ? "Edit User" : "Create New User"}</h3>
                                    {isEditing && (
                                        <button onClick={resetForm} className="text-red-400 hover:text-white flex items-center gap-2 text-sm font-bold">
                                            <FaTimes /> Cancel Edit
                                        </button>
                                    )}
                                </div>

                                {formSuccess && <div className="mb-6 p-4 bg-green-500/20 text-green-300 rounded-lg">{formSuccess}</div>}
                                {formError && <div className="mb-6 p-4 bg-red-500/20 text-red-300 rounded-lg">{formError}</div>}

                                <form onSubmit={handleCreateOrUpdateUser} className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="col-span-2">
                                            <label className="text-gray-400 text-xs font-bold uppercase mb-1 block">Role</label>
                                            <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })} className="w-full p-3 bg-white/5 border border-white/10 rounded-lg text-white">
                                                <option value="student">Student</option>
                                                <option value="teacher">Teacher</option>
                                                <option value="admin">Admin</option>
                                            </select>
                                        </div>

                                        <div className="col-span-2">
                                            <label className="text-gray-400 text-xs font-bold uppercase mb-1 block">Full Name</label>
                                            <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full p-3 bg-white/5 border border-white/10 rounded-lg text-white" required />
                                        </div>

                                        <div className="col-span-2 md:col-span-1">
                                            <label className="text-gray-400 text-xs font-bold uppercase mb-1 block">Email {isEditing && <span className="text-xs text-red-400">(Read Only)</span>}</label>
                                            <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className={`w-full p-3 bg-white/5 border border-white/10 rounded-lg text-white ${isEditing ? 'opacity-50 cursor-not-allowed' : ''}`} required disabled={isEditing} />
                                        </div>

                                        {!isEditing && (
                                            <div className="col-span-2 md:col-span-1">
                                                <label className="text-gray-400 text-xs font-bold uppercase mb-1 block">Password</label>
                                                <input type="password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} className="w-full p-3 bg-white/5 border border-white/10 rounded-lg text-white" required />
                                            </div>
                                        )}

                                        {formData.role === 'student' && <>
                                            <div className="col-span-2 md:col-span-1">
                                                <label className="text-gray-400 text-xs font-bold uppercase mb-1 block">Roll Number</label>
                                                <input type="text" value={formData.rollNumber} onChange={e => setFormData({ ...formData, rollNumber: e.target.value })} className="w-full p-3 bg-white/5 border border-white/10 rounded-lg text-white" required />
                                            </div>
                                            <div className="col-span-2 md:col-span-1">
                                                <label className="text-gray-400 text-xs font-bold uppercase mb-1 block">Class / Section</label>
                                                <input type="text" value={formData.class} onChange={e => setFormData({ ...formData, class: e.target.value })} className="w-full p-3 bg-white/5 border border-white/10 rounded-lg text-white" required />
                                            </div>
                                        </>}

                                        {formData.role === 'teacher' && (
                                            <div className="col-span-2">
                                                <label className="text-gray-400 text-xs font-bold uppercase mb-1 block">Subject</label>
                                                <input type="text" value={formData.subject} onChange={e => setFormData({ ...formData, subject: e.target.value })} className="w-full p-3 bg-white/5 border border-white/10 rounded-lg text-white" required />
                                            </div>
                                        )}
                                    </div>
                                    <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg mt-4 hover:bg-blue-500 transition-all flex items-center justify-center gap-2">
                                        {loading ? 'Saving...' : <><FaSave /> {isEditing ? 'Update User' : 'Create Account'}</>}
                                    </button>
                                </form>
                            </div>
                        )}

                        {activeTab === 'manage-teachers' && renderUserTable(teachers, 'teacher')}
                        {activeTab === 'manage-students' && renderUserTable(students, 'student')}
                        {activeTab === 'manage-admins' && renderUserTable(admins, 'admin')}

                    </div>
                </div>
            </main>
        </div>
    );
};

export default AdminDashboard;
