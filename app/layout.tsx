import './globals.css'
import { AuthProvider } from '@/lib/auth'

export const metadata = {
  title: 'Mirum Group — Selling Platform',
  description: 'Stock distribution, holds & reservations for Mirum Group selling partners.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}