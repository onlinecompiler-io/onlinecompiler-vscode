// Runs inside VS Code's extension host (see run-e2e.ts). The fake API answers each run with the
// request it got as the output, so these checks see exactly what the extension sent.

import assert from 'node:assert/strict';
import * as vscode from 'vscode';

interface Sent {
	compiler: string;
	code: string;
	input: string;
	userAgent: string;
}

async function open(name: string): Promise<vscode.TextEditor> {
	const folder = vscode.workspace.workspaceFolders?.[0];
	assert.ok(folder, 'no workspace folder');
	const document = await vscode.workspace.openTextDocument(vscode.Uri.joinPath(folder.uri, name));
	return vscode.window.showTextDocument(document);
}

async function runCurrent(): Promise<Sent | undefined> {
	const result = await vscode.commands.executeCommand<{ output: string; exit_code: number } | undefined>('onlinecompiler.runFile');
	if (!result) return undefined;
	assert.equal(result.exit_code, 0);
	return JSON.parse(result.output) as Sent;
}

const checks: Array<[string, () => Promise<void>]> = [
	[
		'runs the file with the input file beside it',
		async () => {
			await open('hello.py');
			const sent = await runCurrent();
			assert.ok(sent, 'no result');
			assert.equal(sent.compiler, 'python-3.14');
			assert.equal(sent.code, 'name = input()\nprint(f"Hello, {name}!")\n');
			assert.equal(sent.input, 'World\n');
			assert.match(sent.userAgent, /^onlinecompiler-vscode\/0\.1\.0 vscode\/\d+\.\d+/);
		},
	],
	[
		'runs only the selection, with input.txt when there is no <file>.in',
		async () => {
			const editor = await open('two.py');
			editor.selection = new vscode.Selection(1, 0, 2, 0);
			const sent = await runCurrent();
			assert.ok(sent, 'no result');
			assert.equal(sent.code, 'print(2)\n');
			assert.equal(sent.input, 'from input.txt\n');
		},
	],
	[
		'sends Windows line endings as \\n and picks Bash for .sh',
		async () => {
			await open('crlf.sh');
			const sent = await runCurrent();
			assert.ok(sent, 'no result');
			assert.equal(sent.compiler, 'bash-5.2');
			assert.equal(sent.code, 'echo a\necho b\n');
		},
	],
	[
		'runs an untitled file by its language mode, with unsaved text',
		async () => {
			const document = await vscode.workspace.openTextDocument({ language: 'ruby', content: 'puts 1' });
			await vscode.window.showTextDocument(document);
			const sent = await runCurrent();
			assert.ok(sent, 'no result');
			assert.equal(sent.compiler, 'ruby-4.0');
			assert.equal(sent.code, 'puts 1');
			assert.equal(sent.input, '');
		},
	],
	[
		'reports a refused key without throwing',
		async () => {
			await vscode.commands.executeCommand('onlinecompiler.setApiKey', 'wrong-key');
			await open('hello.py');
			assert.equal(await runCurrent(), undefined);
		},
	],
];

export async function run(): Promise<void> {
	const key = process.env.ONLINECOMPILER_E2E_KEY;
	assert.ok(key, 'ONLINECOMPILER_E2E_KEY is not set');
	await vscode.commands.executeCommand('onlinecompiler.setApiKey', key);
	const extension = vscode.extensions.getExtension('onlinecompiler.onlinecompiler');
	assert.ok(extension?.isActive, 'the extension did not activate');

	let failed = 0;
	for (const [name, check] of checks) {
		try {
			await check();
			console.log(`  ok   ${name}`);
		} catch (err) {
			failed++;
			console.log(`  FAIL ${name}\n${err instanceof Error ? err.stack : String(err)}`);
		}
	}
	console.log(`e2e: ${checks.length - failed} of ${checks.length} passed`);
	if (failed) throw new Error(`${failed} e2e check(s) failed`);
}
