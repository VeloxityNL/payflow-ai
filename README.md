# PayFlow AI

PayFlow AI is an AI-powered freelancer payment agent built for the PayPal AI Hackathon 2026.

## Concept
A freelancer pastes a client brief. The local AI agent turns it into a clear scope, milestones, acceptance criteria and payment plan. PayPal Sandbox is then used to create and track the payment flow. Webhooks keep the agent updated when payment state changes.

## Why it matters
Freelancers lose time turning vague requests into safe payment milestones. PayFlow AI combines project scoping and money movement in one workflow while keeping the freelancer in control before any payment action.

## Planned hackathon flow
1. Paste or import a freelance brief.
2. AI extracts deliverables, risks and milestones.
3. User approves the proposed payment plan.
4. PayPal Sandbox creates the payment/request flow.
5. Webhooks update status automatically.
6. Agent produces a client-ready progress and payment summary.

## Stack
- Node.js / Express
- Local AI model on the VPS (no paid AI API required)
- PayPal REST API + Sandbox
- PayPal webhooks
- Browser UI

## Status
Initial hackathon scaffold. PayPal Sandbox integration and demo UI are next.
