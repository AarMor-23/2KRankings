import './globals.css';

export const metadata = {
  title: '2K26 Rankings',
  description: 'Weekly power rankings with Monday voting',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
