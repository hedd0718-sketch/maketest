// Run with: node scripts/gen-templates.js
const fs = require('fs');
const path = require('path');

const base = path.join(__dirname, '..', 'src', 'lib', 'hwpx', 'templates');

const files = [
  { key: 'versionXml',      file: 'version.xml',            binary: false },
  { key: 'mimetypeStr',     file: 'mimetype',               binary: false },
  { key: 'prvTextTxt',      file: 'Preview/PrvText.txt',    binary: false },
  { key: 'containerXml',    file: 'META-INF/container.xml', binary: false },
  { key: 'containerRdf',    file: 'META-INF/container.rdf', binary: false },
  { key: 'manifestXml',     file: 'META-INF/manifest.xml',  binary: false },
  { key: 'settingsXml',     file: 'settings.xml',           binary: false },
  { key: 'contentHpf',      file: 'Contents/content.hpf',   binary: false },
  { key: 'section0Xml',     file: 'Contents/section0.xml',  binary: false },
  { key: 'headerXml',       file: 'Contents/header.xml',    binary: false },
  { key: 'prvImagePngB64',  file: 'Preview/PrvImage.png',   binary: true  },
];

let out = '// Auto-generated: HWPX template files inlined for serverless deployment\n/* eslint-disable */\n\n';

for (const { key, file, binary } of files) {
  const full = path.join(base, file);
  if (binary) {
    const b64 = fs.readFileSync(full).toString('base64');
    out += `export const ${key} = \`${b64}\`;\n\n`;
  } else {
    const content = fs.readFileSync(full, 'utf-8');
    // Escape backticks and template literal ${ sequences
    const escaped = content
      .replace(/\\/g, '\\\\')
      .replace(/`/g, '\\`')
      .replace(/\$\{/g, '\\${');
    out += `export const ${key} = \`${escaped}\`;\n\n`;
  }
}

const outPath = path.join(__dirname, '..', 'src', 'lib', 'hwpx', 'templates-inline.ts');
fs.writeFileSync(outPath, out, 'utf-8');
console.log('Done. Size:', out.length, 'bytes written to', outPath);
