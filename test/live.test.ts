// Runs against the live API when ONLINECOMPILER_API_KEY is set; skipped otherwise.
// ONLINECOMPILER_API_BASE points it at another server.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { listCompilers, runCode, RunError } from '../src/api';
import { COMPILERS } from '../src/languages';

const apiKey = process.env.ONLINECOMPILER_API_KEY ?? '';
const apiBase = process.env.ONLINECOMPILER_API_BASE || undefined;
const skip = apiKey ? false : 'set ONLINECOMPILER_API_KEY to run against the live API';

describe('live API', { skip }, () => {
	it('runs a Python program with input', async () => {
		const result = await runCode(
			apiKey,
			{ compiler: 'python-3.14', code: 'name = input()\nprint(f"Hello, {name}!")\n', input: 'World' },
			{ apiBase, userAgent: 'onlinecompiler-vscode/test' },
		);
		assert.equal(result.output, 'Hello, World!\n');
		assert.equal(result.error, '');
		assert.equal(result.exit_code, 0);
		assert.equal(result.status, 'success');
		assert.equal(result.truncated, false);
		assert.ok(Number(result.time) >= 0, `time: ${result.time}`);
	});

	it('refuses an unknown key as an auth error', async () => {
		await assert.rejects(
			runCode('not-a-real-key', { compiler: 'python-3.14', code: 'print(1)' }, { apiBase }),
			(err: unknown) => err instanceof RunError && err.kind === 'auth' && err.status === 404,
		);
	});

	it('lists the same compilers as the built-in list', async () => {
		const live = await listCompilers({ apiBase });
		assert.deepEqual(
			live.map((c) => c.id).sort(),
			COMPILERS.map((c) => c.id).sort(),
		);
		for (const c of live) assert.equal(COMPILERS.find((b) => b.id === c.id)?.name, c.name, c.id);
	});
});
