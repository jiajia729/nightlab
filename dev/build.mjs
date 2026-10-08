// node build.mjs → dist/nightlab.html（單一檔案）
import fs from 'fs';
const r = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
let html = r('./src/template.html');
html = html.replace('/*CSS*/', () => r('./src/style.css'));
html = html.replace('/*LOGIC*/', () => r('./src/chem.js') + '\n' + r('./src/logic.js') + '\n' + r('./src/levels.js'));
html = html.replace('/*UI*/', () => r('./src/ui.js'));
fs.mkdirSync(new URL('./dist/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('./dist/nightlab.html', import.meta.url), html);
console.log(`dist/nightlab.html ${(html.length / 1024).toFixed(1)} KB`);
