const steps = [
  {
    title: 'Connect your wallet',
    description: 'Freighter or any supported Stellar wallet — one click, no account to create.',
  },
  {
    title: 'Start a stream',
    description:
      'Pick a verified NGO, set an amount and a rate. They get paid continuously, second by second — not in one lump sum.',
  },
  {
    title: 'Stay in control',
    description:
      'Top up, adjust the rate, or cancel anytime. Unspent funds always come back to you, instantly.',
  },
];

export function HowItWorks() {
  return (
    <section className="px-6 py-16 sm:px-12">
      <h2 className="text-2xl font-bold">How it works</h2>
      <ol className="mt-8 grid gap-8 sm:grid-cols-3">
        {steps.map((step, index) => (
          <li key={step.title}>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black text-sm font-bold text-white">
              {index + 1}
            </div>
            <h3 className="mt-4 font-semibold">{step.title}</h3>
            <p className="mt-1 text-sm text-gray-600">{step.description}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
