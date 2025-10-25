"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@supabase/ssr"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ShoppingBag, TrendingUp, Clock, ArrowRight } from "lucide-react"

interface Order {
  id: string
  total_amount: number
  status: string
  created_at: string
  listings: {
    image_url: string
    books: {
      title: string
    }
  }
}

interface DashboardStats {
  totalOrders: number
  totalSpent: number
  pendingOrders: number
}

export default function BuyerDashboardPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [stats, setStats] = useState<DashboardStats>({
    totalOrders: 0,
    totalSpent: 0,
    pendingOrders: 0,
  })
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  useEffect(() => {
    const fetchData = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) {
          router.push("/auth/login")
          return
        }
        setUser(user)

        // Fetch recent orders
        const { data: ordersData, error: ordersError } = await supabase
          .from("orders")
          .select(`
            id,
            total_amount,
            status,
            created_at,
            listings(image_url, books(title))
          `)
          .eq("buyer_id", user.id)
          .order("created_at", { ascending: false })
          .limit(6)

        if (ordersError) throw ordersError
        setOrders(ordersData as Order[])

        // Calculate stats
        const { data: allOrders, error: statsError } = await supabase
          .from("orders")
          .select("total_amount, status")
          .eq("buyer_id", user.id)

        if (statsError) throw statsError

        const totalSpent = (allOrders || []).reduce((sum, order) => sum + order.total_amount, 0)
        const pendingOrders = (allOrders || []).filter((order) => order.status === "pending").length

        setStats({
          totalOrders: allOrders?.length || 0,
          totalSpent,
          pendingOrders,
        })
      } catch (error) {
        console.error("Error fetching dashboard data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [supabase, router])

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-amber-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Welcome back, {user?.email?.split("@")[0]}</h1>
          <p className="text-gray-600">Manage your purchases and explore more books</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Total Orders</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalOrders}</p>
              </div>
              <ShoppingBag className="w-12 h-12 text-blue-600 opacity-20" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Total Spent</p>
                <p className="text-3xl font-bold text-gray-900">₹{stats.totalSpent.toFixed(0)}</p>
              </div>
              <TrendingUp className="w-12 h-12 text-amber-600 opacity-20" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Pending Orders</p>
                <p className="text-3xl font-bold text-gray-900">{stats.pendingOrders}</p>
              </div>
              <Clock className="w-12 h-12 text-orange-600 opacity-20" />
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Link href="/">
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg shadow-lg p-6 text-white hover:shadow-xl transition-shadow cursor-pointer">
              <h3 className="text-xl font-bold mb-2">Browse Books</h3>
              <p className="text-blue-100 mb-4">Discover new books from sellers</p>
              <div className="flex items-center gap-2">
                <span>Start Shopping</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </Link>

          <Link href="/cart">
            <div className="bg-gradient-to-br from-amber-600 to-amber-700 rounded-lg shadow-lg p-6 text-white hover:shadow-xl transition-shadow cursor-pointer">
              <h3 className="text-xl font-bold mb-2">Your Cart</h3>
              <p className="text-amber-100 mb-4">Review items in your cart</p>
              <div className="flex items-center gap-2">
                <span>View Cart</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </Link>
        </div>

        {/* Recent Orders */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Recent Orders</h2>
            <Link href="/orders">
              <Button variant="outline" className="gap-2 bg-transparent">
                View All
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>

          {orders.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingBag className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-600 mb-4">No orders yet</p>
              <Link href="/">
                <Button className="bg-blue-600 hover:bg-blue-700">Start Shopping</Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {orders.map((order) => (
                <div key={order.id} className="border rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
                  {order.listings.image_url && (
                    <div className="h-32 bg-gray-200 overflow-hidden">
                      <img
                        src={order.listings.image_url || "/placeholder.svg"}
                        alt={order.listings.books.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 line-clamp-2 mb-2">{order.listings.books.title}</h3>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">{new Date(order.created_at).toLocaleDateString()}</span>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          order.status === "completed" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {order.status}
                      </span>
                    </div>
                    <p className="text-lg font-bold text-blue-600 mt-2">₹{order.total_amount.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
