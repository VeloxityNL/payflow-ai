# Devpost submission draft

## Project name
PayFlow AI

## Tagline
From vague client brief to a paid milestone in minutes.

## Inspiration
Freelancers regularly receive underspecified requests, then spend time translating them into clear deliverables, milestones, pricing, and payment requests. We wanted to connect that reasoning layer directly to a safe PayPal Sandbox workflow without letting AI autonomously move money.

## What it does
PayFlow AI accepts a client brief and target budget, uses a local AI model to generate a structured scope, risks, deliverables, and milestone payment plan, and requires explicit human approval. Once approved, a freelancer can create a PayPal Sandbox order for a milestone. PayPal handles buyer approval, PayFlow captures the approved payment, and verified webhooks update the project timeline.

## How we built it
We built the app with Node.js and Express, a responsive browser UI, a dedicated local Qwen2.5 0.5B Instruct model served through llama.cpp, and PayPal REST APIs. The PayPal integration uses OAuth, Orders v2, capture, webhooks, and webhook signature verification. To keep the demo reliable, model output is schema-checked, milestone amounts are financially normalized to the approved budget, and inference has a timeout with a deterministic fallback generator. Secrets remain server-side and all financial actions are Sandbox-only.

## Tools used

- **PayPal Developer Platform:** Sandbox OAuth, Orders v2, Checkout approval, capture, webhooks, and webhook signature verification.
- **Qwen2.5 0.5B Instruct + llama.cpp:** local AI analysis of unstructured client briefs into project semantics and milestone weights.
- **Node.js + Express:** server-side orchestration, validation, state, and API routes.
- **Browser-native HTML/CSS/JavaScript:** responsive product UI for desktop and mobile.

## Challenges we ran into
Local AI inference can be inconsistent in latency, so we designed a fallback path that preserves the product flow without pretending a model response succeeded. We also separated AI recommendation from payment execution with a human approval gate, and implemented webhook verification instead of trusting incoming callbacks.

## Accomplishments
- AI output directly drives the payment plan instead of acting as a decorative chatbot.
- Human approval is required before a PayPal order can be created.
- End-to-end PayPal Sandbox OAuth, Orders, capture and webhook architecture.
- Verified webhooks and server-side secret handling.
- Fully responsive public demo and open-source repository.

## What we learned
Connecting AI to payments is less about maximum autonomy and more about clear boundaries. The strongest workflow lets AI structure ambiguous work while keeping consequential payment actions explicit and reviewable.

## What's next
Next we would add persistent database storage, reusable client templates, invoice generation, richer change-request analysis, multi-currency planning, and a production PayPal onboarding path for freelancers.

## Links
Judge preview: https://iwesley.dev/payflow-ai-preview
Direct demo: https://iwesley.dev/payflow-ai/
Recorded demo MP4: https://iwesley.dev/payflow-ai-demo.mp4
Downloadable demo: https://iwesley.dev/payflow-ai-demo-download.mp4
YouTube demo: <ADD_PUBLIC_YOUTUBE_URL_AFTER_UPLOAD>
Repository: https://github.com/VeloxityNL/payflow-ai
