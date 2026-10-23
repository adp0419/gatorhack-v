const form = document.getElementById('start-form');
const input = document.getElementById('url');
const error = document.getElementById('url-error');
const button = document.getElementById('start-button');

function showError(message) {
  error.textContent = message;
  error.hidden = false;
  input.setAttribute('aria-invalid', 'true');
  input.focus();
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  error.hidden = true;
  input.removeAttribute('aria-invalid');
  let value = input.value.trim();
  if (!value) return showError('Enter a website address.');
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  button.disabled = true;
  button.textContent = 'Starting…';
  try {
    const res = await fetch('/api/audits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: value }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 409 && data.runId) {
        showError(`${data.error} `);
        const link = document.createElement('a');
        link.href = `/run?id=${encodeURIComponent(data.runId)}`;
        link.textContent = 'Open the running audit';
        error.append(link);
        return;
      }
      return showError(data.error || 'The audit could not be started.');
    }
    location.href = `/run?id=${encodeURIComponent(data.id)}`;
  } catch {
    showError('AccessBench could not be reached. Check that the server is running.');
  } finally {
    button.disabled = false;
    button.textContent = 'Start audit';
  }
});

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
loadRecent();
