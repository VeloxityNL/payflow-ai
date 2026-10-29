# PayFlow AI

**From vague client brief to a paid milestone in minutes.**

PayFlow AI is an open-source hackathon project that combines local AI project scoping with PayPal Sandbox milestone payments. A freelancer pastes a client brief, the AI proposes scope, deliverables, risks, and a milestone payment plan, and the freelancer explicitly approves that plan before any PayPal payment action can be created.

> Built for the PayPal AI Hackathon 2026. The public demo uses PayPal **Sandbox only** — no real money is charged.

## Live demo

- Judge preview: https://iwesley.dev/payflow-ai-preview
- Direct demo: https://iwesley.dev/payflow-ai/
- Recorded demo MP4: https://iwesley.dev/payflow-ai-demo.mp4
- Source: https://github.com/VeloxityNL/payflow-ai

## Core flow

1. **Describe the work** — paste a client request and target budget.
2. **AI structures it** — a local AI model proposes scope, deliverables, risks, and three milestones.
3. **Human approval** — the freelancer must approve the plan before payment creation is unlocked.
4. **PayPal order** — PayFlow creates a PayPal Sandbox Checkout order for the selected milestone.
5. **Buyer approval** — PayPal hosts the buyer approval flow.
6. **Capture + webhooks** — the approved payment is captured and verified PayPal webhooks update project state.
7. **Transparent activity log** — AI, approval, order, capture, and webhook activity is visible in the app.

## Why PayFlow AI

Freelancers often receive vague project requests and then manually translate them into scope, milestones, acceptance criteria, and payment requests. PayFlow AI connects these steps while keeping the human in control of financial actions.

The AI is not a decorative chatbot: its structured output directly determines the milestone/payment workflow that the freelancer reviews before PayPal is invoked.

## Stack

- Node.js 24 + Express 5
- Browser-native responsive frontend
- Dedicated local Qwen2.5 0.5B Instruct model (`payflow-qwen-0.5b`)
- AI-output validation + financial normalization layer
- Deterministic fallback scoping engine for demo reliability
- PayPal REST API / Sandbox
- PayPal Orders API
- PayPal Webhooks + signature verification
- JSON persistence for hackathon demo state
- Nginx + systemd deployment on Ubuntu 24.04

## Safety / design choices

- **Sandbox only:** the server is hard-wired to `https://api-m.sandbox.paypal.com`.
- **Human-in-the-loop:** a project must be explicitly approved before an order can be created.
- **Secrets stay server-side:** PayPal credentials are loaded from `.env`, never sent to the browser, and `.env` is ignored by Git.
- **Webhook verification:** PayPal webhook signatures are verified before event state is trusted.
- **AI timeout + fallback:** slow local inference cannot break the demo; a deterministic milestone generator takes over after the timeout.

## Local development

### 1. Install the web app

```bash
npm install
cp .env.example .env
```

### 2. Start the local AI model

PayFlow uses the official **Qwen2.5 0.5B Instruct GGUF** model through `llama.cpp`. The model is intentionally not committed to Git because it is hundreds of megabytes.

Download it from:

https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF

Recommended file: `qwen2.5-0.5b-instruct-q4_0.gguf`

Place it in `./models/`, then run:

```bash
./scripts/start-local-model.sh
```

If your `llama-server` binary is elsewhere, set `LLAMA_SERVER_BIN`.

### 3. Start PayFlow

```bash
npm start
```

Open `http://127.0.0.1:8810`.

### Environment

```env
PAYPAL_MODE=sandbox
PAYPAL_CLIENT_ID=your_sandbox_client_id
PAYPAL_CLIENT_SECRET=your_sandbox_secret
PAYPAL_WEBHOOK_ID=your_registered_webhook_id
PORT=8810
```

Create a PayPal Sandbox app in the PayPal Developer Dashboard and register a webhook pointing to:

`https://YOUR_HOST/api/paypal/webhook`

Recommended events:

- `CHECKOUT.ORDER.APPROVED`
- `PAYMENT.CAPTURE.COMPLETED`
- `PAYMENT.CAPTURE.DENIED`
- `PAYMENT.CAPTURE.REFUNDED`

## API overview

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | Service, PayPal and local-AI health |
| `POST /api/analyze` | Convert a client brief into a structured payment plan |
| `POST /api/projects/:id/approve` | Explicit human approval |
| `POST /api/projects/:pid/milestones/:mid/order` | Create PayPal Sandbox order |
| `POST /api/paypal/capture/:orderId` | Capture an approved PayPal order |
| `POST /api/paypal/webhook` | Receive + verify PayPal events |
| `GET /api/projects` | Project/payment workspace |
| `GET /api/status` | Demo health + event timeline |

## Architecture

```text
Client brief
    │
    ▼
Local AI ──timeout──► deterministic fallback
    │
    ▼
Structured scope + milestones
    │
    ▼
Human approval gate
    │
    ▼
PayPal Sandbox Orders API
    │
    ├──► PayPal buyer approval
    │
    └──► Capture
            │
            ▼
      Verified webhooks
            │
            ▼
     Project state + activity
```

## Hackathon criteria

See [`CRITERIA.md`](./CRITERIA.md) for a direct mapping of the implementation to the official judging criteria.

## License

MIT
