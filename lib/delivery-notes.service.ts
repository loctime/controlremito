import { collection, doc, getDoc, getDocs, orderBy, query } from "firebase/firestore"
import { db } from "./firebase"
import type { DeliveryNote } from "./types"
import { DELIVERY_NOTES_COLLECTION } from "./firestore-paths"

export const fetchDeliveryNotes = async (): Promise<DeliveryNote[]> => {
  const notesQuery = query(collection(db, DELIVERY_NOTES_COLLECTION), orderBy("createdAt", "desc"))
  const snapshot = await getDocs(notesQuery)
  return snapshot.docs.map((note) => ({ id: note.id, ...note.data() })) as DeliveryNote[]
}

export const fetchDeliveryNoteById = async (noteId: string): Promise<DeliveryNote | null> => {
  const noteRef = doc(db, DELIVERY_NOTES_COLLECTION, noteId)
  const noteSnap = await getDoc(noteRef)

  if (!noteSnap.exists()) {
    return null
  }

  return { id: noteSnap.id, ...noteSnap.data() } as DeliveryNote
}

