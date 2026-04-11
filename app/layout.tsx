import type { Metadata } from 'next'

import './globals.css'

export const metadata: Metadata = {
  title: 'Ochsner heat pump dashboard',
  description: 'Read-only monitoring dashboard for Ochsner heat pump systems',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
