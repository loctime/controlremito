"use client"

import type React from "react"

import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Package, FileText, Users, Settings, ClipboardList, Boxes, File } from "lucide-react"
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
    }
    return labels[role as keyof typeof labels] || role
  }

  const navigation = [
    { name: "Inicio", href: "/dashboard", icon: Package, roles: ["admin", "factory", "branch", "delivery"] },
    { name: "Pedidos", href: "/dashboard/orders", icon: FileText, roles: ["admin", "factory", "branch", "delivery"] },
    { name: "Productos", href: "/dashboard/products", icon: Boxes, roles: ["admin", "factory", "branch"] },
    {
      name: "Plantillas",
      href: "/dashboard/templates",
      icon: ClipboardList,
      roles: ["admin", "factory", "branch"],
    },
    {
      name: "Remitos",
      href: "/dashboard/delivery-notes",
      icon: File,
      roles: ["admin", "factory", "branch", "delivery"],
    },
    { name: "Usuarios", href: "/dashboard/users", icon: Users, roles: ["admin"] },
    { name: "Configuración", href: "/dashboard/settings", icon: Settings, roles: ["admin"] },
  ]

  const filteredNavigation = navigation.filter((item) => item.roles.includes(user?.role || ""))

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="sticky top-0 z-50 border-b bg-background">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
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

      <div className="container mx-auto flex gap-6 p-4 md:p-6">
        <aside className="hidden w-64 shrink-0 md:block">
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
        </aside>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}
