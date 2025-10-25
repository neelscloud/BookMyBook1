"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createBrowserClient } from "@supabase/ssr"
import { Button } from "@/components/ui/button"
import { MessageCircle, ArrowLeft } from "lucide-react"
import ChatInterface from "@/components/chat-interface"

interface Conversation {
  userId: string
  profile: {
    id: string
    full_name: string
    avatar_url: string
  }
  lastMessage: {
    content: string
    created_at: string
    sender_id: string
  }
  unreadCount: number
}

export default function MessagesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string | null>(searchParams.get("user"))
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) {
          router.push("/auth/login")
          return
        }

        setCurrentUser(user)

        const response = await fetch("/api/messages")
        if (!response.ok) throw new Error("Failed to fetch conversations")
        const data = await response.json()
        setConversations(data)
      } catch (error) {
        console.error("Error fetching conversations:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchConversations()
  }, [supabase, router])

  const handleBackToList = () => {
    setSelectedUserId(null)
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (selectedUserId && currentUser) {
    return (
      <ChatInterface
        currentUserId={currentUser.id}
        otherUserId={selectedUserId}
        onBack={handleBackToList}
        conversations={conversations}
      />
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-amber-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button
            onClick={() => router.back()}
            variant="outline"
            className="p-2 border-2 border-gray-300 rounded-lg bg-transparent"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">Messages</h1>
        </div>

        {conversations.length === 0 ? (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">No conversations yet</p>
            <p className="text-sm text-gray-500">Start a conversation by messaging a seller or buyer</p>
          </div>
        ) : (
          <div className="space-y-3">
            {conversations.map((conversation) => (
              <button
                key={conversation.userId}
                onClick={() => setSelectedUserId(conversation.userId)}
                className="w-full bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-4 text-left border-l-4 border-blue-600"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{conversation.profile.full_name}</h3>
                    <p className="text-sm text-gray-600 line-clamp-1">{conversation.lastMessage.content}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(conversation.lastMessage.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  {conversation.unreadCount > 0 && (
                    <div className="ml-4 bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                      {conversation.unreadCount}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
