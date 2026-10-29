const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

/** Generic JSON API helper used by the browser UI. */
async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || 'Request failed.');
  }

  return payload;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character]);
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value || 0);
}

function timeAgo(timestamp) {
  const seconds = (Date.now() - new Date(timestamp)) / 1000;

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;

  return new Date(timestamp).toLocaleDateString();
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');

  setTimeout(() => toast.classList.remove('show'), 2800);
}

// ---------------------------------------------------------------------------
// Workspace navigation
// ---------------------------------------------------------------------------

function showView(viewName) {
  $$('.view').forEach((view) => view.classList.add('hidden'));
  $(`#view-${viewName}`).classList.remove('hidden');

  $$('.side').forEach((button) => {
    button.classList.toggle('active', button.dataset.view === viewName);
  });

  if (viewName === 'projects') loadProjects();
  if (viewName === 'activity') loadActivity();
}

$$('.side').forEach((button) => {
  button.addEventListener('click', () => showView(button.dataset.view));
});

// ---------------------------------------------------------------------------
// Service status
// ---------------------------------------------------------------------------

async function refreshStatus() {
  try {
    const status = await api('./api/status');
    const health = $('#health');

    $('#projectCount').textContent = status.projects;
    health.classList.toggle('ok', status.paypalSandbox);
    health.innerHTML = `
      <span></span>
      ${status.paypalSandbox ? 'AI + PayPal ready' : 'Sandbox unavailable'}
    `;
  } catch {
    // The UI remains usable even if this decorative status check fails.
  }
}

// ---------------------------------------------------------------------------
// AI proposal rendering
// ---------------------------------------------------------------------------

function milestoneRows(milestones, { payable = false, projectId = '' } = {}) {
  return milestones.map((milestone, index) => `
    <div class="milestone">
      <div class="num">0${index + 1}</div>
      <div>
        <div class="ms-title">${escapeHtml(milestone.name)}</div>
        <div class="ms-desc">${escapeHtml(milestone.description)}</div>
      </div>
      <div class="amount">${formatCurrency(milestone.amount)}</div>
      ${payable
        ? `<button class="btn pay-btn" onclick="pay('${projectId}','${milestone.id}')">Pay with PayPal</button>`
        : `<div class="ms-status">${escapeHtml(milestone.status)}</div>`}
    </div>
  `).join('');
}

function renderProposal(project) {
  const analysis = project.analysis;

  $('#result').innerHTML = `
    <div class="result-card">
      <div class="result-top">
        <div>
          <span class="kicker">AI PROPOSAL</span>
          <h3>${escapeHtml(analysis.summary)}</h3>
        </div>
        <span class="badge">
          ${escapeHtml(analysis.engine || 'AI')} · ${escapeHtml(analysis.risk)} risk
        </span>
      </div>

      <div class="meta-row">
        <span class="chip">${escapeHtml(project.client)}</span>
        <span class="chip">Budget ${formatCurrency(project.budget)}</span>
        <span class="chip">3 payment milestones</span>
      </div>

      <div class="columns">
        <div>
          <div class="sub">Deliverables</div>
          <ul class="clean">
            ${analysis.deliverables.map((item) => `<li>✓ ${escapeHtml(item)}</li>`).join('')}
          </ul>
        </div>
        <div>
          <div class="sub">Risks to watch</div>
          <ul class="clean">
            ${analysis.risks.map((item) => `<li>· ${escapeHtml(item)}</li>`).join('')}
          </ul>
        </div>
      </div>

      <div class="milestones">
        <div class="sub">Milestone plan</div>
        ${milestoneRows(analysis.milestones)}
      </div>

      <div class="safeguards">
        <div class="sub">AI safeguards</div>
        ${(analysis.safeguards || []).map((item) => `<span class="guard">✓ ${escapeHtml(item)}</span>`).join('')}
      </div>

      <div class="approve-row">
        <div class="safe">● No payment can be created until you approve.</div>
        <button class="btn primary" onclick="approve('${project.id}')">
          Approve payment plan →
        </button>
      </div>
    </div>
  `;
}

function renderApprovedPlan(project) {
  $('#result').innerHTML = `
    <div class="result-card">
      <div class="result-top">
        <div>
          <span class="kicker">APPROVED PLAN</span>
          <h3>${escapeHtml(project.analysis.summary)}</h3>
        </div>
        <span class="badge">Human approved</span>
      </div>

      <div class="milestones">
        ${milestoneRows(project.analysis.milestones, {
          payable: true,
          projectId: project.id,
        })}
      </div>

      <div class="approve-row">
        <div class="safe">● Sandbox only — no real money is charged.</div>
        <button class="btn ghost" onclick="showView('projects')">
          Open workspace
        </button>
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Project creation + approval
// ---------------------------------------------------------------------------

$('#analyzeForm').addEventListener('submit', async (event) => {
  event.preventDefault();

  const button = $('#analyzeBtn');
  const previousLabel = button.innerHTML;

  button.disabled = true;
  button.innerHTML = '<span class="spinner"></span> Structuring brief';

  try {
    const project = await api('./api/analyze', {
      method: 'POST',
      body: JSON.stringify({
        client: $('#client').value,
        brief: $('#brief').value,
        budget: $('#budget').value,
      }),
    });

    renderProposal(project);
    showToast('AI payment plan created');
    refreshStatus();
  } catch (error) {
    showToast(error.message);
  } finally {
    button.disabled = false;
    button.innerHTML = previousLabel;
  }
});

window.approve = async (projectId) => {
  try {
    const project = await api(`./api/projects/${projectId}/approve`, {
      method: 'POST',
      body: '{}',
    });

    renderApprovedPlan(project);
    showToast('Plan approved — payment creation unlocked');
  } catch (error) {
    showToast(error.message);
  }
};

// ---------------------------------------------------------------------------
// PayPal Sandbox flow
// ---------------------------------------------------------------------------

window.pay = async (projectId, milestoneId) => {
  try {
    showToast('Creating PayPal Sandbox order…');

    const order = await api(
      `./api/projects/${projectId}/milestones/${milestoneId}/order`,
      { method: 'POST', body: '{}' },
    );

    if (!order.approveUrl) {
      throw new Error('PayPal approval link missing.');
    }

    window.location.href = order.approveUrl;
  } catch (error) {
    showToast(error.message);
  }
};

async function handlePayPalReturn() {
  const query = new URLSearchParams(window.location.search);
  const orderId = query.get('token');

  if (query.get('paypal') === 'approved' && orderId) {
    history.replaceState({}, '', window.location.pathname);

    try {
      showToast('Capturing approved Sandbox payment…');
      const order = await api(`./api/paypal/capture/${encodeURIComponent(orderId)}`, {
        method: 'POST',
        body: '{}',
      });

      showToast(`Payment ${order.status.toLowerCase()} ✓`);
      showView('projects');
    } catch (error) {
      showToast(error.message);
    }
  }

  if (query.get('paypal') === 'cancelled') {
    history.replaceState({}, '', window.location.pathname);
    showToast('Sandbox payment cancelled');
  }
}

// ---------------------------------------------------------------------------
// Projects + activity
// ---------------------------------------------------------------------------

async function loadProjects() {
  try {
    const projects = await api('./api/projects');
    $('#projectCount').textContent = projects.length;

    $('#projects').innerHTML = projects.length
      ? projects.map((project) => `
          <div class="project-card">
            <div class="project-title">
              <div>
                <h3>
                  ${escapeHtml(project.client)} ·
                  ${escapeHtml(project.analysis.summary).slice(0, 70)}
                  ${project.analysis.summary.length > 70 ? '…' : ''}
                </h3>
                <small>${timeAgo(project.createdAt)} · ${escapeHtml(project.status)}</small>
              </div>
              <div class="project-budget">${formatCurrency(project.budget)}</div>
            </div>

            <div class="meta-row">
              <span class="chip">${escapeHtml(project.analysis.engine)}</span>
              <span class="chip">
                ${project.analysis.milestones.filter((item) => item.status === 'PAID').length}
                /${project.analysis.milestones.length} paid
              </span>
              <span class="chip">
                ${project.payments.length} PayPal order${project.payments.length === 1 ? '' : 's'}
              </span>
            </div>

            <div class="milestones">
              ${milestoneRows(project.analysis.milestones)}
            </div>
          </div>
        `).join('')
      : '<div class="empty">No projects yet. Create your first AI payment plan.</div>';
  } catch (error) {
    showToast(error.message);
  }
}

async function loadActivity() {
  try {
    const status = await api('./api/status');

    $('#events').innerHTML = status.events.length
      ? status.events.map((event) => {
          const icon = event.type === 'AI'
            ? 'AI'
            : event.type === 'PAYPAL'
              ? 'P'
              : event.type === 'APPROVAL'
                ? '✓'
                : '↻';

          return `
            <div class="event">
              <div class="event-icon">${icon}</div>
              <div>
                <strong>${escapeHtml(event.message)}</strong>
                <p>${escapeHtml(event.type)} · transparent event log</p>
              </div>
              <time>${timeAgo(event.at)}</time>
            </div>
          `;
        }).join('')
      : '<div class="empty">Activity will appear here as you use the demo.</div>';
  } catch (error) {
    showToast(error.message);
  }
}

// Boot the public demo.
refreshStatus();
handlePayPalReturn();
