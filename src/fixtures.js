// Variants share logical IDs. Expected defect labels live only in tests.
export function fixtureHtml(variant) {
  const broken = variant === "broken",
    negative = variant === "negative";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Fieldwork — test environment</title><style>
  *{box-sizing:border-box}body{font:18px/1.5 system-ui;margin:0;color:#172033;background:#f8fafc}header,main,footer{padding:24px;max-width:1000px;margin:auto}header{display:flex;justify-content:space-between;gap:16px;align-items:center}h1{font-size:2rem}button,input,.menu-control{font:inherit;padding:12px;border:1px solid #64748b;border-radius:4px;background:white;color:#172033}button,.menu-control{cursor:pointer}button:focus-visible,a:focus-visible,input:focus-visible{outline:3px solid #1d4ed8;outline-offset:3px}a{color:#1d4ed8}section{background:white;padding:24px;margin:20px 0;border:1px solid #cbd5e1}.muted{color:${broken ? "#b8bdc6" : "#475569"}}.feature{${broken ? "width:900px;" : "max-width:100%;"}background:#e2e8f0;padding:20px}.clip{${broken ? "overflow:hidden;max-width:100%;" : ""}}.feature a{${broken ? "display:block;margin-left:690px;width:170px;" : ""}}label{display:block}input{max-width:100%}nav a{display:block;margin:8px 0}[hidden]{display:none!important}img{width:24px;height:24px}table{border-collapse:collapse}td,th{padding:12px;border:1px solid #64748b}.table-scroll{overflow:auto}
  .mobile-nav{display:none}@media(max-width:600px){${negative ? ".desktop-menu{display:none}" : ""}.mobile-nav{display:block}}</style></head><body><header><strong>Fieldwork</strong>${broken ? '<div id="menu-control" class="menu-control" aria-expanded="false" aria-controls="project-nav" onclick="toggleMenu()">Explore projects</div>' : '<button id="menu-control" class="desktop-menu" type="button" aria-expanded="false" aria-controls="project-nav" onclick="toggleMenu()">Explore projects</button>'}${negative ? '<button id="mobile-menu-control" class="mobile-nav" type="button" aria-expanded="false" aria-controls="project-nav" onclick="toggleMenu()">Explore projects</button>' : ""}</header>
  <main><h1>Good places, better projects.</h1><p class="muted" id="intro">A small studio helping communities build useful things.</p><nav id="project-nav" aria-label="Projects" hidden><a id="project-link" href="#featured">View featured project</a><a id="contact-link" href="#contact">Contact the studio</a></nav>
  <section id="featured"><h2>Featured project</h2><div class="clip"><div class="feature"><p id="feature-copy">Our community garden has room for everyone. Explore the plan and meet the people making it happen.</p><a id="project-details" href="#contact">Project details</a></div></div><p id="project-description"><img id="studio-mark" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Ccircle cx='12' cy='12' r='10' fill='%231d4ed8'/%3E%3C/svg%3E" ${broken ? "" : 'alt=""'}> Community-led work</p><button id="icon-control" type="button" ${broken ? "" : 'aria-label="Like project"'} onclick="this.textContent='Project liked'">${broken ? "♡" : "Like project"}</button></section>
  <section id="contact"><h2>Plan a visit</h2><form novalidate>${broken ? "" : '<label for="visit-name">Your name</label>'}<input id="visit-name" name="visitor" autocomplete="off" ${broken ? 'placeholder=""' : "required"} ${negative ? 'aria-errormessage="visit-error"' : ""}><p id="visit-error" hidden></p><button type="button" id="validate-visit" onclick="validateVisit()">Check details</button><p id="validation-notice">No information is submitted. This is an authorized test environment.</p></form></section>
  ${negative ? '<section><h2>Project data</h2><div class="table-scroll"><table><caption>Garden dimensions</caption><tr><th>Garden</th><th>North boundary</th><th>East boundary</th><th>South boundary</th></tr><tr><th>Community site</th><td>150 metres</td><td>250 metres</td><td>150 metres</td></tr></table></div><button type="button" id="open-dialog" onclick="document.getElementById(\'info-dialog\').showModal()">About the studio</button><dialog id="info-dialog" aria-labelledby="dialog-title"><h2 id="dialog-title">About Fieldwork</h2><p>Community design studio</p><button type="button" onclick="this.closest(\'dialog\').close()">Close</button></dialog></section>' : ""}
  </main><footer>Fieldwork · Controlled accessibility fixture · ${variant}</footer><script>
  function toggleMenu(){const nav=document.getElementById('project-nav');nav.hidden=!nav.hidden;document.querySelectorAll('[aria-controls=project-nav]').forEach(control=>control.setAttribute('aria-expanded',String(!nav.hidden)));}
  function validateVisit(){const input=document.getElementById('visit-name'),error=document.getElementById('visit-error');if(!input.value.trim()){error.hidden=false;error.textContent=${broken ? "'Something went wrong.'" : "'Your name is required. Enter your name to plan a visit.'"};${broken ? "" : `input.setAttribute('aria-invalid','true');input.setAttribute('${negative ? "aria-errormessage" : "aria-describedby"}','visit-error');`}}}
  </script></body></html>`;
}
export const validationRecipe = Object.freeze({
  trigger: "#validate-visit",
  field: "#visit-name",
  error: "#visit-error",
  problemPattern: "name.*required",
  relationshipRequired: true,
});
export function logicalUrl(input, fixtureOrigin) {
  const u = new URL(input);
  return u.origin === fixtureOrigin
    ? `fixture-v1:${u.pathname.replace(/\/(broken|fixed|negative)/, "/site")}${u.hash}`
    : u.href;
}
