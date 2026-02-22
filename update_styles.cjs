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

function replaceStyles(content) {
  // Backgrounds
  content = content.replace(/bg-slate-800\/(?:50|30|80|90|70)/g, 'bg-[var(--app-panel)]');
  content = content.replace(/bg-slate-900\/(?:20|40|50|70|80|90)/g, 'bg-[var(--app-panel)]');
  content = content.replace(/\bbg-slate-800\b/g, 'bg-[var(--app-panel)]');
  
  // Borders
  content = content.replace(/border-slate-[78]00\b/g, 'border-[var(--app-panel-border)]');
  content = content.replace(/border-slate-600\/50/g, 'border-[var(--app-panel-border)]');
  content = content.replace(/border-white\/10/g, 'border-[var(--app-panel-border)]');
  
  // Accents - Texts
  content = content.replace(/text-purple-[45]00\b/g, 'text-[var(--app-accent)]');
  content = content.replace(/text-blue-[45]00\b/g, 'text-[var(--app-accent)]');
  content = content.replace(/text-indigo-[45]00\b/g, 'text-[var(--app-accent)]');
  content = content.replace(/text-emerald-[45]00\b/g, 'text-[var(--app-accent)]');
  
  // Accents - Backgrounds (hover and active)
  content = content.replace(/bg-purple-[56]00\b/g, 'bg-[var(--app-accent)]');
  content = content.replace(/bg-blue-[56]00\b/g, 'bg-[var(--app-accent)]');
  content = content.replace(/bg-indigo-[56]00\b/g, 'bg-[var(--app-accent)]');
  content = content.replace(/bg-emerald-[56]00\b/g, 'bg-[var(--app-accent)]');

  // Accents - Hover Texts
  content = content.replace(/hover:text-purple-[34]00\b/g, 'hover:text-[var(--app-accent)]');
  content = content.replace(/hover:text-blue-[34]00\b/g, 'hover:text-[var(--app-accent)]');

  // Accents - Hover Backgrounds
  content = content.replace(/hover:bg-purple-[67]00\b/g, 'hover:bg-[var(--app-accent)]/80');
  content = content.replace(/hover:bg-blue-[67]00\b/g, 'hover:bg-[var(--app-accent)]/80');
  content = content.replace(/hover:bg-slate-700\b/g, 'hover:bg-[var(--app-tab-hover)]');
  content = content.replace(/hover:bg-slate-800\b/g, 'hover:bg-[var(--app-tab-hover)]');

  // Focus Rings
  content = content.replace(/focus:ring-purple-500(?:\/50)?/g, 'focus:ring-[var(--app-accent)]/50');
  content = content.replace(/focus:border-purple-500\b/g, 'focus:border-[var(--app-accent)]');
  content = content.replace(/focus:border-blue-500\b/g, 'focus:border-[var(--app-accent)]');

  // Misc UI updates (scrollbars, backdrop blur)
  // Replacing static style tags with tailwind equivalents if needed
  content = content.replace(/style={{ backgroundColor: 'var\(--app-panel\)', borderColor: 'var\(--app-panel-border\)' }}/g, 'className={`$1 bg-[var(--app-panel)] border-[var(--app-panel-border)]`}'); // Will need manual fix for this but it catches the intent

  return content;
}

const dirsToUpdate = ['./src/components', './src/App.tsx'];

dirsToUpdate.forEach(target => {
  if (fs.statSync(target).isDirectory()) {
    walkDir(target, (filePath) => {
      const content = fs.readFileSync(filePath, 'utf-8');
      const updated = replaceStyles(content);
      if (content !== updated) {
        fs.writeFileSync(filePath, updated, 'utf-8');
        console.log('Updated:', filePath);
      }
    });
  } else {
      const content = fs.readFileSync(target, 'utf-8');
      const updated = replaceStyles(content);
      if (content !== updated) {
        fs.writeFileSync(target, updated, 'utf-8');
        console.log('Updated:', target);
      }
  }
});
