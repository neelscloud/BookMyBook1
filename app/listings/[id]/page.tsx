"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createBrowserClient } from "@supabase/ssr"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Heart, MessageCircle, Share2 } from "lucide-react"

interface Listing {
  id: string
  price: number
  image_url: string
  status: string
  created_at: string
  books: {
    title: string
    author: string
    description: string
    condition: string
  }
  profiles: {
    full_name: string
    avatar_url: string
  }
}

export default function ListingDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [listing, setListing] = useState<Listing | null>(null)
  const [loading, setLoading] = useState(true)
  const [addedToCart, setAddedToCart] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  useEffect(() => {
    const fetchListing = async () => {
      try {
        const { data, error } = await supabase
          .from("listings")
          .select(`
            id,
            price,
            image_url,
            status,
            created_at,
            book_id,
            seller_id,
            books(title, author, description, condition),
            profiles(full_name, avatar_url)
          `)
          .eq("id", params.id)
          .single()

        if (error) throw error
        setListing(data as Listing)
      } catch (error) {
        console.error("Error fetching listing:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchListing()
  }, [params.id, supabase])

  const handleAddToCart = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push("/auth/login")
        return
      }

      const { error } = await supabase.from("cart_items").insert({
        buyer_id: user.id,
        listing_id: params.id,
        quantity: 1,
      })

      if (error) throw error
      setAddedToCart(true)
      setTimeout(() => setAddedToCart(false), 2000)
    } catch (error) {
      console.error("Error adding to cart:", error)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (!listing) {
    return <div className="flex items-center justify-center min-h-screen">Listing not found</div>
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-amber-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Image Section */}
          <div className="flex items-center justify-center bg-white rounded-lg shadow-lg overflow-hidden">
            {listing.image_url ? (
              <Image
                src={listing.image_url || "/placeholder.svg"}
                alt={listing.books.title}
                width={500}
                height={600}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-96 bg-gray-200 flex items-center justify-center">
                <span className="text-gray-400">No image available</span>
              </div>
            )}
          </div>

          {/* Details Section */}
          <div className="flex flex-col justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">{listing.books.title}</h1>
              <p className="text-xl text-gray-600 mb-4">by {listing.books.author || "Unknown Author"}</p>

              <div className="flex items-center gap-4 mb-6">
                <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                  {listing.books.condition}
                </span>
                <span className="text-sm text-gray-500">
                  Listed {new Date(listing.created_at).toLocaleDateString()}
                </span>
              </div>

              <div className="mb-6">
                <p className="text-gray-700 leading-relaxed">{listing.books.description}</p>
              </div>

              {/* Seller Info */}
              <div className="bg-white p-4 rounded-lg border border-gray-200 mb-6">
                <p className="text-sm text-gray-600 mb-2">Seller</p>
                <p className="text-lg font-semibold text-gray-900">{listing.profiles.full_name}</p>
              </div>
            </div>

            {/* Price and Actions */}
            <div className="space-y-4">
              <div className="text-4xl font-bold text-blue-600">₹{listing.price.toFixed(2)}</div>

              <div className="flex gap-3">
                <Button
                  onClick={handleAddToCart}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold"
                >
                  {addedToCart ? "Added to Cart!" : "Add to Cart"}
                </Button>
                <Button variant="outline" className="px-4 py-3 border-2 border-gray-300 rounded-lg bg-transparent">
                  <Heart className="w-5 h-5" />
                </Button>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => router.push(`/messages?user=${listing.seller_id}`)}
                  variant="outline"
                  className="flex-1 flex items-center justify-center gap-2 border-2 border-gray-300 py-3 rounded-lg bg-transparent"
                >
                  <MessageCircle className="w-5 h-5" />
                  Message Seller
                </Button>
                <Button variant="outline" className="px-4 py-3 border-2 border-gray-300 rounded-lg bg-transparent">
                  <Share2 className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
