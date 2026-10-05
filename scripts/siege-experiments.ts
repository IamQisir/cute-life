import { readFileSync, writeFileSync } from 'node:fs';
import { UNIT_IDS, loadPrefabs, type UnitId } from '../src/battle/siege/prefabs';
import { DEFAULT_RULES } from '../src/battle/siege/siegeSim';
import { BIRTHS_RULES, runBirthsExperiments } from '../src/battle/siege/birthsExperiments';
import { runCaptureExperiments } from '../src/battle/siege/captureExperiments';
import { runExperiments, tablesMarkdown, recipesMarkdown } from '../src/battle/siege/experiments';

const sources = Object.fromEntries(UNIT_IDS.map(id => [id,
  readFileSync(new URL(`../src/life/catalog/${id}.rle`, import.meta.url), 'utf8'),
])) as Record<UnitId, string>;
const extra = Object.fromEntries(['snark', 'buckaroo'].map(id => [id,
  readFileSync(new URL(`../src/life/catalog/${id}.rle`, import.meta.url), 'utf8'),
])) as { snark: string; buckaroo: string };
const capture = process.argv.includes('--capture');
const births = process.argv.includes('--births');
if (births && capture) throw new Error('Choose --births or --capture');
const prefabs = loadPrefabs(sources);
const progress = (message: string) => console.error(message);
const report = births ? runBirthsExperiments(prefabs, progress) : capture ? runCaptureExperiments(prefabs, progress) : runExperiments(prefabs, extra, progress);
const output = `${tablesMarkdown(report)}\n\n### Recipes\n\n${recipesMarkdown(report)}\n`;
if (births) console.log(`Recommended: hitbox=${BIRTHS_RULES.hitbox}, hp=${BIRTHS_RULES.hp}, cap=${BIRTHS_RULES.cap}, unitsPerHP=${BIRTHS_RULES.unitsPerHP}; DEFAULT_RULES.scoring=${DEFAULT_RULES.scoring}`);
console.log(`Release gate: ${report.gate ? 'YES' : 'NO'}\n\n${output}`);
if (process.argv.includes('--write-tables')) {
  const path = new URL('../docs/specs/crystal-siege-experiments.md', import.meta.url);
  const original = readFileSync(path, 'utf8');
  const begin = births ? '<!-- BEGIN GENERATED BIRTHS TABLES -->' : capture ? '<!-- BEGIN GENERATED CAPTURE TABLES -->' : '<!-- BEGIN GENERATED TABLES -->';
  const end = births ? '<!-- END GENERATED BIRTHS TABLES -->' : capture ? '<!-- END GENERATED CAPTURE TABLES -->' : '<!-- END GENERATED TABLES -->';
  if (!original.includes(begin) || !original.includes(end)) throw new Error('Missing generated-table markers');
  writeFileSync(path, original.slice(0, original.indexOf(begin) + begin.length)
    + `\n\n${output}\n` + original.slice(original.indexOf(end)));
}
