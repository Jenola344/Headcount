# Headcount

Headcount is an on-chain forensics engine.

## Setup

1. Copy `.env.example` to `.env` and fill in required API keys (e.g., Alchemy, BaseScan).
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```

## Scripts

- **Smoke test**: Run the engine locally against test vectors.
  ```bash
  npm run smoke
  ```
- **Reproduce**: Run the engine against a specific token.
  ```bash
  npm run reproduce <token_address> [pinned_block]
  ```
- **Tests**:
  ```bash
  npm run test
  ```
