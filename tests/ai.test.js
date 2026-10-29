import test from 'node:test';
import assert from 'node:assert/strict';

import { buildFallbackPlan, normalizePlan } from '../src/ai.js';

test('AI milestone amounts are normalized exactly to the approved budget', () => {
  const fallback = buildFallbackPlan('Build a client portal', 900);
  const candidate = {
    summary: 'Build a freelancer portal',
    risk: 'Medium',
    milestones: [
      { name: 'Information architecture', weight: 10 },
      { name: 'Portal implementation', weight: 70 },
      { name: 'QA and handoff', weight: 20 },
    ],
  };

  const plan = normalizePlan(candidate, fallback, 900);
  const total = plan.milestones.reduce((sum, milestone) => sum + milestone.amount, 0);

  assert.equal(plan.milestones.length, 3);
  assert.equal(total, 900);
});

test('generic model milestone names are replaced with meaningful fallback names', () => {
  const fallback = buildFallbackPlan('Build a client portal', 600);
  const candidate = {
    summary: 'Portal project',
    risk: 'Low',
    milestones: [
      { name: 'Week 1', weight: 20 },
      { name: 'Project 2', weight: 55 },
      { name: 'Phase 3', weight: 25 },
    ],
  };

  const plan = normalizePlan(candidate, fallback, 600);

  assert.deepEqual(
    plan.milestones.map((milestone) => milestone.name),
    ['Discovery & scope', 'Build core experience', 'QA & launch'],
  );
});
