const fs = require('fs');
const path = require('path');

const indexCssPath = path.join(__dirname, 'src', 'styles', 'index.css');
const content = fs.readFileSync(indexCssPath, 'utf8');

const regex = /@import '\.\/components\/(.*\.css)';/g;
let match;
const files = [];
while ((match = regex.exec(content)) !== null) {
  files.push(match[1]);
}

let mergedCss = `@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');\n\n`;

for (const file of files) {
  const filePath = path.join(__dirname, 'src', 'styles', 'components', file);
  if (fs.existsSync(filePath)) {
    mergedCss += `/* --- ${file} --- */\n`;
    mergedCss += fs.readFileSync(filePath, 'utf8') + '\n\n';
  }
}

fs.writeFileSync(indexCssPath, mergedCss);
console.log('Successfully merged all CSS components back into index.css!');
