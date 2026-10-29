import { config } from './config.js';
import { createId } from './store.js';

function buildFallbackPlan(brief, budget) {
  const safeBudget = Math.max(100, Number(budget) || 600);
  const weights = [0.2, 0.55, 0.25];

  const milestones = [
    {
      name: 'Discovery & scope',
      description: 'Confirm scope, flows and acceptance criteria.',
    },
    {
      name: 'Build core experience',
      description: 'Implement the agreed core experience and integrations.',
    },
    {
      name: 'QA & launch',
      description: 'Run QA, resolve launch blockers and hand off.',
    },
  ].map((milestone, index) => ({
    ...milestone,
    id: createId('ms'),
    amount: Number((safeBudget * weights[index]).toFixed(2)),
    status: 'PROPOSED',
  }));

  return {
    summary: `Deliver a production-ready solution for: ${brief.slice(0, 180)}`,
    risk: 'Medium',
    risks: [
      'Scope ambiguity',
      'External integration dependencies',
      'Acceptance criteria drift',
    ],
    deliverables: [
      'Responsive working product',
      'Core workflow and integrations',
      'Testing and deployment notes',
    ],
    milestones,
  };
}

/**
 * Convert uncertain model output into a safe, deterministic project plan.
 * The model decides the semantic content; this layer enforces financial invariants.
 */
function normalizePlan(candidate, fallback, budget) {
  const safeBudget = Math.max(100, Number(budget) || 600);

  const sourceMilestones = Array.isArray(candidate?.milestones)
    ? candidate.milestones.slice(0, 3)
    : [];

  const semanticMilestones = fallback.milestones.map((fallbackMilestone, index) => {
    const modelMilestone = sourceMilestones[index] || {};

    const proposedName = String(modelMilestone.name || '').trim();
    const genericName = /^(week|project|phase|milestone)\s*\d+$/i.test(proposedName);

    const safeName = String(
      proposedName && !genericName ? proposedName : fallbackMilestone.name,
    ).slice(0, 90);

    return {
      id: createId('ms'),
      name: safeName,
      description: String(
        modelMilestone.description || `Complete ${safeName.toLowerCase()} and verify acceptance criteria.`,
      ).slice(0, 220),
      status: 'PROPOSED',
    };
  });

  // Financial amounts are normalized after AI generation so they always equal
  // the user's approved budget. This prevents model arithmetic errors from
  // reaching PayPal while preserving the AI-created milestone semantics.
  const proposedAmounts = sourceMilestones.map((item) => Number(item?.weight ?? item?.amount) || 0);
  const positiveTotal = proposedAmounts.reduce((sum, amount) => sum + Math.max(0, amount), 0);
  const fallbackWeights = [0.2, 0.55, 0.25];

  const weights = positiveTotal > 0
    ? proposedAmounts.map((amount) => Math.max(0, amount) / positiveTotal)
    : fallbackWeights;

  const normalizedAmounts = weights.map((weight) => Number((safeBudget * weight).toFixed(2)));
  const roundingDifference = Number(
    (safeBudget - normalizedAmounts.reduce((sum, amount) => sum + amount, 0)).toFixed(2),
  );
  normalizedAmounts[normalizedAmounts.length - 1] += roundingDifference;

  const milestones = semanticMilestones.map((milestone, index) => ({
    ...milestone,
    amount: Number(normalizedAmounts[index].toFixed(2)),
  }));

  const validRisk = ['Low', 'Medium', 'High'].includes(candidate?.risk)
    ? candidate.risk
    : fallback.risk;

  const deliverables = milestones.map((milestone) => milestone.name);

  return {
    summary: String(candidate?.summary || fallback.summary).slice(0, 240),
    risk: validRisk,
    risks: fallback.risks,
    deliverables,
    milestones,
  };
}

/**
 * Ask the dedicated local model for structured scoping output.
 * A deterministic fallback keeps the public demo available if inference fails.
 */
export async function analyzeBrief(brief, budget) {
  const fallback = buildFallbackPlan(brief, budget);
  const numericBudget = Math.max(100, Number(budget) || 600);

  const prompt = [
    'Create a concise freelance payment structure.',
    `Brief: ${brief}`,
    'Return JSON only:',
    '{summary, risk, milestones:[{name, weight},{name, weight},{name, weight}]}.',
    'risk is Low, Medium, or High.',
    'Milestone names must be concrete deliverables, not Week 1 or Project 1.',
    'Weights are relative effort estimates around a total of 100.',
    'Keep summary under 16 words.',
  ].join(' ');

  try {
    const response = await fetch(config.localAiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(7000),
      body: JSON.stringify({
        model: config.localAiModel,
        messages: [
          {
            role: 'system',
            content: 'Return compact valid JSON only. Do not use markdown fences.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 130,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'payflow_plan',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                summary: { type: 'string' },
                risk: {
                  type: 'string',
                  enum: ['Low', 'Medium', 'High'],
                },
                milestones: {
                  type: 'array',
                  minItems: 3,
                  maxItems: 3,
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      weight: { type: 'number' },
                    },
                    required: ['name', 'weight'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['summary', 'risk', 'milestones'],
              additionalProperties: false,
            },
          },
        },
      }),
    });

    const payload = await response.json();
    const rawText = payload?.choices?.[0]?.message?.content || '';
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) throw new Error('Local model returned no JSON object.');

    const candidate = JSON.parse(jsonMatch[0]);
    const normalized = normalizePlan(candidate, fallback, numericBudget);

    return {
      ...normalized,
      engine: `Local AI · ${config.localAiModel}`,
      safeguards: [
        'AI semantics validated before use',
        'Milestone totals normalized to approved budget',
        'Human approval required before PayPal order creation',
      ],
    };
  } catch {
    return {
      ...fallback,
      engine: 'Deterministic fallback',
      aiWarning: 'Local AI was unavailable; safe fallback planning was used.',
      safeguards: [
        'Deterministic fallback used',
        'Human approval required before PayPal order creation',
      ],
    };
  }
}
