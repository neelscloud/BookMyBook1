"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { BookOpen, Search, Plus, LogOut, ShoppingCart } from "lucide-react"

interface Book {
  id: string
  title: string
  author: string
  condition: string
}

interface Profile {
  id: string
  full_name: string
}

interface Listing {
  id: string
  price: number
  image_url: string
  book_id: string
  seller_id: string
  book?: Book
  seller?: Profile
}

export default function Home() {
  const [listings, setListings] = useState<Listing[]>([])
  const [filteredListings, setFilteredListings] = useState<Listing[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [cartCount, setCartCount] = useState(0)

  const supabase = createClient()

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get current user
        const {
          data: { user },
        } = await supabase.auth.getUser()
        setUser(user)

        if (user) {
          const { data: cartData } = await supabase.from("cart_items").select("id").eq("buyer_id", user.id)
          setCartCount(cartData?.length || 0)
        }

        const { data: listingsData, error: listingsError } = await supabase
          .from("listings")
          .select("id, price, image_url, book_id, seller_id, status")
          .eq("status", "available")
          .order("created_at", { ascending: false })

        if (listingsError) throw listingsError

        if (!listingsData || listingsData.length === 0) {
          setListings([])
          setFilteredListings([])
          setLoading(false)
          return
        }

        // Get unique book IDs and seller IDs
        const bookIds = [...new Set(listingsData.map((l: any) => l.book_id))]
        const sellerIds = [...new Set(listingsData.map((l: any) => l.seller_id))]

        // Fetch all books
        const { data: booksData, error: booksError } = await supabase
          .from("books")
          .select("id, title, author, condition")
          .in("id", bookIds)

        if (booksError) throw booksError

        // Fetch all profiles
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", sellerIds)

        if (profilesError) throw profilesError

        // Create lookup maps
        const booksMap = new Map(booksData?.map((b: any) => [b.id, b]) || [])
        const profilesMap = new Map(profilesData?.map((p: any) => [p.id, p]) || [])

        // Combine data
        const enrichedListings = listingsData.map((listing: any) => ({
          ...listing,
          book: booksMap.get(listing.book_id),
          seller: profilesMap.get(listing.seller_id),
        }))

        setListings(enrichedListings)
        setFilteredListings(enrichedListings)
      } catch (error) {
        console.error("Error fetching listings:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  useEffect(() => {
    const filtered = listings.filter(
      (listing) =>
        listing.book?.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        listing.book?.author.toLowerCase().includes(searchQuery.toLowerCase()),
    )
    setFilteredListings(filtered)
  }, [searchQuery, listings])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setCartCount(0)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-amber-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <img src="/logo.jpg" alt="BookMyBook Logo" className="h-12 w-auto hover:opacity-80 transition-opacity" />
          </Link>

          <div className="flex items-center gap-4">
            {user ? (
              <>
                <Link href="/sell">
                  <Button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 gap-2">
                    <Plus className="w-4 h-4" />
                    Sell Book
                  </Button>
                </Link>
                <Link href="/dashboard">
                  <Button variant="outline">Dashboard</Button>
                </Link>
                <Link href="/cart" className="relative">
                  <Button variant="outline" size="icon">
                    <ShoppingCart className="w-4 h-4" />
                  </Button>
                  {cartCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {cartCount}
                    </span>
                  )}
                </Link>
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  <LogOut className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <>
                <Link href="/auth/login">
                  <Button variant="outline">Login</Button>
                </Link>
                <Link href="/auth/sign-up">
                  <Button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800">
                    Sign Up
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
          Discover Your Next{" "}
          <span className="bg-gradient-to-r from-blue-600 to-amber-500 bg-clip-text text-transparent">Great Read</span>
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Buy and sell used books from your community. Save money, reduce waste, and share the love of reading.
        </p>
      </section>

      {/* Search Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
        <div className="relative">
          <Search className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
          <Input
            placeholder="Search by title or author..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 py-6 text-lg rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-0"
          />
        </div>
      </section>

      {/* Listings Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Loading books...</p>
          </div>
        ) : filteredListings.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No books found. Try a different search!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredListings.map((listing) => (
              <Link key={listing.id} href={`/listings/${listing.id}`}>
                <Card className="overflow-hidden hover:shadow-xl transition-shadow duration-300 group cursor-pointer h-full">
                  <div className="relative h-48 bg-gray-200 overflow-hidden">
                    {listing.image_url ? (
                      <img
                        src={listing.image_url || "/placeholder.svg"}
                        alt={listing.book?.title || "Book"}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-amber-100">
                        <BookOpen className="w-12 h-12 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <CardHeader className="pb-3">
                    <CardTitle className="line-clamp-2 text-lg">{listing.book?.title || "Unknown Title"}</CardTitle>
                    <CardDescription className="text-sm">{listing.book?.author || "Unknown Author"}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                        {listing.book?.condition || "Unknown"}
                      </span>
                      <span className="text-sm text-gray-500">by {listing.seller?.full_name || "Unknown"}</span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                      <span className="text-2xl font-bold text-blue-600">₹{listing.price}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
