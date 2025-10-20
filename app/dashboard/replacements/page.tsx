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
  Plus, 
  Merge, 
  Truck,
  Package,
  RefreshCw
} from "lucide-react"
import { useState } from "react"
import { useReplacements } from "@/hooks/use-replacements"
import type { ReplacementPriority } from "@/lib/types"

function ReplacementsContent() {
  const {
    urgentQueues,
    pendingQueues,
    completedQueues,
    mergeOpportunities,
    loading,
    actionLoading,
    fetchQueues,
    handleCreateUrgentOrder,
    handleMergeItems,
    handleProcessAutoMerge,
    handleAutoMergeAll
  } = useReplacements()
  
  const [selectedItems, setSelectedItems] = useState<string[]>([])

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
      merged: { label: "Fusionado", variant: "default" as const, icon: Merge },
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

  // Agrupar colas por estado
  const urgentQueues = queues.filter(queue => 
    queue.items.some(item => item.priority === "urgent" && item.status === "pending")
  )
  
  const pendingQueues = queues.filter(queue => 
    queue.items.some(item => item.status === "pending" || item.status === "in_queue")
  )
  
  const completedQueues = queues.filter(queue => 
    queue.items.every(item => item.status === "completed" || item.status === "merged")
  )

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Cargando reposiciones...</p>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">🔄 Reposiciones</h2>
            <p className="text-muted-foreground">Gestión de productos faltantes y reposiciones</p>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={handleAutoMergeAll} 
              variant="outline" 
              disabled={actionLoading}
              className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
            >
              <Merge className="mr-2 h-4 w-4" />
              Fusión Automática Global
            </Button>
            <Button onClick={fetchQueues} variant="outline" disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Actualizar
            </Button>
          </div>
        </div>

        <Tabs defaultValue="urgent" className="space-y-4">
          <TabsList>
            <TabsTrigger value="urgent" className="flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              Urgentes ({urgentQueues.length})
            </TabsTrigger>
            <TabsTrigger value="pending" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              En Cola ({pendingQueues.length})
            </TabsTrigger>
            <TabsTrigger value="completed" className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Completadas ({completedQueues.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="urgent" className="space-y-4">
            {urgentQueues.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                  <h3 className="text-lg font-semibold">No hay items urgentes</h3>
                  <p className="text-muted-foreground">Todos los items están siendo procesados correctamente</p>
                </CardContent>
              </Card>
            ) : (
              urgentQueues.map((queue) => (
                <Card key={queue.id} className="border-red-200">
                  <CardHeader className="bg-red-50">
                    <CardTitle className="flex items-center gap-2 text-red-800">
                      <XCircle className="h-5 w-5" />
                      🔴 Items Urgentes - {queue.branchName}
                    </CardTitle>
                    <CardDescription className="text-red-700">
                      {queue.items.filter(item => item.priority === "urgent" && item.status === "pending").length} items requieren atención inmediata
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Producto</TableHead>
                          <TableHead>Cantidad</TableHead>
                          <TableHead>Prioridad</TableHead>
                          <TableHead>Motivo</TableHead>
                          <TableHead>Reportado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {queue.items
                          .filter(item => item.priority === "urgent" && item.status === "pending")
                          .map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">{item.productName}</TableCell>
                              <TableCell>{item.quantity} {item.unit}</TableCell>
                              <TableCell>{getPriorityBadge(item.priority)}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{item.reason}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {formatDate(item.reportedAt)}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                    <div className="flex gap-2">
                      <Button 
                        onClick={() => handleCreateUrgentOrder(queue.id)}
                        disabled={actionLoading}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        <Truck className="mr-2 h-4 w-4" />
                        Crear Pedido Urgente
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="pending" className="space-y-4">
            {pendingQueues.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                  <h3 className="text-lg font-semibold">No hay items en cola</h3>
                  <p className="text-muted-foreground">Todos los items están siendo procesados</p>
                </CardContent>
              </Card>
            ) : (
              pendingQueues.map((queue) => (
                <Card key={queue.id} className="border-yellow-200">
                  <CardHeader className="bg-yellow-50">
                    <CardTitle className="flex items-center gap-2 text-yellow-800">
                      <Clock className="h-5 w-5" />
                      🟡 En Cola - {queue.branchName}
                    </CardTitle>
                    <CardDescription className="text-yellow-700">
                      {queue.items.filter(item => item.status === "pending" || item.status === "in_queue").length} items esperando procesamiento
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Producto</TableHead>
                          <TableHead>Cantidad</TableHead>
                          <TableHead>Prioridad</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Motivo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {queue.items
                          .filter(item => item.status === "pending" || item.status === "in_queue")
                          .map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">{item.productName}</TableCell>
                              <TableCell>{item.quantity} {item.unit}</TableCell>
                              <TableCell>{getPriorityBadge(item.priority)}</TableCell>
                              <TableCell>{getStatusBadge(item.status)}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{item.reason}</TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                    <div className="flex gap-2">
                      {mergeOpportunities[queue.id] && mergeOpportunities[queue.id].length > 0 && (
                        <div className="flex-1 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-sm font-medium text-blue-900 mb-2">
                            💡 Oportunidades de Fusión Disponibles
                          </p>
                          <p className="text-sm text-blue-700">
                            Hay {mergeOpportunities[queue.id].length} pedido(s) en borrador que pueden fusionar estos items automáticamente.
                          </p>
                        </div>
                      )}
                      <Button 
                        onClick={() => handleProcessAutoMerge(queue.branchId)}
                        disabled={actionLoading}
                        variant="outline"
                        className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                      >
                        <Merge className="mr-2 h-4 w-4" />
                        Procesar Fusión Automática
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            {completedQueues.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Package className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold">No hay reposiciones completadas</h3>
                  <p className="text-muted-foreground">Las reposiciones completadas aparecerán aquí</p>
                </CardContent>
              </Card>
            ) : (
              completedQueues.map((queue) => (
                <Card key={queue.id} className="border-green-200">
                  <CardHeader className="bg-green-50">
                    <CardTitle className="flex items-center gap-2 text-green-800">
                      <CheckCircle className="h-5 w-5" />
                      ✅ Completadas - {queue.branchName}
                    </CardTitle>
                    <CardDescription className="text-green-700">
                      {queue.items.filter(item => item.status === "completed" || item.status === "merged").length} items procesados
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Producto</TableHead>
                          <TableHead>Cantidad</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Procesado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {queue.items
                          .filter(item => item.status === "completed" || item.status === "merged")
                          .map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">{item.productName}</TableCell>
                              <TableCell>{item.quantity} {item.unit}</TableCell>
                              <TableCell>{getStatusBadge(item.status)}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {formatDate(item.completedAt || item.mergedAt)}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </ProtectedRoute>
  )
}

export default ReplacementsContent
