import { db } from "./firebase"
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore"

/**
 * Servicio de utilidades para desarrollo
 * ADVERTENCIA: Estas funciones son destructivas y solo deben usarse en desarrollo
 */

export async function clearFirestoreCollections(
  collectionsToDelete: string[]
): Promise<{ success: boolean; message: string; details?: any }> {
  try {
    const results: Record<string, number> = {}

    for (const collectionName of collectionsToDelete) {
      const collectionRef = collection(db, collectionName)
      const snapshot = await getDocs(collectionRef)
      
      let deletedCount = 0
      const deletePromises = snapshot.docs.map(async (document) => {
        await deleteDoc(doc(db, collectionName, document.id))
        deletedCount++
      })

      await Promise.all(deletePromises)
      results[collectionName] = deletedCount
    }

    return {
      success: true,
      message: "Colecciones eliminadas exitosamente",
      details: results,
    }
  } catch (error: any) {
    console.error("Error al limpiar colecciones:", error)
    return {
      success: false,
      message: `Error al eliminar colecciones: ${error.message}`,
    }
  }
}

/**
 * Limpia las colecciones principales del sistema
 */
export async function clearMainCollections() {
  return clearFirestoreCollections([
    "orders",
    "delivery-notes",
    "remit-metadata",
  ])
}




