import Link from 'next/link';

import { HowItWorks } from '@/components/landing/HowItWorks';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <section className="flex flex-col items-center gap-6 px-6 py-24 text-center sm:px-12">
          <h1 className="max-w-2xl text-4xl font-bold sm:text-5xl">
            Give as a stream, not a one-time click.
          </h1>
          <p className="max-w-xl text-gray-600">
            StreamGive lets you support verified NGOs on Stellar with continuous, cancel-anytime
            donations — transparent, on-chain, and instant.
          </p>
          <Link
            href="/ngos"
            className="rounded-md bg-black px-6 py-3 text-sm font-medium text-white hover:bg-gray-800"
          >
            Explore NGOs
          </Link>
        </section>
        <HowItWorks />
      </main>
      <Footer />
    </>
  );
}
