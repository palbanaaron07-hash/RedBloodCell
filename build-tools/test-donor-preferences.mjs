import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source = fs.readFileSync(new URL('../public/supabase-client.js', import.meta.url), 'utf8');
const extract = name => {
  const start = source.indexOf(`function ${name}(`);
  return source.slice(start, source.indexOf('\n}', start) + 2);
};
const context = vm.createContext({});
vm.runInContext(['isEligibleToCheckIn', 'getDonorMapVisibilityState'].map(extract).join('\n'), context);
const donor = { donor_status: 'approved', availability_status: 'available', show_on_map: true, location_status: 'verified', map_area: 'Tagbilaran City' };
assert.equal(context.getDonorMapVisibilityState(donor).visible, true);
for (const override of [
  { availability_status: 'unavailable' }, { show_on_map: false },
  { location_status: 'needs_review' }, { map_area: '' },
  { donor_status: 'checked_in' }, { donor_status: 'registered' },
  { donor_status: 'deferred' }, { donor_status: 'incomplete' },
  { last_donation_date: new Date().toISOString().slice(0, 10) }
]) assert.equal(context.getDonorMapVisibilityState({ ...donor, ...override }).visible, false);
assert.match(context.getDonorMapVisibilityState({ ...donor, donor_status: 'checked_in' }).reason, /Awaiting medical approval/);
assert.equal(context.getDonorMapVisibilityState({ ...donor, donor_status: 'donated', last_donation_date: '2000-01-01' }).visible, true);
console.log('Donor preference regression checks passed.');
