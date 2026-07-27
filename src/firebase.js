import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';

// ============================================================================
//  CONFIG DE FIREBASE  → pegá acá los datos de tu proyecto.
//  Firebase console → ⚙ Configuración del proyecto → "Tus apps" → app web → SDK.
//  Estos valores son públicos (van en la app), no son secretos.
// ============================================================================
export const firebaseConfig = {
  apiKey: 'AIzaSyDrhUJLLJh6L-hJ6atNkkuEJ7XfzY4lg58',
  authDomain: 'gastos-9cde6.firebaseapp.com',
  projectId: 'gastos-9cde6',
  storageBucket: 'gastos-9cde6.firebasestorage.app',
  messagingSenderId: '788672048109',
  appId: '1:788672048109:web:5a6731b84cd2ecaeae55e4',
};

export function isFirebaseConfigured() {
  return !!firebaseConfig.apiKey && !!firebaseConfig.projectId;
}

let dbInstance = null;
export function getFirestoreDb() {
  if (!isFirebaseConfigured()) return null;
  if (!dbInstance) {
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    // Long polling: más estable en React Native que el streaming por defecto.
    dbInstance = initializeFirestore(app, { experimentalForceLongPolling: true });
  }
  return dbInstance;
}
