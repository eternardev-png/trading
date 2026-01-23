const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend', 'src', 'components', 'ChartPane.jsx');

// Read file as buffer to preserve encoding
let content = fs.readFileSync(filePath, 'utf8');

// Replace using Unicode escape sequences
content = content.replace(/\u0440\u045F\u2019\u0403/g, '\u25CF');  // ● filled circle
content = content.replace(/\u0440\u045F\u2019\u0403\u201C\u0440\u045F\u2014\u0401/g, '\u25CB');  // ○ empty circle
content = content.replace(/\u0432\u045A\u2122/g, '\u2699');  // ⚙ gear
content = content.replace(/\u0432\u2020\u2019/g, '\u25B2');  // ▲ up triangle
content = content.replace(/\u0432\u2020\u201C/g, '\u25BC');  // ▼ down triangle

// Write back
fs.writeFileSync(filePath, content, 'utf8');

console.log('Icons fixed!');
