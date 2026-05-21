const fs = require('fs');
const path = require('path');

const cssFilePath = path.join(__dirname, 'src', 'styles', 'index.css');
const componentsDir = path.join(__dirname, 'src', 'styles', 'components');

if (!fs.existsSync(componentsDir)) {
  fs.mkdirSync(componentsDir, { recursive: true });
}

const content = fs.readFileSync(cssFilePath, 'utf8');
const lines = content.split('\n');

let currentSection = 'base';
const sections = {
  base: []
};

// Regex to find major comment headers
const sectionRegex = /\/\*\s*([a-zA-Z0-9\s&_]+)\s*\*\//i;
const bigSectionRegex = /\/\*\s*════[^\n]+\n\s*([a-zA-Z0-9\s&_]+)\n/i;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  if (line.includes('/* ════')) {
     // Skip the big header decoration
     currentSection = 'phases';
     if (!sections[currentSection]) sections[currentSection] = [];
     sections[currentSection].push(line);
  } else if (line.match(sectionRegex) && !line.includes('════')) {
     const match = line.match(sectionRegex)[1].trim().toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
     if (match.length > 2 && match.length < 30) {
         currentSection = match;
         if (!sections[currentSection]) sections[currentSection] = [];
     }
     sections[currentSection].push(line);
  } else {
     sections[currentSection].push(line);
  }
}

let mainCss = `@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');\n\n`;

for (const [sectionName, sectionLines] of Object.entries(sections)) {
  if (sectionLines.length === 0 || sectionLines.join('').trim() === '') continue;
  
  const fileName = `${sectionName}.css`;
  const filePath = path.join(componentsDir, fileName);
  fs.writeFileSync(filePath, sectionLines.join('\n'));
  
  if (sectionName === 'base') {
     mainCss += `@import './components/${fileName}';\n`;
  } else {
     mainCss += `@import './components/${fileName}';\n`;
  }
}

fs.writeFileSync(cssFilePath, mainCss);
console.log('CSS successfully split into ' + Object.keys(sections).length + ' components!');
