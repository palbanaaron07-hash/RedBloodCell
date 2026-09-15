import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source = fs.readFileSync(new URL('../public/scripts/pages/patient-donor-map.js', import.meta.url), 'utf8');
const extract = name => {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0);
  return source.slice(start, source.indexOf('\n}', start) + 2);
};
const nodes = {
  filterBloodType: { value: 'all' }, filterLocation: { value: 'Town A' },
  searchAreaInput: { value: 'Town B' }, btnClearSearchText: { style: {} }
};
let chip = 'Town A';
let refreshed = false;
let resetView = false;
const context = vm.createContext({
  document: { getElementById: id => nodes[id] },
  profile: { blood_type: 'A+' }, RECEIVE_FROM: { 'A+': ['A+', 'A-', 'O+', 'O-'] },
  showAreaChip: value => { chip = value; }, updateFilterPickerDisplays: () => {},
  searchDonors: force => { refreshed = force; },
  map: { setView: () => { resetView = true; } }, BOHOL_CENTER: [9.8, 124]
});
vm.runInContext(['getSelectedBloodTypes', 'getSelectedLocation', 'clearAllFilters'].map(extract).join('\n'), context);
assert.equal(context.getSelectedBloodTypes().length, 8);
nodes.filterBloodType.value = 'compatible';
assert.equal(context.getSelectedBloodTypes().length, 4);
nodes.filterBloodType.value = 'B+';
assert.equal(context.getSelectedBloodTypes()[0], 'B+');
context.clearAllFilters();
assert.equal(nodes.filterBloodType.value, 'all');
assert.equal(context.getSelectedLocation(), 'all');
assert.equal(nodes.searchAreaInput.value, '');
assert.equal(chip, null);
assert.equal(refreshed, true);
assert.equal(resetView, true);
assert.doesNotMatch(source, /typeSelect\.value = 'compatible'/);
assert.doesNotMatch(source, /locEl\.value = recipientArea/);
const html = fs.readFileSync(new URL('../recipient_donor_map.html', import.meta.url), 'utf8');
assert.match(html, /id="filterBloodType" value="all"/);
assert.match(html, /id="bloodTypeDisplay">All Blood Types/);
assert.match(html, /<button[^>]*id="btnClearFilters"/);
assert.match(source, /getElementById\('btnClearFilters'\)\?\.addEventListener\('click', clearAllFilters\)/);
console.log('Map filter regression checks passed.');
