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

  const risks = Array.isArray(candidate?.risks)
    ? candidate.risks.map(String).filter(Boolean).slice(0, 3)
    : fallback.risks;

  const deliverables = Array.isArray(candidate?.deliverables)
    ? candidate.deliverables.map(String).filter(Boolean).slice(0, 6)
    : fallback.deliverables;

  const sourceMilestones = Array.isArray(candidate?.milestones)
    ? candidate.milestones.slice(0, 3)
    : [];

  const semanticMilestones = fallback.milestones.map((fallbackMilestone, index) => {
    const modelMilestone = sourceMilestones[index] || {};

    const proposedName = String(modelMilestone.name || '').trim();
    const genericName = /^(week|project|phase|milestone)\s*\d+$/i.test(proposedName);

    return {
      id: createId('ms'),
      name: String(
        proposedName && !genericName ? proposedName : fallbackMilestone.name,
      ).slice(0, 90),
      description: String(
        modelMilestone.description || fallbackMilestone.description,
      ).slice(0, 220),
      status: 'PROPOSED',
    };
  });

  // Financial amounts are normalized after AI generation so they always equal
  // the user's approved budget. This prevents model arithmetic errors from
  // reaching PayPal while preserving the AI-created milestone semantics.
  const proposedAmounts = sourceMilestones.map((item) => Number(item?.amount) || 0);
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

  return {
    summary: String(candidate?.summary || fallback.summary).slice(0, 240),
    risk: validRisk,
    risks: risks.length ? risks : fallback.risks,
    deliverables: deliverables.length ? deliverables : fallback.deliverables,
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
    'Create a concise freelance project plan.',
    `Budget: ${numericBudget} USD.`,
    `Brief: ${brief}`,
    'Return JSON only with:',
    'summary string, risk Low|Medium|High, risks array of 3 strings,',
    'deliverables array of 3-5 strings, milestones array of exactly 3 objects',
    'with name, description, amount. Milestone names must be concrete deliverables, never Week 1/2/3 or Project 1/2/3.',
    'Make the three milestone amounts roughly reflect effort.',
  ].join(' ');

  try {
    const response = await fetch(config.localAiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10000),
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
        max_tokens: 320,
        response_format: { type: 'json_object' },
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
