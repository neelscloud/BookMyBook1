"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@supabase/ssr"
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js"
import { loadStripe } from "@stripe/stripe-js"
import { Button } from "@/components/ui/button"
import { createCheckoutSession, completeCheckout } from "@/app/actions/stripe"

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface CartItem {
  id: string
  listing_id: string
  listings: {
    price: number
    seller_id: string
    books: {
      title: string
    }
  }
}

export default function CheckoutPage() {
  const router = useRouter()
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showCheckout, setShowCheckout] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)

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
            listings(price, seller_id, books(title))
          `)
          .eq("buyer_id", user.id)

        if (error) throw error
        setCartItems(data as CartItem[])

        const cartTotal = (data as CartItem[]).reduce((sum, item) => sum + item.listings.price, 0)
        setTotal(cartTotal)
      } catch (error) {
        console.error("Error fetching cart:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchCart()
  }, [supabase, router])

  const handleCheckout = async () => {
    try {
      const cartItemIds = cartItems.map((item) => item.id)
      const clientSecret = await createCheckoutSession(cartItemIds)
      setSessionId(clientSecret)
      setShowCheckout(true)
    } catch (error) {
      console.error("Error creating checkout session:", error)
      alert("Failed to create checkout session")
    }
  }

  const handleCheckoutComplete = async () => {
    if (!sessionId) return

    try {
      await completeCheckout(sessionId)
      router.push("/orders?success=true")
    } catch (error) {
      console.error("Error completing checkout:", error)
      alert("Failed to complete checkout")
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (cartItems.length === 0) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-amber-50">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Checkout</h1>
          <div className="bg-white rounded-lg shadow-lg p-6">
            <p className="text-gray-600 mb-4">Your cart is empty</p>
            <Button onClick={() => router.push("/")} className="bg-blue-600 hover:bg-blue-700">
              Continue Shopping
            </Button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-amber-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Checkout</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {showCheckout ? (
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow-lg p-6">
                <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret: sessionId! }}>
                  <EmbeddedCheckout onComplete={handleCheckoutComplete} />
                </EmbeddedCheckoutProvider>
              </div>
            </div>
          ) : (
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Order Items</h2>
                <div className="space-y-3">
                  {cartItems.map((item) => (
                    <div key={item.id} className="flex justify-between text-gray-700 pb-3 border-b">
                      <span>{item.listings.books.title}</span>
                      <span>₹{item.listings.price.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-lg p-6 sticky top-4">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Order Summary</h2>
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>₹{total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Shipping</span>
                  <span>Free</span>
                </div>
                <div className="border-t pt-3 flex justify-between text-2xl font-bold text-blue-600">
                  <span>Total</span>
                  <span>₹{total.toFixed(2)}</span>
                </div>
              </div>

              {!showCheckout && (
                <Button
                  onClick={handleCheckout}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold"
                >
                  Proceed to Payment
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
