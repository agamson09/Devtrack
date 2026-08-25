/* Syntax-check changed frontend files using @babel/parser (in-process, no child spawns). */
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

const args = process.argv.slice(2);
const files = args.length > 0 ? args : [
  'components/layout/Sidebar.js',
  'components/layout/Header.js',
  'pages/dashboard/index.js',
  'pages/login.js',
  'pages/register.js',
];

let failed = false;
for (const rel of files) {
  const abs = path.join(__dirname, '..', rel);
  const src = fs.readFileSync(abs, 'utf8');
  try {
    parser.parse(src, { sourceType: 'module', plugins: ['jsx'] });
    console.log(`OK      ${rel}`);
  } catch (e) {
    failed = true;
    console.log(`FAIL    ${rel}: ${e.message}`);
  }
}
process.exit(failed ? 1 : 0);
