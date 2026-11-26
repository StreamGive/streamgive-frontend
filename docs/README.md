# Documentation index

Every guide in the repository, with one line on what it covers.

## Root guides

- [README](../README.md): what the app is, the stack, local development, deployment and troubleshooting.
- [CONTRIBUTING](../CONTRIBUTING.md): setup, running unit and E2E tests, linting and the accessibility checklist.
- [ENVIRONMENT](../ENVIRONMENT.md): every `NEXT_PUBLIC_*` variable with its development default and production requirement.
- [SECURITY](../SECURITY.md): how to report a vulnerability privately.
- [CHANGELOG](../CHANGELOG.md): notable changes to the project.

## Setup and deployment

- [LOCAL_BACKEND](./LOCAL_BACKEND.md): run the frontend against a local backend and the testnet contracts.
- [local-backendd](./local-backendd.md): an identical copy of LOCAL_BACKEND.
- [DEPLOYMENT](./DEPLOYMENT.md): deploy to Vercel or Docker, and the environment variables each needs.
- [WALLET_TROUBLESHOOTING](./WALLET_TROUBLESHOOTING.md): fixes for common wallet connection problems.
- [WALLET_SUPPORT_MATRIX](./WALLET_SUPPORT_MATRIX.md): which wallets the kit offers and what has been tested with each.

## Architecture

- [COMPONENTS](./COMPONENTS.md): a tree of `src/components/` with a line on each component.
- [STATE_ARCHITECTURE](./STATE_ARCHITECTURE.md): the wallet and toast contexts and the signature cache.
- [STATE_CONVENTIONS](./STATE_CONVENTIONS.md): the loading, empty and error state patterns and wording.
- [DATA_FETCHING](./DATA_FETCHING.md): server and client data loading, revalidation and polling.
- [CONTRACT_CALLS](./CONTRACT_CALLS.md): every Soroban contract method the app calls and the UI flow behind it.
- [adr/](./adr/README.md): accepted architecture decision records and the template for new ones.

## Features

- [ADMIN_AUTH](./ADMIN_AUTH.md): how admin API requests are authenticated with a signed message.
- [admin-auth-mock](./admin-auth-mock.md): an identical copy of ADMIN_AUTH.
- [EMBED](./EMBED.md): embed the donate widget in an iframe on another site.
- [I18N](./I18N.md): how translations are wired up and how to add a language.

## Design and accessibility

- [DESIGN](./DESIGN.md): colour tokens, type scale, spacing rules and shared components.
- [THEMING](./THEMING.md): Tailwind v4 theme tokens and the dark mode strategy.
- [ACCESSIBILITY](./ACCESSIBILITY.md): focus, contrast and interaction patterns to follow.

## Reference

- [GLOSSARY](./GLOSSARY.md): terms used across the app, such as streams, rates and stroops.
