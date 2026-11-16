import { posix } from 'node:path';
import * as vscode from 'vscode';
import { apiKeysUrl, cleanApiKey, listCompilers, normalizeBase, runCode, RunError, type ListedCompiler, type RunResult } from './api';
import { formatHeader, formatResult, type RunHeader } from './format';
import { inputCandidates } from './input';
import { COMPILERS, compilerById, defaultCompiler } from './languages';

const SECRET_KEY = 'onlinecompiler.apiKey';
const RUNNING_CONTEXT = 'onlinecompiler.running';
const GET_KEY = 'Get a free key';
const ENTER_KEY = 'Enter key';

let output: vscode.OutputChannel;
let statusItem: vscode.StatusBarItem;
let secrets: vscode.SecretStorage;
let userAgent = 'onlinecompiler-vscode';
/** Compiler ids chosen with Choose Language, by document URI, until VS Code restarts. */
const overrides = new Map<string, string>();
/** The run in progress, if any. */
let current: AbortController | undefined;
/** The API's compiler list, fetched once per API base for Choose Language. */
let compilerList: { base: string; list: Promise<ListedCompiler[]> } | undefined;

export function activate(context: vscode.ExtensionContext): void {
	secrets = context.secrets;
	const version = String(context.extension.packageJSON.version ?? '0.0.0');
	userAgent = `onlinecompiler-vscode/${version} vscode/${vscode.version}`;
	output = vscode.window.createOutputChannel('OnlineCompiler.io');
	statusItem = vscode.window.createStatusBarItem('onlinecompiler.run', vscode.StatusBarAlignment.Left, 100);
	statusItem.name = 'OnlineCompiler.io run';
	statusItem.command = 'onlinecompiler.stop';

	context.subscriptions.push(
		output,
		statusItem,
		vscode.commands.registerCommand('onlinecompiler.runFile', runFile),
		vscode.commands.registerCommand('onlinecompiler.setApiKey', setApiKey),
		vscode.commands.registerCommand('onlinecompiler.chooseLanguage', chooseLanguage),
		vscode.commands.registerCommand('onlinecompiler.stop', stop),
	);
}

export function deactivate(): void {
	current?.abort();
}

function settings() {
	const config = vscode.workspace.getConfiguration('onlinecompiler');
	return {
		apiBase: normalizeBase(config.get<string>('apiBase')),
		askForInput: config.get<boolean>('askForInput', false),
		clearOutput: config.get<boolean>('clearOutput', true),
	};
}

function fileNameOf(document: vscode.TextDocument): string {
	return posix.basename(document.uri.path) || document.fileName;
}

/** The document to run: the one the title bar button was pressed for, or the active editor's. */
async function target(uri?: unknown): Promise<{ document: vscode.TextDocument; editor?: vscode.TextEditor } | undefined> {
	const editor = vscode.window.activeTextEditor;
	if (uri instanceof vscode.Uri && editor?.document.uri.toString() !== uri.toString()) {
		return { document: await vscode.workspace.openTextDocument(uri) };
	}
	if (editor && editor.document.uri.scheme !== 'output') return { document: editor.document, editor };
	return undefined;
}

/** OnlineCompiler: Run File. Returns the result, or undefined when nothing ran or the run failed. */
async function runFile(uri?: unknown): Promise<RunResult | undefined> {
	if (current) {
		const choice = await vscode.window.showWarningMessage('OnlineCompiler.io is already running a file.', 'Stop It');
		if (choice) stop();
		return undefined;
	}
	const found = await target(uri);
	if (!found) {
		void vscode.window.showInformationMessage('Open a file to run it with OnlineCompiler.io.');
		return undefined;
	}
	const { document, editor } = found;
	const { apiBase, askForInput, clearOutput } = settings();
	if (!/^https?:\/\/[^/]/i.test(apiBase)) {
		void vscode.window.showErrorMessage(`The onlinecompiler.apiBase setting is not an http(s) URL: ${apiBase}`);
		return undefined;
	}

	const compiler =
		overrides.get(document.uri.toString()) ??
		defaultCompiler(document.fileName, document.languageId) ??
		(await pickCompiler(document, `Which language is ${fileNameOf(document)}?`));
	if (!compiler) return undefined;

	const apiKey = await savedKeyOrAsk(apiBase);
	if (!apiKey) return undefined;

	const header: RunHeader = { fileName: fileNameOf(document), compiler };
	let code = document.getText();
	if (editor && !editor.selection.isEmpty) {
		const { start, end } = editor.selection;
		code = document.getText(editor.selection);
		// A selection that ends at the start of a line does not include that line.
		const last = end.character === 0 && end.line > start.line ? end.line : end.line + 1;
		header.selection = { start: start.line + 1, end: last };
	}

	let stdin = '';
	const inputFile = await findInputFile(document);
	if (inputFile) {
		stdin = inputFile.text;
		header.inputSource = inputFile.name;
	} else if (askForInput) {
		const typed = await vscode.window.showInputBox({
			title: `Input for ${header.fileName}`,
			prompt: `Sent as stdin. For several lines, save them in ${header.fileName}.in or input.txt beside the file.`,
			placeHolder: 'Leave empty for no input',
			ignoreFocusOut: true,
		});
		if (typed === undefined) return undefined;
		stdin = typed;
		if (typed) header.inputSource = 'the input box';
	}

	if (clearOutput) output.clear();
	output.show(true);
	output.append(formatHeader(header));

	const controller = new AbortController();
	current = controller;
	setRunning(header.fileName);
	try {
		// The sandbox is Linux: Windows line endings would reach the program as stray \r characters.
		const result = await runCode(
			apiKey,
			{ compiler, code: toLf(code), input: toLf(stdin) },
			{ apiBase, signal: controller.signal, userAgent },
		);
		output.append(formatResult(result));
		return result;
	} catch (err) {
		reportError(err, apiBase);
		return undefined;
	} finally {
		current = undefined;
		setRunning(undefined);
	}
}

function toLf(text: string): string {
	return text.replace(/\r\n/g, '\n');
}

function reportError(err: unknown, apiBase: string): void {
	if (!(err instanceof RunError)) {
		output.appendLine(`[Error] ${err instanceof Error ? err.message : String(err)}`);
		return;
	}
	if (err.kind === 'cancelled') {
		output.appendLine('[Stopped] Stopped waiting for the result.');
		return;
	}
	output.appendLine(`[Error] ${err.message}`);
	if (err.kind === 'auth') {
		output.appendLine(`Copy an API key from ${apiKeysUrl(apiBase)} and save it with "OnlineCompiler: Set API Key".`);
		void vscode.window.showErrorMessage(err.message, ENTER_KEY, GET_KEY).then((choice) => keyAction(choice, apiBase));
	}
}

/** The input file beside the document (main.py.in, then input.txt), preferring its unsaved text if it is open. */
async function findInputFile(document: vscode.TextDocument): Promise<{ name: string; text: string } | undefined> {
	if (document.isUntitled) return undefined;
	for (const path of inputCandidates(document.uri.path)) {
		const uri = document.uri.with({ path });
		const name = posix.basename(path);
		const open = vscode.workspace.textDocuments.find((d) => d.uri.toString() === uri.toString());
		if (open) return { name, text: open.getText() };
		try {
			const bytes = await vscode.workspace.fs.readFile(uri);
			return { name, text: new TextDecoder().decode(bytes) };
		} catch {
			// Not there; try the next one.
		}
	}
	return undefined;
}

function setRunning(fileName: string | undefined): void {
	void vscode.commands.executeCommand('setContext', RUNNING_CONTEXT, fileName !== undefined);
	if (fileName === undefined) {
		statusItem.hide();
		return;
	}
	statusItem.text = `$(sync~spin) Running ${fileName}`;
	statusItem.tooltip = 'OnlineCompiler.io is running this file. Click to stop waiting for it.';
	statusItem.show();
}

/** OnlineCompiler: Stop Run. */
function stop(): void {
	current?.abort();
}

// API key

async function savedKeyOrAsk(apiBase: string): Promise<string | undefined> {
	const saved = await secrets.get(SECRET_KEY);
	if (saved) return saved;
	const choice = await vscode.window.showInformationMessage(
		'OnlineCompiler.io needs a free API key to run code. Sign in with Google or GitHub to get one, then enter it here.',
		GET_KEY,
		ENTER_KEY,
	);
	return keyAction(choice, apiBase);
}

async function keyAction(choice: string | undefined, apiBase: string): Promise<string | undefined> {
	if (choice === GET_KEY) {
		await vscode.env.openExternal(vscode.Uri.parse(apiKeysUrl(apiBase)));
		return askForKey(apiBase, false);
	}
	if (choice === ENTER_KEY) return askForKey(apiBase, false);
	return undefined;
}

/** Ask for a key and save it; undefined if the box was closed. With canRemove, an empty value removes the saved key. */
async function askForKey(apiBase: string, canRemove: boolean): Promise<string | undefined> {
	const value = await vscode.window.showInputBox({
		title: 'OnlineCompiler.io API key',
		prompt: `Paste an API key from ${apiKeysUrl(apiBase)}${canRemove ? '. Leave empty to remove the saved key.' : ''}`,
		placeHolder: 'API key',
		password: true,
		ignoreFocusOut: true,
		validateInput: (text) => (canRemove || cleanApiKey(text) ? undefined : 'Paste your API key.'),
	});
	if (value === undefined) return undefined;
	const key = cleanApiKey(value);
	if (!key) {
		await secrets.delete(SECRET_KEY);
		void vscode.window.showInformationMessage('OnlineCompiler.io API key removed.');
		return undefined;
	}
	await secrets.store(SECRET_KEY, key);
	void vscode.window.showInformationMessage('OnlineCompiler.io API key saved.');
	return key;
}

/** OnlineCompiler: Set API Key. A key passed as the argument is saved without asking. */
async function setApiKey(key?: unknown): Promise<void> {
	if (typeof key === 'string' && cleanApiKey(key)) {
		await secrets.store(SECRET_KEY, cleanApiKey(key));
		return;
	}
	const hasKey = Boolean(await secrets.get(SECRET_KEY));
	await askForKey(settings().apiBase, hasKey);
}

// Choosing a language

function compilersFor(apiBase: string): Promise<ListedCompiler[]> {
	if (compilerList?.base !== apiBase) {
		const builtIn = COMPILERS.map(({ id, name }) => ({ id, name }));
		const list = listCompilers({ apiBase, userAgent })
			.then((live) => (live.length > 0 ? live : builtIn))
			.catch(() => {
				compilerList = undefined; // ask the API again next time
				return builtIn;
			});
		compilerList = { base: apiBase, list };
	}
	return compilerList.list;
}

interface CompilerItem extends vscode.QuickPickItem {
	compilerId?: string;
}

/** Ask which compiler runs this document, remember the answer for the session and return it. */
async function pickCompiler(document: vscode.TextDocument, title: string): Promise<string | undefined> {
	const key = document.uri.toString();
	const now = overrides.get(key) ?? defaultCompiler(document.fileName, document.languageId);
	const items = compilersFor(settings().apiBase).then((list) => {
		const item = (c: ListedCompiler): CompilerItem => ({ label: c.name, description: c.id, compilerId: c.id });
		const rest = list.filter((c) => c.id !== now).map(item);
		if (!now) return rest;
		const chosen = list.find((c) => c.id === now) ?? { id: now, name: compilerById(now)?.name ?? now };
		return [
			{ label: 'Current', kind: vscode.QuickPickItemKind.Separator },
			item(chosen),
			{ label: 'Other languages', kind: vscode.QuickPickItemKind.Separator },
			...rest,
		] as CompilerItem[];
	});
	const picked = await vscode.window.showQuickPick<CompilerItem>(items, {
		title,
		placeHolder: 'Type a language or compiler id',
		matchOnDescription: true,
	});
	if (!picked?.compilerId) return undefined;
	overrides.set(key, picked.compilerId);
	return picked.compilerId;
}

/** OnlineCompiler: Choose Language. Returns the chosen compiler id. */
async function chooseLanguage(): Promise<string | undefined> {
	const editor = vscode.window.activeTextEditor;
	if (!editor || editor.document.uri.scheme === 'output') {
		void vscode.window.showInformationMessage('Open a file to choose the language it runs with.');
		return undefined;
	}
	const fileName = fileNameOf(editor.document);
	const picked = await pickCompiler(editor.document, `Run ${fileName} with`);
	if (picked) vscode.window.setStatusBarMessage(`OnlineCompiler.io: ${fileName} runs with ${picked} until VS Code restarts`, 5000);
	return picked;
}
