import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// Using the configuration provided by the user to ensure synchronization with their existing application
const firebaseConfig = {
  apiKey: "AIzaSyB7-EjQ5lJkLxM9nQrY3xU8vW2iLpKjH1M",
  authDomain: "transportecolectivomanagua.firebaseapp.com",
  databaseURL: "https://transportecolectivomanagua-default-rtdb.firebaseio.com/",
  projectId: "transportecolectivomanagua",
  storageBucket: "transportecolectivomanagua.appspot.com"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
