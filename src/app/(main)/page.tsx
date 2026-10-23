import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { HowItWorks } from '@/components/landing/HowItWorks';
import { StatsStrip } from '@/components/landing/StatsStrip';
import { StatsStripSkeleton } from '@/components/landing/StatsStripSkeleton';

export default async function Home() {
  const t = await getTranslations('HomePage');

  return (
    <>
      <main id="main">
        <section className="flex flex-col items-center gap-6 px-6 py-24 text-center sm:px-12">
          <h1 className="max-w-2xl text-4xl font-bold sm:text-5xl">{t('heroHeading')}</h1>
          <p className="max-w-xl text-gray-600 dark:text-gray-400">{t('heroSubtext')}</p>
          <Link
            href="/ngos"
            className="rounded-md bg-black px-6 py-3 text-sm font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
          >
            {t('exploreNgos')}
          </Link>
        </section>
        <Suspense fallback={<StatsStripSkeleton />}>
          <StatsStrip />
        </Suspense>
        <HowItWorks />
      </main>
    </>
  );
}
