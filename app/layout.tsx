import type { Metadata } from 'next'
import { IBM_Plex_Sans, Space_Mono } from 'next/font/google'
import './globals.css'

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-ibm-plex-sans',
})

const spaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
  variable: '--font-space-mono',
})

export const metadata: Metadata = {
  title: 'Jarvis - Assistente de Voz',
  description: 'Controle seu PC com sua voz. Assistente inteligente que executa comandos do sistema.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${ibmPlexSans.variable} ${spaceMono.variable} ${ibmPlexSans.className}`}>
        {children}
      </body>
    </html>
  )
}
