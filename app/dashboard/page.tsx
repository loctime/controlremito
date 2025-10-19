"use client"

import { ProtectedRoute } from "@/components/protected-route"
import { useAuth } from "@/lib/auth-context"
import { BranchDashboard } from "@/components/dashboard/branch-dashboard"
import { FactoryDeliveryDashboard } from "@/components/dashboard/factory-delivery-dashboard"

function DashboardContent() {
  const { user } = useAuth()

  // Renderizar dashboard según el rol del usuario
  if (user?.role === "branch") {
    return (
      <ProtectedRoute>
        <BranchDashboard />
      </ProtectedRoute>
    )
  }

  // Para factory y delivery
  return (
    <ProtectedRoute>
      <FactoryDeliveryDashboard />
    </ProtectedRoute>
  )
}

export default DashboardContent
