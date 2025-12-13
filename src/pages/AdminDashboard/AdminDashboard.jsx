import React, { useState, useEffect, useMemo } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../../firebase';
import { doc, setDoc, collection, getDocs, query, where, deleteDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../../hooks/useAuth';
import './AdminDashboard.css';
import { FaUserPlus, FaUserShield, FaSignOutAlt, FaChalkboardTeacher, FaUserGraduate, FaUsersCog, FaTrash, FaEdit, FaSearch, FaTimes } from 'react-icons/fa';

/**
 * Admin Dashboard with full CRUD capabilities.
 */
const AdminDashboard = () => {
    const { user } = useAuth();

    // UI State
    const [activeTab, setActiveTab] = useState('create-user'); // 'create-user' | 'teachers' | 'students' | 'admins'
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });

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
            fetchUsers(activeTab); // activeTab matches role name logic mostly
        }
    }, [activeTab, refreshTrigger]);

    // --- ACTIONS ---

    const fetchUsers = async (roleType) => {
        setLoading(true);
        try {
            // Map tab names to role values in DB
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
            // 1. Create User in Auth (Logs out current admin)
            const userCredential = await createUserWithEmailAndPassword(auth, createForm.email, createForm.password);
            const newUser = userCredential.user;

            // 2. Create User Profile
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
            // Auth listener in App.jsx handles the rest (likely redirecting the new user)
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mt-6">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                        {activeTab === 'students' && (
                            <>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Roll No</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class</th>
                            </>
                        )}
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {usersList.length === 0 ? (
                        <tr><td colSpan="5" className="text-center py-8 text-gray-500">No users found.</td></tr>
                    ) : (
                        usersList.map(u => (
                            <tr key={u.id}>
                                <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{u.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-gray-500">{u.email}</td>
                                {activeTab === 'students' && (
                                    <>
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">{u.rollNumber}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">{u.class}</td>
                                    </>
                                )}
                                <td className="px-6 py-4 whitespace-nowrap flex gap-3">
                                    <button onClick={() => openEditModal(u)} className="text-blue-600 hover:text-blue-800"><FaEdit /></button>
                                    <button onClick={() => handleDeleteUser(u.id)} className="text-red-600 hover:text-red-800"><FaTrash /></button>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );

    return (
        <div className="flex h-screen bg-gray-100 font-sans">
            {/* Sidebar */}
            <aside className="w-64 bg-slate-900 text-white flex flex-col hidden md:flex">
                <div className="p-6 border-b border-slate-700 flex items-center gap-3">
                    <FaUserShield className="text-purple-400 text-2xl" />
                    <span className="font-bold text-lg">Admin Panel</span>
                </div>
                <nav className="flex-1 p-4 space-y-2">
                    <div className={`nav-item ${activeTab === 'create-user' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`} onClick={() => setActiveTab('create-user')}>
                        <FaUserPlus /> <span>Create User</span>
                    </div>
                    <div className={`nav-item ${activeTab === 'teachers' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`} onClick={() => setActiveTab('teachers')}>
                        <FaChalkboardTeacher /> <span>Manage Teachers</span>
                    </div>
                    <div className={`nav-item ${activeTab === 'students' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`} onClick={() => setActiveTab('students')}>
                        <FaUserGraduate /> <span>Manage Students</span>
                    </div>
                    <div className={`nav-item ${activeTab === 'admins' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`} onClick={() => setActiveTab('admins')}>
                        <FaUsersCog /> <span>Manage Admins</span>
                    </div>
                </nav>
                <div className="p-4 border-t border-slate-700">
                    <button onClick={handleLogout} className="flex items-center gap-3 text-slate-400 hover:text-red-400 w-full px-4 py-2 transition-colors">
                        <FaSignOutAlt /> <span>Logout</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto">
                {/* Mobile Header */}
                <header className="bg-white shadow-sm p-4 flex justify-between items-center md:hidden">
                    <span className="font-bold text-gray-800">Admin Dashboard</span>
                    <button onClick={handleLogout} className="text-gray-600"><FaSignOutAlt /></button>
                </header>

                <div className="p-8 max-w-7xl mx-auto">
                    <div className="mb-6">
                        <h1 className="text-2xl font-bold text-gray-800 capitalize">
                            {activeTab.replace('-', ' ')}
                        </h1>
                        <p className="text-gray-500">Welcome, {user?.email}</p>
                    </div>

                    {message.text && (
                        <div className={`mb-4 p-4 rounded-lg ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                            {message.text}
                        </div>
                    )}

                    {activeTab === 'create-user' && (
                        <div className="bg-white p-8 rounded-2xl shadow-sm max-w-2xl border border-gray-100">
                            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
                                <p className="text-sm text-yellow-700">
                                    <strong>Note:</strong> Creating a new user will sign them in immediately. You will be logged out.
                                </p>
                            </div>
                            <form onSubmit={handleCreateUser} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                        <input type="email" required value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} className="form-input" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                                        <input type="password" required value={createForm.password} onChange={e => setCreateForm({ ...createForm, password: e.target.value })} className="form-input" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                                        <input type="text" required value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })} className="form-input" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                                        <select value={createForm.role} onChange={e => setCreateForm({ ...createForm, role: e.target.value })} className="form-input">
                                            <option value="student">Student</option>
                                            <option value="teacher">Teacher</option>
                                            <option value="admin">Admin</option>
                                        </select>
                                    </div>
                                </div>
                                {createForm.role === 'student' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-gray-50 rounded-lg">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Roll Num</label>
                                            <input type="text" required value={createForm.rollNumber} onChange={e => setCreateForm({ ...createForm, rollNumber: e.target.value })} className="form-input" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                                            <input type="text" required value={createForm.class} onChange={e => setCreateForm({ ...createForm, class: e.target.value })} className="form-input" />
                                        </div>
                                    </div>
                                )}
                                <button disabled={loading} type="submit" className="btn-primary w-full">
                                    {loading ? "Creating..." : "Create User"}
                                </button>
                            </form>
                        </div>
                    )}

                    {activeTab !== 'create-user' && renderUserTable()}
                </div>
            </main>

            {/* Edit Modal */}
            {editingUser && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold">Edit User</h2>
                            <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-gray-600"><FaTimes /></button>
                        </div>
                        <form onSubmit={handleUpdateUser} className="space-y-4">
                            <div>
                                <label className="form-label">Name</label>
                                <input type="text" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="form-input" />
                            </div>
                            {editingUser.role === 'student' && (
                                <>
                                    <div>
                                        <label className="form-label">Roll Number</label>
                                        <input type="text" value={editForm.rollNumber} onChange={e => setEditForm({ ...editForm, rollNumber: e.target.value })} className="form-input" />
                                    </div>
                                    <div>
                                        <label className="form-label">Class</label>
                                        <input type="text" value={editForm.class} onChange={e => setEditForm({ ...editForm, class: e.target.value })} className="form-input" />
                                    </div>
                                </>
                            )}
                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={() => setEditingUser(null)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
                                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Update</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
