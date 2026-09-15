import assert from 'node:assert/strict';
import fs from 'node:fs';

const client = fs.readFileSync(new URL('../public/supabase-client.js', import.meta.url), 'utf8');
const patient = fs.readFileSync(new URL('../public/scripts/pages/account-dashboard.js', import.meta.url), 'utf8');
const admin = fs.readFileSync(new URL('../public/scripts/pages/admin-dashboard.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../account_dashboard.html', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../supabase/migrations/202609130008_requester_request_actions.sql', import.meta.url), 'utf8');

for (const required of [
  'security definer',
  'p.auth_user_id = auth.uid()',
  'u.auth_user_id = auth.uid()',
  "normalized_action = 'delete'",
  "normalized_action = 'cancel'",
  "'Cancelled by requester'",
  'grant execute on function blood_bank.manage_my_blood_request(bigint, text) to authenticated'
]) assert.ok(migration.includes(required), `Missing protected request-action rule: ${required}`);

assert.match(client, /rpc\('manage_my_blood_request'/);
assert.match(client, /async function cancelMyBloodRequest/);
assert.match(patient, /const canDelete = !isClosedHistory/);
assert.match(patient, /const canCancel = !isClosedHistory/);
assert.match(patient, /hasRequestMenu \? `<div class="my-req-menu-wrap"/);
assert.match(patient, /Cancelled/);
assert.match(admin, /Cancelled by requester/);
assert.match(html, /id="requestActionMessage"/);

console.log('Requester delete/cancel lifecycle checks passed.');
