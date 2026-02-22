const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walkDir(dirPath, callback);
    } else {
      if (dirPath.endsWith('.tsx') || dirPath.endsWith('.ts')) {
        callback(dirPath);
      }
    }
  });
}

const dirsToUpdate = ['./src/components', './src/App.tsx'];

dirsToUpdate.forEach(target => {
  if (fs.statSync(target).isDirectory()) {
    walkDir(target, (filePath) => {
      let content = fs.readFileSync(filePath, 'utf-8');
      content = content.replace(/className="([^"]+)"\s+className={`\$1\s+bg-\[var\(--app-panel\)\] border-\[var\(--app-panel-border\)\]`}/g, 'className="$1 bg-[var(--app-panel)] border-[var(--app-panel-border)]"');
      fs.writeFileSync(filePath, content, 'utf-8');
    });
  } else {
      let content = fs.readFileSync(target, 'utf-8');
      content = content.replace(/className="([^"]+)"\s+className={`\$1\s+bg-\[var\(--app-panel\)\] border-\[var\(--app-panel-border\)\]`}/g, 'className="$1 bg-[var(--app-panel)] border-[var(--app-panel-border)]"');
      fs.writeFileSync(target, content, 'utf-8');
  }
});
