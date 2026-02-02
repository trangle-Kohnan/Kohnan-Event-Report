
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCmw6n6NIStgdjCAXoHh3N5J-RI4xfbFbY",
  authDomain: "kohnan-d20d3.firebaseapp.com",
  projectId: "kohnan-d20d3",
  storageBucket: "kohnan-d20d3.firebasestorage.app",
  messagingSenderId: "827178566760",
  appId: "1:827178566760:web:62825179df0efd639f67dd",
  measurementId: "G-PXJKN85XG8"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
