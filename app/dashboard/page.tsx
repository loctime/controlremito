"use client"

import { ProtectedRoute } from "@/components/protected-route"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ShoppingCart, Clock, Package, Truck, CheckCircle, FileText, Plus, Send, Edit, ChevronDown, ChevronUp, Save, X, CheckCheck, ChevronRight } from "lucide-react"
import { useEffect, useState } from "react"
import { collection, query, where, getDocs, type Timestamp, addDoc, doc, updateDoc, documentId, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Order, Template } from "@/lib/types"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { isDayAllowed, getNextAllowedDay, getCurrentDayOfWeek } from "@/lib/utils"
import { createRemitMetadata } from "@/lib/remit-metadata-service"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

function DashboardContent() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [stats, setStats] = useState({
    makeOrder: 0,
    pendingToReceive: 0,
    pendingProducts: 0,
    onTheWay: 0,
    received: 0,
  })
  const [templates, setTemplates] = useState<Template[]>([])
  const [draftOrders, setDraftOrders] = useState<Order[]>([])
  const [expandedCard, setExpandedCard] = useState<string | null>(null)
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)
  const [editFormData, setEditFormData] = useState<{
    items: { productId: string; productName: string; quantity: number; unit: string }[]
    notes: string
  }>({ items: [], notes: "" })
  const [pendingOrders, setPendingOrders] = useState<(Order & { templateName: string })[]>([])
  const [assemblingOrders, setAssemblingOrders] = useState<(Order & { templateName: string })[]>([])
  const [inTransitOrders, setInTransitOrders] = useState<(Order & { templateName: string })[]>([])
  const [showPendingOrders, setShowPendingOrders] = useState(false)
  const [collapsedTemplates, setCollapsedTemplates] = useState<Set<string>>(new Set())
  const [collapsedAssemblingTemplates, setCollapsedAssemblingTemplates] = useState<Set<string>>(new Set())
  const [collapsedInTransitTemplates, setCollapsedInTransitTemplates] = useState<Set<string>>(new Set())
  const [showAcceptConfirmation, setShowAcceptConfirmation] = useState(false)
  const [showAcceptAllConfirmation, setShowAcceptAllConfirmation] = useState(false)
  const [orderToAccept, setOrderToAccept] = useState<(Order & { templateName: string }) | null>(null)
  const [ordersToAcceptAll, setOrdersToAcceptAll] = useState<(Order & { templateName: string })[]>([])

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return

      // Si es sucursal, cargar plantillas y borradores
      if (user.role === "branch") {
        await Promise.all([fetchTemplates(), fetchDraftOrders()])
        return
      }

      // Para otros roles, cargar estadísticas
      await fetchStats()
      
      // Para factory, también cargar pedidos pendientes, en armando y en camino
      if (user.role === "factory") {
        await Promise.all([
          fetchPendingOrders(),
          fetchAssemblingOrders(),
          fetchInTransitOrders()
        ])
        setShowPendingOrders(true)
      }
      
      // Para delivery, cargar pedidos en armando y en camino
      if (user.role === "delivery") {
        await Promise.all([
          fetchAssemblingOrders(),
          fetchInTransitOrders()
        ])
      }
    }

    fetchData()
  }, [user])

  const fetchStats = async () => {
    if (!user) return

    try {
      const ordersRef = collection(db, "apps/controld/orders")
      let q = query(ordersRef)

      // Filtrar según el rol (solo si tiene branchId asignado)
      if (user.role === "branch" && user.branchId) {
        q = query(ordersRef, where("fromBranchId", "==", user.branchId))
      } else if (user.role === "factory" && user.branchId) {
        q = query(ordersRef, where("toBranchId", "==", user.branchId))
      }

      const snapshot = await getDocs(q)
      const orders = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Order[]

      const today = new Date()
      today.setHours(0, 0, 0, 0)

       setStats({
         makeOrder: orders.filter((o) => o.status === "draft").length,
         pendingToReceive: orders.filter((o) => o.status === "sent").length,
         pendingProducts: orders.filter((o) => o.status === "assembling").length,
         onTheWay: orders.filter((o) => o.status === "in_transit").length,
         received: orders.filter((o) => {
           if (o.status !== "received" || !o.receivedAt) return false
           const receivedDate = (o.receivedAt as Timestamp).toDate()
           return receivedDate >= today
         }).length,
       })
    } catch (error) {
      console.error("[v0] Error al cargar estadísticas:", error)
    }
  }

  const fetchTemplates = async () => {
    if (!user) return

    try {
      const templatesRef = collection(db, "apps/controld/templates")
      
      console.log("🔍 [DEBUG] Cargando plantillas para rol:", user.role, "branchId:", user.branchId)

      let templatesData: Template[] = []

      if (user.role === "branch" && user.branchId) {
        // Firestore no permite usar "in" con null, así que hacemos dos consultas separadas
        
        // 1. Plantillas globales (branchId == null)
        const globalQuery = query(templatesRef, where("active", "==", true), where("branchId", "==", null))
        const globalSnapshot = await getDocs(globalQuery)
        const globalTemplates = globalSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Template[]
        console.log("📋 [DEBUG] Plantillas globales encontradas:", globalTemplates.length)
        
        // 2. Plantillas específicas de esta sucursal (branchId == user.branchId)
        const branchQuery = query(templatesRef, where("active", "==", true), where("branchId", "==", user.branchId))
        const branchSnapshot = await getDocs(branchQuery)
        const branchTemplates = branchSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Template[]
        console.log("📋 [DEBUG] Plantillas de la sucursal encontradas:", branchTemplates.length)
        
        // Combinar ambas listas
        templatesData = [...globalTemplates, ...branchTemplates]
      } else {
        // Para admin y otros roles, traer todas las activas
        const q = query(templatesRef, where("active", "==", true))
        const snapshot = await getDocs(q)
        templatesData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Template[]
      }

      console.log("📋 [DEBUG] Total plantillas encontradas:", templatesData.length, templatesData)
      setTemplates(templatesData)
    } catch (error) {
      console.error("[v0] Error al cargar plantillas:", error)
    }
  }

  const fetchDraftOrders = async () => {
    if (!user || user.role !== "branch" || !user.branchId) return

    try {
      const ordersRef = collection(db, "apps/controld/orders")
      const q = query(
        ordersRef,
        where("fromBranchId", "==", user.branchId),
        where("status", "==", "draft"),
        where("createdBy", "==", user.id)
      )
      const snapshot = await getDocs(q)
      const draftOrdersData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Order[]
      
      // Arreglar borradores que no tienen días permitidos
      for (const draft of draftOrdersData) {
        if (!draft.allowedSendDays || draft.allowedSendDays.length === 0) {
          const template = templates.find(t => t.id === draft.templateId)
          if (template && template.allowedSendDays) {
            console.log("🔧 [DEBUG] Arreglando borrador sin días permitidos:", draft.id)
            await updateDoc(doc(db, "apps/controld/orders", draft.id), {
              allowedSendDays: template.allowedSendDays
            })
            draft.allowedSendDays = template.allowedSendDays
          }
        }
      }
      
      setDraftOrders(draftOrdersData)
      console.log("📝 [DEBUG] Borradores encontrados:", draftOrdersData.length)
    } catch (error) {
      console.error("[v0] Error al cargar borradores:", error)
    }
  }

  const fetchPendingOrders = async () => {
    if (!user) return

    try {
      const ordersRef = collection(db, "apps/controld/orders")
      let q = query(ordersRef, where("status", "==", "sent"))

      // Filtrar según el rol
      if (user.role === "branch" && user.branchId) {
        q = query(ordersRef, where("fromBranchId", "==", user.branchId), where("status", "==", "sent"))
      } else if (user.role === "factory" && user.branchId) {
        q = query(ordersRef, where("toBranchId", "==", user.branchId), where("status", "==", "sent"))
      }

      const snapshot = await getDocs(q)
      const pendingOrdersData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Order[]
      
      // Obtener información de las plantillas para cada pedido
      const ordersWithTemplates = await Promise.all(
        pendingOrdersData.map(async (order) => {
          if (order.templateId) {
            try {
              const templateDocRef = doc(db, "apps/controld/templates", order.templateId)
              const templateSnapshot = await getDoc(templateDocRef)
              const template = templateSnapshot.exists() ? templateSnapshot.data() as Template : null
              console.log(`🔍 [DEBUG] Buscando plantilla ${order.templateId}:`, template?.name || "No encontrada")
              return { ...order, templateName: template?.name || "Plantilla no encontrada" }
            } catch (error) {
              console.error(`Error al obtener plantilla para pedido ${order.id}:`, error)
              return { ...order, templateName: "Error al cargar plantilla" }
            }
          }
          return { ...order, templateName: "Sin plantilla" }
        })
      )
      
      setPendingOrders(ordersWithTemplates)
      console.log("📦 [DEBUG] Pedidos pendientes encontrados:", ordersWithTemplates.length)
    } catch (error) {
      console.error("[v0] Error al cargar pedidos pendientes:", error)
    }
  }

  const fetchAssemblingOrders = async () => {
    if (!user) return

    try {
      const ordersRef = collection(db, "apps/controld/orders")
      let q = query(ordersRef, where("status", "==", "assembling"))

      // Filtrar según el rol
      if (user.role === "branch" && user.branchId) {
        q = query(ordersRef, where("fromBranchId", "==", user.branchId), where("status", "==", "assembling"))
      } else if ((user.role === "factory" || user.role === "delivery") && user.branchId) {
        q = query(ordersRef, where("toBranchId", "==", user.branchId), where("status", "==", "assembling"))
      }

      const snapshot = await getDocs(q)
      const assemblingOrdersData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Order[]
      
      // Obtener información de las plantillas para cada pedido
      const ordersWithTemplates = await Promise.all(
        assemblingOrdersData.map(async (order) => {
          if (order.templateId) {
            try {
              const templateDocRef = doc(db, "apps/controld/templates", order.templateId)
              const templateSnapshot = await getDoc(templateDocRef)
              const template = templateSnapshot.exists() ? templateSnapshot.data() as Template : null
              return { ...order, templateName: template?.name || "Plantilla no encontrada" }
            } catch (error) {
              console.error(`Error al obtener plantilla para pedido ${order.id}:`, error)
              return { ...order, templateName: "Error al cargar plantilla" }
            }
          }
          return { ...order, templateName: "Sin plantilla" }
        })
      )
      
      setAssemblingOrders(ordersWithTemplates)
      console.log("🔧 [DEBUG] Pedidos en armando encontrados:", ordersWithTemplates.length)
    } catch (error) {
      console.error("[v0] Error al cargar pedidos en armando:", error)
    }
  }

  const fetchInTransitOrders = async () => {
    if (!user) return

    try {
      const ordersRef = collection(db, "apps/controld/orders")
      let q = query(ordersRef, where("status", "==", "in_transit"))

      // Filtrar según el rol
      if (user.role === "branch" && user.branchId) {
        q = query(ordersRef, where("fromBranchId", "==", user.branchId), where("status", "==", "in_transit"))
      } else if ((user.role === "factory" || user.role === "delivery") && user.branchId) {
        q = query(ordersRef, where("toBranchId", "==", user.branchId), where("status", "==", "in_transit"))
      }

      const snapshot = await getDocs(q)
      const inTransitOrdersData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Order[]
      
      // Obtener información de las plantillas para cada pedido
      const ordersWithTemplates = await Promise.all(
        inTransitOrdersData.map(async (order) => {
          if (order.templateId) {
            try {
              const templateDocRef = doc(db, "apps/controld/templates", order.templateId)
              const templateSnapshot = await getDoc(templateDocRef)
              const template = templateSnapshot.exists() ? templateSnapshot.data() as Template : null
              return { ...order, templateName: template?.name || "Plantilla no encontrada" }
            } catch (error) {
              console.error(`Error al obtener plantilla para pedido ${order.id}:`, error)
              return { ...order, templateName: "Error al cargar plantilla" }
            }
          }
          return { ...order, templateName: "Sin plantilla" }
        })
      )
      
      setInTransitOrders(ordersWithTemplates)
      console.log("🚚 [DEBUG] Pedidos en camino encontrados:", ordersWithTemplates.length)
    } catch (error) {
      console.error("[v0] Error al cargar pedidos en camino:", error)
    }
  }

  const getTemplateStatus = (template: Template) => {
    const existingDraft = draftOrders.find(order => order.templateId === template.id)
    
    if (existingDraft) {
      return {
        status: 'draft',
        label: 'En Borrador',
        color: 'bg-orange-200 text-orange-800'
      }
    }

    // Verificar si hay un pedido enviado recientemente para esta plantilla
    // (esto requeriría cargar todos los pedidos enviados, por ahora asumimos que si no hay borrador, está disponible)
    const today = getCurrentDayOfWeek()
    const isTodayAllowed = template.allowedSendDays?.includes(today) || false
    
    if (isTodayAllowed) {
      return {
        status: 'available',
        label: 'Disponible',
        color: 'bg-green-200 text-green-800'
      }
    } else {
      const nextDay = getNextAllowedDay(template.allowedSendDays || [])
      return {
        status: 'waiting',
        label: `Próximo: ${nextDay}`,
        color: 'bg-blue-200 text-blue-800'
      }
    }
  }

  const createOrderFromTemplate = async (template: Template) => {
    if (!user || !user.branchId) return

    try {
      // Buscar si ya existe un borrador para esta plantilla
      const existingDraft = draftOrders.find(order => order.templateId === template.id)
      
      if (existingDraft) {
        // Si ya existe, redirigir a editar
        window.location.href = `/dashboard/orders/${existingDraft.id}`
        return
      }

      // Buscar la fábrica destino (por ahora tomamos la primera)
      const destinationBranchId = template.destinationBranchIds[0]
      if (!destinationBranchId) {
        toast({
          title: "Error",
          description: "La plantilla no tiene destino configurado",
          variant: "destructive",
        })
        return
      }

      // Obtener nombres de las sucursales
      const [fromBranchDoc, toBranchDoc] = await Promise.all([
        getDocs(query(collection(db, "apps/controld/branches"), where("id", "==", user.branchId))),
        getDocs(query(collection(db, "apps/controld/branches"), where("id", "==", destinationBranchId)))
      ])

      const fromBranchName = fromBranchDoc.docs[0]?.data()?.name || user.name
      const toBranchName = toBranchDoc.docs[0]?.data()?.name || "Fábrica"

      // Crear el pedido borrador
      const orderData = {
        orderNumber: `ORD-${Date.now()}`,
        fromBranchId: user.branchId,
        fromBranchName: fromBranchName,
        toBranchId: destinationBranchId,
        toBranchName: toBranchName,
        status: "draft",
        items: template.items.map((item) => ({
          id: `${Date.now()}-${item.productId}`,
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unit: item.unit,
          status: "pending" as const,
        })),
        createdAt: new Date(),
        createdBy: user.id,
        createdByName: user.name,
        templateId: template.id,
        allowedSendDays: template.allowedSendDays || [],
      }

      console.log("🔍 [DEBUG] Creando borrador - Días permitidos de la plantilla:", template.allowedSendDays)
      console.log("🔍 [DEBUG] Creando borrador - Días permitidos del pedido:", orderData.allowedSendDays)

      const docRef = await addDoc(collection(db, "apps/controld/orders"), orderData)
      
      toast({
        title: "Borrador creado",
        description: `Se creó un borrador para la plantilla "${template.name}"`,
      })

      // Recargar borradores
      await fetchDraftOrders()
      
      // Redirigir a editar el pedido
      window.location.href = `/dashboard/orders/${docRef.id}`
    } catch (error) {
      console.error("[v0] Error al crear borrador:", error)
      toast({
        title: "Error",
        description: "No se pudo crear el borrador",
        variant: "destructive",
      })
    }
  }

  const sendDraftOrder = async (order: Order) => {
    if (!user) return

    try {
      // Verificar si hoy es un día permitido
      if (order.allowedSendDays && order.allowedSendDays.length > 0 && !isDayAllowed(order.allowedSendDays)) {
        toast({
          title: "Error",
          description: "Hoy no es un día permitido para enviar este pedido",
          variant: "destructive",
        })
        return
      }

      // Actualizar estado del pedido
      console.log("🔍 [DEBUG] Actualizando pedido:", order.id, "usuario:", user.id)
      console.log("🔍 [DEBUG] Datos del pedido:", {
        createdBy: order.createdBy,
        fromBranchId: order.fromBranchId,
        userBranchId: user.branchId
      })
      
      await updateDoc(doc(db, "apps/controld/orders", order.id), {
        status: "sent",
        sentAt: new Date(),
        sentBy: user.id,
        sentByName: user.name
      })

      // Crear metadata del remito
      await createRemitMetadata({
        ...order,
        status: "sent"
      })

      toast({
        title: "Pedido enviado",
        description: `El pedido ${order.orderNumber} fue enviado correctamente`,
      })

      // Recargar borradores
      await fetchDraftOrders()
    } catch (error) {
      console.error("Error al enviar pedido:", error)
      toast({
        title: "Error",
        description: "No se pudo enviar el pedido",
        variant: "destructive",
      })
    }
  }

  const toggleExpanded = (templateId: string) => {
    if (expandedCard === templateId) {
      setExpandedCard(null)
      setEditingOrder(null)
    } else {
      setExpandedCard(templateId)
    }
  }

  const startEditing = (order: Order) => {
    setEditingOrder(order)
    setEditFormData({
      items: order.items.map(item => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unit: item.unit
      })),
      notes: order.notes || ""
    })
  }

  const cancelEditing = () => {
    setEditingOrder(null)
    setEditFormData({ items: [], notes: "" })
  }

  const updateItemQuantity = (itemIndex: number, newQuantity: number) => {
    if (newQuantity < 0) return
    const newItems = [...editFormData.items]
    newItems[itemIndex] = { ...newItems[itemIndex], quantity: newQuantity }
    setEditFormData({ ...editFormData, items: newItems })
  }

  const saveChanges = async () => {
    if (!editingOrder) return

    try {
      const updatedItems = editFormData.items.map(item => ({
        ...item,
        id: `${Date.now()}-${item.productId}`,
        status: "pending" as const,
      }))

      await updateDoc(doc(db, "apps/controld/orders", editingOrder.id), {
        items: updatedItems,
        notes: editFormData.notes
      })

      toast({
        title: "Cambios guardados",
        description: "El pedido se actualizó correctamente",
      })

      // Recargar borradores
      await fetchDraftOrders()
      setEditingOrder(null)
      setEditFormData({ items: [], notes: "" })
    } catch (error) {
      console.error("Error al guardar cambios:", error)
      toast({
        title: "Error",
        description: "No se pudieron guardar los cambios",
        variant: "destructive",
      })
    }
  }

  const toggleTemplateCollapse = (templateName: string) => {
    setCollapsedTemplates(prev => {
      const newSet = new Set(prev)
      if (newSet.has(templateName)) {
        newSet.delete(templateName)
      } else {
        newSet.add(templateName)
      }
      return newSet
    })
  }

  const toggleAssemblingTemplateCollapse = (templateName: string) => {
    setCollapsedAssemblingTemplates(prev => {
      const newSet = new Set(prev)
      if (newSet.has(templateName)) {
        newSet.delete(templateName)
      } else {
        newSet.add(templateName)
      }
      return newSet
    })
  }

  const toggleInTransitTemplateCollapse = (templateName: string) => {
    setCollapsedInTransitTemplates(prev => {
      const newSet = new Set(prev)
      if (newSet.has(templateName)) {
        newSet.delete(templateName)
      } else {
        newSet.add(templateName)
      }
      return newSet
    })
  }

  const showAcceptOrderConfirmation = (order: Order & { templateName: string }) => {
    setOrderToAccept(order)
    setShowAcceptConfirmation(true)
  }

  const acceptOrder = async (orderId: string) => {
    if (!user) return

    try {
      await updateDoc(doc(db, "apps/controld/orders", orderId), {
        status: "assembling",
        acceptedAt: new Date(),
        acceptedBy: user.id,
        acceptedByName: user.name
      })

      toast({
        title: "Pedido aceptado",
        description: "El pedido fue aceptado correctamente",
      })

      // Recargar pedidos pendientes y en armando
      await Promise.all([
        fetchPendingOrders(),
        fetchAssemblingOrders()
      ])

      // Cerrar confirmación
      setShowAcceptConfirmation(false)
      setOrderToAccept(null)
    } catch (error) {
      console.error("Error al aceptar pedido:", error)
      toast({
        title: "Error",
        description: "No se pudo aceptar el pedido",
        variant: "destructive",
      })
    }
  }

  const showAcceptAllOrdersConfirmation = (orders: (Order & { templateName: string })[]) => {
    setOrdersToAcceptAll(orders)
    setShowAcceptAllConfirmation(true)
  }

  const acceptAllOrdersFromTemplate = async (orders: (Order & { templateName: string })[]) => {
    if (!user) return

    try {
      const updatePromises = orders.map(order => 
        updateDoc(doc(db, "apps/controld/orders", order.id), {
          status: "assembling",
          acceptedAt: new Date(),
          acceptedBy: user.id,
          acceptedByName: user.name
        })
      )

      await Promise.all(updatePromises)

      toast({
        title: "Pedidos aceptados",
        description: `${orders.length} pedidos fueron aceptados correctamente`,
      })

      // Recargar pedidos pendientes y en armando
      await Promise.all([
        fetchPendingOrders(),
        fetchAssemblingOrders()
      ])

      // Cerrar confirmación
      setShowAcceptAllConfirmation(false)
      setOrdersToAcceptAll([])
    } catch (error) {
      console.error("Error al aceptar pedidos:", error)
      toast({
        title: "Error",
        description: "No se pudieron aceptar los pedidos",
        variant: "destructive",
      })
    }
  }

  // Función para marcar pedido como listo (fábrica)
  const markOrderAsReady = async (orderId: string) => {
    if (!user) return

    try {
      await updateDoc(doc(db, "apps/controld/orders", orderId), {
        preparedAt: new Date(),
        preparedBy: user.id,
        preparedByName: user.name
      })

      toast({
        title: "Pedido marcado como listo",
        description: "El pedido está listo para ser enviado",
      })

      // Recargar estadísticas y pedidos en armando
      await Promise.all([
        fetchStats(),
        fetchAssemblingOrders()
      ])
    } catch (error) {
      console.error("Error al marcar pedido como listo:", error)
      toast({
        title: "Error",
        description: "No se pudo marcar el pedido como listo",
        variant: "destructive",
      })
    }
  }

  // Función para que delivery tome pedido (pasar de assembling a in_transit)
  const takeOrderForDelivery = async (orderId: string) => {
    if (!user) return

    try {
      await updateDoc(doc(db, "apps/controld/orders", orderId), {
        status: "in_transit",
        deliveredAt: new Date(),
        deliveredBy: user.id,
        deliveredByName: user.name
      })

      toast({
        title: "Pedido tomado para entrega",
        description: "El pedido está en camino",
      })

      // Recargar estadísticas, pedidos en armando y en camino
      await Promise.all([
        fetchStats(),
        fetchAssemblingOrders(),
        fetchInTransitOrders()
      ])
    } catch (error) {
      console.error("Error al tomar pedido para entrega:", error)
      toast({
        title: "Error",
        description: "No se pudo tomar el pedido para entrega",
        variant: "destructive",
      })
    }
  }

  // Si es sucursal, mostrar plantillas y borradores
  if (user?.role === "branch") {
    return (
      <ProtectedRoute>
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h2 className="text-2xl font-bold">Bienvenido, {user?.name}</h2>
            <p className="text-muted-foreground">Gestiona tus pedidos y plantillas</p>
          </div>

          {/* Sección Unificada de Plantillas */}
          <div>
            <h3 className="text-lg font-semibold mb-4">📋 Plantillas</h3>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {templates.map((template) => {
                const existingDraft = draftOrders.find(order => order.templateId === template.id)
                const templateStatus = getTemplateStatus(template)
                
                return (
                  <Card 
                    key={template.id} 
                    className={`hover:shadow-lg transition-all ${
                      templateStatus.status === 'draft'
                        ? "border-orange-200 bg-orange-50/50" 
                        : templateStatus.status === 'waiting'
                        ? "border-blue-200 bg-blue-50/50"
                        : "border-gray-200"
                    }`}
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {templateStatus.status === 'draft' ? (
                            <Edit className="h-5 w-5 text-orange-600" />
                          ) : (
                            <FileText className="h-5 w-5 text-primary" />
                          )}
                          <CardTitle className={`text-base sm:text-lg ${
                            templateStatus.status === 'draft' ? "text-orange-800" : 
                            templateStatus.status === 'waiting' ? "text-blue-800" : ""
                          }`}>
                            {template.name}
                          </CardTitle>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded ${templateStatus.color}`}>
                          {templateStatus.label}
                        </span>
                      </div>
                      {template.description && (
                        <CardDescription className={`text-sm ${
                          templateStatus.status === 'draft' ? "text-orange-700" : 
                          templateStatus.status === 'waiting' ? "text-blue-700" : ""
                        }`}>
                          {existingDraft ? existingDraft.orderNumber : template.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {/* Solo mostrar detalles de productos en desktop */}
                        <div className="hidden sm:block">
                          <p className="text-sm font-medium text-muted-foreground mb-2">
                            Productos ({existingDraft ? existingDraft.items.length : template.items.length}):
                          </p>
                          <div className="space-y-1">
                            {(existingDraft ? existingDraft.items : template.items).slice(0, 3).map((item, index) => (
                              <div key={index} className="text-sm">
                                <span className="font-medium">{item.productName}</span>
                                <span className="text-muted-foreground ml-2">
                                  {item.quantity} {item.unit}
                                </span>
                              </div>
                            ))}
                            {(existingDraft ? existingDraft.items : template.items).length > 3 && (
                              <p className="text-sm text-muted-foreground">
                                +{(existingDraft ? existingDraft.items : template.items).length - 3} productos más...
                              </p>
                            )}
                          </div>
                        </div>

                        {/* En móvil, solo mostrar contador simple */}
                        <div className="sm:hidden">
                          <p className="text-sm text-muted-foreground">
                            {existingDraft ? existingDraft.items.length : template.items.length} productos
                          </p>
                        </div>
                        
                        {existingDraft ? (
                          // Botones para borrador existente
                          <div className="space-y-3">
                            <div className="flex gap-2">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="flex-1"
                                onClick={() => {
                                  if (editingOrder?.id === existingDraft.id) {
                                    cancelEditing()
                                  } else {
                                    startEditing(existingDraft)
                                  }
                                }}
                              >
                                {editingOrder?.id === existingDraft.id ? (
                                  <>
                                    <X className="mr-1 h-3 w-3" />
                                    <span className="hidden sm:inline">Cancelar</span>
                                  </>
                                ) : (
                                  <>
                                    <Edit className="mr-1 h-3 w-3" />
                                    <span className="hidden sm:inline">Editar</span>
                                  </>
                                )}
                              </Button>
                              <Button 
                                size="sm" 
                                className={`flex-1 ${
                                  existingDraft.allowedSendDays && !isDayAllowed(existingDraft.allowedSendDays)
                                    ? 'opacity-50 cursor-not-allowed'
                                    : ''
                                }`}
                                onClick={() => sendDraftOrder(existingDraft)}
                                disabled={existingDraft.allowedSendDays && !isDayAllowed(existingDraft.allowedSendDays)}
                                title={
                                  existingDraft.allowedSendDays && !isDayAllowed(existingDraft.allowedSendDays)
                                    ? `Hoy no es un día permitido para enviar. Días permitidos: ${existingDraft.allowedSendDays.join(', ')}`
                                    : 'Enviar pedido'
                                }
                              >
                                <Send className="mr-1 h-3 w-3" />
                                <span className="hidden sm:inline">
                                  {existingDraft.allowedSendDays && !isDayAllowed(existingDraft.allowedSendDays) 
                                    ? 'No disponible' 
                                    : 'Enviar'
                                  }
                                </span>
                              </Button>
                            </div>
                            
                            {/* Sección de edición expandible */}
                            {editingOrder?.id === existingDraft.id && (
                              <div className="border-t pt-3 space-y-3">
                                <div>
                                  <Label className="text-sm font-medium">Notas del pedido</Label>
                                  <Input
                                    value={editFormData.notes}
                                    onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                                    placeholder="Agregar notas..."
                                    className="mt-1"
                                  />
                                </div>
                                
                                <div>
                                  <Label className="text-sm font-medium">Cantidades</Label>
                                  <div className="space-y-2 mt-2">
                                    {editFormData.items.map((item, index) => (
                                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                        <div className="flex-1">
                                          <span className="text-sm font-medium">{item.productName}</span>
                                          <span className="text-xs text-gray-500 ml-2">({item.unit})</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => updateItemQuantity(index, item.quantity - 1)}
                                            disabled={item.quantity <= 0}
                                            className="h-6 w-6 p-0"
                                          >
                                            -
                                          </Button>
                                          <span className="w-8 text-center text-sm">{item.quantity}</span>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => updateItemQuantity(index, item.quantity + 1)}
                                            className="h-6 w-6 p-0"
                                          >
                                            +
                                          </Button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                
                                <div className="flex gap-2">
                                  <Button 
                                    onClick={saveChanges}
                                    className="flex-1"
                                    size="sm"
                                  >
                                    <Save className="mr-1 h-3 w-3" />
                                    Guardar
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : templateStatus.status === 'available' ? (
                          // Botón para crear nuevo (solo cuando está disponible)
                          <Button 
                            onClick={() => createOrderFromTemplate(template)}
                            className="w-full"
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            <span className="hidden sm:inline">Crear pedido</span>
                            <span className="sm:hidden">Crear</span>
                          </Button>
                        ) : (
                          // Cuando no está disponible, mostrar mensaje
                          <div className="w-full text-center text-sm text-muted-foreground py-2">
                            No disponible hoy
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            {templates.length === 0 && (
              <Card>
                <CardContent className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No hay plantillas disponibles</h3>
                  <p className="text-muted-foreground mb-4">
                    El administrador aún no ha creado plantillas para tu sucursal.
                  </p>
                  <Button asChild>
                    <Link href="/dashboard/orders/new">
                      <Plus className="mr-2 h-4 w-4" />
                      Crear pedido manual
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  // Para otros roles, mostrar estadísticas
  return (
    <ProtectedRoute>
      <div className="max-w-7xl mx-auto">
       

        <Tabs defaultValue="recibir" className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-auto p-1 bg-gray-100">
            <TabsTrigger 
              value="recibir" 
              className="flex items-center gap-2 p-3 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:font-semibold transition-all duration-200 hover:bg-gray-200 rounded-md"
            >
              <Clock className="h-4 w-4" />
              <span>Recibir</span>
            </TabsTrigger>
            <TabsTrigger 
              value="armando" 
              className="flex items-center gap-2 p-3 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:font-semibold transition-all duration-200 hover:bg-gray-200 rounded-md"
            >
              <Package className="h-4 w-4" />
              <span>Armando</span>
            </TabsTrigger>
            <TabsTrigger 
              value="en-camino" 
              className="flex items-center gap-2 p-3 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:font-semibold transition-all duration-200 hover:bg-gray-200 rounded-md"
            >
              <Truck className="h-4 w-4" />
              <span>En Camino</span>
            </TabsTrigger>
          </TabsList>

          {/* Contenido de la pestaña Recibir */}
          <TabsContent value="recibir" className="mt-6">
            {showPendingOrders && (
              <div>
                <div className="mb-4">
                  <h3 className="text-lg font-semibold">📦 Pedidos Pendientes de Recibir</h3>
                  <p className="text-sm text-muted-foreground">
                    Pedidos enviados que están esperando ser recibidos
                  </p>
                </div>
                
                {pendingOrders.length > 0 ? (
                  <div className="space-y-6">
                    {Object.entries(
                      pendingOrders.reduce((groups, order) => {
                        const templateName = order.templateName
                        if (!groups[templateName]) {
                          groups[templateName] = []
                        }
                        groups[templateName].push(order)
                        return groups
                      }, {} as Record<string, (Order & { templateName: string })[]>)
                    ).map(([templateName, orders]) => (
                      <div key={templateName} className="space-y-3">
                        <div className="border-b pb-2">
                          <div className="flex items-center justify-between cursor-pointer hover:bg-gray-50 rounded-lg p-2 -m-2 transition-colors">
                            <div 
                              className="flex items-center gap-2 flex-1"
                              onClick={() => toggleTemplateCollapse(templateName)}
                            >
                              {collapsedTemplates.has(templateName) ? (
                                <ChevronRight className="h-4 w-4 text-gray-600" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-gray-600" />
                              )}
                              <h4 className="text-lg font-semibold text-gray-800">{templateName}</h4>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm text-muted-foreground">{orders.length} pedido{orders.length !== 1 ? 's' : ''}</span>
                              <Button
                                size="sm"
                                className="text-xs px-3 py-1 h-auto bg-green-600 hover:bg-green-700"
                                onClick={(e) => {
                                  e.stopPropagation() // Prevenir que se colapse al hacer clic en el botón
                                  showAcceptAllOrdersConfirmation(orders)
                                }}
                              >
                                <CheckCheck className="mr-1 h-3 w-3" />
                                Aceptar todas
                              </Button>
                            </div>
                          </div>
                        </div>
                        
                        {/* Tabla responsive - solo visible si no está colapsada */}
                        {!collapsedTemplates.has(templateName) && (
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[300px]">
                              <thead>
                                <tr className="border-b bg-gray-50">
                                  <th className="text-left py-3 px-2 text-sm font-medium text-gray-700">De</th>
                                  <th className="text-left py-3 px-2 text-sm font-medium text-gray-700">Productos</th>
                                  <th className="text-center py-3 px-2 text-sm font-medium text-gray-700">Acción</th>
                                </tr>
                              </thead>
                              <tbody>
                                {orders.map((order) => (
                                  <tr key={order.id} className="border-b hover:bg-gray-50">
                                    <td className="py-3 px-2">
                                      <div className="text-sm font-medium text-gray-900">{order.fromBranchName}</div>
                                    </td>
                                    <td className="py-3 px-2">
                                      <div className="text-sm text-gray-900">{order.items.length}</div>
                                    </td>
                                    <td className="py-3 px-2">
                                      <div className="flex justify-center">
                                        <Button 
                                          size="sm" 
                                          className="text-xs px-4 py-1 h-auto bg-green-600 hover:bg-green-700"
                                          onClick={() => showAcceptOrderConfirmation(order)}
                                        >
                                          Aceptar
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="text-center py-8">
                      <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium mb-2">No hay pedidos pendientes</h3>
                      <p className="text-muted-foreground">
                        No hay pedidos enviados esperando ser recibidos.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>

          {/* Contenido de la pestaña Armando */}
          <TabsContent value="armando" className="mt-6">
            <div>
              <div className="mb-4">
                <h3 className="text-lg font-semibold">🔧 Pedidos en Armando</h3>
                <p className="text-sm text-muted-foreground">
                  Pedidos aceptados que están siendo preparados
                </p>
              </div>
              
              {assemblingOrders.length > 0 ? (
                <div className="space-y-6">
                  {Object.entries(
                    assemblingOrders.reduce((groups, order) => {
                      const templateName = order.templateName
                      if (!groups[templateName]) {
                        groups[templateName] = []
                      }
                      groups[templateName].push(order)
                      return groups
                    }, {} as Record<string, (Order & { templateName: string })[]>)
                  ).map(([templateName, orders]) => (
                    <div key={templateName} className="space-y-3">
                      <div className="border-b pb-2">
                        <div className="flex items-center justify-between cursor-pointer hover:bg-gray-50 rounded-lg p-2 -m-2 transition-colors">
                          <div 
                            className="flex items-center gap-2 flex-1"
                            onClick={() => toggleAssemblingTemplateCollapse(templateName)}
                          >
                            {collapsedAssemblingTemplates.has(templateName) ? (
                              <ChevronRight className="h-4 w-4 text-gray-600" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-gray-600" />
                            )}
                            <h4 className="text-lg font-semibold text-gray-800">{templateName}</h4>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-muted-foreground">{orders.length} pedido{orders.length !== 1 ? 's' : ''}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Tabla responsive - solo visible si no está colapsada */}
                      {!collapsedAssemblingTemplates.has(templateName) && (
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[300px]">
                            <thead>
                              <tr className="border-b bg-gray-50">
                                <th className="text-left py-3 px-2 text-sm font-medium text-gray-700">De</th>
                                <th className="text-left py-3 px-2 text-sm font-medium text-gray-700">Productos</th>
                                <th className="text-left py-3 px-2 text-sm font-medium text-gray-700">Estado</th>
                                <th className="text-center py-3 px-2 text-sm font-medium text-gray-700">Acción</th>
                              </tr>
                            </thead>
                            <tbody>
                              {orders.map((order) => (
                                <tr key={order.id} className="border-b hover:bg-gray-50">
                                  <td className="py-3 px-2">
                                    <div className="text-sm font-medium text-gray-900">{order.fromBranchName}</div>
                                  </td>
                                  <td className="py-3 px-2">
                                    <div className="text-sm text-gray-900">{order.items.length}</div>
                                  </td>
                                  <td className="py-3 px-2">
                                    <div className="text-sm">
                                      {order.preparedAt ? (
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                          ✓ Listo
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                          ⏳ En proceso
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-3 px-2">
                                    <div className="flex justify-center gap-2">
                                      {!order.preparedAt && user?.role === "factory" && (
                                        <Button 
                                          size="sm" 
                                          className="text-xs px-3 py-1 h-auto bg-blue-600 hover:bg-blue-700"
                                          onClick={() => markOrderAsReady(order.id)}
                                        >
                                          ✓ Listo
                                        </Button>
                                      )}
                                      {order.preparedAt && user?.role === "delivery" && (
                                        <Button 
                                          size="sm" 
                                          className="text-xs px-3 py-1 h-auto bg-green-600 hover:bg-green-700"
                                          onClick={() => takeOrderForDelivery(order.id)}
                                        >
                                          🚚 Tomar
                                        </Button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="text-center py-8">
                    <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No hay pedidos en armando</h3>
                    <p className="text-muted-foreground">
                      No hay pedidos siendo preparados en este momento.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Contenido de la pestaña En Camino */}
          <TabsContent value="en-camino" className="mt-6">
            <div>
              <div className="mb-4">
                <h3 className="text-lg font-semibold">🚚 Pedidos En Camino</h3>
                <p className="text-sm text-muted-foreground">
                  Pedidos que están siendo entregados
                </p>
              </div>
              
              {inTransitOrders.length > 0 ? (
                <div className="space-y-6">
                  {Object.entries(
                    inTransitOrders.reduce((groups, order) => {
                      const templateName = order.templateName
                      if (!groups[templateName]) {
                        groups[templateName] = []
                      }
                      groups[templateName].push(order)
                      return groups
                    }, {} as Record<string, (Order & { templateName: string })[]>)
                  ).map(([templateName, orders]) => (
                    <div key={templateName} className="space-y-3">
                      <div className="border-b pb-2">
                        <div className="flex items-center justify-between cursor-pointer hover:bg-gray-50 rounded-lg p-2 -m-2 transition-colors">
                          <div 
                            className="flex items-center gap-2 flex-1"
                            onClick={() => toggleInTransitTemplateCollapse(templateName)}
                          >
                            {collapsedInTransitTemplates.has(templateName) ? (
                              <ChevronRight className="h-4 w-4 text-gray-600" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-gray-600" />
                            )}
                            <h4 className="text-lg font-semibold text-gray-800">{templateName}</h4>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-muted-foreground">{orders.length} pedido{orders.length !== 1 ? 's' : ''}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Tabla responsive - solo visible si no está colapsada */}
                      {!collapsedInTransitTemplates.has(templateName) && (
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[300px]">
                            <thead>
                              <tr className="border-b bg-gray-50">
                                <th className="text-left py-3 px-2 text-sm font-medium text-gray-700">De</th>
                                <th className="text-left py-3 px-2 text-sm font-medium text-gray-700">Para</th>
                                <th className="text-left py-3 px-2 text-sm font-medium text-gray-700">Productos</th>
                                <th className="text-left py-3 px-2 text-sm font-medium text-gray-700">Delivery</th>
                              </tr>
                            </thead>
                            <tbody>
                              {orders.map((order) => (
                                <tr key={order.id} className="border-b hover:bg-gray-50">
                                  <td className="py-3 px-2">
                                    <div className="text-sm font-medium text-gray-900">{order.fromBranchName}</div>
                                  </td>
                                  <td className="py-3 px-2">
                                    <div className="text-sm text-gray-900">{order.toBranchName}</div>
                                  </td>
                                  <td className="py-3 px-2">
                                    <div className="text-sm text-gray-900">{order.items.length}</div>
                                  </td>
                                  <td className="py-3 px-2">
                                    <div className="text-sm text-gray-900">{order.deliveredByName || "Sin asignar"}</div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="text-center py-8">
                    <Truck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No hay pedidos en camino</h3>
                    <p className="text-muted-foreground">
                      No hay pedidos siendo entregados en este momento.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Diálogo de confirmación para aceptar pedido individual */}
        <Dialog open={showAcceptConfirmation} onOpenChange={setShowAcceptConfirmation}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Confirmar Aceptación de Pedido
              </DialogTitle>
              <DialogDescription>
                ¿Estás seguro de que quieres aceptar este pedido? Se moverá al estado "Armando".
              </DialogDescription>
            </DialogHeader>
            
            {orderToAccept && (
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Detalles del Pedido</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Plantilla:</span>
                      <span className="font-medium">{orderToAccept.templateName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">De:</span>
                      <span className="font-medium">{orderToAccept.fromBranchName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Productos:</span>
                      <span className="font-medium">{orderToAccept.items.length} items</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Número:</span>
                      <span className="font-medium">{orderToAccept.orderNumber}</span>
                    </div>
                  </div>
                </div>
                
                {orderToAccept.items.length > 0 && (
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h5 className="font-medium text-blue-900 mb-2">Productos incluidos:</h5>
                    <div className="space-y-1 text-sm">
                      {orderToAccept.items.slice(0, 3).map((item, index) => (
                        <div key={index} className="flex justify-between text-blue-800">
                          <span>{item.productName}</span>
                          <span>{item.quantity} {item.unit}</span>
                        </div>
                      ))}
                      {orderToAccept.items.length > 3 && (
                        <div className="text-blue-600 text-xs">
                          +{orderToAccept.items.length - 3} productos más...
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            <DialogFooter className="gap-2">
              <Button 
                variant="outline" 
                onClick={() => setShowAcceptConfirmation(false)}
              >
                Cancelar
              </Button>
              <Button 
                onClick={() => orderToAccept && acceptOrder(orderToAccept.id)}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Aceptar Pedido
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Diálogo de confirmación para aceptar todos los pedidos */}
        <Dialog open={showAcceptAllConfirmation} onOpenChange={setShowAcceptAllConfirmation}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCheck className="h-5 w-5 text-green-600" />
                Confirmar Aceptación Múltiple
              </DialogTitle>
              <DialogDescription>
                ¿Estás seguro de que quieres aceptar todos estos pedidos? Se moverán al estado "Armando".
              </DialogDescription>
            </DialogHeader>
            
            {ordersToAcceptAll.length > 0 && (
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Resumen</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Plantilla:</span>
                      <span className="font-medium">{ordersToAcceptAll[0].templateName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total de pedidos:</span>
                      <span className="font-medium">{ordersToAcceptAll.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total de productos:</span>
                      <span className="font-medium">
                        {ordersToAcceptAll.reduce((sum, order) => sum + order.items.length, 0)}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-blue-50 p-4 rounded-lg max-h-48 overflow-y-auto">
                  <h5 className="font-medium text-blue-900 mb-2">Pedidos a aceptar:</h5>
                  <div className="space-y-2 text-sm">
                    {ordersToAcceptAll.map((order, index) => (
                      <div key={order.id} className="flex justify-between items-center text-blue-800 p-2 bg-white rounded">
                        <div>
                          <span className="font-medium">{order.fromBranchName}</span>
                          <span className="text-blue-600 ml-2">({order.orderNumber})</span>
                        </div>
                        <span className="text-blue-600">{order.items.length} productos</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            <DialogFooter className="gap-2">
              <Button 
                variant="outline" 
                onClick={() => setShowAcceptAllConfirmation(false)}
              >
                Cancelar
              </Button>
              <Button 
                onClick={() => acceptAllOrdersFromTemplate(ordersToAcceptAll)}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCheck className="mr-2 h-4 w-4" />
                Aceptar Todos ({ordersToAcceptAll.length})
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </ProtectedRoute>
  )
}

export default DashboardContent
