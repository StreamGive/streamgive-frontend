import { getTranslations } from 'next-intl/server';

type Step = { title: string; description: string };

export async function HowItWorks() {
  const t = await getTranslations('HowItWorks');
  // Steps are a JSON array, not a single string — t.raw() returns the
  // message as-is instead of running it through ICU formatting.
  const steps = t.raw('steps') as Step[];

  return (
    <section className="px-6 py-16 sm:px-12">
      <h2 className="text-2xl font-bold">{t('heading')}</h2>
      <ol className="mt-8 grid gap-8 sm:grid-cols-3">
        {steps.map((step, index) => (
          <li key={step.title}>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black text-sm font-bold text-white dark:bg-white dark:text-black">
              {index + 1}
            </div>
            <h3 className="mt-4 font-semibold">{step.title}</h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{step.description}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
