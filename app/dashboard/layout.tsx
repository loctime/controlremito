"use client"

import type React from "react"

import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Package, FileText, Users, Settings, ClipboardList, Boxes, File, Menu } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth()
  const pathname = usePathname()

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
    { name: "Pedidos", href: "/dashboard/orders", icon: FileText, roles: ["admin", "factory", "branch", "delivery", "maxdev"] },
    { name: "Productos", href: "/dashboard/products", icon: Boxes, roles: ["admin", "factory", "branch", "maxdev"] },
    {
      name: "Plantillas",
      href: "/dashboard/templates",
      icon: ClipboardList,
      roles: ["admin", "factory", "branch", "maxdev"],
    },
    {
      name: "Remitos",
      href: "/dashboard/delivery-notes",
      icon: File,
      roles: ["admin", "factory", "branch", "delivery", "maxdev"],
    },
    { name: "Usuarios", href: "/dashboard/users", icon: Users, roles: ["admin", "maxdev"] },
    { name: "Configuración", href: "/dashboard/settings", icon: Settings, roles: ["admin", "maxdev"] },
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
            {/* Menú móvil - Versión simple */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="md:hidden mr-2 border-2">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Abrir menú</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {filteredNavigation.map((item) => {
                  const Icon = item.icon
                  const isActive = pathname === item.href
                  return (
                    <DropdownMenuItem key={item.href} asChild>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center gap-2 cursor-pointer",
                          isActive && "bg-accent"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {item.name}
                      </Link>
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
            
            <Package className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold">Control de Remitos</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-xs text-muted-foreground">{getRoleLabel(user?.role || "")}</p>
            </div>
            <Button variant="outline" onClick={signOut}>
              Cerrar sesión
            </Button>
          </div>
        </div>
      </header>

      {/* Menú horizontal para pantallas pequeñas */}
      <div className="md:hidden border-b bg-background">
        <div className="container mx-auto px-4 py-2">
          <nav className="flex gap-2 overflow-x-auto">
            {filteredNavigation.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap",
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
