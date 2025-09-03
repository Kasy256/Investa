import { initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"

const firebaseConfig = {
  apiKey: "AIzaSyAivU94alwgJLgtUeCoIYdZiME1-rXMydI",
  authDomain: "investa-room.firebaseapp.com",
  projectId: "investa-room",
  storageBucket: "investa-room.firebasestorage.app",
  messagingSenderId: "37227932409",
  appId: "1:37227932409:web:c808c0001c2caa8e835028",
  measurementId: "G-NCHW4M0R3V"
}


const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export default app
