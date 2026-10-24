const form = document.getElementById('start-form');
const input = document.getElementById('url');
const error = document.getElementById('url-error');
const button = document.getElementById('start-button');
const demoForm = document.getElementById('demo-form');
const demoError = document.getElementById('demo-error');
const demoButton = document.getElementById('demo-button');

function showError(target, message, field) {
  target.textContent = message;
  target.hidden = false;
  if (field) {
    field.setAttribute('aria-invalid', 'true');
    field.focus();
  }
}

// Starts an audit; returns an error message or navigates to the run.
async function startAudit(url) {
  try {
    const res = await fetch('/api/audits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 409 && data.runId) return { message: data.error, runId: data.runId };
      return { message: data.error || 'The audit could not be started.' };
    }
    location.href = `/run?id=${encodeURIComponent(data.id)}`;
    return null;
  } catch {
    return { message: 'AccessBench could not be reached. Check that the server is running.' };
  }
}

function reportFailure(target, failure, field) {
  showError(target, `${failure.message} `, field);
  if (failure.runId) {
    const link = document.createElement('a');
    link.href = `/run?id=${encodeURIComponent(failure.runId)}`;
    link.textContent = 'Open the running audit';
    target.append(link);
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  error.hidden = true;
  input.removeAttribute('aria-invalid');
  let value = input.value.trim();
  if (!value) return showError(error, 'Enter a website address.', input);
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  button.disabled = true;
  button.textContent = 'Starting…';
  const failure = await startAudit(value);
  if (failure) reportFailure(error, failure, input);
  button.disabled = false;
  button.textContent = 'Start audit';
});

demoForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  demoError.hidden = true;
  const variant = new FormData(demoForm).get('variant');
  demoButton.disabled = true;
  demoButton.textContent = 'Starting…';
  try {
    const res = await fetch('/api/demo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ variant }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'The demo site could not be switched.');
    const failure = await startAudit(data.url);
    if (failure) reportFailure(demoError, failure);
  } catch (err) {
    showError(demoError, err.message);
  }
  demoButton.disabled = false;
  demoButton.textContent = 'Audit the demo site';
});

async function loadDemo() {
  try {
    const { url, variant } = await (await fetch('/api/demo')).json();
    document.getElementById('demo-link').href = url;
    const radio = demoForm.querySelector(`input[value="${variant}"]`);
    if (radio) radio.checked = true;
  } catch {}
}

async function loadRecent() {
  const container = document.getElementById('recent');
  try {
    const { audits } = await (await fetch('/api/audits')).json();
    if (!audits.length) {
      container.innerHTML = '<p class="muted">No audits yet.</p>';
      return;
    }
    const list = document.createElement('ul');
    for (const a of audits) {
      const li = document.createElement('li');
      const link = document.createElement('a');
      link.href = `/run?id=${encodeURIComponent(a.id)}`;
      link.textContent = a.startUrl;
      li.append(link, ` — ${a.lifecycle}${a.baselineRunId ? ' (retest)' : ''}, ${new Date(a.createdAt).toLocaleString()}`);
      list.append(li);
    }
    container.replaceChildren(list);
  } catch {
    container.innerHTML = '<p class="muted">Recent audits could not be loaded.</p>';
  }
}
loadDemo();
loadRecent();
