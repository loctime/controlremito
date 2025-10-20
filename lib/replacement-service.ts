import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  Timestamp,
  writeBatch
} from "firebase/firestore"
import { db } from "./firebase"
import type { 
  ReplacementItem, 
  ReplacementQueue, 
  ReplacementStatus, 
  ReplacementPriority,
  Order,
  User,
  OrderItem
} from "./types"

/**
 * Crear un item de reposición cuando se reporta un producto faltante
 */
export async function createReplacementItem(
  item: OrderItem,
  originalOrder: Order,
  reportingUser: User,
  reason: string
): Promise<string> {
  try {
    const replacementItem: Omit<ReplacementItem, "id"> = {
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unit: item.unit,
      reason,
      originalOrderId: originalOrder.id,
      originalOrderNumber: originalOrder.orderNumber,
      reportedBy: reportingUser.id,
      reportedByName: reportingUser.name,
      reportedAt: Timestamp.now(),
      status: "pending"
    }

    // Verificar si ya existe una cola para esta sucursal
    const existingQueue = await getReplacementQueue(originalOrder.fromBranchId)
    
    if (existingQueue) {
      // Agregar a cola existente
      const updatedItems = [...existingQueue.items, { ...replacementItem, id: `${Date.now()}-${Math.random()}` }]
      
      await updateDoc(doc(db, "apps/controld/replacementQueues", existingQueue.id), {
        items: updatedItems,
        updatedAt: Timestamp.now()
      })
      
      return existingQueue.id
    } else {
      // Crear nueva cola
      const newQueue: Omit<ReplacementQueue, "id"> = {
        branchId: originalOrder.fromBranchId,
        branchName: originalOrder.fromBranchName,
        items: [{ ...replacementItem, id: `${Date.now()}-${Math.random()}` }],
        status: "pending",
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        autoMergeEnabled: true,
        maxWaitDays: 3
      }
      
      const docRef = await addDoc(collection(db, "apps/controld/replacementQueues"), newQueue)
      return docRef.id
    }
  } catch (error) {
    console.error("Error al crear item de reposición:", error)
    throw error
  }
}

/**
 * Obtener cola de reposiciones para una sucursal
 */
export async function getReplacementQueue(branchId: string): Promise<ReplacementQueue | null> {
  try {
    const q = query(
      collection(db, "apps/controld/replacementQueues"),
      where("branchId", "==", branchId),
      where("status", "in", ["pending", "in_queue"])
    )
    
    const snapshot = await getDocs(q)
    
    if (snapshot.empty) {
      return null
    }
    
    const doc = snapshot.docs[0]
    return { id: doc.id, ...doc.data() } as ReplacementQueue
  } catch (error) {
    console.error("Error al obtener cola de reposiciones:", error)
    throw error
  }
}

/**
 * Obtener todas las colas de reposiciones
 */
export async function getAllReplacementQueues(): Promise<ReplacementQueue[]> {
  try {
    const q = query(
      collection(db, "apps/controld/replacementQueues"),
      orderBy("createdAt", "desc")
    )
    
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ReplacementQueue))
  } catch (error) {
    console.error("Error al obtener colas de reposiciones:", error)
    throw error
  }
}

/**
 * Fusionar items de reposición con un pedido existente
 */
export async function mergeReplacementItems(
  queueId: string,
  targetOrderId: string,
  itemsToMerge: string[], // IDs de los items a fusionar
  user: User
): Promise<void> {
  try {
    const queueDoc = await getDoc(doc(db, "apps/controld/replacementQueues", queueId))
    if (!queueDoc.exists()) {
      throw new Error("Cola de reposiciones no encontrada")
    }
    
    const queue = queueDoc.data() as ReplacementQueue
    const orderDoc = await getDoc(doc(db, "apps/controld/orders", targetOrderId))
    if (!orderDoc.exists()) {
      throw new Error("Pedido no encontrado")
    }
    
    const order = orderDoc.data() as Order
    
    // Filtrar items a fusionar
    const itemsToKeep = queue.items.filter(item => !itemsToMerge.includes(item.id))
    const itemsToMergeData = queue.items.filter(item => itemsToMerge.includes(item.id))
    
    // Crear nuevos items para el pedido
    const newOrderItems: OrderItem[] = itemsToMergeData.map(item => ({
      id: `${Date.now()}-${Math.random()}`,
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unit: item.unit,
      status: "pending"
    }))
    
    // Actualizar pedido con nuevos items
    await updateDoc(doc(db, "apps/controld/orders", targetOrderId), {
      items: [...order.items, ...newOrderItems],
      notes: `${order.notes || ""}\n\n[REPOSICIÓN] Items agregados automáticamente: ${itemsToMergeData.map(i => i.productName).join(", ")}`
    })
    
    // Actualizar cola de reposiciones
    const updatedItems = itemsToKeep.map(item => ({
      ...item,
      status: "merged" as ReplacementStatus,
      mergedIntoOrderId: targetOrderId,
      mergedAt: Timestamp.now()
    }))
    
    await updateDoc(doc(db, "apps/controld/replacementQueues", queueId), {
      items: updatedItems,
      updatedAt: Timestamp.now(),
      status: updatedItems.length === 0 ? "completed" : "in_queue"
    })
    
  } catch (error) {
    console.error("Error al fusionar items de reposición:", error)
    throw error
  }
}

/**
 * Crear pedido automático para items urgentes
 */
export async function createUrgentReplacementOrder(
  queueId: string,
  user: User
): Promise<string> {
  try {
    const queueDoc = await getDoc(doc(db, "apps/controld/replacementQueues", queueId))
    if (!queueDoc.exists()) {
      throw new Error("Cola de reposiciones no encontrada")
    }
    
    const queue = queueDoc.data() as ReplacementQueue
    const urgentItems = queue.items.filter(item => 
      item.priority === "urgent" && item.status === "pending"
    )
    
    if (urgentItems.length === 0) {
      throw new Error("No hay items urgentes para procesar")
    }
    
    // Crear nuevo pedido
    const newOrder: Omit<Order, "id"> = {
      orderNumber: `REP-${Date.now()}`,
      fromBranchId: queue.branchId,
      fromBranchName: queue.branchName,
      toBranchId: "", // Se debe determinar la fábrica destino
      toBranchName: "",
      status: "draft",
      items: urgentItems.map(item => ({
        id: `${Date.now()}-${Math.random()}`,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unit: item.unit,
        status: "pending"
      })),
      createdAt: Timestamp.now(),
      createdBy: user.id,
      createdByName: user.name,
      notes: `[REPOSICIÓN URGENTE] Items faltantes: ${urgentItems.map(i => i.productName).join(", ")}`,
      parentOrderId: urgentItems[0].originalOrderId
    }
    
    const orderRef = await addDoc(collection(db, "apps/controld/orders"), newOrder)
    
    // Marcar items como fusionados
    const updatedItems = queue.items.map(item => {
      if (urgentItems.some(urgent => urgent.id === item.id)) {
        return {
          ...item,
          status: "merged" as ReplacementStatus,
          mergedIntoOrderId: orderRef.id,
          mergedAt: Timestamp.now()
        }
      }
      return item
    })
    
    await updateDoc(doc(db, "apps/controld/replacementQueues", queueId), {
      items: updatedItems,
      updatedAt: Timestamp.now()
    })
    
    return orderRef.id
  } catch (error) {
    console.error("Error al crear pedido urgente:", error)
    throw error
  }
}

/**
 * Verificar si hay pedidos en draft para fusionar automáticamente
 */
export async function checkAutoMergeOpportunities(branchId: string): Promise<string[]> {
  try {
    const q = query(
      collection(db, "apps/controld/orders"),
      where("fromBranchId", "==", branchId),
      where("status", "==", "draft")
    )
    
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => doc.id)
  } catch (error) {
    console.error("Error al verificar oportunidades de fusión:", error)
    throw error
  }
}

/**
 * Procesar fusión automática para items en cola
 */
export async function processAutoMerge(branchId: string): Promise<void> {
  try {
    const queue = await getReplacementQueue(branchId)
    if (!queue || !queue.autoMergeEnabled) {
      return
    }
    
    const draftOrders = await checkAutoMergeOpportunities(branchId)
    if (draftOrders.length === 0) {
      return
    }
    
    // Fusionar con el primer pedido en draft
    const targetOrderId = draftOrders[0]
    const normalItems = queue.items.filter(item => 
      item.priority !== "urgent" && item.status === "pending"
    )
    
    if (normalItems.length > 0) {
      await mergeReplacementItems(
        queue.id,
        targetOrderId,
        normalItems.map(item => item.id),
        { id: "system", name: "Sistema", email: "", role: "admin" } as User
      )
    }
  } catch (error) {
    console.error("Error en fusión automática:", error)
    throw error
  }
}

/**
 * Marcar item de reposición como completado
 */
export async function markReplacementItemCompleted(
  queueId: string,
  itemId: string,
  user: User
): Promise<void> {
  try {
    const queueDoc = await getDoc(doc(db, "apps/controld/replacementQueues", queueId))
    if (!queueDoc.exists()) {
      throw new Error("Cola de reposiciones no encontrada")
    }
    
    const queue = queueDoc.data() as ReplacementQueue
    const updatedItems = queue.items.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          status: "completed" as ReplacementStatus,
          completedAt: Timestamp.now(),
          completedBy: user.id,
          completedByName: user.name
        }
      }
      return item
    })
    
    await updateDoc(doc(db, "apps/controld/replacementQueues", queueId), {
      items: updatedItems,
      updatedAt: Timestamp.now()
    })
  } catch (error) {
    console.error("Error al marcar item como completado:", error)
    throw error
  }
}
