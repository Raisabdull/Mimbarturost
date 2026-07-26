const fs = require('fs');

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace Mimbar Turats -> Mimbar Turost
  content = content.replace(/Mimbar Turats/g, 'Mimbar Turost');
  content = content.replace(/mimbar Turats/g, 'mimbar Turost');
  content = content.replace(/mimbar Turast/g, 'mimbar Turost');
  content = content.replace(/Mimbar Turast/g, 'Mimbar Turost');
  content = content.replace(/mimbar_turats/g, 'mimbar_turost');
  content = content.replace(/turats_sermon_history/g, 'turost_sermon_history');

  fs.writeFileSync(filePath, content);
}

replaceInFile('src/App.tsx');
replaceInFile('metadata.json');
replaceInFile('index.html');

console.log('Renaming done.');
