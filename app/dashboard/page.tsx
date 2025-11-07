"use client"

import { ProtectedRoute } from "@/components/protected-route"
import { useAuth } from "@/lib/auth-context"
import { BranchDashboard } from "@/components/dashboard/branch-dashboard"
import { FactoryDeliveryDashboard } from "@/components/dashboard/factory-delivery-dashboard"
import { PullToRefresh } from "@/components/mobile/pull-to-refresh"
import { useQueryClient } from "@tanstack/react-query"

function DashboardContent() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const handleRefresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["templates"] }),
      queryClient.invalidateQueries({ queryKey: ["orders"] }),
      queryClient.invalidateQueries({ queryKey: ["orders-list"] }),
      queryClient.invalidateQueries({ queryKey: ["delivery-notes"] }),
      queryClient.invalidateQueries({ queryKey: ["branches"] }),
      queryClient.invalidateQueries({ queryKey: ["products"] }),
    ])
  }

  // Renderizar dashboard según el rol del usuario
  if (user?.role === "branch") {
    return (
      <ProtectedRoute>
        <PullToRefresh onRefresh={handleRefresh}>
          <BranchDashboard />
        </PullToRefresh>
      </ProtectedRoute>
    )
  }

  // Para factory y delivery
  return (
    <ProtectedRoute>
      <PullToRefresh onRefresh={handleRefresh}>
        <FactoryDeliveryDashboard />
      </PullToRefresh>
    </ProtectedRoute>
  )
}

export default DashboardContent
