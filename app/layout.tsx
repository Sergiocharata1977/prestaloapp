import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'prestaloapp',
  description: 'Landing minima de Next.js para validar deploy en Vercel.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
