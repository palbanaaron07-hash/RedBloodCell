import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source = fs.readFileSync(new URL('../public/scripts/pages/patient-dashboard.js', import.meta.url), 'utf8');
const start = source.indexOf('function renderAccountRoleControls(');
const nodes = Object.fromEntries(['recipientOverviewState', 'donorEnrollmentState', 'donorDashboardState', 'donorSetupMessage'].map(id => [id, {}]));
nodes['section-dashboard'] = { classList: { contains: () => true } };
const title = {};
const context = vm.createContext({
  currentAccountRoles: new Set(), sectionTitles: { dashboard: {} },
  document: { getElementById: id => nodes[id], querySelector: () => title }
});
vm.runInContext(source.slice(start, source.indexOf('\n}', start) + 2), context);
context.renderAccountRoleControls({ roles: ['patient'], has_patient_profile: true });
assert.equal(nodes.recipientOverviewState.hidden, false);
assert.equal(nodes.donorEnrollmentState.hidden, false);
assert.equal(nodes.donorDashboardState.hidden, true);
assert.equal(title.textContent, 'Recipient Overview');
for (const hasPatient of [false, true]) {
  context.renderAccountRoleControls({ roles: ['donor'], has_donor_profile: true, has_patient_profile: hasPatient });
  assert.equal(nodes.recipientOverviewState.hidden, true);
  assert.equal(nodes.donorEnrollmentState.hidden, true);
  assert.equal(nodes.donorDashboardState.hidden, false);
  assert.equal(title.textContent, 'Donor Center');
}
const html = fs.readFileSync(new URL('../patient_dashboard.html', import.meta.url), 'utf8');
assert.match(html, /id="donorEnrollmentState" hidden/);
assert.doesNotMatch(source, /replaceState\(null, '', window\.location\.pathname \+ window\.location\.search\)/);
assert.match(source, /const currentSection = window\.location\.hash/);
assert.match(source, /async function loadDonorDashboard\(force = false\) \{\s*if \(!currentProfile\) return;/);
assert.match(html, /Want to become a donor\?/);
assert.match(html, /Register as a Donor/);
assert.match(html, /Registration does not confirm donation eligibility/);
assert.match(html, /href="#section-requests"/);
console.log('Recipient overview regression checks passed.');
