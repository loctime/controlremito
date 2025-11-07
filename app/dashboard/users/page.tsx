"use client"

import type React from "react"

import Link from "next/link"
import { ProtectedRoute } from "@/components/protected-route"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Search, Edit, Trash2 } from "lucide-react"
import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import type { User, Branch } from "@/lib/types"
import { useUsersQuery, useBranchesQuery, useUpdateUser, useChangeUserRole } from "@/hooks/use-users-query"
import { Loader2 } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { doc, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { USERS_COLLECTION } from "@/lib/firestore-paths"
import { useToast } from "@/hooks/use-toast"

function UsersContent() {
  const { user: currentUser, createUser } = useAuth()
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(false)
  
  // TanStack Query hooks
  const { data: users = [], isLoading: usersLoading, error: usersError, refetch: fetchUsers } = useUsersQuery()
  const { data: branches = [], isLoading: branchesLoading } = useBranchesQuery()
  const updateUserMutation = useUpdateUser()
  const changeRoleMutation = useChangeUserRole()
  const [formData, setFormData] = useState<{
    email: string
    password: string
    name: string
    role: "admin" | "factory" | "branch" | "delivery"
    branchId: string
  }>({
    email: "",
    password: "",
    name: "",
    role: "branch",
    branchId: "",
  })

  const isLoading = usersLoading || branchesLoading
  const filteredUsers = users.filter((user) => user.active && 
    (user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
     user.email?.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!currentUser) return

    setLoading(true)

    try {
      if (editingUser) {
        // Actualizar usuario existente
        await updateDoc(doc(db, USERS_COLLECTION, editingUser.id), {
          name: formData.name,
          role: formData.role,
          branchId: formData.role === "branch" || formData.role === "factory" ? formData.branchId : null,
        })

        toast({
          title: "Usuario actualizado",
          description: "El usuario se actualizó correctamente",
        })
      } else {
        // Crear nuevo usuario
        if (!formData.password || formData.password.length < 6) {
          toast({
            title: "Error",
            description: "La contraseña debe tener al menos 6 caracteres",
            variant: "destructive",
          })
          setLoading(false)
          return
        }

        await createUser(formData.email, formData.password, {
          email: formData.email,
          name: formData.name,
          role: formData.role,
          branchId: formData.role === "branch" || formData.role === "factory" ? formData.branchId : undefined,
          active: true,
        })

        toast({
          title: "Usuario creado",
          description: "El usuario se creó correctamente",
        })
      }

      setIsDialogOpen(false)
      setEditingUser(null)
      setFormData({ email: "", password: "", name: "", role: "branch", branchId: "" })
      
      // Recargar usuarios inmediatamente (la sesión del admin se mantiene)
      fetchUsers()
    } catch (error: any) {
      console.error("[v0] Error al guardar usuario:", error)

      let errorMessage = "No se pudo guardar el usuario"
      if (error.message === "auth/email-already-exists-wrong-password") {
        errorMessage = "Este email ya existe en Firebase Auth pero la contraseña proporcionada es incorrecta. Usa la contraseña correcta del usuario existente para crear su perfil en esta app."
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "El correo electrónico no es válido"
      } else if (error.code === "auth/weak-password") {
        errorMessage = "La contraseña es muy débil"
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (user: User) => {
    // Prevenir edición de usuarios maxdev
    if (user.role === "maxdev") {
      toast({
        title: "Acción no permitida",
        description: "Los usuarios maxdev no pueden ser editados",
        variant: "destructive",
      })
      return
    }

    setEditingUser(user)
    setFormData({
      email: user.email,
      password: "",
      name: user.name,
      role: user.role as "admin" | "factory" | "branch" | "delivery",
      branchId: user.branchId || "",
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (userId: string) => {
    // Prevenir eliminación de usuarios maxdev
    const userToDelete = users.find((u) => u.id === userId)
    if (userToDelete?.role === "maxdev") {
      toast({
        title: "Acción no permitida",
        description: "Los usuarios maxdev no pueden ser eliminados",
        variant: "destructive",
      })
      return
    }

    if (!confirm("¿Estás seguro de que deseas eliminar este usuario?")) return

    try {
      await updateDoc(doc(db, USERS_COLLECTION, userId), { active: false })
      toast({
        title: "Usuario eliminado",
        description: "El usuario se eliminó correctamente",
      })
      fetchUsers()
    } catch (error) {
      console.error("[v0] Error al eliminar usuario:", error)
      toast({
        title: "Error",
        description: "No se pudo eliminar el usuario",
        variant: "destructive",
      })
    }
  }

  const getRoleLabel = (role: string) => {
    const labels = {
      admin: "Administrador",
      factory: "Fábrica",
      branch: "Sucursal",
      delivery: "Delivery",
      maxdev: "Super Admin",
    }
    return labels[role as keyof typeof labels] || role
  }

  const getRoleBadgeVariant = (role: string) => {
    const variants = {
      admin: "default" as const,
      factory: "secondary" as const,
      branch: "secondary" as const,
      delivery: "secondary" as const,
      maxdev: "default" as const,
    }
    return variants[role as keyof typeof variants] || ("secondary" as const)
  }

  return (
    <ProtectedRoute allowedRoles={["admin", "maxdev"]}>
      <div>
        <div className="mb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold">Usuarios</h2>
              <p className="text-sm sm:text-base text-muted-foreground">Gestiona los usuarios del sistema</p>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => {
                    setEditingUser(null)
                    setFormData({ email: "", password: "", name: "", role: "branch", branchId: "" })
                  }}
                  className="w-full sm:w-auto"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo Usuario
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingUser ? "Editar Usuario" : "Nuevo Usuario"}</DialogTitle>
                <DialogDescription>
                  {editingUser ? "Modifica los datos del usuario" : "Completa los datos del nuevo usuario"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre completo *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Correo electrónico *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    disabled={!!editingUser}
                  />
                  {editingUser && <p className="text-xs text-muted-foreground">El correo no se puede modificar</p>}
                </div>
                {!editingUser && (
                  <div className="space-y-2">
                    <Label htmlFor="password">Contraseña *</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                      minLength={6}
                    />
                    <p className="text-xs text-muted-foreground">
                      Mínimo 6 caracteres. Si el email ya existe en Firebase Auth (de otra app), usa la contraseña correcta del usuario existente.
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="role">Rol *</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value: any) => setFormData({ ...formData, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar rol" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="factory">Fábrica</SelectItem>
                      <SelectItem value="branch">Sucursal</SelectItem>
                      <SelectItem value="delivery">Delivery</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(formData.role === "branch" || formData.role === "factory") && (
                  <div className="space-y-2">
                    <Label htmlFor="branchId">Sucursal / Fábrica *</Label>
                    {branches.length === 0 ? (
                      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground space-y-3">
                        <p>No hay sucursales activas. Crea una para poder asignarla a este usuario.</p>
                        <Button asChild size="sm" className="w-fit">
                          <Link href="/dashboard/settings?tab=branches&createBranch=1">Crear sucursal</Link>
                        </Button>
                      </div>
                    ) : (
                      <Select
                        value={formData.branchId}
                        onValueChange={(value) => setFormData({ ...formData, branchId: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar sucursal" />
                        </SelectTrigger>
                        <SelectContent>
                          {branches.map((branch) => (
                            <SelectItem key={branch.id} value={branch.id}>
                              {branch.name} ({branch.type === "factory" ? "Fábrica" : "Sucursal"})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? "Guardando..." : editingUser ? "Actualizar" : "Crear"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar usuarios..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent>
            {filteredUsers.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No hay usuarios disponibles</p>
            ) : (
              <>
                {/* Vista Mobile - Cards */}
                <div className="block md:hidden space-y-4">
                  {filteredUsers.map((user) => (
                    <Card key={user.id} className="overflow-hidden">
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1 flex-1">
                              <p className="font-semibold text-base">{user.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant={getRoleBadgeVariant(user.role)} className="text-xs">
                                  {getRoleLabel(user.role)}
                                </Badge>
                                {user.branchId && (
                                  <span className="text-xs text-muted-foreground">
                                    {branches.find((b) => b.id === user.branchId)?.name || "-"}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              {user.role !== "maxdev" && (
                                <Button variant="ghost" size="sm" onClick={() => handleEdit(user)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                              )}
                              {user.id !== currentUser?.id && user.role !== "maxdev" && (
                                <Button variant="ghost" size="sm" onClick={() => handleDelete(user.id)}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              )}
                            </div>
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
                        <TableHead>Nombre</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Rol</TableHead>
                        <TableHead>Sucursal</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.name}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            <Badge variant={getRoleBadgeVariant(user.role)}>{getRoleLabel(user.role)}</Badge>
                          </TableCell>
                          <TableCell>
                            {user.branchId ? branches.find((b) => b.id === user.branchId)?.name || "-" : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {user.role !== "maxdev" && (
                                <Button variant="ghost" size="sm" onClick={() => handleEdit(user)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                              )}
                              {user.id !== currentUser?.id && user.role !== "maxdev" && (
                                <Button variant="ghost" size="sm" onClick={() => handleDelete(user.id)}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              )}
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

export default UsersContent
