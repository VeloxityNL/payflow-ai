import express from 'express';
import { analyzeBrief } from '../ai.js';
import { config } from '../config.js';
import { formatMoney, getPayPalToken, paypalRequest, verifyWebhook } from '../paypal.js';
import { addEvent, createId, readState, writeState } from '../store.js';

export const apiRouter = express.Router();

apiRouter.get('/status', async (req, res) => {
  const state = await readState();
  let paypalSandbox = false;

  try {
    await getPayPalToken();
    paypalSandbox = true;
  } catch {
    paypalSandbox = false;
  }

  res.json({
    ok: true,
    paypalSandbox,
    ai: config.localAiModel,
    projects: state.projects.length,
    events: state.events.slice(0, 12),
  });
});

apiRouter.get('/projects', async (req, res) => {
  res.json((await readState()).projects);
});

apiRouter.post('/analyze', async (req, res) => {
  const brief = String(req.body.brief || '').trim();
  const client = String(req.body.client || 'Demo Client').trim();
  const budget = Math.max(100, Number(req.body.budget) || 600);

  if (brief.length < 15) {
    return res.status(400).json({ error: 'Please enter a more detailed client brief.' });
  }

  const analysis = await analyzeBrief(brief, budget);
  const project = {
    id: createId('proj'),
    client,
    brief,
    budget,
    currency: 'USD',
    status: 'DRAFT',
    analysis,
    payments: [],
    createdAt: new Date().toISOString(),
  };

  const state = await readState();
  state.projects.unshift(project);
  await writeState(state);
  await addEvent('AI', 'AI created a scoped payment plan', {
    projectId: project.id,
    engine: analysis.engine,
  });

  res.json(project);
});

apiRouter.post('/projects/:projectId/approve', async (req, res) => {
  const state = await readState();
  const project = state.projects.find((item) => item.id === req.params.projectId);

  if (!project) return res.status(404).json({ error: 'Project not found.' });

  project.status = 'APPROVED';
  project.analysis.milestones.forEach((milestone) => {
    if (milestone.status === 'PROPOSED') milestone.status = 'APPROVED';
  });

  await writeState(state);
  await addEvent('APPROVAL', 'Human approved the AI payment plan', {
    projectId: project.id,
  });

  res.json(project);
});

apiRouter.post('/projects/:projectId/milestones/:milestoneId/order', async (req, res) => {
  try {
    const state = await readState();
    const project = state.projects.find((item) => item.id === req.params.projectId);

    if (!project) return res.status(404).json({ error: 'Project not found.' });
    if (project.status !== 'APPROVED') {
      return res.status(409).json({ error: 'Approve the AI plan before creating a payment.' });
    }

    const milestone = project.analysis.milestones.find(
      (item) => item.id === req.params.milestoneId,
    );

    if (!milestone) return res.status(404).json({ error: 'Milestone not found.' });

    const order = await paypalRequest('/v2/checkout/orders', {
      method: 'POST',
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: `${project.id}:${milestone.id}`,
            description: `PayFlow AI · ${milestone.name}`.slice(0, 127),
            amount: {
              currency_code: 'USD',
              value: formatMoney(milestone.amount),
            },
          },
        ],
        application_context: {
          brand_name: 'PayFlow AI',
          landing_page: 'LOGIN',
          user_action: 'PAY_NOW',
          return_url: `${config.publicBaseUrl}/?paypal=approved&project=${encodeURIComponent(project.id)}&milestone=${encodeURIComponent(milestone.id)}`,
          cancel_url: `${config.publicBaseUrl}/?paypal=cancelled&project=${encodeURIComponent(project.id)}`,
        },
      }),
    });

    milestone.status = 'PAYMENT_CREATED';
    milestone.paypalOrderId = order.id;
    project.payments.unshift({
      id: createId('pay'),
      milestoneId: milestone.id,
      orderId: order.id,
      amount: milestone.amount,
      status: order.status,
      createdAt: new Date().toISOString(),
    });

    await writeState(state);
    await addEvent('PAYPAL', 'PayPal Sandbox order created', {
      projectId: project.id,
      orderId: order.id,
      amount: milestone.amount,
    });

    res.json({
      orderId: order.id,
      status: order.status,
      approveUrl: order.links?.find((link) => link.rel === 'approve')?.href,
    });
  } catch (error) {
    res.status(502).json({
      error: error.message,
      details: error.details?.details?.[0]?.description,
    });
  }
});

apiRouter.post('/paypal/capture/:orderId', async (req, res) => {
  try {
    const order = await paypalRequest(
      `/v2/checkout/orders/${encodeURIComponent(req.params.orderId)}/capture`,
      { method: 'POST', body: '{}' },
    );

    const state = await readState();

    for (const project of state.projects) {
      const payment = project.payments.find((item) => item.orderId === req.params.orderId);
      if (!payment) continue;

      payment.status = order.status;
      payment.capturedAt = new Date().toISOString();

      const milestone = project.analysis.milestones.find(
        (item) => item.id === payment.milestoneId,
      );

      if (milestone) {
        milestone.status = order.status === 'COMPLETED' ? 'PAID' : order.status;
      }

      if (project.analysis.milestones.every((item) => item.status === 'PAID')) {
        project.status = 'PAID';
      }
    }

    await writeState(state);
    await addEvent('PAYPAL', 'Sandbox payment captured', {
      orderId: order.id,
      status: order.status,
    });

    res.json(order);
  } catch (error) {
    res.status(502).json({
      error: error.message,
      details: error.details?.details?.[0]?.description,
    });
  }
});

apiRouter.get('/paypal/order/:orderId', async (req, res) => {
  try {
    const order = await paypalRequest(
      `/v2/checkout/orders/${encodeURIComponent(req.params.orderId)}`,
    );
    res.json(order);
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

/**
 * PayPal webhooks are signature-verified before they can mutate demo state.
 */
apiRouter.post('/paypal/webhook', async (req, res) => {
  try {
    const event = req.body || {};
    const verified = await verifyWebhook(req.headers, event);

    if (!verified) {
      return res.status(400).json({ error: 'Webhook signature verification failed.' });
    }

    const orderId =
      event.resource?.supplementary_data?.related_ids?.order_id ||
      event.resource?.id ||
      null;

    if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED' && orderId) {
      const state = await readState();

      for (const project of state.projects) {
        const payment = project.payments.find((item) => item.orderId === orderId);
        if (!payment) continue;

        payment.status = 'COMPLETED';
        payment.capturedAt = new Date().toISOString();

        const milestone = project.analysis.milestones.find(
          (item) => item.id === payment.milestoneId,
        );
        if (milestone) milestone.status = 'PAID';

        if (project.analysis.milestones.every((item) => item.status === 'PAID')) {
          project.status = 'PAID';
        }
      }

      await writeState(state);
    }

    await addEvent('WEBHOOK', event.event_type || 'PayPal webhook', {
      resourceId: event.resource?.id || null,
      verified: true,
    });

    res.sendStatus(200);
  } catch (error) {
    console.error('Webhook verification failed:', error.message);
    res.status(400).json({ error: 'Webhook verification failed.' });
  }
});
