import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
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
            // Handle cookie setting errors
          }
        },
      },
    },
  )

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const otherUserId = searchParams.get("otherUserId")

    if (!otherUserId) {
      // Get all conversations for the user
      const { data, error } = await supabase
        .from("messages")
        .select(
          `
          id,
          sender_id,
          receiver_id,
          content,
          created_at,
          read,
          listing_id
        `,
        )
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at", { ascending: false })

      if (error) throw error

      // Group messages by conversation
      const conversations = new Map()
      data.forEach((msg) => {
        const otherUser = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id
        if (!conversations.has(otherUser)) {
          conversations.set(otherUser, [])
        }
        conversations.get(otherUser).push(msg)
      })

      // Get unique user IDs and fetch their profiles
      const userIds = Array.from(conversations.keys())
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, avatar_url").in("id", userIds)

      const profileMap = profiles?.reduce(
        (acc, profile) => {
          acc[profile.id] = profile
          return acc
        },
        {} as Record<string, any>,
      )

      const conversationList = Array.from(conversations.entries()).map(([userId, messages]) => ({
        userId,
        profile: profileMap?.[userId],
        lastMessage: messages[0],
        unreadCount: messages.filter((m) => m.receiver_id === user.id && !m.read).length,
      }))

      return NextResponse.json(conversationList)
    } else {
      // Get messages between two users
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`,
        )
        .order("created_at", { ascending: true })

      if (error) throw error

      // Mark messages as read
      await supabase.from("messages").update({ read: true }).eq("receiver_id", user.id).eq("sender_id", otherUserId)

      return NextResponse.json(data)
    }
  } catch (error) {
    console.error("Error fetching messages:", error)
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
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
            // Handle cookie setting errors
          }
        },
      },
    },
  )

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { receiverId, content, listingId } = await request.json()

    if (!receiverId || !content) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("messages")
      .insert({
        sender_id: user.id,
        receiver_id: receiverId,
        content,
        listing_id: listingId || null,
        read: false,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error sending message:", error)
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 })
  }
}
