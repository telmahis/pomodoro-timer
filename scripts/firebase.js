import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyADb7wVLWp7nXRZDVG8mfw4f4nVFTxtXb4",
    authDomain: "pomotimer-6441d.firebaseapp.com",
    projectId: "pomotimer-6441d",
    storageBucket: "pomotimer-6441d.firebasestorage.app",
    messagingSenderId: "276646605409",
    appId: "1:276646605409:web:6ae1c9ea67d337d4c5f020",
    measurementId: "G-JKSTX5ZYXK"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
