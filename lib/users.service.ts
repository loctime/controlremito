import { collection, getDocs, updateDoc, doc, query, where } from "firebase/firestore"
import { db } from "./firebase"
import type { User, Branch } from "./types"

// Servicio para obtener usuarios
export const fetchUsers = async (): Promise<User[]> => {
  const q = query(collection(db, "apps/controld/users"))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as User[]
}

// Servicio para obtener sucursales (reutilizamos el de settings)
export const fetchBranches = async (): Promise<Branch[]> => {
  const q = query(collection(db, "apps/controld/branches"), where("active", "==", true))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Branch[]
}

// Servicio para actualizar usuario
export const updateUser = async (userId: string, userData: Partial<User>): Promise<void> => {
  await updateDoc(doc(db, "apps/controld/users", userId), userData)
}

// Servicio para cambiar rol de usuario
export const changeUserRole = async (userId: string, role: string): Promise<void> => {
  await updateDoc(doc(db, "apps/controld/users", userId), { role })
}
