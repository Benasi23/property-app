import './globals.css'
import { AuthProvider } from '@/lib/auth'

export const metadata = {
  title: 'Moneta Group — Selling Platform',
  description: 'Stock distribution, holds & reservations for Moneta Group selling partners.',
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