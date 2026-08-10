const fs = require('fs');

const data = JSON.parse(fs.readFileSync('eslint-report.json', 'utf8'));
const filesWithErrors = data.filter(d => d.errorCount > 0 || d.warningCount > 0);

for (const file of filesWithErrors) {
  console.log(`\nFile: ${file.filePath}`);
  const errorMap = {};
  for (const msg of file.messages) {
    if (!errorMap[msg.ruleId]) errorMap[msg.ruleId] = [];
    errorMap[msg.ruleId].push(`L${msg.line}:${msg.column} - ${msg.message}`);
  }
  for (const rule in errorMap) {
    console.log(`  Rule: ${rule}`);
    for (const msg of errorMap[rule]) {
      console.log(`    ${msg}`);
    }
  }
}
