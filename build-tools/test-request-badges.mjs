import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source = fs.readFileSync(new URL('../public/scripts/pages/patient-dashboard.js', import.meta.url), 'utf8');
const start = source.indexOf('function getRequestHeaderStatus(');
const end = source.indexOf('\n}', start) + 2;
const context = vm.createContext({});
vm.runInContext(source.slice(start, end), context);
const active = { status: 'active', label: 'Active' };
assert.equal(context.getRequestHeaderStatus({ verification_status: 'pending' }, active).label, 'Pending verification');
assert.equal(context.getRequestHeaderStatus({ verification_status: 'verified', operational_status: 'approved' }, active).label, 'Active');
assert.equal(context.getRequestHeaderStatus({ verification_status: 'needs_clarification' }, active).label, 'Needs clarification');
assert.equal(context.getRequestHeaderStatus({ verification_status: 'rejected' }, active).label, 'Not approved');
for (const status of ['expired', 'fulfilled']) {
  assert.equal(context.getRequestHeaderStatus({ verification_status: 'pending' }, { status, label: status }).label, status);
}
assert.equal(context.getRequestHeaderStatus({ verification_status: 'verified' }, { status: 'covered', label: 'Covered' }).label, 'Covered');
const card = source.slice(source.indexOf('function renderRequestCard('), source.indexOf('let pendingBloodReceipt'));
assert.equal((card.match(/class="feed-status-pill/g) || []).length, 1);
assert.match(card, /class="request-arrangement-text"/);
assert.match(card, /class="request-card-heading"/);
assert.match(card, /class="request-progress-summary"/);
assert.match(card, /Mark Blood Received/);
assert.match(card, /View Details/);
assert.match(card, /onclick="markBloodReceived\(/);
console.log('Request badge regression checks passed.');
