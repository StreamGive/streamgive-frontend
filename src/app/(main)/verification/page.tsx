import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

type VerificationStep = { title: string; description: string };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Verification');
  return { title: t('title'), description: t('description') };
}

export default async function VerificationPage() {
  const t = await getTranslations('Verification');
  // The steps and limits are JSON arrays, so read them with t.raw() rather
  // than running them through ICU formatting.
  const steps = t.raw('steps') as VerificationStep[];
  const limits = t.raw('limits') as string[];

  return (
    <main id="main" className="px-6 py-16 sm:px-12">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <p className="mt-2 max-w-2xl text-gray-600 dark:text-gray-400">{t('description')}</p>

      <h2 className="mt-8 text-lg font-semibold">{t('stepsHeading')}</h2>
      <ol className="mt-4 max-w-2xl space-y-4">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className="rounded-lg border border-gray-200 p-4 dark:border-gray-800"
          >
            <h3 className="font-medium">
              {index + 1}. {step.title}
            </h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{step.description}</p>
          </li>
        ))}
      </ol>

      <h2 className="mt-10 text-lg font-semibold">{t('limitsHeading')}</h2>
      <ul className="mt-4 max-w-2xl list-disc space-y-2 pl-6 text-gray-600 dark:text-gray-400">
        {limits.map((limit) => (
          <li key={limit}>{limit}</li>
        ))}
      </ul>

      <p className="mt-8 max-w-2xl text-sm text-gray-600 dark:text-gray-400">{t('footerNote')}</p>
      <Link href="/ngos" className="mt-6 inline-block text-sm font-medium underline">
        {t('backToNgos')}
      </Link>
    </main>
  );
}
