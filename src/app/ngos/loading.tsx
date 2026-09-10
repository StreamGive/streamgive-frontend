import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { NgoCardSkeleton } from '@/components/ngos/NgoCardSkeleton';

const SKELETON_COUNT = 6;

export default function NgosLoading() {
  return (
    <>
      <Header />
      <main className="px-6 py-16 sm:px-12">
        <h1 className="text-2xl font-bold">Explore NGOs</h1>

        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: SKELETON_COUNT }, (_, i) => (
            <NgoCardSkeleton key={i} />
          ))}
        </ul>
      </main>
      <Footer />
    </>
  );
}
