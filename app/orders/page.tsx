"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@supabase/ssr"
import { Button } from "@/components/ui/button"

interface Order {
  id: string
  total_amount: number
  status: string
  created_at: string
  listing_id: string
  seller_id: string
  payment_id: string
  listings: {
    image_url: string
    books: {
      title: string
      author: string
      condition: string
    }
  }
}

interface SellerInfo {
  id: string
  full_name: string
  email: string
}

export default function OrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [sellers, setSellers] = useState<Record<string, SellerInfo>>({})
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) {
          router.push("/auth/login")
          return
        }

        const { data, error } = await supabase
          .from("orders")
          .select(`
            id,
            total_amount,
            status,
            created_at,
            listing_id,
            seller_id,
            payment_id,
            listings(image_url, books(title, author, condition))
          `)
          .eq("buyer_id", user.id)
          .order("created_at", { ascending: false })

        if (error) throw error
        setOrders(data as Order[])

        // Fetch seller information for all orders
        const sellerIds = [...new Set((data as Order[]).map((order) => order.seller_id))]
        if (sellerIds.length > 0) {
          const { data: sellerData, error: sellerError } = await supabase
            .from("profiles")
            .select("id, full_name, email")
            .in("id", sellerIds)

          if (!sellerError && sellerData) {
            const sellerMap = sellerData.reduce(
              (acc, seller) => {
                acc[seller.id] = seller
                return acc
              },
              {} as Record<string, SellerInfo>,
            )
            setSellers(sellerMap)
          }
        }
      } catch (error) {
        console.error("Error fetching orders:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchOrders()
  }, [supabase, router])

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800"
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      case "cancelled":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-amber-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">My Orders</h1>

        {orders.length === 0 ? (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <p className="text-gray-600 mb-4">No orders yet</p>
            <Button
              onClick={() => router.push("/")}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
            >
              Start Shopping
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {orders.map((order) => {
              const seller = sellers[order.seller_id]
              return (
                <div
                  key={order.id}
                  className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
                >
                  {order.listings.image_url && (
                    <div className="h-48 bg-gray-200 overflow-hidden">
                      <img
                        src={order.listings.image_url || "/placeholder.svg"}
                        alt={order.listings.books.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <div className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">
                          {order.listings.books.title}
                        </h3>
                        <p className="text-sm text-gray-600">{order.listings.books.author}</p>
                      </div>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ml-2 ${getStatusColor(order.status)}`}
                      >
                        {order.status}
                      </span>
                    </div>

                    <div className="space-y-2 mb-4 text-sm text-gray-600">
                      <p>Condition: {order.listings.books.condition}</p>
                      <p>Order Date: {new Date(order.created_at).toLocaleDateString()}</p>
                      {seller && <p>Seller: {seller.full_name}</p>}
                    </div>

                    <div className="border-t pt-3 mb-4">
                      <p className="text-2xl font-bold text-blue-600">₹{order.total_amount.toFixed(2)}</p>
                    </div>

                    <div className="space-y-2">
                      <Button
                        onClick={() => setSelectedOrder(order)}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm"
                      >
                        View Details
                      </Button>
                      {seller && (
                        <Button
                          onClick={() => router.push(`/messages?user=${selectedOrder.seller_id}`)}
                          className="w-full bg-amber-600 hover:bg-amber-700 text-white py-2 rounded-lg text-sm"
                        >
                          Contact Seller
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {selectedOrder && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-96 overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-2xl font-bold text-gray-900">Order Details</h2>
                  <button onClick={() => setSelectedOrder(null)} className="text-gray-500 hover:text-gray-700 text-2xl">
                    ×
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Book Information</h3>
                    <p className="text-gray-700">Title: {selectedOrder.listings.books.title}</p>
                    <p className="text-gray-700">Author: {selectedOrder.listings.books.author}</p>
                    <p className="text-gray-700">Condition: {selectedOrder.listings.books.condition}</p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Order Information</h3>
                    <p className="text-gray-700">Order ID: {selectedOrder.id}</p>
                    <p className="text-gray-700">Date: {new Date(selectedOrder.created_at).toLocaleDateString()}</p>
                    <p className="text-gray-700">Status: {selectedOrder.status}</p>
                    <p className="text-gray-700">Payment ID: {selectedOrder.payment_id}</p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Seller Information</h3>
                    {sellers[selectedOrder.seller_id] ? (
                      <>
                        <p className="text-gray-700">Name: {sellers[selectedOrder.seller_id].full_name}</p>
                        <p className="text-gray-700">Email: {sellers[selectedOrder.seller_id].email}</p>
                      </>
                    ) : (
                      <p className="text-gray-600">Seller information not available</p>
                    )}
                  </div>

                  <div className="border-t pt-4">
                    <p className="text-xl font-bold text-blue-600">Total: ₹{selectedOrder.total_amount.toFixed(2)}</p>
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  <Button
                    onClick={() => setSelectedOrder(null)}
                    className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-900 py-2 rounded-lg"
                  >
                    Close
                  </Button>
                  <Button
                    onClick={() => {
                      // TODO: Implement review feature
                      alert("Review feature coming soon!")
                    }}
                    className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-2 rounded-lg"
                  >
                    Leave Review
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
