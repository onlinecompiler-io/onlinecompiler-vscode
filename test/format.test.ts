import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { RunResult } from '../src/api';
import { exitCodeMeaning, formatHeader, formatMemory, formatResult, formatSeconds } from '../src/format';

function result(fields: Partial<RunResult>): RunResult {
	return { output: '', error: '', status: 'success', exit_code: 0, signal: null, truncated: false, ...fields };
}

describe('formatResult', () => {
	it('shows the output, then exit code, time and memory', () => {
		const text = formatResult(result({ output: 'Hello, World!\n', time: '0.0248', total: '0.0330', memory: '8192' }));
		assert.equal(text, 'Hello, World!\n\n[Done] exit code 0, time 0.025 s, memory 8.0 MB\n');
	});

	it('shows stderr under its own heading', () => {
		const text = formatResult(
			result({ output: 'before\n', error: 'Traceback (most recent call last):\nValueError\n', status: 'error', exit_code: 1, time: '0.03', memory: '9000' }),
		);
		assert.equal(
			text,
			'before\n\n[stderr]\nTraceback (most recent call last):\nValueError\n\n[Done] exit code 1, time 0.030 s, memory 8.8 MB\n',
		);
	});

	it('shows stderr alone when there was no output', () => {
		const text = formatResult(result({ error: "main.c:1:1: error: unknown type name 'x'", status: 'error', exit_code: 1 }));
		assert.equal(text, "[stderr]\nmain.c:1:1: error: unknown type name 'x'\n\n[Done] exit code 1\n");
	});

	it('ends output that has no final newline before the summary', () => {
		assert.equal(formatResult(result({ output: 'no newline' })), 'no newline\n\n[Done] exit code 0\n');
	});

	it('prints only the summary when the program printed nothing', () => {
		assert.equal(formatResult(result({ time: '0.010' })), '[Done] exit code 0, time 0.010 s\n');
	});

	it('names the signal and what the exit code means', () => {
		const killed = formatResult(result({ status: 'error', exit_code: 137, signal: 9, memory: '524288' }));
		assert.match(killed, /\[Done\] exit code 137 \(signal 9, killed: memory limit\), memory 512\.0 MB/);
		const timedOut = formatResult(result({ status: 'error', exit_code: 124 }));
		assert.match(timedOut, /\[Done\] exit code 124 \(time limit reached\)/);
		const segfault = formatResult(result({ status: 'error', exit_code: 139, signal: 11 }));
		assert.match(segfault, /exit code 139 \(signal 11, segmentation fault\)/);
	});

	it('adds a clear line when the output was cut', () => {
		const text = formatResult(result({ output: 'x'.repeat(10), truncated: true }));
		assert.match(text, /\n\[Truncated\] The output or stderr was longer than the API returns \(64 KB each\), so it was cut\.\n$/);
		assert.doesNotMatch(formatResult(result({ output: 'x' })), /Truncated/);
	});

	it('shows compile time when the total is clearly longer than the run', () => {
		const text = formatResult(result({ time: '0.010', total: '1.250' }));
		assert.equal(text, '[Done] exit code 0, time 0.010 s (1.250 s with compiling)\n');
		assert.equal(formatResult(result({ time: '0.010', total: '0.020' })), '[Done] exit code 0, time 0.010 s\n');
	});

	it('leaves out time and memory the API could not measure', () => {
		assert.equal(formatResult(result({ time: '', memory: '0' })), '[Done] exit code 0\n');
		assert.equal(formatResult(result({ time: 'n/a', memory: undefined })), '[Done] exit code 0\n');
	});

	it('says so when there is no exit code', () => {
		assert.equal(formatResult(result({ exit_code: null })), '[Done] no exit code\n');
	});
});

describe('formatHeader', () => {
	it('names the file and the compiler', () => {
		assert.equal(formatHeader({ fileName: 'main.py', compiler: 'python-3.14' }), '[Running] main.py with python-3.14\n');
	});

	it('names the selected lines and the input file', () => {
		assert.equal(
			formatHeader({ fileName: 'main.py', compiler: 'python-3.14', selection: { start: 3, end: 7 }, inputSource: 'main.py.in' }),
			'[Running] lines 3 to 7 of main.py with python-3.14, stdin from main.py.in\n',
		);
		assert.equal(
			formatHeader({ fileName: 'a.c', compiler: 'gcc-15', selection: { start: 2, end: 2 } }),
			'[Running] line 2 of a.c with gcc-15\n',
		);
	});
});

describe('number formatting', () => {
	it('formats seconds', () => {
		assert.equal(formatSeconds('0.0248'), '0.025 s');
		assert.equal(formatSeconds('2'), '2.000 s');
		assert.equal(formatSeconds(undefined), undefined);
		assert.equal(formatSeconds('-1'), undefined);
	});

	it('formats memory from KB', () => {
		assert.equal(formatMemory('512'), '512 KB');
		assert.equal(formatMemory('8192'), '8.0 MB');
		assert.equal(formatMemory('0'), undefined);
		assert.equal(formatMemory('abc'), undefined);
	});

	it('explains only the exit codes the sandbox gives', () => {
		assert.equal(exitCodeMeaning(0), undefined);
		assert.equal(exitCodeMeaning(1), undefined);
		assert.equal(exitCodeMeaning(153), 'stopped: too much output');
		assert.equal(exitCodeMeaning(71), 'stopped: too many processes');
	});
});
