const fs = require('fs');
const getJson = (file) => JSON.parse(fs.readFileSync(__dirname + '/locales/' + file, 'utf8'));

const uk = getJson('uk.json');
const en = getJson('en.json');
const ru = getJson('ru.json');
const de = getJson('de.json');

const ukKeys = Object.keys(uk);
const enKeys = Object.keys(en);
const ruKeys = Object.keys(ru);
const deKeys = Object.keys(de);

console.log('=== i18n VERIFICATION REPORT ===\n');

// 1. Key completeness
console.log('1. KEY COMPLETENESS CHECK');
console.log('   UK keys:', ukKeys.length, '| EN keys:', enKeys.length, '| RU keys:', ruKeys.length, '| DE keys:', deKeys.length);
const langs = { en, ru, de };
let ok1 = true;
for (const [lang, dict] of Object.entries(langs)) {
  const missing = ukKeys.filter(k => !(k in dict));
  if (missing.length > 0) { console.log('   ❌', lang.toUpperCase(), 'missing:', missing.length); ok1 = false; }
}
if (ok1) console.log('   ✅ All languages have complete key coverage');

// 2. Empty values
console.log('\n2. EMPTY VALUE CHECK');
let ok2 = true;
for (const [lang, dict] of Object.entries({ uk, en, ru, de })) {
  for (const [key, val] of Object.entries(dict)) {
    if (!val || String(val).trim() === '') { console.log('   ❌', lang.toUpperCase()+'.'+key, 'is empty'); ok2 = false; }
  }
}
if (ok2) console.log('   ✅ No empty values');

// 3. German length
console.log('\n3. GERMAN STRING LENGTH (vs EN)');
let long = [];
for (const key of enKeys) {
  if (de[key] && en[key]) {
    const r = de[key].length / en[key].length;
    if (r > 1.5 && de[key].length > 15) long.push({key, enL: en[key].length, deL: de[key].length, r: r.toFixed(2), de: de[key]});
  }
}
if (long.length === 0) console.log('   ✅ No German strings >1.5x English');
else long.forEach(s => console.log('   ⚠️ ', s.key, ': EN='+s.enL+'ch DE='+s.deL+'ch ('+s.r+'x) —', s.de));

// 4. Placeholder consistency
console.log('\n4. PLACEHOLDER CONSISTENCY');
let ok4 = true;
for (const key of ukKeys) {
  const ukP = (uk[key].match(/\{\{(\w+)\}\}/g) || []).sort();
  for (const [lang, dict] of Object.entries(langs)) {
    if (dict[key]) {
      const lP = (dict[key].match(/\{\{(\w+)\}\}/g) || []).sort();
      if (JSON.stringify(ukP) !== JSON.stringify(lP)) { console.log('   ❌', lang.toUpperCase()+'.'+key, 'mismatch:', ukP, lP); ok4 = false; }
    }
  }
}
if (ok4) console.log('   ✅ All placeholders consistent');

console.log('\n=== DONE ===');
