// Calls to the OnlineCompiler.io REST API with Node's built-in fetch. Nothing here imports vscode,
// so the unit tests and the live test run it as it is.

export const DEFAULT_API_BASE = 'https://api.onlinecompiler.io';
/** How long a run may take before the extension stops waiting. The API stops a run at 30 seconds. */
export const RUN_TIMEOUT_MS = 60_000;
const COMPILERS_TIMEOUT_MS = 10_000;
// The API answers 404 with this message for an unknown or inactive key.
const KEY_REFUSED = 'Invalid or inactive API key';

export interface RunRequest {
	compiler: string;
	code: string;
	input?: string;
}

/** The fields of a run-code-sync response that the extension reads. */
export interface RunResult {
	output: string;
	error: string;
	status: string;
	exit_code: number | null;
	signal: number | null;
	truncated: boolean;
	/** Run-command wall time in seconds, as a decimal string. */
	time?: string;
	/** Wall time including a separate compile step, in seconds. */
	total?: string;
	/** Peak memory in KB, as a decimal string. */
	memory?: string;
}

export type RunErrorKind =
	| 'auth' // the key is missing, unknown, inactive, a widget key, or not allowed from this address
	| 'rate-limit' // 429: monthly allowance, per-minute rate, or every sandbox of the account busy
	| 'too-large' // 413: the request body is over the API's limit
	| 'bad-request' // 400: the API refused the request (bad compiler id, code or input too large, ...)
	| 'http' // any other status, such as 404 from a wrong apiBase or 5xx
	| 'network' // no response arrived
	| 'timeout' // no response within the client timeout
	| 'cancelled'; // the user stopped the run

export class RunError extends Error {
	readonly kind: RunErrorKind;
	/** The HTTP status, or 0 when no response arrived. */
	readonly status: number;

	constructor(kind: RunErrorKind, message: string, status = 0) {
		super(message);
		this.name = 'RunError';
		this.kind = kind;
		this.status = status;
	}
}

export interface ClientOptions {
	apiBase?: string;
	/** Aborting it stops waiting for the result; the result's error is a RunError of kind "cancelled". */
	signal?: AbortSignal;
	timeoutMs?: number;
	userAgent?: string;
	/** For tests. */
	fetch?: typeof fetch;
}

/** The API base without trailing slashes. */
export function normalizeBase(apiBase: string | undefined): string {
	const base = (apiBase ?? '').trim().replace(/\/+$/, '');
	return base || DEFAULT_API_BASE;
}

/** The dashboard page where a signed-in user makes and copies API keys, tagged so that an account
 * made from it counts the extension as its source. */
export function apiKeysUrl(apiBase?: string): string {
	return `${normalizeBase(apiBase)}/compilers/api-keys/?utm_source=vscode`;
}

/** A key as the user pasted it, without spaces around it or a "Bearer " prefix copied from an example. */
export function cleanApiKey(key: string): string {
	return key.trim().replace(/^Bearer\s+/i, '').trim();
}

/** The error for a response that was not a success: its JSON "error" message, sorted by status. */
export function errorFromResponse(status: number, body: string, url = ''): RunError {
	let message = '';
	try {
		const parsed: unknown = JSON.parse(body);
		if (parsed && typeof parsed === 'object' && 'error' in parsed) message = String(parsed.error);
	} catch {
		// Not JSON: a proxy's error page, or a URL that is not the API.
	}
	if (status === 401 || status === 403 || (status === 404 && message === KEY_REFUSED)) {
		return new RunError('auth', `The API key was refused: ${message || `HTTP ${status}`}`, status);
	}
	if (status === 429) {
		return new RunError('rate-limit', `Limit reached: ${message || 'too many runs. Try again shortly.'}`, status);
	}
	if (status === 413) {
		return new RunError('too-large', `The request is too large: ${message || 'shorten the code or the input.'}`, status);
	}
	if (status === 400) {
		return new RunError('bad-request', `The API refused the run: ${message || 'bad request.'}`, status);
	}
	if (status === 404) {
		return new RunError('http', `HTTP 404 from ${url || 'the API'}. Check the onlinecompiler.apiBase setting.`, status);
	}
	if (status >= 500) {
		return new RunError('http', `OnlineCompiler.io answered HTTP ${status}${message ? `: ${message}` : ''}. Try again in a moment.`, status);
	}
	return new RunError('http', `OnlineCompiler.io answered HTTP ${status}${message ? `: ${message}` : ''}.`, status);
}

/**
 * fetch with a timeout and an outside abort signal, turning failures into RunErrors. Returns the
 * response's status and text.
 */
async function request(url: string, init: RequestInit, options: ClientOptions, timeoutMs: number) {
	const doFetch = options.fetch ?? fetch;
	if (options.signal?.aborted) throw new RunError('cancelled', 'Stopped.');
	const controller = new AbortController();
	let timedOut = false;
	const timer = setTimeout(() => {
		timedOut = true;
		controller.abort();
	}, timeoutMs);
	const outside = options.signal;
	const onAbort = () => controller.abort();
	outside?.addEventListener('abort', onAbort, { once: true });
	try {
		const response = await doFetch(url, { ...init, signal: controller.signal });
		const text = await response.text();
		return { status: response.status, ok: response.ok, text };
	} catch (err) {
		if (timedOut) {
			throw new RunError('timeout', `No result after ${Math.round(timeoutMs / 1000)} seconds, so the run was stopped. Try again, or check your connection.`);
		}
		if (outside?.aborted) throw new RunError('cancelled', 'Stopped.');
		throw new RunError('network', `Could not reach ${new URL(url).origin}: ${describeCause(err)}`);
	} finally {
		clearTimeout(timer);
		outside?.removeEventListener('abort', onAbort);
	}
}

function describeCause(err: unknown): string {
	if (err instanceof Error) {
		const cause = (err as Error & { cause?: unknown }).cause;
		if (cause instanceof Error && cause.message) return cause.message;
		return err.message;
	}
	return String(err);
}

/** Run code with POST /api/run-code-sync/ and return the result, or throw a RunError. */
export async function runCode(apiKey: string, run: RunRequest, options: ClientOptions = {}): Promise<RunResult> {
	const url = `${normalizeBase(options.apiBase)}/api/run-code-sync/`;
	const headers: Record<string, string> = {
		Authorization: apiKey,
		'Content-Type': 'application/json',
		Accept: 'application/json',
	};
	if (options.userAgent) headers['User-Agent'] = options.userAgent;
	const body = JSON.stringify({ compiler: run.compiler, code: run.code, input: run.input ?? '' });
	const response = await request(url, { method: 'POST', headers, body }, options, options.timeoutMs ?? RUN_TIMEOUT_MS);
	if (!response.ok) throw errorFromResponse(response.status, response.text, url);
	let result: unknown;
	try {
		result = JSON.parse(response.text);
	} catch {
		throw new RunError('http', `OnlineCompiler.io sent a response that is not JSON (HTTP ${response.status}). Check the onlinecompiler.apiBase setting.`, response.status);
	}
	if (!result || typeof result !== 'object') {
		throw new RunError('http', 'OnlineCompiler.io sent an empty response.', response.status);
	}
	const r = result as Partial<RunResult>;
	return {
		output: typeof r.output === 'string' ? r.output : '',
		error: typeof r.error === 'string' ? r.error : '',
		status: typeof r.status === 'string' ? r.status : '',
		exit_code: typeof r.exit_code === 'number' ? r.exit_code : null,
		signal: typeof r.signal === 'number' ? r.signal : null,
		truncated: r.truncated === true,
		time: r.time == null ? undefined : String(r.time),
		total: r.total == null ? undefined : String(r.total),
		memory: r.memory == null ? undefined : String(r.memory),
	};
}

export interface ListedCompiler {
	id: string;
	name: string;
}

/**
 * The compilers GET /api/compilers/ lists (no key needed), without the test packs, which judge test
 * suites rather than run a file.
 */
export async function listCompilers(options: ClientOptions = {}): Promise<ListedCompiler[]> {
	const url = `${normalizeBase(options.apiBase)}/api/compilers/`;
	const headers: Record<string, string> = { Accept: 'application/json' };
	if (options.userAgent) headers['User-Agent'] = options.userAgent;
	const response = await request(url, { method: 'GET', headers }, options, options.timeoutMs ?? COMPILERS_TIMEOUT_MS);
	if (!response.ok) throw errorFromResponse(response.status, response.text, url);
	const parsed = JSON.parse(response.text) as { compilers?: Array<{ id?: unknown; name?: unknown; pack?: unknown }> };
	return (parsed.compilers ?? [])
		.filter((c) => typeof c.id === 'string' && c.pack === undefined)
		.map((c) => ({ id: c.id as string, name: typeof c.name === 'string' ? c.name : (c.id as string) }));
}
