// The README's table of languages, made from src/languages.ts.

import { COMPILERS } from '../src/languages';

export const TABLE_START = '<!-- languages:start -->';
export const TABLE_END = '<!-- languages:end -->';

export function languagesTable(): string {
	const rows = COMPILERS.map((c) => {
		const extensions = c.extensions.length > 0 ? c.extensions.map((e) => `\`${e}\``).join(' ') : 'Choose Language';
		return `| ${c.name} | \`${c.id}\` | ${extensions} |`;
	});
	return ['| Language | Compiler id | Runs by default for |', '| --- | --- | --- |', ...rows].join('\n');
}

/** text with the part between the markers replaced by the current table. */
export function withTable(text: string): string {
	const start = text.indexOf(TABLE_START);
	const end = text.indexOf(TABLE_END);
	if (start < 0 || end < start) throw new Error(`README.md needs ${TABLE_START} and ${TABLE_END} markers`);
	return `${text.slice(0, start + TABLE_START.length)}\n${languagesTable()}\n${text.slice(end)}`;
}
