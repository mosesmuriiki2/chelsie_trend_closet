import './globals.css';
import { DM_Sans, Playfair_Display } from 'next/font/google';

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans', display: 'swap' });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair', display: 'swap' });

export const metadata = {
  title: 'Chelsie Trend Closet | Your style, your story',
  description: 'Find your next favourite outfit at Chelsie Trend Closet. Shop fresh finds and order easily on WhatsApp.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://chelsietrendcloset.com'),
  openGraph: {
    title: 'Chelsie Trend Closet',
    description: 'Find your next favourite outfit. Shop fresh finds and order easily on WhatsApp.',
    siteName: 'Chelsie Trend Closet',
    type: 'website',
  },
  icons: { icon: '/icon.jpeg', apple: '/chelsie-logo.jpeg' },
};
export default function RootLayout({ children }) {
  return (<html lang="en"><body className={`${dmSans.variable} ${playfair.variable}`}>{children}</body></html>);
}
