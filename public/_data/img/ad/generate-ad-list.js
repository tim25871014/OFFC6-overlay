const fs = require('fs');
const path = require('path');

const adDir = __dirname;
const outputFile = path.join(adDir, 'ad-list.json');
const allowedExt = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

const files = fs.readdirSync(adDir)
  .filter(name => allowedExt.has(path.extname(name).toLowerCase()))
  .sort();

fs.writeFileSync(outputFile, JSON.stringify(files, null, 2));
console.log(`[ad-list] Wrote ${files.length} items to ${outputFile}`);
