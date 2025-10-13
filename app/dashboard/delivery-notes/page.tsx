"use client"

import { ProtectedRoute } from "@/components/protected-route"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Eye } from "lucide-react"
import { useEffect, useState } from "react"
import { collection, getDocs, query, orderBy } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/lib/auth-context"
import type { DeliveryNote } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Link from "next/link"

function DeliveryNotesContent() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDeliveryNotes()
  }, [])

  const fetchDeliveryNotes = async () => {
    setLoading(true)
    try {
      const q = query(collection(db, "apps/controld/deliveryNotes"), orderBy("createdAt", "desc"))
      const snapshot = await getDocs(q)
      const notesData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as DeliveryNote[]
      setDeliveryNotes(notesData)
    } catch (error) {
      console.error("[v0] Error al cargar remitos:", error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los remitos",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
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
          <h2 className="text-2xl font-bold">Remitos</h2>
          <p className="text-muted-foreground">Historial de remitos generados</p>
        </div>

        <Card>
          <CardHeader>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por número de pedido, sucursal..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center text-muted-foreground">Cargando remitos...</p>
            ) : (
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
                  {filteredNotes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No hay remitos disponibles
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredNotes.map((note) => (
                      <TableRow key={note.id}>
                        <TableCell className="font-medium">{note.orderNumber}</TableCell>
                        <TableCell>{note.fromBranchName}</TableCell>
                        <TableCell>{note.toBranchName}</TableCell>
                        <TableCell className="text-sm">{formatDate(note.createdAt)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Badge variant="default">{note.itemsDelivered.length} OK</Badge>
                            {note.itemsReturned.length > 0 && (
                              <Badge variant="destructive">{note.itemsReturned.length} Dev</Badge>
                            )}
                            {note.itemsNotReceived.length > 0 && (
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
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  )
}

export default DeliveryNotesContent
