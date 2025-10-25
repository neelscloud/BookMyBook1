"use server"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { stripe } from "@/lib/stripe"

interface CartItem {
  id: string
  listing_id: string
  listings: {
    price: number
    books: {
      title: string
    }
  }
}

export async function createCheckoutSession(cartItemIds: string[]) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("User not authenticated")
  }

  // Fetch cart items with prices from database for server-side validation
  const { data: cartItems, error } = await supabase
    .from("cart_items")
    .select(`
      id,
      listing_id,
      listings(price, books(title))
    `)
    .in("id", cartItemIds)
    .eq("buyer_id", user.id)

  if (error || !cartItems || cartItems.length === 0) {
    throw new Error("Cart items not found")
  }

  // Create line items with server-validated prices
  const lineItems = (cartItems as CartItem[]).map((item) => ({
    price_data: {
      currency: "inr",
      product_data: {
        name: item.listings.books.title,
        description: `Book listing from BookMyBook`,
      },
      unit_amount: Math.round(item.listings.price * 100), // Convert to paise
    },
    quantity: 1,
  }))

  // Create Checkout Session
  const session = await stripe.checkout.sessions.create({
    ui_mode: "embedded",
    redirect_on_completion: "never",
    line_items: lineItems,
    mode: "payment",
    metadata: {
      buyer_id: user.id,
      cart_item_ids: cartItemIds.join(","),
    },
  })

  return session.client_secret
}

export async function completeCheckout(sessionId: string) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // The `setAll` method was called from a Server Component.
          }
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("User not authenticated")
  }

  // Retrieve session from Stripe
  const session = await stripe.checkout.sessions.retrieve(sessionId)

  if (session.payment_status !== "paid") {
    throw new Error("Payment not completed")
  }

  // Get cart item IDs from metadata
  const cartItemIds = session.metadata?.cart_item_ids?.split(",") || []

  // Fetch cart items to get listing and seller info
  const { data: cartItems, error } = await supabase
    .from("cart_items")
    .select(`
      id,
      listing_id,
      listings(price, seller_id)
    `)
    .in("id", cartItemIds)
    .eq("buyer_id", user.id)

  if (error || !cartItems) {
    throw new Error("Failed to fetch cart items")
  }

  // Create orders for each cart item
  for (const item of cartItems as CartItem[]) {
    const { error: orderError } = await supabase.from("orders").insert({
      buyer_id: user.id,
      seller_id: item.listings.seller_id,
      listing_id: item.listing_id,
      total_amount: item.listings.price,
      status: "completed",
      payment_id: session.payment_intent,
    })

    if (orderError) throw orderError

    // Update listing status to sold
    await supabase.from("listings").update({ status: "sold" }).eq("id", item.listing_id)
  }

  // Clear cart items
  const { error: deleteError } = await supabase.from("cart_items").delete().in("id", cartItemIds)

  if (deleteError) throw deleteError

  return { success: true }
}
