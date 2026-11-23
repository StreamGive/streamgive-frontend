# Run the frontend with a local backend and testnet contracts

This setup runs the frontend on `http://localhost:3001`, the backend API on
`http://localhost:3000`, and PostgreSQL in Docker. The frontend reads NGO and
stream data from the backend, while wallet transactions call Stellar testnet
contracts. Keep the backend's [local development instructions](https://github.com/StreamGive/streamgive-backend#local-development)
and [environment reference](https://github.com/StreamGive/streamgive-backend/blob/main/ENVIRONMENT.md)
handy if its commands or variables change.

1. Install Node.js and Docker, then clone the two repositories side by side:

   ```sh
   git clone https://github.com/StreamGive/streamgive-backend.git
   git clone https://github.com/StreamGive/streamgive-frontend.git
   ```

2. Configure the backend and start its database:

   ```sh
   cd streamgive-backend
   cp .env.example .env
   docker compose up -d postgres
   npm install
   npm run db:push
   npm run db:seed  # optional: load sample NGOs, donors, and streams
   ```

   The example `DATABASE_URL` connects to the Docker PostgreSQL instance at
   `localhost:5432` when the backend runs directly on your machine. If you
   changed the database credentials or port, update `DATABASE_URL` in the
   backend's `.env` before `npm run db:push`.

3. Check the testnet settings in the backend's `.env`. Its
   `NGO_REGISTRY_CONTRACT_ID` and `DONATION_VAULT_CONTRACT_ID` must match the
   frontend variables in the next step. The example files include the current
   testnet IDs; use [contract deployments](https://github.com/StreamGive/streamgive-contracts/blob/main/deployments.json)
   if you need to update them. Keep `SOROBAN_RPC_URL` on testnet and include
   `http://localhost:3001` in `CORS_ORIGINS` (already set in the backend
   example). The backend indexer needs both contract IDs to process on-chain
   events.

4. Copy the frontend configuration in a second terminal:

   ```sh
   cd streamgive-frontend
   cp .env.example .env.local
   npm install
   ```

   Confirm `NEXT_PUBLIC_API_URL=http://localhost:3000` and that
   `NEXT_PUBLIC_DONATION_VAULT_CONTRACT_ID` matches the backend's
   `DONATION_VAULT_CONTRACT_ID`, while
   `NEXT_PUBLIC_NGO_REGISTRY_CONTRACT_ID` matches its
   `NGO_REGISTRY_CONTRACT_ID`. Leave `NEXT_PUBLIC_SOROBAN_RPC_URL` and
   `NEXT_PUBLIC_NETWORK_PASSPHRASE` on testnet. See the frontend
   [environment reference](../ENVIRONMENT.md) for the remaining variables.

5. Start each app in its own terminal:

   ```sh
   # In streamgive-backend
   npm run dev
   ```

   ```sh
   # In streamgive-frontend
   npm run dev
   ```

   Open `http://localhost:3001/ngos`. Seeded records can appear immediately;
   newly created on-chain activity appears after the backend indexes its
   events. A fresh indexer starts at the current ledger, so older contract
   events will not automatically be replayed. For wallet actions, use a
   funded Stellar testnet wallet on the same network as the contract IDs.

If the page cannot reach the API, check that the backend is running on port
`3000`, `NEXT_PUBLIC_API_URL` points there, and `CORS_ORIGINS` includes the
frontend origin. If the backend cannot connect to PostgreSQL, follow its
[database troubleshooting steps](https://github.com/StreamGive/streamgive-backend#troubleshooting).
