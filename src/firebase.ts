import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  initializeFirestore, 
  setLogLevel, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged, User } from "firebase/auth";
import { getStorage } from "firebase/storage";

// Supress verbose client offline / connection retry logs
setLogLevel('silent');

// Konfigurasi resmi proyek Firebase (bisa di-override lewat file .env atau Vercel Environment Variables)
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyC_56TuoItrEFJqP2dGI7c2g0-yjJ-Yqag",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "gen-lang-client-0343008361.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://gen-lang-client-0343008361-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "gen-lang-client-0343008361",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "gen-lang-client-0343008361.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "612040701151",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:612040701151:web:737d8c4ce820925c2ba56a"
};

// 1. Inisialisasi Firebase App
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// 2. Inisialisasi Firestore dengan persistent cache & auto-detect long polling (anti [code=unavailable])
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  }),
  experimentalAutoDetectLongPolling: true,
  ignoreUndefinedProperties: true
}, "(default)");

// 3. Inisialisasi fitur Login dan Penyimpanan File/Gambar
export const auth = getAuth(app);
export const storage = getStorage(app);

export function ensureAuth(): Promise<User | null> {
  return new Promise((resolve) => {
    if (!auth) {
      resolve(null);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        unsubscribe();
        resolve(user);
      } else {
        try {
          const cred = await signInAnonymously(auth);
          unsubscribe();
          resolve(cred.user);
        } catch {
          unsubscribe();
          resolve(null);
        }
      }
    });
  });
}

