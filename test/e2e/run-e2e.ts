// Starts VS Code with the extension and runs suite.ts inside it, against a small fake API on
// 127.0.0.1, so no real key is needed or stored. VSCODE_PATH names a VS Code binary to use
// (such as /usr/share/code/code); without it, @vscode/test-electron downloads one.
// On Linux, run it under xvfb-run to keep the window off the screen; in a Wayland session also
// unset WAYLAND_DISPLAY and XDG_SESSION_TYPE, or VS Code opens on the desktop instead:
//   env -u WAYLAND_DISPLAY -u XDG_SESSION_TYPE xvfb-run -a npm run test:e2e

import { createServer, type IncomingMessage } from 'node:http';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { runTests } from '@vscode/test-electron';

export const TEST_KEY = 'e2e-test-key';

function readBody(request: IncomingMessage): Promise<string> {
	return new Promise((done) => {
		let body = '';
		request.on('data', (chunk) => (body += chunk));
		request.on('end', () => done(body));
	});
}

/** Answers run-code-sync with what it was sent, so the suite can check the request. */
const fakeApi = createServer(async (request, response) => {
	const body = await readBody(request);
	response.setHeader('Content-Type', 'application/json');
	if (request.method !== 'POST' || request.url !== '/api/run-code-sync/') {
		response.writeHead(404).end('{"error": "Not found"}');
		return;
	}
	if (request.headers.authorization !== TEST_KEY) {
		response.writeHead(404).end('{"error": "Invalid or inactive API key"}');
		return;
	}
	const sent = JSON.parse(body);
	response.end(
		JSON.stringify({
			output: JSON.stringify({ ...sent, userAgent: request.headers['user-agent'] }),
			error: '',
			status: 'success',
			exit_code: 0,
			signal: null,
			truncated: false,
			time: '0.0100',
			total: '0.0100',
			memory: '1024',
		}),
	);
});

async function main(): Promise<void> {
	await new Promise<void>((done) => fakeApi.listen(0, '127.0.0.1', done));
	const port = (fakeApi.address() as AddressInfo).port;

	const scratch = mkdtempSync(join(tmpdir(), 'onlinecompiler-vscode-e2e-'));
	const workspace = join(scratch, 'workspace');
	const userData = join(scratch, 'user-data');
	mkdirSync(workspace);
	mkdirSync(join(userData, 'User'), { recursive: true });
	writeFileSync(join(workspace, 'hello.py'), 'name = input()\nprint(f"Hello, {name}!")\n');
	writeFileSync(join(workspace, 'hello.py.in'), 'World\n');
	writeFileSync(join(workspace, 'two.py'), 'print(1)\nprint(2)\nprint(3)\n');
	writeFileSync(join(workspace, 'crlf.sh'), 'echo a\r\necho b\r\n');
	writeFileSync(join(workspace, 'input.txt'), 'from input.txt\n');
	writeFileSync(
		join(userData, 'User', 'settings.json'),
		JSON.stringify({ 'onlinecompiler.apiBase': `http://127.0.0.1:${port}`, 'security.workspace.trust.enabled': false }),
	);

	const root = resolve(__dirname, '../../..');
	try {
		await runTests({
			vscodeExecutablePath: process.env.VSCODE_PATH || undefined,
			extensionDevelopmentPath: root,
			extensionTestsPath: join(__dirname, 'suite.js'),
			launchArgs: [
				workspace,
				'--disable-extensions',
				'--disable-gpu',
				'--skip-welcome',
				'--skip-release-notes',
				'--password-store=basic',
				`--user-data-dir=${userData}`,
				`--extensions-dir=${join(scratch, 'extensions')}`,
			],
			extensionTestsEnv: { ONLINECOMPILER_E2E_KEY: TEST_KEY },
		});
	} finally {
		fakeApi.close();
		rmSync(scratch, { recursive: true, force: true });
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
