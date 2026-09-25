# Headcount

**Every project claims a community. Headcount counts the people.**

Headcount is an autonomous agent for Base that measures how many *independent humans* actually stand behind a token's holder count — not how many wallets hold it. Every finding ships with a SHA-256 receipt you can recompute yourself.

Built for the **Orion Builder Hackathon** (orionagents.org) — live on Base mainnet, zero simulated data.

---

## The pitch, in one case

```
Claims 4,200 holders.
Analysed: top 250 by balance (81.3% of supply) at block 24,918,402.
Independent funding origins: 61.
Holders with activity outside this token: 44.

Effective holders: 44.
Independence ratio: 0.176 → MANUFACTURED
```

That's the entire product. Everything below is how it gets there.

---

## Contents

- [What it does](#what-it-does)
- [How it works](#how-it-works)
- [What each verdict means](#what-each-verdict-means)
- [Architecture](#architecture)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Available commands](#available-commands)
- [Verifying a receipt](#verifying-a-receipt)
- [API](#api)
- [Testing](#testing)
- [Project structure](#project-structure)
- [Known gaps](#known-gaps)
- [Hackathon](#hackathon)
- [License](#license)

---

## What it does

Given any Base ERC-20 address, Headcount:

1. Resolves who actually funded each holder — their first-ever inbound transfer.
2. Collapses wallets that trace back to one non-exchange funder into a single cluster.
3. Counts exchange- and bridge-funded wallets as independent (funding through infrastructure isn't evidence of one operator — see [`exclusion-list.json`](./src/engine/exclusion-list.json)).
4. Computes **effective holders** and an **independence ratio** from what's left.
5. Reaches one of four verdicts from a fixed decision table — never a guess.
6. Publishes a receipt: the exact evidence, hashed, that you can recompute in your own browser or with the `reproduce` CLI.

The deterministic engine decides what's true. A bounded agent loop decides where to look deeper. An LLM only ever narrates what the engine already proved — it never computes or asserts a number.

## How it works

| Stage | What happens |
|---|---|
| **Admit** | Pin the block, read token metadata |
| **Holders** | Build the top-N holder set, report supply coverage |
| **Acquisition** | Classify bought / airdropped / dusted / transferred |
| **Funding** | Resolve first funders, cluster, exclude infrastructure |
| **Signals** | Birth dispersion, exogenous rate, cluster-adjusted concentration, dormancy |
| **Agent loop** | Model spends a bounded probe budget deepening evidence where it matters |
| **Adjudicate** | Engine assigns the verdict from a fixed table |
| **Receipt** | Canonical JSON, SHA-256 hashed |
| **Narrate** | LLM writes the prose — every number in it is checked against the run data first |

## What each verdict means

| Verdict | Meaning |
|---|---|
| 🟢 `ORGANIC` | Holders are independently funded, most show activity beyond this token |
| 🟡 `CONCENTRATED` | Ownership is real, but a small number of hands account for most of it |
| 🔴 `MANUFACTURED` | Most of the claimed community traces back to a single funding origin |
| ⚪ `UNVERIFIABLE` | Coverage or funding data was too thin to reach a finding — and we say so |

Headcount never returns `SAFE`. It measures structure, not intent.

## Architecture

```
SOURCES     Base RPC (viem), Alchemy, Basescan, pinned block, versioned exclusion list
   ↓
ENGINE      deterministic TypeScript — the only layer allowed to decide what's true
   ↓
AGENT LOOP  chooses which probes to spend a bounded budget on
   ↓
NARRATION   Groq writes prose only, gated by a numeric guard + Zod validation
   ↓
SURFACES    web UI, JSON API, Telegram bot, x402 endpoint, MCP server
```

Authority flows one direction. No layer does the job of the layer below it.

## Getting started

**Prerequisites:** Node.js 18+, npm

```bash
git clone https://github.com/Jenola344/Headcount.git
cd Headcount
npm install
cp .env.example .env.local   # fill in your API keys — see below
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `BASE_RPC_URL` | No | Defaults to `https://mainnet.base.org` |
| `ALCHEMY_API_KEY` | Yes | Free tier (30M CUs/month) — used for holder and funding resolution |
| `BASESCAN_API_KEY` | Yes | Free tier — contract metadata and verification status |
| `GROQ_API_KEY` | Yes | Narration layer only — the engine runs without it, just without prose |
| `DEFAULT_HOLDER_CAP` | No | Defaults to `250` |
| `PROBE_BUDGET` | No | Defaults to `6` |
| `X402_RECEIVE_ADDRESS` | No | Only needed for the paid x402 deep-pass endpoint |
| `X402_FACILITATOR_URL` | No | Only needed alongside the above |
| `TELEGRAM_BOT_TOKEN` | No | Only needed for the guard/alert bot |

## Available commands

| Command | What it does | Status |
|---|---|---|
| `npm run dev` | Start the local dev server | ✅ |
| `npm run build` | Production build | ✅ |
| `npm run start` | Run the production build | ✅ |
| `npm run lint` | Lint the codebase | ✅ |
| `npm run test` | Run the test suite once (Vitest) | ✅ |
| `npm run test:watch` | Run tests in watch mode | ✅ |
| `npm run reproduce` | Re-fetch Base at a case's pinned block and diff against the published receipt | ✅ |
| `npm run catalogue` | Run the engine across the token catalogue and publish `/findings` | 🚧 wired in `package.json`, `scripts/catalogue.ts` not committed yet |
| `npm run field-scan` | Score every registered hackathon entry against the same engine | 🚧 wired in `package.json`, `scripts/field-scan.ts` not committed yet |

## Verifying a receipt

Every case publishes a receipt — the canonical evidence JSON, SHA-256 hashed. You don't have to take Headcount's word for it:

- **In the browser:** open `/verify`, paste the receipt, the hash recomputes client-side.
- **From the command line:**
  ```bash
  npm run reproduce -- <token-address>
  ```
  This re-reads Base at the case's pinned block with your own RPC and diffs the result against what's published. See [`src/cli/reproduce.ts`](./src/cli/reproduce.ts).

## API

```
GET /api/token/[address]
```
Streams the live trace and returns the final verdict object for a given Base token address. See [`src/app/api/token/[address]/route.ts`](./src/app/api/token/[address]/route.ts).

Pages:
- `/` — browse recent and in-progress cases
- `/token/[address]` — case detail, live trace, full evidence, receipt
- `/findings` — catalogue run results, including failures and refusals
- `/verify` — standalone receipt verifier

## Testing

```bash
npm run test
```

Covers the deterministic engine ([`src/__tests__/engine.test.ts`](./src/__tests__/engine.test.ts)) and, critically, the narration numeric guard ([`src/__tests__/numeric-guard.test.ts`](./src/__tests__/numeric-guard.test.ts)) — the test that confirms the model can't slip a fabricated number past the engine's evidence.

## Project structure

```
src/
├── agent/           # the bounded probe loop — chooser, loop, probe menu
├── app/
│   ├── api/         # /api/token/[address]
│   ├── token/       # case detail page
│   ├── findings/    # catalogue results page
│   └── verify/      # receipt verifier page
├── engine/          # deterministic stages — admit, holders, acquisition,
│   │                # funding, signals, adjudicate, receipt
│   └── exclusion-list.json   # versioned infra/CEX/bridge exclusion list
├── narration/        # LLM prose layer + the numeric guard
├── sources/          # Base RPC, Alchemy, Basescan clients
├── sweeper/          # background cron (hourly catalogue, daily field scan)
├── cli/reproduce.ts  # reproducibility CLI
└── __tests__/
```



- **X:** [_g3theadcount_](https://x.com/g3theadcount)
- **Telegram:** [_add link_](https://t.me/getheadcount)
- **Website:** [_Headcount_](https://headcount-seven-omega.vercel.app/)
