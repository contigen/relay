import type { Metadata } from 'next'
import './globals.css'
import { ConvexClientProvider } from './convex-client-provider'

export const metadata: Metadata = {
  title: 'RELAY — Autonomous Sourcing Agent',
  description:
    'Email-native autonomous AI sourcing agent with real-time verification and multi-vendor coordination.',
}

type RootLayoutProps = {
  children: React.ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang='en'>
      <body
        className='antialiased min-h-screen bg-[#fafafa] text-[#0a0a0a]'
        suppressHydrationWarning
      >
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  )
}
