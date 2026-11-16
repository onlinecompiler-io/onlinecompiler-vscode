// How a run looks in the output channel. Nothing here imports vscode.

import type { RunResult } from './api';

export interface RunHeader {
	/** The file's name, such as main.py. */
	fileName: string;
	compiler: string;
	/** 1-based first and last line when only a selection is sent. */
	selection?: { start: number; end: number };
	/** Where stdin came from: an input file's name, "typed in", or undefined for none. */
	inputSource?: string;
}

export function formatHeader(header: RunHeader): string {
	let what = header.fileName;
	if (header.selection) {
		const { start, end } = header.selection;
		what = start === end ? `line ${start} of ${header.fileName}` : `lines ${start} to ${end} of ${header.fileName}`;
	}
	const input = header.inputSource ? `, stdin from ${header.inputSource}` : '';
	return `[Running] ${what} with ${header.compiler}${input}\n`;
}

/** What a few exit codes mean in the sandbox (see the run-code docs); undefined for the rest. */
export function exitCodeMeaning(exitCode: number | null): string | undefined {
	switch (exitCode) {
		case 124:
			return 'time limit reached';
		case 137:
			return 'killed: memory limit';
		case 139:
			return 'segmentation fault';
		case 153:
			return 'stopped: too much output';
		case 71:
			return 'stopped: too many processes';
		default:
			return undefined;
	}
}

/** Seconds as the API sends them ("0.0248") to "0.025 s", or undefined when missing or not a number. */
export function formatSeconds(value: string | undefined): string | undefined {
	if (value === undefined || value.trim() === '') return undefined;
	const seconds = Number(value);
	if (!Number.isFinite(seconds) || seconds < 0) return undefined;
	return `${seconds.toFixed(3)} s`;
}

/** KB as the API sends them ("8192") to "8.0 MB" or "512 KB"; undefined when missing, zero or not a number. */
export function formatMemory(value: string | undefined): string | undefined {
	if (value === undefined || value.trim() === '') return undefined;
	const kb = Number(value);
	if (!Number.isFinite(kb) || kb <= 0) return undefined;
	return kb < 1024 ? `${Math.round(kb)} KB` : `${(kb / 1024).toFixed(1)} MB`;
}

function withNewline(text: string): string {
	return text.endsWith('\n') ? text : `${text}\n`;
}

/** The program's output, its stderr, then one summary line, and a line when output was cut. */
export function formatResult(result: RunResult): string {
	let text = '';
	if (result.output) text += withNewline(result.output);
	if (result.error) {
		if (text) text += '\n';
		text += '[stderr]\n' + withNewline(result.error);
	}
	if (text) text += '\n';

	const parts: string[] = [];
	if (result.exit_code === null) {
		parts.push('no exit code');
	} else {
		let exit = `exit code ${result.exit_code}`;
		const detail = [result.signal !== null ? `signal ${result.signal}` : undefined, exitCodeMeaning(result.exit_code)]
			.filter(Boolean)
			.join(', ');
		if (detail) exit += ` (${detail})`;
		parts.push(exit);
	}
	const time = formatSeconds(result.time);
	if (time) {
		const total = formatSeconds(result.total);
		const compiling = Number(result.total) - Number(result.time) >= 0.05;
		parts.push(total && compiling ? `time ${time} (${total} with compiling)` : `time ${time}`);
	}
	const memory = formatMemory(result.memory);
	if (memory) parts.push(`memory ${memory}`);
	text += `[Done] ${parts.join(', ')}\n`;

	if (result.truncated) {
		text += '[Truncated] The output or stderr was longer than the API returns (64 KB each), so it was cut.\n';
	}
	return text;
}
