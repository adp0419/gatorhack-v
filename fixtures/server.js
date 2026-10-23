// Controlled fixture site ("Gator Bikes") with broken and fixed variants served
// at the same URLs. The variant is read from fixtures/.variant on every request,
// so `npm run fixture:fixed` plays the role of a developer deploying a fix.
// Seeded defects (broken variant), one or more per category:
//   keyboard   - "Contact" nav item is a pointer-only <span onclick>
//   forms      - email input has only adjacent text, no label; validation error does not name the field
//   contrast   - tagline and footer text are low contrast
//   semantics  - icon-only search button has no name; hero image has no alt
//   reflow     - promo banner has a fixed 900px width
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const variantFile = path.join(dir, '.variant');
const port = Number(process.env.FIXTURE_PORT || 4100);

function variant() {
  try {
    return fs.readFileSync(variantFile, 'utf8').trim() === 'fixed' ? 'fixed' : 'broken';
  } catch {
    return 'broken';
  }
}

const styles = (fixed) => `
  * { box-sizing: border-box; }
  body { margin: 0; font: 16px/1.5 system-ui, sans-serif; color: #1f2937; background: #fff; }
  header { display: flex; align-items: center; gap: 24px; padding: 12px 24px; border-bottom: 1px solid #e5e7eb; flex-wrap: wrap; }
  .brand { font-weight: 700; font-size: 20px; color: #14532d; text-decoration: none; }
  nav ul { display: flex; gap: 16px; list-style: none; margin: 0; padding: 0; flex-wrap: wrap; }
  nav a, .nav-link { color: #1d4ed8; text-decoration: underline; cursor: pointer; }
  .search-btn { margin-left: auto; width: 40px; height: 40px; border: 1px solid #9ca3af; border-radius: 6px; background: #fff; cursor: pointer; }
  main { padding: 24px; max-width: 960px; }
  .tagline { color: ${fixed ? '#4b5563' : '#b8b8b8'}; font-size: 18px; }
  .promo { ${fixed ? 'max-width: 100%;' : 'width: 900px;'} background: #ecfdf5; border: 1px solid #a7f3d0; padding: 16px; margin: 16px 0; }
  .hero { max-width: 100%; height: auto; display: block; }
  footer { padding: 24px; color: ${fixed ? '#4b5563' : '#c4c4c4'}; font-size: 14px; }
  label, .field-label { display: block; font-weight: 600; margin: 12px 0 0; }
  input, textarea { font: inherit; padding: 8px; width: 100%; max-width: 420px; border: 1px solid #6b7280; border-radius: 4px; }
  button { font: inherit; }
  .submit { margin-top: 16px; padding: 8px 16px; background: #14532d; color: #fff; border: 0; border-radius: 4px; cursor: pointer; }
  .error { color: #b91c1c; font-weight: 600; }
  .sent { color: #14532d; font-weight: 600; }
`;

const searchIcon = '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="8" cy="8" r="6" stroke="#374151" stroke-width="2" fill="none"/><line x1="13" y1="13" x2="18" y2="18" stroke="#374151" stroke-width="2"/></svg>';

const heroSvg = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="200"><rect width="640" height="200" fill="#bbf7d0"/><circle cx="200" cy="140" r="40" stroke="#14532d" stroke-width="8" fill="none"/><circle cx="440" cy="140" r="40" stroke="#14532d" stroke-width="8" fill="none"/><path d="M200 140 L300 80 L440 140 M300 80 L330 140" stroke="#14532d" stroke-width="8" fill="none"/></svg>');

function layout(title, body, fixed) {
  const contact = fixed
    ? '<a href="/contact">Contact</a>'
    : `<span class="nav-link" onclick="location.href='/contact'">Contact</span>`;
  const search = fixed
    ? `<button type="button" class="search-btn" aria-label="Search">${searchIcon}</button>`
    : `<button type="button" class="search-btn">${searchIcon}</button>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · Gator Bikes</title>
<style>${styles(fixed)}</style>
</head>
<body>
<header>
  <a class="brand" href="/">Gator Bikes</a>
  <nav aria-label="Main">
    <ul>
      <li><a href="/">Home</a></li>
      <li><a href="/services">Services</a></li>
      <li>${contact}</li>
    </ul>
  </nav>
  ${search}
</header>
<main>
${body}
</main>
<footer>Gator Bikes · 101 University Ave · Open daily 9–6</footer>
</body>
</html>`;
}

function home(fixed) {
  const alt = fixed ? ' alt="Illustration of a green bicycle"' : '';
  return layout('Home', `
  <h1>Bike repair in Gainesville</h1>
  <p class="tagline">Same-day tune-ups for students and commuters.</p>
  <img class="hero" src="data:image/svg+xml,${heroSvg}" width="640" height="200"${alt}>
  <div class="promo">
    <h2>Fall tune-up special</h2>
    <p>Bring your bike in before November and get a full brake and gear tune-up for $39. Walk-ins welcome; most repairs are finished the same day so you can ride home.</p>
  </div>
  <p>Questions? Use the contact page to send us a message.</p>`, fixed);
}

function services(fixed) {
  return layout('Services', `
  <h1>Services</h1>
  <ul>
    <li>Flat tire repair — $12</li>
    <li>Brake adjustment — $20</li>
    <li>Full tune-up — $55</li>
  </ul>
  <p><a href="/">Back to home</a></p>`, fixed);
}

function contact(fixed) {
  const emailField = fixed
    ? `<label for="email">Email</label>
    <input id="email" name="email" type="text" autocomplete="email" aria-describedby="email-error">
    <p id="email-error" class="error" hidden></p>`
    : `<p class="field-label">Email</p>
    <input id="email" name="email" type="text">`;
  const script = fixed
    ? `
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('email');
    const err = document.getElementById('email-error');
    if (!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(email.value)) {
      email.setAttribute('aria-invalid', 'true');
      err.textContent = 'Email: enter an address like name@example.com.';
      err.hidden = false;
      email.focus();
      return;
    }
    email.removeAttribute('aria-invalid');
    err.hidden = true;
    status.textContent = 'Thanks! (Demo form: nothing was sent.)';
  });`
    : `
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('email');
    if (!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(email.value)) {
      status.className = 'error';
      status.textContent = 'Something went wrong.';
      return;
    }
    status.className = 'sent';
    status.textContent = 'Thanks! (Demo form: nothing was sent.)';
  });`;
  return layout('Contact', `
  <h1>Contact us</h1>
  <form id="contact-form" novalidate>
    <label for="name">Name</label>
    <input id="name" name="name" type="text" autocomplete="name">
    ${emailField}
    <label for="message">Message</label>
    <textarea id="message" name="message" rows="4"></textarea>
    <button id="contact-submit" class="submit" type="submit">Send message</button>
  </form>
  <p id="form-status" role="status"></p>
  <script>
  const form = document.getElementById('contact-form');
  const status = document.getElementById('form-status');${script}
  </script>`, fixed);
}

const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.get('/', (req, res) => res.send(home(variant() === 'fixed')));
app.get('/services', (req, res) => res.send(services(variant() === 'fixed')));
app.get('/contact', (req, res) => res.send(contact(variant() === 'fixed')));
app.use((req, res) => res.status(404).send(layout('Not found', '<h1>Page not found</h1>', variant() === 'fixed')));

app.listen(port, () => {
  console.log(`Fixture site (${variant()} variant) at http://localhost:${port}`);
});
