"use client"

import { ProtectedRoute } from "@/components/protected-route"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  AlertCircle, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Package,
  RefreshCw,
  Filter,
  Search
} from "lucide-react"
import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/hooks/use-toast"
import type { ReplacementQueue, ReplacementItem, ReplacementPriority } from "@/lib/types"
import { getAllReplacementQueues } from "@/lib/replacement-service"
import { Input } from "@/components/ui/input"

function PendingContent() {
  const { user } = useAuth()
  const { toast } = useToast()
  
  const [queues, setQueues] = useState<ReplacementQueue[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [priorityFilter, setPriorityFilter] = useState<string>("all")

  useEffect(() => {
    fetchPendingProducts()
  }, [])

  const fetchPendingProducts = async () => {
    setLoading(true)
    try {
      const data = await getAllReplacementQueues()
      setQueues(data)
    } catch (error) {
      console.error("Error al cargar productos pendientes:", error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los productos pendientes",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const getPriorityBadge = (priority: ReplacementPriority) => {
    const config = {
      low: { label: "Baja", variant: "secondary" as const, icon: Clock },
      normal: { label: "Normal", variant: "default" as const, icon: Package },
      high: { label: "Alta", variant: "destructive" as const, icon: AlertCircle },
      urgent: { label: "Urgente", variant: "destructive" as const, icon: XCircle },
    }
    const { label, variant, icon: Icon } = config[priority]
    return (
      <Badge variant={variant} className="flex w-fit items-center gap-1">
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    )
  }

  const getStatusBadge = (status: string) => {
    const config = {
      pending: { label: "Pendiente", variant: "secondary" as const, icon: Clock },
      urgent: { label: "Urgente", variant: "destructive" as const, icon: XCircle },
      in_queue: { label: "En Cola", variant: "default" as const, icon: Package },
      merged: { label: "Fusionado", variant: "default" as const, icon: CheckCircle },
      completed: { label: "Completado", variant: "default" as const, icon: CheckCircle },
      cancelled: { label: "Cancelado", variant: "destructive" as const, icon: XCircle },
    }
    const { label, variant, icon: Icon } = config[status as keyof typeof config] || {
      label: status,
      variant: "secondary" as const,
      icon: Clock,
    }
    return (
      <Badge variant={variant} className="flex w-fit items-center gap-1">
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    )
  }

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "-"
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return date.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  // Obtener todos los items pendientes
  const allPendingItems = queues.flatMap(queue => 
    queue.items.filter(item => item.status === "pending" || item.status === "in_queue")
  )

  // Filtrar items
  const filteredItems = allPendingItems.filter(item => {
    const matchesSearch = item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.reason.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesPriority = priorityFilter === "all" || item.priority === priorityFilter
    return matchesSearch && matchesPriority
  })

  // Agrupar por prioridad
  const urgentItems = filteredItems.filter(item => item.priority === "urgent")
  const highItems = filteredItems.filter(item => item.priority === "high")
  const normalItems = filteredItems.filter(item => item.priority === "normal")
  const lowItems = filteredItems.filter(item => item.priority === "low")

  // Estadísticas
  const stats = {
    total: allPendingItems.length,
    urgent: allPendingItems.filter(item => item.priority === "urgent").length,
    high: allPendingItems.filter(item => item.priority === "high").length,
    normal: allPendingItems.filter(item => item.priority === "normal").length,
    low: allPendingItems.filter(item => item.priority === "low").length,
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Cargando productos pendientes...</p>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">📦 Productos Pendientes</h2>
            <p className="text-muted-foreground">Productos faltantes que necesitan reposición</p>
          </div>
          <Button onClick={fetchPendingProducts} variant="outline" disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Actualizar
          </Button>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-red-600">{stats.urgent}</div>
              <p className="text-xs text-red-600">Urgentes</p>
            </CardContent>
          </Card>
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-orange-600">{stats.high}</div>
              <p className="text-xs text-orange-600">Alta</p>
            </CardContent>
          </Card>
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-600">{stats.normal}</div>
              <p className="text-xs text-blue-600">Normal</p>
            </CardContent>
          </Card>
          <Card className="border-gray-200 bg-gray-50">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-gray-600">{stats.low}</div>
              <p className="text-xs text-gray-600">Baja</p>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por producto o motivo..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="px-3 py-2 border rounded-md text-sm"
                >
                  <option value="all">Todas las prioridades</option>
                  <option value="urgent">Urgentes</option>
                  <option value="high">Alta</option>
                  <option value="normal">Normal</option>
                  <option value="low">Baja</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista de productos pendientes */}
        <Tabs defaultValue="urgent" className="space-y-4">
          <TabsList>
            <TabsTrigger value="urgent" className="flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              Urgentes ({urgentItems.length})
            </TabsTrigger>
            <TabsTrigger value="high" className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Alta ({highItems.length})
            </TabsTrigger>
            <TabsTrigger value="normal" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Normal ({normalItems.length})
            </TabsTrigger>
            <TabsTrigger value="low" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Baja ({lowItems.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="urgent" className="space-y-4">
            {urgentItems.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                  <h3 className="text-lg font-semibold">No hay items urgentes</h3>
                  <p className="text-muted-foreground">Todos los items urgentes están siendo procesados</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="bg-red-50">
                  <CardTitle className="flex items-center gap-2 text-red-800">
                    <XCircle className="h-5 w-5" />
                    🔴 Items Urgentes
                  </CardTitle>
                  <CardDescription className="text-red-700">
                    {urgentItems.length} items requieren atención inmediata
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead>Cantidad</TableHead>
                        <TableHead>Sucursal</TableHead>
                        <TableHead>Motivo</TableHead>
                        <TableHead>Reportado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {urgentItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.productName}</TableCell>
                          <TableCell>{item.quantity} {item.unit}</TableCell>
                          <TableCell>
                            {queues.find(q => q.items.some(i => i.id === item.id))?.branchName || "-"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{item.reason}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(item.reportedAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="high" className="space-y-4">
            {highItems.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                  <h3 className="text-lg font-semibold">No hay items de alta prioridad</h3>
                  <p className="text-muted-foreground">Todos los items de alta prioridad están siendo procesados</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="bg-orange-50">
                  <CardTitle className="flex items-center gap-2 text-orange-800">
                    <AlertCircle className="h-5 w-5" />
                    🟠 Items de Alta Prioridad
                  </CardTitle>
                  <CardDescription className="text-orange-700">
                    {highItems.length} items de alta prioridad
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead>Cantidad</TableHead>
                        <TableHead>Sucursal</TableHead>
                        <TableHead>Motivo</TableHead>
                        <TableHead>Reportado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {highItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.productName}</TableCell>
                          <TableCell>{item.quantity} {item.unit}</TableCell>
                          <TableCell>
                            {queues.find(q => q.items.some(i => i.id === item.id))?.branchName || "-"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{item.reason}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(item.reportedAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="normal" className="space-y-4">
            {normalItems.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                  <h3 className="text-lg font-semibold">No hay items normales</h3>
                  <p className="text-muted-foreground">Todos los items normales están siendo procesados</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="bg-blue-50">
                  <CardTitle className="flex items-center gap-2 text-blue-800">
                    <Package className="h-5 w-5" />
                    🔵 Items Normales
                  </CardTitle>
                  <CardDescription className="text-blue-700">
                    {normalItems.length} items de prioridad normal
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead>Cantidad</TableHead>
                        <TableHead>Sucursal</TableHead>
                        <TableHead>Motivo</TableHead>
                        <TableHead>Reportado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {normalItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.productName}</TableCell>
                          <TableCell>{item.quantity} {item.unit}</TableCell>
                          <TableCell>
                            {queues.find(q => q.items.some(i => i.id === item.id))?.branchName || "-"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{item.reason}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(item.reportedAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="low" className="space-y-4">
            {lowItems.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                  <h3 className="text-lg font-semibold">No hay items de baja prioridad</h3>
                  <p className="text-muted-foreground">Todos los items de baja prioridad están siendo procesados</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="bg-gray-50">
                  <CardTitle className="flex items-center gap-2 text-gray-800">
                    <Clock className="h-5 w-5" />
                    ⚪ Items de Baja Prioridad
                  </CardTitle>
                  <CardDescription className="text-gray-700">
                    {lowItems.length} items de baja prioridad
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead>Cantidad</TableHead>
                        <TableHead>Sucursal</TableHead>
                        <TableHead>Motivo</TableHead>
                        <TableHead>Reportado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lowItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.productName}</TableCell>
                          <TableCell>{item.quantity} {item.unit}</TableCell>
                          <TableCell>
                            {queues.find(q => q.items.some(i => i.id === item.id))?.branchName || "-"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{item.reason}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(item.reportedAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </ProtectedRoute>
  )
}

export default PendingContent
