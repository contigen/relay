'use client'

import { ConvexProvider, ConvexReactClient } from 'convex/react'
import { ReactNode } from 'react'

const convexUrl =
  process.env.NEXT_PUBLIC_CONVEX_URL ||
  process.env.VITE_CONVEX_URL ||
  'https://energetic-koala-352.convex.cloud'

const convex = new ConvexReactClient(convexUrl)

type ConvexClientProviderProps = {
  children: ReactNode
}

export function ConvexClientProvider({ children }: ConvexClientProviderProps) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>
}
