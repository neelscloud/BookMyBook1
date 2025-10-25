"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BookOpen, Plus, Trash2, ArrowLeft } from "lucide-react"
import Link from "next/link"

interface UserListing {
  id: string
  price: number
  image_url: string
  status: string
  books: {
    title: string
    author: string
  }
}

export default function DashboardPage() {
  const [listings, setListings] = useState<UserListing[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const router = useRouter()
  const supabase = createClient()

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

        const { data, error } = await supabase
          .from("listings")
          .select(`
            id,
            price,
            image_url,
            status,
            books (title, author)
          `)
          .eq("seller_id", user.id)
          .order("created_at", { ascending: false })

        if (error) throw error
        setListings(data || [])
      } catch (error) {
        console.error("Error fetching listings:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const handleDelete = async (listingId: string) => {
    if (!confirm("Are you sure you want to delete this listing?")) return

    try {
      const { error } = await supabase.from("listings").update({ status: "removed" }).eq("id", listingId)

      if (error) throw error
      setListings(listings.filter((l) => l.id !== listingId))
    } catch (error) {
      console.error("Error deleting listing:", error)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-amber-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">My Dashboard</h1>
          </div>
          <Link href="/sell">
            <Button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 gap-2">
              <Plus className="w-4 h-4" />
              Sell Book
            </Button>
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Loading your listings...</p>
          </div>
        ) : listings.length === 0 ? (
          <Card className="border-0 shadow-xl text-center py-12">
            <BookOpen className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No listings yet</h2>
            <p className="text-gray-600 mb-6">Start selling your books today!</p>
            <Link href="/sell">
              <Button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800">
                Create Your First Listing
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map((listing) => (
              <Card key={listing.id} className="overflow-hidden hover:shadow-xl transition-shadow">
                <div className="relative h-48 bg-gray-200">
                  {listing.image_url ? (
                    <img
                      src={listing.image_url || "/placeholder.svg"}
                      alt={listing.books.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-amber-100">
                      <BookOpen className="w-12 h-12 text-gray-400" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2 bg-white px-3 py-1 rounded-full text-xs font-semibold text-blue-600">
                    {listing.status}
                  </div>
                </div>
                <CardHeader className="pb-3">
                  <CardTitle className="line-clamp-2">{listing.books.title}</CardTitle>
                  <CardDescription>{listing.books.author}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-blue-600">₹{listing.price}</span>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(listing.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
