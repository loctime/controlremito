"use client"

import type React from "react"

import { createContext, useContext, useEffect, useState } from "react"
import {
  type User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
} from "firebase/auth"
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore"
import { auth, db, googleProvider } from "./firebase"
import type { User } from "./types"

interface AuthContextType {
  user: User | null
  firebaseUser: FirebaseUser | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signInWithGoogleAndRole: (role: string) => Promise<void>
  signOut: () => Promise<void>
  registerWithEmailPassword: (email: string, password: string, name: string, role: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setFirebaseUser(firebaseUser)

      if (firebaseUser) {
        // Obtener datos adicionales del usuario desde Firestore
        const userDoc = await getDoc(doc(db, "apps/controld/users", firebaseUser.uid))
        if (userDoc.exists()) {
          setUser({ id: firebaseUser.uid, ...userDoc.data() } as User)
        } else {
          setUser(null)
        }
      } else {
        setUser(null)
      }

      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const signInWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider)
  }

  const signInWithGoogleAndRole = async (role: string) => {
    const result = await signInWithPopup(auth, googleProvider)
    const user = result.user

    // Verificar si el usuario ya existe en Firestore
    const userDoc = await getDoc(doc(db, "apps/controld/users", user.uid))
    
    if (!userDoc.exists()) {
      // Crear documento de usuario en Firestore con el rol especificado
      await setDoc(doc(db, "apps/controld/users", user.uid), {
        email: user.email,
        name: user.displayName || user.email?.split("@")[0] || "Usuario",
        role,
        createdAt: serverTimestamp(),
        active: true,
      })
    }
  }

  const signOut = async () => {
    await firebaseSignOut(auth)
    setUser(null)
  }

  const registerWithEmailPassword = async (email: string, password: string, name: string, role: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password)
    const newUser = userCredential.user

    // Crear documento de usuario en Firestore
    await setDoc(doc(db, "apps/controld/users", newUser.uid), {
      email: newUser.email,
      name,
      role,
      createdAt: serverTimestamp(),
      active: true,
    })
  }

  return (
    <AuthContext.Provider value={{ user, firebaseUser, loading, signInWithGoogle, signInWithGoogleAndRole, signOut, registerWithEmailPassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth debe usarse dentro de un AuthProvider")
  }
  return context
}
