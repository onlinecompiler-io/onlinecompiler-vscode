import { readFileSync, writeFileSync } from 'node:fs';
import { withTable } from './languages-table';

const before = readFileSync('README.md', 'utf8');
const after = withTable(before);
if (after !== before) writeFileSync('README.md', after);
console.log(after === before ? 'README.md is up to date.' : 'README.md languages table updated.');
