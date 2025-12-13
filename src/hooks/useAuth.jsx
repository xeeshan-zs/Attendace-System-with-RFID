import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

export const useAuth = () => {
    const [user, setUser] = useState(null);
    const [role, setRole] = useState(null);
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setLoading(true);
            if (currentUser) {
                setUser(currentUser);
                try {
                    // Fetch additional user details (like role and rollNumber) from Firestore
                    const userDocRef = doc(db, "users", currentUser.uid);
                    const userDoc = await getDoc(userDocRef);

                    if (userDoc.exists()) {
                        const data = userDoc.data();
                        setRole(data.role || "student");
                        setUserData(data);
                    } else {
                        console.warn("User authenticated but no Firestore document found.");
                        setRole(null); // Or handle as default role
                    }
                } catch (error) {
                    console.error("Error fetching user role from Firestore:", error);
                    setRole(null);
                }
            } else {
                setUser(null);
                setRole(null);
                setUserData(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    return { user, role, userData, loading };
};
