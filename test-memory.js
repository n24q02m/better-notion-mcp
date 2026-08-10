const fs = require('fs');
const content = fs.readFileSync('.jules/sentinel.md', 'utf-8');
console.log(content.includes('semantic-pull-request'));
