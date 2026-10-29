# PayPal AI Hackathon criteria checklist

This file maps the current PayFlow AI implementation to the judging criteria shown on the official Devpost hackathon page.

## Technological Implementation

- **PayPal OAuth:** server-side Sandbox authentication with token caching.
- **Orders API:** approved project milestones can create real PayPal Sandbox Checkout orders.
- **Capture:** approved Sandbox orders can be captured after the buyer returns from PayPal.
- **Webhooks:** PayPal events are registered and incoming webhook signatures are verified before state is trusted.
- **AI:** a dedicated local Qwen2.5 0.5B Instruct model converts unstructured client briefs into structured project semantics.
- **AI → PayPal connection:** AI-generated scope and milestone semantics directly define the payment plan presented to the freelancer.
- **Financial validation:** model-generated milestone weights are normalized so the final amounts always equal the user-approved budget.
- **Human approval:** PayPal order creation stays locked until the freelancer explicitly approves the AI plan.
- **Reliability:** if local inference times out or returns invalid output, a deterministic fallback keeps the demo usable without pretending that a model response succeeded.

## Design

- Responsive desktop/mobile interface.
- Coherent flow from brief → AI plan → approval → PayPal payment → activity timeline.
- Clear visual distinction between AI recommendations, human approval, and payment state.
- Live service status for PayPal Sandbox + local AI.
- Live Sandbox metrics for planned, paid and pending volume plus completed captures.
- AI safeguards are visible in the proposal UI.

## Potential Impact

Target user: freelancers and small independent studios.

Problem addressed:
- vague client requests;
- manual project scoping;
- unclear milestone boundaries;
- disconnected payment requests;
- scope/payment disputes caused by ambiguous expectations.

PayFlow reduces those steps to one reviewable workflow while keeping consequential financial actions human-controlled.

## Innovation / Idea

The project does not simply place a chatbot next to a checkout button. AI-generated project semantics feed the milestone payment workflow, while deterministic financial validation and a human approval gate make the AI output safe enough to connect to PayPal.

## Presentation

- Hosted judge demo: https://iwesley.dev/payflow-ai-preview
- Direct live app: https://iwesley.dev/payflow-ai/
- Public source: https://github.com/VeloxityNL/payflow-ai
- Recorded demo source MP4: https://iwesley.dev/payflow-ai-demo.mp4
- Final Devpost submission still requires the demo video to be uploaded publicly to YouTube.
