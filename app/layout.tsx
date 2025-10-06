import './globals.css';
import ThemeToggle from './ThemeToggle';
import { ThemeProvider } from 'next-themes';

export const metadata = {
  title: '2K26 Rankings',
  description: 'Weekly power rankings with Monday voting',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <header className="header">
            <div className="brand">
              <div className="dot" />
              2K26 Rankings
            </div>
            <ThemeToggle />
          </header>

          <main className="container">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
