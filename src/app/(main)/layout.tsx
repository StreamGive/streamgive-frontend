import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';

/** Shared chrome for every route except /embed, which renders standalone
 * inside someone else's iframe and must not get a header/footer. */
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      {children}
      <Footer />
    </>
  );
}
