import { collection, query, where, getDocs, updateDoc, doc, orderBy } from "firebase/firestore"
import { db } from "./firebase"
import type { Order, Template, User } from "./types"
import { ORDERS_COLLECTION, TEMPLATES_COLLECTION } from "./firestore-paths"

// Servicio para obtener órdenes por estado
export const fetchOrdersByStatus = async (user: any, status: Order["status"]): Promise<Order[]> => {
  const ordersRef = collection(db, ORDERS_COLLECTION)
  let q = query(ordersRef, where("status", "==", status))

  // Filtrar según el rol
  if (user.role === "branch" && user.branchId) {
    q = query(ordersRef, where("fromBranchId", "==", user.branchId), where("status", "==", status))
  } else if ((user.role === "factory" || user.role === "delivery") && user.branchId) {
    q = query(ordersRef, where("toBranchId", "==", user.branchId), where("status", "==", status))
  }

  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Order[]
}

// Servicio para obtener órdenes con información de plantillas
export const fetchOrdersWithTemplates = async (user: any, status: Order["status"]): Promise<Array<Order & { templateName: string }>> => {
  const orders = await fetchOrdersByStatus(user, status)
  
  // Obtener IDs únicos de plantillas
  const templateIds = [...new Set(orders.map(o => o.templateId).filter(Boolean))] as string[]
  
  // Crear mapa de plantillas
  const templatesMap = new Map<string, string>()
  
  if (templateIds.length > 0) {
    // Firestore permite máximo 10 items en "in", así que dividimos si es necesario
    const chunks = []
    for (let i = 0; i < templateIds.length; i += 10) {
      chunks.push(templateIds.slice(i, i + 10))
    }
    
    for (const chunk of chunks) {
      const templatesRef = collection(db, TEMPLATES_COLLECTION)
      const templatesQuery = query(templatesRef, where("__name__", "in", chunk))
      const templatesSnapshot = await getDocs(templatesQuery)
      
      templatesSnapshot.docs.forEach(doc => {
        const template = doc.data() as Template
        templatesMap.set(doc.id, template.name || "Sin nombre")
      })
    }
  }
  
  // Mapear órdenes con nombres de plantillas
  return orders.map(order => ({
    ...order,
    templateName: order.templateId 
      ? (templatesMap.get(order.templateId) || "Plantilla no encontrada")
      : "Sin plantilla"
  }))
}

// Servicio para obtener listado completo de órdenes según el rol del usuario
export const fetchOrdersList = async (user: User | null): Promise<Order[]> => {
  if (!user) return []

  const ordersRef = collection(db, ORDERS_COLLECTION)

  if ((user.role === "branch" || user.role === "factory") && user.branchId) {
    const qFrom = query(ordersRef, where("fromBranchId", "==", user.branchId), orderBy("createdAt", "desc"))
    const qTo = query(ordersRef, where("toBranchId", "==", user.branchId), orderBy("createdAt", "desc"))

    const [snapshotFrom, snapshotTo] = await Promise.all([getDocs(qFrom), getDocs(qTo)])

    const ordersFrom = snapshotFrom.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Order[]
    const ordersTo = snapshotTo.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Order[]

    const ordersMap = new Map<string, Order>()
    ;[...ordersFrom, ...ordersTo].forEach((order) => ordersMap.set(order.id, order))

    return Array.from(ordersMap.values()).sort((a, b) => {
      const aDate = (a.createdAt as any)?.seconds || 0
      const bDate = (b.createdAt as any)?.seconds || 0
      return bDate - aDate
    })
  }

  if (user.role === "delivery") {
    const q = query(
      ordersRef,
      where("status", "in", ["assembling", "in_transit", "received"]),
      orderBy("createdAt", "desc")
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Order[]
  }

  const q = query(ordersRef, orderBy("createdAt", "desc"))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Order[]
}

// Servicio para actualizar estado de orden
export const updateOrderStatus = async (orderId: string, status: Order["status"], user: any, additionalData?: any): Promise<void> => {
  const updateData: any = {
    status,
    ...additionalData
  }

  // Agregar información de usuario según el estado
  switch (status) {
    case "assembling":
      updateData.acceptedAt = new Date()
      updateData.acceptedBy = user.id
      updateData.acceptedByName = user.name
      break
    case "in_transit":
      updateData.deliveredAt = new Date()
      updateData.deliveredBy = user.id
      updateData.deliveredByName = user.name
      break
  }

  await updateDoc(doc(db, ORDERS_COLLECTION, orderId), updateData)
}

// Servicio para marcar orden como lista
export const markOrderAsReady = async (orderId: string, user: any): Promise<void> => {
  await updateDoc(doc(db, ORDERS_COLLECTION, orderId), {
    preparedAt: new Date(),
    preparedBy: user.id,
    preparedByName: user.name
  })
}
