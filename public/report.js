// Renders the final report. Filled in as the check engine lands.
export function renderReport(container, data) {
  const { report } = data;
  container.innerHTML = '';
  const section = document.createElement('section');
  section.className = 'panel';
  const h = document.createElement('h2');
  h.textContent = 'Exploration summary';
  const p = document.createElement('p');
  p.textContent = `Twinly made ${report.exploration.calls} calls and stopped because: ${report.exploration.stopReason.replace(/_/g, ' ')}. ${report.checkpoints.length} state(s) selected.`;
  section.append(h, p);
  container.append(section);
}
