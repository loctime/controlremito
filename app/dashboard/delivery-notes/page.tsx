"use client"

import { ProtectedRoute } from "@/components/protected-route"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Eye, RefreshCw } from "lucide-react"
import { useEffect, useState } from "react"
import type { DeliveryNote } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Link from "next/link"
import { useDeliveryNotes } from "@/hooks/use-delivery-notes"

function DeliveryNotesContent() {
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")

  const {
    data: deliveryNotes = [],
    isLoading,
    isFetching,
    refetch,
    error,
  } = useDeliveryNotes()

  useEffect(() => {
    if (error) {
      console.error("❌ Error al cargar remitos:", error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los remitos",
        variant: "destructive",
      })
    }
  }, [error, toast])

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

  const isBusy = isLoading || isFetching

  const filteredNotes = deliveryNotes.filter(
    (note) =>
      note.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      note.fromBranchName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      note.toBranchName.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  return (
    <ProtectedRoute>
      <div>
        <div className="mb-6">
          <h2 className="text-xl sm:text-2xl font-bold">Remitos</h2>
          <p className="text-sm sm:text-base text-muted-foreground">Historial de remitos generados</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por número de pedido, sucursal..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => refetch()}
                disabled={isBusy}
              >
                <RefreshCw className={`h-4 w-4 ${isBusy ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center text-muted-foreground py-8">Cargando remitos...</p>
            ) : error ? (
              <div className="text-center text-destructive py-8">
                <p className="font-medium mb-1">Error al cargar remitos</p>
                <p className="text-sm text-muted-foreground">Intenta nuevamente más tarde.</p>
              </div>
            ) : filteredNotes.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <p className="text-muted-foreground">
                  {deliveryNotes.length === 0 
                    ? "No hay remitos generados todavía" 
                    : "No se encontraron resultados para tu búsqueda"}
                </p>
                {deliveryNotes.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Los remitos se generan automáticamente cuando un pedido es recibido
                  </p>
                )}
              </div>
            ) : (
              <>
                {/* Vista Mobile - Cards */}
                <div className="block md:hidden space-y-4">
                  {filteredNotes.map((note) => (
                    <Card key={note.id} className="overflow-hidden">
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <p className="font-semibold text-base">{note.orderNumber}</p>
                              <div className="flex flex-wrap gap-1">
                                {note.itemsDelivered?.length > 0 && (
                                  <Badge variant="default" className="text-xs">{note.itemsDelivered.length} OK</Badge>
                                )}
                                {note.itemsPartial?.length > 0 && (
                                  <Badge variant="secondary" className="text-xs">{note.itemsPartial.length} Parcial</Badge>
                                )}
                                {note.itemsReturned?.length > 0 && (
                                  <Badge variant="destructive" className="text-xs">{note.itemsReturned.length} Dev</Badge>
                                )}
                                {note.itemsNotReceived?.length > 0 && (
                                  <Badge variant="destructive" className="text-xs">{note.itemsNotReceived.length} NR</Badge>
                                )}
                              </div>
                            </div>
                            <Link href={`/dashboard/delivery-notes/${note.id}`}>
                              <Button variant="outline" size="sm">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-muted-foreground text-xs">Desde</p>
                              <p className="font-medium truncate">{note.fromBranchName}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">Hacia</p>
                              <p className="font-medium truncate">{note.toBranchName}</p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-sm pt-2 border-t">
                            <span className="text-xs text-muted-foreground">{formatDate(note.createdAt)}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Vista Desktop - Table */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pedido</TableHead>
                        <TableHead>Desde</TableHead>
                        <TableHead>Hacia</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredNotes.map((note) => (
                        <TableRow key={note.id}>
                          <TableCell className="font-medium">{note.orderNumber}</TableCell>
                          <TableCell>{note.fromBranchName}</TableCell>
                          <TableCell>{note.toBranchName}</TableCell>
                          <TableCell className="text-sm">{formatDate(note.createdAt)}</TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              {note.itemsDelivered?.length > 0 && (
                                <Badge variant="default">{note.itemsDelivered.length} OK</Badge>
                              )}
                              {note.itemsPartial?.length > 0 && (
                                <Badge variant="secondary">{note.itemsPartial.length} Parcial</Badge>
                              )}
                              {note.itemsReturned?.length > 0 && (
                                <Badge variant="destructive">{note.itemsReturned.length} Dev</Badge>
                              )}
                              {note.itemsNotReceived?.length > 0 && (
                                <Badge variant="destructive">{note.itemsNotReceived.length} NR</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Link href={`/dashboard/delivery-notes/${note.id}`}>
                                <Button variant="ghost" size="sm">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Link>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  )
}

export default DeliveryNotesContent
