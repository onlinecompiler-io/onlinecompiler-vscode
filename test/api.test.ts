import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { apiKeysUrl, cleanApiKey, errorFromResponse, listCompilers, normalizeBase, runCode, RunError } from '../src/api';
import { inputCandidates } from '../src/input';

type Call = { url: string; init: RequestInit };

function fakeFetch(status: number, body: string, calls: Call[] = []): typeof fetch {
	return (async (url: string | URL | Request, init?: RequestInit) => {
		calls.push({ url: String(url), init: init ?? {} });
		return new Response(body, { status });
	}) as typeof fetch;
}

/** A fetch that answers only when aborted, as a request that never returns would. */
const hangingFetch = ((_url: string | URL | Request, init?: RequestInit) =>
	new Promise<Response>((_resolve, reject) => {
		const aborted = () => reject(new DOMException('This operation was aborted', 'AbortError'));
		if (init?.signal?.aborted) aborted();
		init?.signal?.addEventListener('abort', aborted);
	})) as typeof fetch;

async function runError(promise: Promise<unknown>): Promise<RunError> {
	try {
		await promise;
	} catch (err) {
		assert.ok(err instanceof RunError, `expected a RunError, got ${String(err)}`);
		return err;
	}
	assert.fail('expected the call to fail');
}

describe('runCode', () => {
	it('POSTs the code to run-code-sync with the key in Authorization', async () => {
		const calls: Call[] = [];
		const body = JSON.stringify({ output: 'hi\n', error: '', status: 'success', exit_code: 0, signal: null, truncated: false, time: '0.0248', total: '0.0330', memory: '8192' });
		const result = await runCode(
			'key-123',
			{ compiler: 'python-3.14', code: 'print("hi")', input: 'World' },
			{ apiBase: 'https://api.example.test///', userAgent: 'onlinecompiler-vscode/0.1.0', fetch: fakeFetch(200, body, calls) },
		);
		assert.equal(calls.length, 1);
		assert.equal(calls[0].url, 'https://api.example.test/api/run-code-sync/');
		assert.equal(calls[0].init.method, 'POST');
		const headers = calls[0].init.headers as Record<string, string>;
		assert.equal(headers.Authorization, 'key-123');
		assert.equal(headers['Content-Type'], 'application/json');
		assert.equal(headers['User-Agent'], 'onlinecompiler-vscode/0.1.0');
		assert.deepEqual(JSON.parse(String(calls[0].init.body)), { compiler: 'python-3.14', code: 'print("hi")', input: 'World' });
		assert.deepEqual(result, { output: 'hi\n', error: '', status: 'success', exit_code: 0, signal: null, truncated: false, time: '0.0248', total: '0.0330', memory: '8192' });
	});

	it('sends empty input when there is none and uses the default API base', async () => {
		const calls: Call[] = [];
		await runCode('k', { compiler: 'gcc-15', code: 'int main(){}' }, { fetch: fakeFetch(200, '{"output":"","exit_code":0}', calls) });
		assert.equal(calls[0].url, 'https://api.onlinecompiler.io/api/run-code-sync/');
		assert.equal(JSON.parse(String(calls[0].init.body)).input, '');
	});

	it('fills fields the response leaves out', async () => {
		const result = await runCode('k', { compiler: 'gcc-15', code: '' }, { fetch: fakeFetch(200, '{"output":"x"}') });
		assert.deepEqual(result, { output: 'x', error: '', status: '', exit_code: null, signal: null, truncated: false, time: undefined, total: undefined, memory: undefined });
	});

	it('turns a refused key into an auth error', async () => {
		const err = await runError(runCode('bad', { compiler: 'python-3.14', code: '' }, { fetch: fakeFetch(404, '{"error": "Invalid or inactive API key"}') }));
		assert.equal(err.kind, 'auth');
		assert.equal(err.status, 404);
		assert.equal(err.message, 'The API key was refused: Invalid or inactive API key');
	});

	it('turns a 429 into a rate-limit error with the API message', async () => {
		const message = 'Monthly limit of 100,000 submissions reached. Upgrade at https://onlinecompiler.io/pricing';
		const err = await runError(runCode('k', { compiler: 'python-3.14', code: '' }, { fetch: fakeFetch(429, JSON.stringify({ error: message })) }));
		assert.equal(err.kind, 'rate-limit');
		assert.equal(err.message, `Limit reached: ${message}`);
	});

	it('stops waiting after the timeout', async () => {
		const err = await runError(runCode('k', { compiler: 'python-3.14', code: '' }, { fetch: hangingFetch, timeoutMs: 30 }));
		assert.equal(err.kind, 'timeout');
		assert.match(err.message, /No result after 0 seconds/);
	});

	it('stops waiting when the run is cancelled', async () => {
		const controller = new AbortController();
		const pending = runCode('k', { compiler: 'python-3.14', code: '' }, { fetch: hangingFetch, signal: controller.signal });
		setTimeout(() => controller.abort(), 10);
		const err = await runError(pending);
		assert.equal(err.kind, 'cancelled');
	});

	it('does not start when already cancelled', async () => {
		const controller = new AbortController();
		controller.abort();
		const err = await runError(runCode('k', { compiler: 'python-3.14', code: '' }, { fetch: hangingFetch, signal: controller.signal }));
		assert.equal(err.kind, 'cancelled');
	});

	it('reports a network failure with its cause', async () => {
		const failing = (async () => {
			throw new TypeError('fetch failed', { cause: new Error('getaddrinfo ENOTFOUND api.example.test') });
		}) as typeof fetch;
		const err = await runError(runCode('k', { compiler: 'python-3.14', code: '' }, { apiBase: 'https://api.example.test', fetch: failing }));
		assert.equal(err.kind, 'network');
		assert.equal(err.message, 'Could not reach https://api.example.test: getaddrinfo ENOTFOUND api.example.test');
	});

	it('refuses a success response that is not JSON', async () => {
		const err = await runError(runCode('k', { compiler: 'python-3.14', code: '' }, { fetch: fakeFetch(200, '<html>hello</html>') }));
		assert.equal(err.kind, 'http');
		assert.match(err.message, /not JSON/);
	});
});

describe('errorFromResponse', () => {
	it('sorts each status the API answers with', () => {
		const cases: Array<[number, string, string, string]> = [
			[401, '{"error": "Unauthorized"}', 'auth', 'The API key was refused: Unauthorized'],
			[403, '{"error": "This key is not authorized for the REST API"}', 'auth', 'The API key was refused: This key is not authorized for the REST API'],
			[403, '{"error": "Request origin not allowed for this API key"}', 'auth', 'The API key was refused: Request origin not allowed for this API key'],
			[404, '{"error": "Invalid or inactive API key"}', 'auth', 'The API key was refused: Invalid or inactive API key'],
			[400, '{"error": "Unsupported compiler: python-2"}', 'bad-request', 'The API refused the run: Unsupported compiler: python-2'],
			[413, '{"error": "The request body is over 32 MB"}', 'too-large', 'The request is too large: The request body is over 32 MB'],
			[429, '{"error": "Too many concurrent requests. Please try again shortly."}', 'rate-limit', 'Limit reached: Too many concurrent requests. Please try again shortly.'],
			[502, '<html>Bad Gateway</html>', 'http', 'OnlineCompiler.io answered HTTP 502. Try again in a moment.'],
			[503, '{"error": "Execution queue unavailable"}', 'http', 'OnlineCompiler.io answered HTTP 503: Execution queue unavailable. Try again in a moment.'],
		];
		for (const [status, body, kind, message] of cases) {
			const err = errorFromResponse(status, body);
			assert.equal(err.kind, kind, `${status} ${body}`);
			assert.equal(err.message, message);
			assert.equal(err.status, status);
		}
	});

	it('points at the apiBase setting for a 404 that is not about the key', () => {
		const err = errorFromResponse(404, '<html>Not Found</html>', 'https://example.test/api/run-code-sync/');
		assert.equal(err.kind, 'http');
		assert.equal(err.message, 'HTTP 404 from https://example.test/api/run-code-sync/. Check the onlinecompiler.apiBase setting.');
	});

	it('still explains statuses that come without a message', () => {
		assert.equal(errorFromResponse(429, '').message, 'Limit reached: too many runs. Try again shortly.');
		assert.equal(errorFromResponse(401, '').message, 'The API key was refused: HTTP 401');
	});
});

describe('listCompilers', () => {
	it('lists compilers without the test packs', async () => {
		const calls: Call[] = [];
		const body = JSON.stringify({
			compilers: [
				{ id: 'python-3.14', name: 'Python 3.14', packages: [] },
				{ id: 'gcc-15', name: 'C (gcc 15)' },
				{ id: 'python-3.14-tests', name: 'Python 3.14 (tests)', pack: { version: '1.0' } },
			],
			retired: {},
		});
		const list = await listCompilers({ fetch: fakeFetch(200, body, calls) });
		assert.equal(calls[0].url, 'https://api.onlinecompiler.io/api/compilers/');
		assert.deepEqual(list, [
			{ id: 'python-3.14', name: 'Python 3.14' },
			{ id: 'gcc-15', name: 'C (gcc 15)' },
		]);
	});
});

describe('keys and URLs', () => {
	it('cleans a pasted key', () => {
		assert.equal(cleanApiKey('  abc123 \n'), 'abc123');
		assert.equal(cleanApiKey('Bearer abc123'), 'abc123');
		assert.equal(cleanApiKey('   '), '');
	});

	it('builds the API keys page from the API base', () => {
		assert.equal(apiKeysUrl(), 'https://api.onlinecompiler.io/compilers/api-keys/?utm_source=vscode');
		assert.equal(apiKeysUrl('http://localhost:8000/'), 'http://localhost:8000/compilers/api-keys/?utm_source=vscode');
		assert.equal(normalizeBase('  '), 'https://api.onlinecompiler.io');
	});
});

describe('inputCandidates', () => {
	it('checks <file>.in, then input.txt in the same folder', () => {
		assert.deepEqual(inputCandidates('/home/me/project/main.py'), ['/home/me/project/main.py.in', '/home/me/project/input.txt']);
		assert.deepEqual(inputCandidates('/c:/Users/me/Main.java'), ['/c:/Users/me/Main.java.in', '/c:/Users/me/input.txt']);
	});
});
