import { collection, addDoc, getDocs, updateDoc, doc, query, where, writeBatch } from "firebase/firestore"
import { db } from "./firebase"
import type { Product } from "./types"
import { PRODUCTS_COLLECTION } from "./firestore-paths"

// Servicio para obtener productos
export const fetchProducts = async (): Promise<Product[]> => {
  const q = query(collection(db, PRODUCTS_COLLECTION), where("active", "==", true))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Product[]
}

// Servicio para crear producto
export const createProduct = async (productData: Omit<Product, "id">, userId: string): Promise<void> => {
  await addDoc(collection(db, PRODUCTS_COLLECTION), {
    ...productData,
    createdAt: new Date(),
    createdBy: userId,
    active: true,
  })
}

// Servicio para actualizar producto
export const updateProduct = async (productId: string, productData: Partial<Product>): Promise<void> => {
  await updateDoc(doc(db, PRODUCTS_COLLECTION, productId), productData)
}

// Servicio para eliminar producto (soft delete)
export const deleteProduct = async (productId: string): Promise<void> => {
  await updateDoc(doc(db, PRODUCTS_COLLECTION, productId), { active: false })
}

// Servicio para importación masiva
export const bulkImportProducts = async (products: Partial<Product>[], userId: string): Promise<void> => {
  const batch = writeBatch(db)
  const productsRef = collection(db, PRODUCTS_COLLECTION)

  products.forEach((product) => {
    const newDocRef = doc(productsRef)
    batch.set(newDocRef, {
      ...product,
      createdAt: new Date(),
      createdBy: userId,
      active: true,
    })
  })

  await batch.commit()
}
