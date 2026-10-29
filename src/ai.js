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
 * Ask the local model for structured scoping output.
 * A deterministic fallback keeps the demo responsive if local inference is slow.
 */
export async function analyzeBrief(brief, budget) {
  const fallback = buildFallbackPlan(brief, budget);
  const numericBudget = Number(budget) || 600;

  const prompt = [
    'You are PayFlow AI, a freelancer project scoping assistant.',
    'Return ONLY valid JSON with keys:',
    'summary (string), risk (Low|Medium|High), risks (array of 3 strings),',
    'deliverables (array of 3-6 strings), milestones (exactly 3 objects with name, description, amount).',
    `Milestone amounts must total exactly ${numericBudget}.`,
    `Client brief: ${brief}`,
  ].join(' ');

  try {
    const response = await fetch(config.localAiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        model: config.localAiModel,
        messages: [
          { role: 'system', content: 'You output strict JSON only. Never use markdown.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.15,
        max_tokens: 1000,
      }),
    });

    const payload = await response.json();
    const rawText = payload?.choices?.[0]?.message?.content || '';
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) throw new Error('Local model returned no JSON object.');

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed.milestones) || parsed.milestones.length !== 3) {
      throw new Error('Local model returned an invalid milestone structure.');
    }

    parsed.milestones = parsed.milestones.map((milestone) => ({
      ...milestone,
      id: createId('ms'),
      amount: Number(milestone.amount) || 0,
      status: 'PROPOSED',
    }));

    return {
      ...fallback,
      ...parsed,
      engine: `Local AI · ${config.localAiModel}`,
    };
  } catch {
    return {
      ...fallback,
      engine: 'Local fallback',
      aiWarning: 'Local model fallback used for this request.',
    };
  }
}
