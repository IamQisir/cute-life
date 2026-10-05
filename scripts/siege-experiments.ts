import { readFileSync, writeFileSync } from 'node:fs';
import { UNIT_IDS, loadPrefabs, type UnitId } from '../src/battle/siege/prefabs';
import { runCaptureExperiments } from '../src/battle/siege/captureExperiments';
import { runExperiments, tablesMarkdown, recipesMarkdown } from '../src/battle/siege/experiments';

const sources = Object.fromEntries(UNIT_IDS.map(id => [id,
  readFileSync(new URL(`../src/life/catalog/${id}.rle`, import.meta.url), 'utf8'),
])) as Record<UnitId, string>;
const extra = Object.fromEntries(['snark', 'buckaroo'].map(id => [id,
  readFileSync(new URL(`../src/life/catalog/${id}.rle`, import.meta.url), 'utf8'),
])) as { snark: string; buckaroo: string };
const capture = process.argv.includes('--capture');
const prefabs = loadPrefabs(sources);
const progress = (message: string) => console.error(message);
const report = capture ? runCaptureExperiments(prefabs, progress) : runExperiments(prefabs, extra, progress);
const output = `${tablesMarkdown(report)}\n\n### Recipes\n\n${recipesMarkdown(report)}\n`;
console.log(`Release gate: ${report.gate ? 'YES' : 'NO'}\n\n${output}`);
if (process.argv.includes('--write-tables')) {
  const path = new URL('../docs/specs/crystal-siege-experiments.md', import.meta.url);
  const original = readFileSync(path, 'utf8');
  const begin = capture ? '<!-- BEGIN GENERATED CAPTURE TABLES -->' : '<!-- BEGIN GENERATED TABLES -->';
  const end = capture ? '<!-- END GENERATED CAPTURE TABLES -->' : '<!-- END GENERATED TABLES -->';
  if (!original.includes(begin) || !original.includes(end)) throw new Error('Missing generated-table markers');
  writeFileSync(path, original.slice(0, original.indexOf(begin) + begin.length)
    + `\n\n${output}\n` + original.slice(original.indexOf(end)));
}
