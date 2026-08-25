import fs from 'fs';

const p =
  'C:/Users/Sathish Kumar R/.cursor/projects/d-P2P-project-8090130/agent-transcripts/a7527277-3623-4bdc-b5d6-7d0589e37f23/a7527277-3623-4bdc-b5d6-7d0589e37f23.jsonl';
const lines = fs.readFileSync(p, 'utf8').trim().split(/\n/);
for (const idx of [6931, 6921, 6910, 6879, 6848, 6815]) {
  try {
    const j = JSON.parse(lines[idx - 1]);
    const text = (j.message?.content || [])
      .map((c) => c.text || '')
      .join('\n');
    const imgs = text.match(/assets\/[^\s"']+\.png/g);
    console.log('line', idx, 'images', imgs);
    const q = text.match(/user_query>([\s\S]*?)<\/user_query>/);
    if (q) console.log('query', q[1].replace(/\s+/g, ' ').slice(0, 250));
  } catch (e) {
    console.log('line', idx, e.message);
  }
}
