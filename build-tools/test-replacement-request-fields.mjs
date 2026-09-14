import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../patient_dashboard.html', import.meta.url), 'utf8');
const client = fs.readFileSync(new URL('../public/supabase-client.js', import.meta.url), 'utf8');
const patient = fs.readFileSync(new URL('../public/scripts/pages/patient-dashboard.js', import.meta.url), 'utf8');
const admin = fs.readFileSync(new URL('../public/scripts/pages/admin-dashboard.js', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../supabase/migrations/202609140001_replacement_any_blood_type.sql', import.meta.url), 'utf8');

for (const control of [
  'id="requestBloodTypeGroup"',
  'id="requestUrgencyGroup"',
  'id="replacementRequirementsNote"',
  'id="editReqType"',
  'id="editReqBloodTypeGroup"',
  'id="editReqUrgencyGroup"'
]) assert.ok(html.includes(control), `Missing replacement form control: ${control}`);

assert.match(patient, /bloodType\.disabled = isReplacement/);
assert.match(patient, /urgency\.disabled = isReplacement/);
assert.match(patient, /bloodType\.required = !isReplacement/);
assert.match(patient, /urgency\.required = !isReplacement/);
assert.match(patient, /Any eligible blood type/);
assert.match(patient, /r\.request_type === 'replacement'[\s\S]*normalizeBloodType\(r\.blood_type\)/);
assert.match(client, /isReplacementRequest \? 'normal'/);
assert.match(client, /isReplacementRequest[\s\S]*patientResult\.profile\.blood_type_needed/);
assert.match(admin, /formatRequestRequirement/);
assert.match(admin, /any eligible blood type/);

for (const rule of [
  "br.request_type = 'replacement'",
  "or upper(trim(br.blood_type_needed)) = upper(trim(d.blood_type))",
  "request_row.request_type = 'replacement'",
  'Any eligible blood type may respond',
  'returns table (',
  'request_type varchar'
]) assert.ok(migration.includes(rule), `Missing replacement matching rule: ${rule}`);

console.log('Replacement request field and matching checks passed.');
