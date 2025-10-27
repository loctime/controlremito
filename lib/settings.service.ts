import { collection, addDoc, getDocs, updateDoc, doc, query, where } from "firebase/firestore"
import { db } from "./firebase"
import type { Branch, User } from "./types"

// Servicio para obtener sucursales
export const fetchBranches = async (): Promise<Branch[]> => {
  const q = query(collection(db, "apps/controld/branches"), where("active", "==", true))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Branch[]
}

// Servicio para crear sucursal
export const createBranch = async (branchData: Omit<Branch, "id">, userId: string, userName: string): Promise<void> => {
  await addDoc(collection(db, "apps/controld/branches"), {
    ...branchData,
    createdAt: new Date(),
    createdBy: userId,
    createdByName: userName,
    active: true,
  })
}

// Servicio para actualizar sucursal
export const updateBranch = async (branchId: string, branchData: Partial<Branch>): Promise<void> => {
  await updateDoc(doc(db, "apps/controld/branches", branchId), branchData)
}

// Servicio para eliminar sucursal (soft delete)
export const deleteBranch = async (branchId: string): Promise<void> => {
  await updateDoc(doc(db, "apps/controld/branches", branchId), { active: false })
}

// Servicio para actualizar perfil de usuario
export const updateUserProfile = async (userId: string, profileData: {
  name?: string
  signature?: {
    fullName: string
    position: string
    signatureImage?: string
  }
}): Promise<void> => {
  await updateDoc(doc(db, "apps/controld/users", userId), profileData)
}
