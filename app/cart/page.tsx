"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@supabase/ssr"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Trash2, Minus, Plus } from "lucide-react"

interface CartItem {
  id: string
  listing_id: string
  quantity: number
  listings: {
    price: number
    image_url: string
    books: {
      title: string
      author: string
    }
  }
}

export default function CartPage() {
  const router = useRouter()
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  useEffect(() => {
    const fetchCart = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) {
          router.push("/auth/login")
          return
        }

        const { data, error } = await supabase
          .from("cart_items")
          .select(`
            id,
            listing_id,
            quantity,
            listings(price, image_url, books(title, author))
          `)
          .eq("buyer_id", user.id)

        if (error) throw error
        setCartItems(data as CartItem[])

        const cartTotal = (data as CartItem[]).reduce((sum, item) => sum + item.listings.price * item.quantity, 0)
        setTotal(cartTotal)
      } catch (error) {
        console.error("Error fetching cart:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchCart()
  }, [supabase, router])

  const handleRemoveItem = async (cartItemId: string) => {
    try {
      const { error } = await supabase.from("cart_items").delete().eq("id", cartItemId)

      if (error) throw error
      const updatedItems = cartItems.filter((item) => item.id !== cartItemId)
      setCartItems(updatedItems)
      const newTotal = updatedItems.reduce((sum, item) => sum + item.listings.price * item.quantity, 0)
      setTotal(newTotal)
    } catch (error) {
      console.error("Error removing item:", error)
    }
  }

  const handleUpdateQuantity = async (cartItemId: string, newQuantity: number) => {
    if (newQuantity < 1) return

    setUpdatingId(cartItemId)
    try {
      const { error } = await supabase.from("cart_items").update({ quantity: newQuantity }).eq("id", cartItemId)

      if (error) throw error

      const updatedItems = cartItems.map((item) => (item.id === cartItemId ? { ...item, quantity: newQuantity } : item))
      setCartItems(updatedItems)
      const newTotal = updatedItems.reduce((sum, item) => sum + item.listings.price * item.quantity, 0)
      setTotal(newTotal)
    } catch (error) {
      console.error("Error updating quantity:", error)
    } finally {
      setUpdatingId(null)
    }
  }

  const handleCheckout = () => {
    router.push("/checkout")
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-amber-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Shopping Cart</h1>

        {cartItems.length === 0 ? (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <p className="text-gray-600 mb-4">Your cart is empty</p>
            <Button
              onClick={() => router.push("/")}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
            >
              Continue Shopping
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              {cartItems.map((item) => (
                <div key={item.id} className="bg-white rounded-lg shadow-lg p-4 flex gap-4">
                  {item.listings.image_url && (
                    <Image
                      src={item.listings.image_url || "/placeholder.svg"}
                      alt={item.listings.books.title}
                      width={100}
                      height={120}
                      className="w-24 h-32 object-cover rounded"
                    />
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{item.listings.books.title}</h3>
                    <p className="text-sm text-gray-600">{item.listings.books.author}</p>
                    <p className="text-lg font-bold text-blue-600 mt-2">₹{item.listings.price.toFixed(2)}</p>

                    <div className="flex items-center gap-3 mt-4">
                      <button
                        onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                        disabled={updatingId === item.id || item.quantity <= 1}
                        className="p-1 hover:bg-gray-100 rounded disabled:opacity-50"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center font-semibold">{item.quantity}</span>
                      <button
                        onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                        disabled={updatingId === item.id}
                        className="p-1 hover:bg-gray-100 rounded disabled:opacity-50"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <button onClick={() => handleRemoveItem(item.id)} className="text-red-500 hover:text-red-700">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Order Summary */}
            <div className="bg-white rounded-lg shadow-lg p-6 h-fit">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Order Summary</h2>
              <div className="space-y-3 mb-6 pb-6 border-b border-gray-200">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>₹{total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Shipping</span>
                  <span>₹0.00</span>
                </div>
              </div>
              <div className="flex justify-between text-xl font-bold text-gray-900 mb-6">
                <span>Total</span>
                <span>₹{total.toFixed(2)}</span>
              </div>
              <Button
                onClick={handleCheckout}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold"
              >
                Proceed to Checkout
              </Button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
