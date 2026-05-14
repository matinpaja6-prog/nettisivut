import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

export const isFirebaseConfigured =
  Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
  );

export function getFirebaseAuth() {
  if (!isFirebaseConfigured) {
    return null;
  }

  const app =
    getApps().length > 0
      ? getApps()[0]
      : initializeApp(firebaseConfig);

  const auth =
    getAuth(app);

  auth.languageCode = "fi";

  if (process.env.NODE_ENV === "development") {
    auth.settings.appVerificationDisabledForTesting = true;
  }

  return auth;
}
