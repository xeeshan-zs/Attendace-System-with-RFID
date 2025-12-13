import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// TODO: Replace with your actual Firebase project configuration
// You can get these details from the Firebase Console -> Project Settings
const firebaseConfig = {
    apiKey: "AIzaSyB80NcMvcKP-E8hLZI3KZx0l732q997hts",
    authDomain: "rfid-numl.firebaseapp.com",
    projectId: "rfid-numl",
    storageBucket: "rfid-numl.firebasestorage.app",
    messagingSenderId: "247170708300",
    appId: "1:247170708300:web:e8fccb0e29125d3783d5e9",
    measurementId: "G-HXC5MR65T4"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
