"use client"

import type React from "react"

import { createContext, useContext, useEffect, useState } from "react"
import { initializeApp, deleteApp } from "firebase/app"
import {
  type User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  getAuth,
} from "firebase/auth"
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore"
import { auth, db, googleProvider } from "./firebase"
import type { User } from "./types"
import { USERS_COLLECTION } from "./firestore-paths"

interface AuthContextType {
  user: User | null
  firebaseUser: FirebaseUser | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signInWithGoogleAndRole: (role: string) => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  registerWithEmailPassword: (email: string, password: string, name: string, role: string) => Promise<void>
  createUser: (email: string, password: string, userData: Partial<User>) => Promise<void>
  changeRole: (role: string) => Promise<void>
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
        const userDoc = await getDoc(doc(db, USERS_COLLECTION, firebaseUser.uid))
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
    console.log("[Auth] Iniciando sesión con Google...")
    try {
      await signInWithPopup(auth, googleProvider)
      console.log("[Auth] Sesión iniciada exitosamente")
    } catch (error) {
      console.error("[Auth] Error en signInWithGoogle:", error)
      throw error
    }
  }

  const signInWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password)
  }

  const signInWithGoogleAndRole = async (role: string) => {
    const result = await signInWithPopup(auth, googleProvider)
    const user = result.user

    // Verificar si el usuario ya existe en Firestore
    const userDoc = await getDoc(doc(db, USERS_COLLECTION, user.uid))
    
    if (!userDoc.exists()) {
      // Crear documento de usuario en Firestore con el rol especificado
      console.log("[Auth] Creando nuevo documento para usuario:", user.email, "con rol:", role)
      await setDoc(doc(db, USERS_COLLECTION, user.uid), {
        email: user.email,
        name: user.displayName || user.email?.split("@")[0] || "Usuario",
        role,
        createdAt: serverTimestamp(),
        active: true,
      })
    } else {
      // Usuario ya existe, actualizar solo si está inactivo o sin rol definido
      const userData = userDoc.data()
      if (!userData.active || !userData.role) {
        console.log("[Auth] Actualizando usuario existente:", user.email, "con rol:", role)
        await setDoc(doc(db, USERS_COLLECTION, user.uid), {
          email: user.email,
          name: user.displayName || userData.name || user.email?.split("@")[0] || "Usuario",
          role,
          createdAt: userData.createdAt || serverTimestamp(),
          active: true,
        }, { merge: true })
      } else {
        console.log("[Auth] Usuario ya existe y está activo en Firestore:", user.email)
      }
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
    await setDoc(doc(db, USERS_COLLECTION, newUser.uid), {
      email: newUser.email,
      name,
      role,
      createdAt: serverTimestamp(),
      active: true,
    })
  }

  const createUser = async (email: string, password: string, userData: Partial<User>) => {
    try {
      // Crear una segunda instancia de Firebase solo para crear usuarios
      // Esto evita que se cierre la sesión del admin
      const secondaryApp = initializeApp(
        {
          apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
          authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        },
        'secondary' + Date.now() // Nombre único para cada operación
      )
      const secondaryAuth = getAuth(secondaryApp)

      // Crear el usuario en la instancia secundaria (no afecta la sesión principal)
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password)
      const newUser = userCredential.user

      // Crear documento de usuario en Firestore con todos los datos proporcionados
      await setDoc(doc(db, USERS_COLLECTION, newUser.uid), {
        email: newUser.email,
        name: userData.name || "",
        role: userData.role || "branch",
        branchId: userData.branchId || null,
        createdAt: serverTimestamp(),
        active: userData.active !== undefined ? userData.active : true,
      })
      
      // Eliminar la app secundaria para liberar recursos
      await deleteApp(secondaryApp)
      
    } catch (error: any) {
      // Si el usuario ya existe en Firebase Auth (de otra app), 
      // iniciar sesión en instancia secundaria para obtener el UID y crear el documento
      if (error.code === "auth/email-already-in-use") {
        try {
          // Crear una instancia secundaria para verificar el usuario existente
          const secondaryApp = initializeApp(
            {
              apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
              authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
              projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            },
            'secondary-check' + Date.now()
          )
          const secondaryAuth = getAuth(secondaryApp)
          
          // Iniciar sesión con el usuario existente para obtener su UID
          const userCredential = await signInWithEmailAndPassword(secondaryAuth, email, password)
          const existingUser = userCredential.user
          
          // Verificar si ya existe el documento en Firestore
          const userDoc = await getDoc(doc(db, USERS_COLLECTION, existingUser.uid))
          
          if (userDoc.exists()) {
            // Si el documento ya existe, actualizar los datos
            await setDoc(doc(db, USERS_COLLECTION, existingUser.uid), {
              email: existingUser.email,
              name: userData.name || userDoc.data().name || "",
              role: userData.role || "branch",
              branchId: userData.branchId || null,
              createdAt: userDoc.data().createdAt || serverTimestamp(),
              active: userData.active !== undefined ? userData.active : true,
            }, { merge: true })
          } else {
            // Crear nuevo documento de usuario en Firestore
            await setDoc(doc(db, USERS_COLLECTION, existingUser.uid), {
              email: existingUser.email,
              name: userData.name || "",
              role: userData.role || "branch",
              branchId: userData.branchId || null,
              createdAt: serverTimestamp(),
              active: userData.active !== undefined ? userData.active : true,
            })
          }
          
          // Eliminar la app secundaria
          await deleteApp(secondaryApp)
          
        } catch (signInError: any) {
          // Si falla el inicio de sesión, significa que la contraseña es incorrecta
          // o que el usuario existe en Auth pero no podemos acceder
          throw new Error("auth/email-already-exists-wrong-password")
        }
      } else {
        // Re-lanzar otros errores
        throw error
      }
    }
  }

  // Función para cambiar el rol del usuario actual (solo para desarrollo)
  const changeRole = async (role: string) => {
    if (!firebaseUser) return
    
      await setDoc(doc(db, USERS_COLLECTION, firebaseUser.uid), {
      role,
    }, { merge: true })
    
    // Recargar los datos del usuario
    const userDoc = await getDoc(doc(db, USERS_COLLECTION, firebaseUser.uid))
    if (userDoc.exists()) {
      setUser({ id: firebaseUser.uid, ...userDoc.data() } as User)
    }
  }

  return (
    <AuthContext.Provider value={{ user, firebaseUser, loading, signInWithGoogle, signInWithGoogleAndRole, signInWithEmail, signOut, registerWithEmailPassword, createUser, changeRole }}>
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
