import React, { createContext, useContext, useState, useEffect } from 'react'
import { trpc } from '@/lib/trpc'
import type { User } from '../../../shared/types'

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
  })

  // Handle user state updates
  useEffect(() => {
    if (meQuery.data !== undefined) {
      setUser(meQuery.data || null)
      setIsLoading(false)
    }
  }, [meQuery.data])

  const logoutMutation = trpc.auth.logout.useMutation()

  const logout = async () => {
    await logoutMutation.mutateAsync()
    setUser(null)
  }

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export { AuthContext }