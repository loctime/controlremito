"use client"

import type React from "react"

import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Package, FileText, Users, Settings, ClipboardList, Boxes, File, Menu, Download, Trash2 } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useInstallPWA } from "@/hooks/use-install-pwa"
import { clearMainCollections } from "@/lib/dev-utils"
import { useToast } from "@/hooks/use-toast"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { useState } from "react"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut, changeRole } = useAuth()
  const pathname = usePathname()
  const { isInstallable, isInstalled, installPWA } = useInstallPWA()
  const { toast } = useToast()
  const [isClearing, setIsClearing] = useState(false)

  const handleRoleChange = async (newRole: string) => {
    await changeRole(newRole)
  }

  const handleClearCollections = async () => {
    setIsClearing(true)
    try {
      const result = await clearMainCollections()
      
      if (result.success) {
        toast({
          title: "✅ Colecciones eliminadas",
          description: `Se eliminaron: ${Object.entries(result.details || {})
            .map(([key, value]) => `${key} (${value} docs)`)
            .join(", ")}`,
        })
      } else {
        toast({
          title: "❌ Error",
          description: result.message,
          variant: "destructive",
        })
      }
    } catch (error: any) {
      toast({
        title: "❌ Error",
        description: error.message || "Error al eliminar colecciones",
        variant: "destructive",
      })
    } finally {
      setIsClearing(false)
    }
  }

  const getRoleLabel = (role: string) => {
    const labels = {
      admin: "Administrador",
      factory: "Fábrica",
      branch: "Sucursal",
      delivery: "Delivery",
      maxdev: "Desarrollador",
    }
    return labels[role as keyof typeof labels] || role
  }

  const navigation = [
    { name: "Inicio", href: "/dashboard", icon: Package, roles: ["admin", "factory", "branch", "delivery", "maxdev"] },
    { name: "Pedidos", href: "/dashboard/orders", icon: FileText, roles: ["admin", "factory", "delivery", "maxdev"] },
    { name: "Productos", href: "/dashboard/products", icon: Boxes, roles: ["admin", "maxdev"] },
    {
      name: "Plantillas",
      href: "/dashboard/templates",
      icon: ClipboardList,
      roles: ["admin", "factory", "maxdev"],
    },
    {
      name: "Remitos",
      href: "/dashboard/delivery-notes",
      icon: File,
      roles: ["admin", "factory", "branch", "delivery", "maxdev"],
    },
    { name: "Usuarios", href: "/dashboard/users", icon: Users, roles: ["admin", "maxdev"] },
    { name: "Configuración", href: "/dashboard/settings", icon: Settings, roles: ["admin", "factory", "branch", "delivery", "maxdev"] },
  ]

  const filteredNavigation = navigation.filter((item) => item.roles.includes(user?.role || ""))

  const NavigationItems = () => (
    <nav className="space-y-1">
      {filteredNavigation.map((item) => {
        const Icon = item.icon
        const isActive = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {item.name}
          </Link>
        )
      })}
    </nav>
  )

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="sticky top-0 z-50 border-b bg-background">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            {/* Menú móvil - Versión simple (no se muestra para sucursal) */}
            {user?.role !== "branch" && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="md:hidden mr-2 border-2 min-h-[44px] min-w-[44px] touch-manipulation">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Abrir menú</span>
            </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  {filteredNavigation.map((item) => {
                    const Icon = item.icon
                    const isActive = pathname === item.href
                    const mobileLabel = item.name === "Configuración" ? "Config" : item.name
                    return (
                      <DropdownMenuItem key={item.href} asChild>
                        <Link
                          href={item.href}
                          className={cn(
                            "flex items-center gap-3 cursor-pointer min-h-[44px] touch-manipulation px-3 py-2",
                            isActive && "bg-accent"
                          )}
                        >
                          <Icon className="h-4 w-4 flex-shrink-0" />
                          <span className="text-sm font-medium">{mobileLabel}</span>
                        </Link>
                      </DropdownMenuItem>
                    )
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            
            <Package className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            <h1 className="text-base sm:text-xl font-semibold">Control de Remitos</h1>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            {/* Botón Instalar PWA */}
            {isInstallable && !isInstalled && (
              <Button 
                onClick={installPWA}
                size="sm"
                className="bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white min-h-[44px] touch-manipulation"
              >
                <Download className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Instalar App</span>
              </Button>
            )}
            
            {/* Botón Limpiar Colecciones (solo desktop y en desarrollo) */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="destructive"
                  size="sm"
                  className="hidden md:inline-flex h-9"
                  title="Limpiar colecciones de desarrollo"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Limpiar DB
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>⚠️ ¿Eliminar todas las colecciones?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción eliminará TODAS los documentos de las siguientes colecciones:
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li><strong>orders</strong> (Pedidos)</li>
                      <li><strong>delivery-notes</strong> (Remitos)</li>
                      <li><strong>remit-metadata</strong> (Metadata de remitos)</li>
                    </ul>
                    <p className="mt-3 font-semibold text-destructive">
                      Esta acción NO se puede deshacer.
                    </p>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleClearCollections}
                    disabled={isClearing}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    {isClearing ? "Eliminando..." : "Sí, eliminar todo"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            
            {/* Selector de rol para desarrollo */}
            <Select value={user?.role} onValueChange={handleRoleChange}>
              <SelectTrigger className="w-[90px] sm:w-[120px] md:w-[140px] h-9 text-xs sm:text-sm bg-yellow-50 border-yellow-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="factory">🏭 Fábrica</SelectItem>
                <SelectItem value="branch">🏪 Sucursal</SelectItem>
                <SelectItem value="delivery">🚚 Delivery</SelectItem>
                <SelectItem value="admin">👑 Admin</SelectItem>
                <SelectItem value="maxdev">💻 Dev</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-right hidden md:block">
              <p className="text-sm font-medium truncate max-w-[150px]">{user?.name}</p>
              <p className="text-xs text-muted-foreground">{getRoleLabel(user?.role || "")}</p>
            </div>
            <Button variant="outline" onClick={signOut} className="text-xs sm:text-sm min-h-[44px] touch-manipulation">
              <span className="hidden sm:inline">Cerrar sesión</span>
              <span className="sm:hidden">Salir</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Menú horizontal para pantallas pequeñas */}
      <div className="md:hidden border-b bg-background sticky top-16 z-40">
        <div className="container mx-auto px-4 py-2">
          <nav className="flex gap-1 overflow-x-auto pb-1">
            {filteredNavigation.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              const mobileLabel = item.name === "Configuración" ? "Config" : item.name
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-3 text-sm font-medium transition-colors whitespace-nowrap min-h-[44px] touch-manipulation flex-shrink-0",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground active:bg-muted/80",
                  )}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span className="text-xs sm:text-sm">{mobileLabel}</span>
                </Link>
              )
            })}
          </nav>
        </div>
      </div>

      <div className="container mx-auto flex gap-6 p-4 md:p-6">
        <aside className="hidden w-64 shrink-0 md:block bg-background border-r pr-4">
          <div className="sticky top-20">
            <NavigationItems />
          </div>
        </aside>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}
