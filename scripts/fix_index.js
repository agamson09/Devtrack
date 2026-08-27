const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../pages/index.js');
let content = fs.readFileSync(filePath, 'utf8');

// Fix Devicon URLs
content = content.replace(/devicon\/icons/g, 'devicon@latest/icons');

// Fix GitHub links
content = content.replace(/href="https:\/\/github\.com"/g, 'href="https://github.com/agamson09/Devtrack"');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed pages/index.js');
