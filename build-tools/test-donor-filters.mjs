import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/scripts/pages/admin-dashboard.js', import.meta.url), 'utf8');
function extract(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `Missing ${name}`);
  return source.slice(start, source.indexOf('\n}', start) + 2);
}
const nodes = Object.fromEntries(['donorTableBody', 'donorFilterSummary', 'clearDonorFilters'].map(id => [id, {}]));
const context = vm.createContext({
  donorFilter: 'all', donorBloodTypeFilter: 'all', query: '', donorCache: [],
  document: { getElementById: id => nodes[id] },
  getSearchQuery: () => context.query,
  getDonorLifecycleLabel: status => ({ approved: 'Approved (Medical)', checked_in: 'Checked-in' }[status] || status),
  formatDateShort: date => date.toISOString().slice(0, 10),
});
vm.runInContext(['normalizeBloodType', 'includesQuery', 'applyDonorFilter', 'formatNextEligible', 'renderDonorRows'].map(extract).join('\n'), context);
const statuses = ['registered', 'checked_in', 'approved', 'donated', 'deferred', 'incomplete'];
const donors = statuses.map((donor_status, id) => ({ id, donor_status, first_name: `Donor${id}`, blood_type: id === 2 ? 'B+' : 'A+' }));
assert.equal(context.applyDonorFilter(donors).length, 6, 'All preserves legacy incomplete records');
for (const status of statuses.slice(0, -1)) {
  context.donorFilter = status;
  assert.equal(context.applyDonorFilter(donors)[0].donor_status, status);
  assert.equal(context.applyDonorFilter(donors).length, 1);
}
context.donorFilter = 'approved';
context.donorBloodTypeFilter = 'B+';
context.query = 'medical';
assert.equal(context.applyDonorFilter(donors).length, 1);
context.donorBloodTypeFilter = 'A+';
assert.equal(context.applyDonorFilter(donors).length, 0);
context.donorFilter = 'all';
context.donorBloodTypeFilter = 'all';
context.query = '';
assert.equal(context.applyDonorFilter([{ first_name: 'New donor' }]).length, 1);
for (const blood_type of ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']) {
  context.donorBloodTypeFilter = blood_type;
  assert.equal(context.applyDonorFilter([{ blood_type }]).length, 1);
}
context.donorBloodTypeFilter = 'all';
assert.match(context.formatNextEligible(null), /No previous donation/);
assert.match(context.formatNextEligible('invalid'), /Date needs review/);
assert.match(context.formatNextEligible('2000-01-01'), /Waiting period complete/);
assert.match(context.formatNextEligible('2999-01-01'), /Wait until/);
context.renderDonorRows();
assert.match(nodes.donorTableBody.innerHTML, /No donors yet/);
assert.equal(nodes.clearDonorFilters.disabled, true);
context.donorCache = donors;
context.query = 'no matching donor';
context.renderDonorRows();
assert.match(nodes.donorTableBody.innerHTML, /No donors match these filters/);
assert.equal(nodes.donorFilterSummary.textContent, 'Showing 0 of 6 donors');
assert.equal(nodes.clearDonorFilters.disabled, false);
const html = fs.readFileSync(new URL('../admin_dashboard.html', import.meta.url), 'utf8');
const statusSelect = html.match(/id="donorStatusFilter"[\s\S]*?<\/select>/)[0];
assert.match(statusSelect, /value="approved"/);
assert.doesNotMatch(statusSelect, /incomplete/);
console.log('Donor filter regression checks passed.');
