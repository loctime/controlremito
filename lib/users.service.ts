import { collection, getDocs, updateDoc, doc, query, where } from "firebase/firestore"
import { db } from "./firebase"
import type { User, Branch } from "./types"
import { USERS_COLLECTION, BRANCHES_COLLECTION } from "./firestore-paths"

// Servicio para obtener usuarios
export const fetchUsers = async (): Promise<User[]> => {
  const q = query(collection(db, USERS_COLLECTION))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as User[]
}

// Servicio para obtener sucursales (reutilizamos el de settings)
export const fetchBranches = async (): Promise<Branch[]> => {
  const q = query(collection(db, BRANCHES_COLLECTION), where("active", "==", true))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Branch[]
}

// Servicio para actualizar usuario
export const updateUser = async (userId: string, userData: Partial<User>): Promise<void> => {
  await updateDoc(doc(db, USERS_COLLECTION, userId), userData)
}

// Servicio para cambiar rol de usuario
export const changeUserRole = async (userId: string, role: string): Promise<void> => {
  await updateDoc(doc(db, USERS_COLLECTION, userId), { role })
}
