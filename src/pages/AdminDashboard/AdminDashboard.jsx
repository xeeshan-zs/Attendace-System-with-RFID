import React, { useState, useEffect } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../../firebase';
import { doc, setDoc, collection, getDocs, query, where, deleteDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../../hooks/useAuth';
import './AdminDashboard.css';
import {
    FaUserPlus, FaUserShield, FaSignOutAlt, FaChalkboardTeacher,
    FaUserGraduate, FaUsersCog, FaTrash, FaEdit, FaTimes,
    FaUniversity, FaBars
} from 'react-icons/fa';

/**
 * Admin Dashboard with full CRUD capabilities.
 * Styled to match StudentDashboard.
 */
const AdminDashboard = () => {
    const { user } = useAuth();

    // UI State
    const [activeTab, setActiveTab] = useState('create-user'); // 'create-user' | 'teachers' | 'students' | 'admins'
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    // Data State
    const [usersList, setUsersList] = useState([]);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Form State (Create)
    const [createForm, setCreateForm] = useState({
        email: '', password: '', role: 'student', name: '', rollNumber: '', class: ''
    });

    // Edit State
    const [editingUser, setEditingUser] = useState(null);
    const [editForm, setEditForm] = useState({ name: '', rollNumber: '', class: '' });

    // --- EFFECTS ---
    useEffect(() => {
        if (activeTab !== 'create-user') {
            fetchUsers(activeTab);
        }
    }, [activeTab, refreshTrigger]);

    useEffect(() => {
        // Responsive sidebar handler
        const handleResize = () => {
            if (window.innerWidth < 768) setIsSidebarOpen(false);
            else setIsSidebarOpen(true);
        };
        window.addEventListener('resize', handleResize);
        handleResize(); // Init
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // --- ACTIONS ---

    const fetchUsers = async (roleType) => {
        setLoading(true);
        try {
            let dbRole = 'student';
            if (roleType === 'teachers') dbRole = 'teacher';
            if (roleType === 'admins') dbRole = 'admin';

            const q = query(collection(db, "users"), where("role", "==", dbRole));
            const querySnapshot = await getDocs(q);
            const fetchedUsers = [];
            querySnapshot.forEach((doc) => {
                fetchedUsers.push({ id: doc.id, ...doc.data() });
            });
            setUsersList(fetchedUsers);
        } catch (error) {
            console.error("Error fetching users:", error);
            setMessage({ text: "Failed to fetch users.", type: "error" });
        }
        setLoading(false);
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage({ text: '', type: '' });

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, createForm.email, createForm.password);
            const newUser = userCredential.user;

            await setDoc(doc(db, "users", newUser.uid), {
                email: createForm.email,
                role: createForm.role,
                name: createForm.name,
                ...(createForm.role === 'student' && {
                    rollNumber: createForm.rollNumber,
                    class: createForm.class
                })
            });

            setMessage({ text: `Success! User ${createForm.email} created. You have been logged in as the new user.`, type: "success" });
        } catch (error) {
            console.error("Error creating user:", error);
            setMessage({ text: `Error: ${error.message}`, type: "error" });
            setLoading(false);
        }
    };

    const handleDeleteUser = async (userId) => {
        if (!window.confirm("Are you sure you want to delete this user? (This only removes them from the database, not Authentication)")) return;

        try {
            await deleteDoc(doc(db, "users", userId));
            setMessage({ text: "User deleted from database.", type: "success" });
            setRefreshTrigger(p => p + 1);
        } catch (error) {
            console.error("Error deleting user:", error);
            setMessage({ text: "Failed to delete user.", type: "error" });
        }
    };

    const openEditModal = (user) => {
        setEditingUser(user);
        setEditForm({
            name: user.name || '',
            rollNumber: user.rollNumber || '',
            class: user.class || ''
        });
    };

    const handleUpdateUser = async (e) => {
        e.preventDefault();
        try {
            const docRef = doc(db, "users", editingUser.id);
            await updateDoc(docRef, {
                name: editForm.name,
                ...(editingUser.role === 'student' && {
                    rollNumber: editForm.rollNumber,
                    class: editForm.class
                })
            });
            setMessage({ text: "User updated successfully.", type: "success" });
            setEditingUser(null);
            setRefreshTrigger(p => p + 1);
        } catch (error) {
            console.error("Error updating user:", error);
            setMessage({ text: "Failed to update user.", type: "error" });
        }
    };

    const handleLogout = () => auth.signOut();

    // --- RENDER HELPERS ---

    const renderUserTable = () => (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mt-6 animate-fadeIn">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-sm uppercase tracking-wider">
                            <th className="p-4 font-semibold">Name</th>
                            <th className="p-4 font-semibold">Email</th>
                            {activeTab === 'students' && (
                                <>
                                    <th className="p-4 font-semibold">Roll No</th>
                                    <th className="p-4 font-semibold">Class</th>
                                </>
                            )}
                            <th className="p-4 font-semibold">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {usersList.length === 0 ? (
                            <tr><td colSpan="5" className="p-8 text-center text-gray-500">No users found.</td></tr>
                        ) : (
                            usersList.map(u => (
                                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="p-4 font-medium text-gray-800">{u.name}</td>
                                    <td className="p-4 text-gray-600">{u.email}</td>
                                    {activeTab === 'students' && (
                                        <>
                                            <td className="p-4 text-gray-600 font-mono text-sm">{u.rollNumber}</td>
                                            <td className="p-4 text-gray-600">
                                                <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs font-bold">{u.class}</span>
                                            </td>
                                        </>
                                    )}
                                    <td className="p-4 flex gap-3">
                                        <button onClick={() => openEditModal(u)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                                            <FaEdit />
                                        </button>
                                        <button onClick={() => handleDeleteUser(u.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
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
    );

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
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded border border-gray-200 uppercase font-bold tracking-wider">Admin</span>
                    </div>

                    {/* Navigation */}
                    <nav className="p-4 space-y-2 mt-4">
                        <div className="px-4 pb-2 text-xs font-bold text-gray-400 uppercase tracking-wider">Management</div>

                        <button
                            onClick={() => setActiveTab('create-user')}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'create-user'
                                ? 'bg-blue-50 text-blue-600 shadow-sm ring-1 ring-blue-100'
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                }`}
                        >
                            <FaUserPlus size={18} /> Create User
                        </button>

                        <button
                            onClick={() => setActiveTab('teachers')}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'teachers'
                                ? 'bg-blue-50 text-blue-600 shadow-sm ring-1 ring-blue-100'
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                }`}
                        >
                            <FaChalkboardTeacher size={18} /> Manage Teachers
                        </button>

                        <button
                            onClick={() => setActiveTab('students')}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'students'
                                ? 'bg-blue-50 text-blue-600 shadow-sm ring-1 ring-blue-100'
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                }`}
                        >
                            <FaUserGraduate size={18} /> Manage Students
                        </button>

                        <button
                            onClick={() => setActiveTab('admins')}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'admins'
                                ? 'bg-blue-50 text-blue-600 shadow-sm ring-1 ring-blue-100'
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                }`}
                        >
                            <FaUsersCog size={18} /> Manage Admins
                        </button>
                    </nav>
                </div>

                {/* Bottom Section */}
                <div className="p-4 border-t border-gray-100 bg-gray-50/50">
                    <div className="mb-4 bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-white font-bold text-lg shadow-md">
                                <FaUserShield />
                            </div>
                            <div className="overflow-hidden">
                                <p className="text-sm font-bold text-gray-800 truncate">Administrator</p>
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
                            {activeTab.replace('-', ' ')}
                        </h2>
                    </div>
                </header>

                <div className="flex-1 overflow-auto p-4 md:p-8">
                    <div className="max-w-6xl mx-auto">
                        {message.text && (
                            <div className={`mb-6 p-4 rounded-xl border flex items-center gap-3 ${message.type === 'error'
                                ? 'bg-red-50 border-red-100 text-red-700'
                                : 'bg-green-50 border-green-100 text-green-700'}`}>
                                {message.text}
                            </div>
                        )}

                        {activeTab === 'create-user' ? (
                            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100 max-w-3xl animate-fadeIn">
                                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
                                    <div className="bg-blue-50 p-3 rounded-lg text-blue-600">
                                        <FaUserPlus size={20} />
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-800">Create New Account</h3>
                                </div>

                                <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-4 mb-6">
                                    <p className="text-sm text-yellow-800 flex items-start gap-2">
                                        <span className="font-bold">Note:</span> Creating a new user will sign them in immediately. You will be logged out of this admin account.
                                    </p>
                                </div>

                                <form onSubmit={handleCreateUser} className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                                            <input
                                                type="email"
                                                required
                                                value={createForm.email}
                                                onChange={e => setCreateForm({ ...createForm, email: e.target.value })}
                                                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                                                placeholder="user@example.com"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
                                            <input
                                                type="password"
                                                required
                                                value={createForm.password}
                                                onChange={e => setCreateForm({ ...createForm, password: e.target.value })}
                                                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                                                placeholder="••••••••"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
                                            <input
                                                type="text"
                                                required
                                                value={createForm.name}
                                                onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
                                                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                                                placeholder="John Doe"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">Role</label>
                                            <div className="relative">
                                                <select
                                                    value={createForm.role}
                                                    onChange={e => setCreateForm({ ...createForm, role: e.target.value })}
                                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all appearance-none bg-white"
                                                >
                                                    <option value="student">Student</option>
                                                    <option value="teacher">Teacher</option>
                                                    <option value="admin">Admin</option>
                                                </select>
                                                <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-500">
                                                    <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {createForm.role === 'student' && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-gray-50 rounded-xl border border-gray-100">
                                            <div>
                                                <label className="block text-sm font-semibold text-gray-700 mb-2">Roll Number</label>
                                                <input
                                                    type="text"
                                                    required
                                                    value={createForm.rollNumber}
                                                    onChange={e => setCreateForm({ ...createForm, rollNumber: e.target.value })}
                                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                                                    placeholder="e.g. CS-2022-001"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-semibold text-gray-700 mb-2">Class / Section</label>
                                                <input
                                                    type="text"
                                                    required
                                                    value={createForm.class}
                                                    onChange={e => setCreateForm({ ...createForm, class: e.target.value })}
                                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                                                    placeholder="e.g. BSCS 4-B"
                                                />
                                            </div>
                                        </div>
                                    )}
                                    <div className="pt-4">
                                        <button
                                            disabled={loading}
                                            type="submit"
                                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-600/20 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed"
                                        >
                                            {loading ? "Creating Account..." : "Create User Account"}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        ) : (
                            renderUserTable()
                        )}
                    </div>
                </div>
            </main>

            {/* Edit Modal */}
            {editingUser && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h2 className="text-lg font-bold text-gray-800">Edit User Details</h2>
                            <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                <FaTimes size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleUpdateUser} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Name</label>
                                <input
                                    type="text"
                                    value={editForm.name}
                                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                                />
                            </div>
                            {editingUser.role === 'student' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Roll Number</label>
                                        <input
                                            type="text"
                                            value={editForm.rollNumber}
                                            onChange={e => setEditForm({ ...editForm, rollNumber: e.target.value })}
                                            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Class</label>
                                        <input
                                            type="text"
                                            value={editForm.class}
                                            onChange={e => setEditForm({ ...editForm, class: e.target.value })}
                                            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                                        />
                                    </div>
                                </>
                            )}
                            <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-gray-50">
                                <button
                                    type="button"
                                    onClick={() => setEditingUser(null)}
                                    className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold shadow-lg shadow-blue-600/20 transition-all"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
