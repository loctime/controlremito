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
  Order,
  User,
  OrderItem
} from "./types"
import { REPLACEMENT_QUEUES_COLLECTION, ORDERS_COLLECTION } from "./firestore-paths"

/**
 * Helper para eliminar campos undefined de un objeto antes de guardarlo en Firestore
 */
function removeUndefinedFields<T extends Record<string, any>>(obj: T): Partial<T> {
  const cleaned: any = {}
  
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value as any).toDate) {
        cleaned[key] = removeUndefinedFields(value)
      } else if (Array.isArray(value)) {
        cleaned[key] = value.map(item => 
          item !== null && typeof item === 'object' && !(item as any).toDate
            ? removeUndefinedFields(item)
            : item
        )
      } else {
        cleaned[key] = value
      }
    }
  }
  
  return cleaned
}

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
    console.log("🔍 DEBUG [createReplacementItem] - Iniciando creación:", {
      productName: item.productName,
      quantity: item.quantity,
      branchId: originalOrder.fromBranchId,
      branchName: originalOrder.fromBranchName
    })
    
    const replacementItem: Omit<ReplacementItem, "id"> = {
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unit: item.unit,
      reason,
      originalOrderId: originalOrder.id || "",
      originalOrderNumber: originalOrder.orderNumber || `PED-${Date.now()}`,
      reportedBy: reportingUser.id,
      reportedByName: reportingUser.name,
      reportedAt: Timestamp.now(),
      status: "pending"
    }
    
    console.log("🔍 DEBUG [createReplacementItem] - Item preparado con status:", replacementItem.status)
    console.log("🔍 DEBUG [createReplacementItem] - ReplacementItem campos:", {
      productId: replacementItem.productId,
      productName: replacementItem.productName,
      quantity: replacementItem.quantity,
      unit: replacementItem.unit,
      reason: replacementItem.reason,
      originalOrderId: replacementItem.originalOrderId,
      originalOrderNumber: replacementItem.originalOrderNumber,
      reportedBy: replacementItem.reportedBy,
      reportedByName: replacementItem.reportedByName,
      status: replacementItem.status
    })

    // Verificar si ya existe una cola para esta sucursal
    const existingQueue = await getReplacementQueue(originalOrder.fromBranchId)
    console.log("🔍 DEBUG [createReplacementItem] - Cola existente:", existingQueue ? `Sí (${existingQueue.id})` : "No")
    
    if (existingQueue) {
      // Agregar a cola existente
      const newItemWithId = { ...replacementItem, id: `${Date.now()}-${Math.random()}` }
      const cleanedNewItem = removeUndefinedFields(newItemWithId)
      const updatedItems = [...existingQueue.items, cleanedNewItem]
      
      console.log("🔍 DEBUG [createReplacementItem] - Agregando a cola existente:", {
        queueId: existingQueue.id,
        totalItemsAntes: existingQueue.items.length,
        totalItemsDespues: updatedItems.length,
        nuevoItem: cleanedNewItem
      })
      
      await updateDoc(doc(db, REPLACEMENT_QUEUES_COLLECTION, existingQueue.id), {
        items: updatedItems,
        updatedAt: Timestamp.now()
      })
      
      console.log("✅ DEBUG [createReplacementItem] - Item agregado exitosamente a cola:", existingQueue.id)
      return existingQueue.id
    } else {
      // Crear nueva cola
      const newItemWithId = { ...replacementItem, id: `${Date.now()}-${Math.random()}` }
      const cleanedNewItem = removeUndefinedFields(newItemWithId) as ReplacementItem
      const newQueue: Omit<ReplacementQueue, "id"> = {
        branchId: originalOrder.fromBranchId,
        branchName: originalOrder.fromBranchName,
        items: [cleanedNewItem],
        status: "pending",
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      }
      
      console.log("🔍 DEBUG [createReplacementItem] - Creando nueva cola:", {
        branchId: newQueue.branchId,
        branchName: newQueue.branchName,
        itemsLength: newQueue.items.length
      })
      
      console.log("🔍 DEBUG [createReplacementItem] - newQueue.items[0] campos:", {
        id: cleanedNewItem.id,
        productId: cleanedNewItem.productId,
        productName: cleanedNewItem.productName,
        quantity: cleanedNewItem.quantity,
        unit: cleanedNewItem.unit,
        reason: cleanedNewItem.reason,
        originalOrderId: cleanedNewItem.originalOrderId,
        originalOrderNumber: cleanedNewItem.originalOrderNumber,
        reportedBy: cleanedNewItem.reportedBy,
        reportedByName: cleanedNewItem.reportedByName,
        status: cleanedNewItem.status
      })
      
      // Verificar campos undefined antes de guardar
      const checkUndefined = (obj: any, path = '', depth = 0): string[] => {
        if (depth > 3) return [] // Evitar recursión infinita
        const undefinedFields: string[] = []
        for (const [key, value] of Object.entries(obj)) {
          const currentPath = path ? `${path}.${key}` : key
          if (value === undefined) {
            undefinedFields.push(currentPath)
          } else if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value as any).toDate) {
            undefinedFields.push(...checkUndefined(value, currentPath, depth + 1))
          } else if (Array.isArray(value)) {
            value.forEach((item, index) => {
              if (item === undefined) {
                undefinedFields.push(`${currentPath}[${index}]`)
              } else if (item !== null && typeof item === 'object' && !(item as any).toDate) {
                undefinedFields.push(...checkUndefined(item, `${currentPath}[${index}]`, depth + 1))
              }
            })
          }
        }
        return undefinedFields
      }
      
      const undefinedFields = checkUndefined(newQueue)
      console.log("🔍 DEBUG [createReplacementItem] - Verificación de undefined completada")
      if (undefinedFields.length > 0) {
        console.error("❌ [createReplacementItem] Campos undefined encontrados:", undefinedFields)
      } else {
        console.log("✅ [createReplacementItem] No se encontraron campos undefined")
      }
      
      // Limpiar campos undefined antes de guardar
      const cleanedQueue = removeUndefinedFields(newQueue)
      console.log("✅ [createReplacementItem] - Queue limpiada, guardando en Firestore...")
      
      const docRef = await addDoc(collection(db, REPLACEMENT_QUEUES_COLLECTION), cleanedQueue)
      console.log("✅ DEBUG [createReplacementItem] - Nueva cola creada con ID:", docRef.id)
      return docRef.id
    }
  } catch (error) {
    console.error("❌ ERROR [createReplacementItem]:", error)
    throw error
  }
}

/**
 * Obtener cola de reposiciones para una sucursal
 */
export async function getReplacementQueue(branchId: string): Promise<ReplacementQueue | null> {
  try {
    const q = query(
      collection(db, REPLACEMENT_QUEUES_COLLECTION),
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
      collection(db, REPLACEMENT_QUEUES_COLLECTION),
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
    const queueDoc = await getDoc(doc(db, REPLACEMENT_QUEUES_COLLECTION, queueId))
    if (!queueDoc.exists()) {
      throw new Error("Cola de reposiciones no encontrada")
    }
    
    const queue = queueDoc.data() as ReplacementQueue
    const orderDoc = await getDoc(doc(db, ORDERS_COLLECTION, targetOrderId))
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
    await updateDoc(doc(db, ORDERS_COLLECTION, targetOrderId), {
      items: [...order.items, ...newOrderItems],
      notes: `${order.notes || ""}\n\n[REPOSICIÓN] Items agregados automáticamente: ${itemsToMergeData.map(i => i.productName).join(", ")}`
    })
    
    // Actualizar cola de reposiciones
    // Solo actualizar el status de los items que SÍ se fusionaron
    const updatedItems = queue.items.map(item => {
      if (itemsToMerge.includes(item.id)) {
        return {
          ...item,
          status: "merged" as ReplacementStatus,
          mergedIntoOrderId: targetOrderId,
          mergedAt: Timestamp.now()
        }
      }
      return item // Mantener el item sin cambios si no se fusionó
    })
    
    await updateDoc(doc(db, REPLACEMENT_QUEUES_COLLECTION, queueId), {
      items: updatedItems,
      updatedAt: Timestamp.now(),
      status: updatedItems.filter(i => i.status === "pending").length === 0 ? "completed" : "in_queue"
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
    const queueDoc = await getDoc(doc(db, REPLACEMENT_QUEUES_COLLECTION, queueId))
    if (!queueDoc.exists()) {
      throw new Error("Cola de reposiciones no encontrada")
    }
    
    const queue = queueDoc.data() as ReplacementQueue
    // TODO: Implementar sistema de prioridades
    // Por ahora, procesar todos los items pendientes
    const urgentItems = queue.items.filter(item => 
      item.status === "pending"
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
    
    const orderRef = await addDoc(collection(db, ORDERS_COLLECTION), newOrder)
    
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
    
    await updateDoc(doc(db, REPLACEMENT_QUEUES_COLLECTION, queueId), {
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
      collection(db, ORDERS_COLLECTION),
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
    if (!queue) {
      return
    }
    
    const draftOrders = await checkAutoMergeOpportunities(branchId)
    if (draftOrders.length === 0) {
      return
    }
    
    // Fusionar con el primer pedido en draft
    const targetOrderId = draftOrders[0]
    // TODO: Implementar sistema de prioridades
    // Por ahora, procesar todos los items pendientes
    const normalItems = queue.items.filter(item => 
      item.status === "pending"
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
    const queueDoc = await getDoc(doc(db, REPLACEMENT_QUEUES_COLLECTION, queueId))
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
    
    await updateDoc(doc(db, REPLACEMENT_QUEUES_COLLECTION, queueId), {
      items: updatedItems,
      updatedAt: Timestamp.now()
    })
  } catch (error) {
    console.error("Error al marcar item como completado:", error)
    throw error
  }
}
