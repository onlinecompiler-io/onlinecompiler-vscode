import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { languagesTable, withTable } from '../scripts/languages-table';
import { COMPILERS, compilerById, defaultCompiler, extensionOf, runnableExtensions, runnableLanguageIds } from '../src/languages';

describe('defaultCompiler by extension', () => {
	const cases: Array<[string, string]> = [
		['main.py', 'python-3.14'],
		['main.c', 'gcc-15'],
		['main.cpp', 'g++-15'],
		['main.cc', 'g++-15'],
		['Main.java', 'openjdk-25'],
		['Program.cs', 'dotnet-csharp-10'],
		['main.fs', 'dotnet-fsharp-10'],
		['index.php', 'php-8.5'],
		['main.rb', 'ruby-4.0'],
		['Main.hs', 'haskell-9.12'],
		['main.go', 'go-1.26'],
		['main.rs', 'rust-1.93'],
		['main.ts', 'typescript-deno'],
		['main.js', 'nodejs-24'],
		['main.mjs', 'nodejs-24'],
		['query.sql', 'sqlite-3'],
		['run.sh', 'bash-5.2'],
		['main.f90', 'gfortran-15'],
		['Module1.vb', 'dotnet-vbnet-10'],
		['Main.kt', 'kotlin-2.4'],
		['analysis.R', 'r-4.6'],
		['main.swift', 'swift-6.4'],
		['HELLO.COB', 'gnucobol-3.2'],
		['main.pl', 'perl-5.44'],
		['main.jl', 'julia-1.13'],
		['main.pas', 'fpc-3.2'],
		['main.m', 'octave-11'],
		['main.asm', 'nasm-3'],
		['main.lua', 'lua-5.5'],
		['main.ml', 'ocaml-5.4'],
		['main.lisp', 'sbcl-2.6'],
		['main.erl', 'erlang-29'],
		['main.exs', 'elixir-1.20'],
		['main.d', 'ldc-1.43'],
		['main.bas', 'fbc-1.10'],
		['main.dart', 'dart-3.13'],
		['main.clj', 'clojure-1.12'],
		['main.groovy', 'groovy-6.0'],
		['Main.scala', 'scala-3.10'],
		['main.zig', 'zig-0.17'],
		['main.nim', 'nim-2.2'],
		['main.cr', 'crystal-1.22'],
		['main.adb', 'gnat-15'],
		['main.ps1', 'powershell-7.6'],
		['main.rkt', 'racket-9.3'],
	];
	for (const [file, id] of cases) {
		it(`${file} runs with ${id}`, () => assert.equal(defaultCompiler(file), id));
	}

	it('ignores the case of the extension', () => {
		assert.equal(defaultCompiler('MAIN.PY'), 'python-3.14');
		assert.equal(defaultCompiler('Main.Java'), 'openjdk-25');
	});

	it('reads the extension from a full path, with either slash', () => {
		assert.equal(defaultCompiler('/home/me/project/src/main.cpp'), 'g++-15');
		assert.equal(defaultCompiler('C:\\Users\\me\\main.go'), 'go-1.26');
	});

	it('has no default for files it cannot run', () => {
		for (const file of ['notes.txt', 'README.md', 'data.json', 'util.h', 'main.py.in', 'Makefile', '.bashrc']) {
			assert.equal(defaultCompiler(file), undefined, file);
		}
	});
});

describe('defaultCompiler with the language mode', () => {
	it('lets the language mode settle an extension two languages share', () => {
		assert.equal(defaultCompiler('main.m', 'objective-c'), 'clang-objc-21');
		assert.equal(defaultCompiler('main.m', 'matlab'), 'octave-11');
		assert.equal(defaultCompiler('main.m', 'octave'), 'octave-11');
		assert.equal(defaultCompiler('main.pl', 'prolog'), 'swipl-10');
		assert.equal(defaultCompiler('main.pl', 'perl'), 'perl-5.44');
	});

	it('keeps the extension when the language mode names another language', () => {
		assert.equal(defaultCompiler('main.py', 'plaintext'), 'python-3.14');
		assert.equal(defaultCompiler('main.cpp', 'c'), 'g++-15');
	});

	it('uses the language mode for untitled files and unknown extensions', () => {
		assert.equal(defaultCompiler('Untitled-1', 'python'), 'python-3.14');
		assert.equal(defaultCompiler('Untitled-2', 'cpp'), 'g++-15');
		assert.equal(defaultCompiler('Untitled-3', 'shellscript'), 'bash-5.2');
		assert.equal(defaultCompiler('script.txt', 'javascript'), 'nodejs-24');
		assert.equal(defaultCompiler('Untitled-4', 'plaintext'), undefined);
		assert.equal(defaultCompiler('Untitled-5'), undefined);
	});
});

describe('extensionOf', () => {
	it('returns the lower-case last extension with its dot', () => {
		assert.equal(extensionOf('main.PY'), '.py');
		assert.equal(extensionOf('archive.tar.gz'), '.gz');
		assert.equal(extensionOf('main.c++'), '.c++');
	});

	it('ignores dots in folder names and leading dots', () => {
		assert.equal(extensionOf('/a/b.d/Makefile'), '');
		assert.equal(extensionOf('.profile'), '');
		assert.equal(extensionOf(''), '');
	});
});

describe('the compiler list', () => {
	it('has 48 compilers with unique ids and no test packs', () => {
		const ids = COMPILERS.map((c) => c.id);
		assert.equal(ids.length, 48);
		assert.equal(new Set(ids).size, ids.length);
		assert.ok(ids.every((id) => !id.endsWith('-tests')));
	});

	it('writes extensions in lower case with a dot', () => {
		for (const c of COMPILERS) {
			for (const e of c.extensions) assert.match(e, /^\.[a-z0-9+]+$/, `${c.id}: ${e}`);
		}
	});

	it('finds a compiler by id', () => {
		assert.equal(compilerById('g++-15')?.name, 'C++ (g++ 15)');
		assert.equal(compilerById('cobol'), undefined);
	});
});

describe('package.json', () => {
	const manifest = JSON.parse(readFileSync('package.json', 'utf8'));

	it('shows the run button for exactly the files that have a default compiler', () => {
		const runButton = manifest.contributes.menus['editor/title'].find(
			(m: { command: string }) => m.command === 'onlinecompiler.runFile',
		);
		const when: string = runButton.when;
		const extensionList = /resourceExtname =~ \/\^\\\.\((.*?)\)\$\/i/.exec(when)?.[1];
		const languageList = /editorLangId =~ \/\^\((.*?)\)\$\//.exec(when)?.[1];
		assert.ok(extensionList && languageList, when);
		const unescape = (s: string) => s.replace(/\\(.)/g, '$1');
		assert.deepEqual(new Set(extensionList.split('|').map((e) => `.${unescape(e)}`)), new Set(runnableExtensions()));
		assert.deepEqual(new Set(languageList.split('|').map(unescape)), new Set(runnableLanguageIds()));
	});

	it('contributes the four commands and the Ctrl+Alt+R / Cmd+Alt+R keybinding', () => {
		const commands = manifest.contributes.commands.map((c: { command: string; category: string; title: string }) => `${c.category}: ${c.title}`);
		assert.deepEqual(commands.sort(), [
			'OnlineCompiler: Choose Language',
			'OnlineCompiler: Run File',
			'OnlineCompiler: Set API Key',
			'OnlineCompiler: Stop Run',
		]);
		assert.deepEqual(manifest.contributes.keybindings[0], {
			command: 'onlinecompiler.runFile',
			key: 'ctrl+alt+r',
			mac: 'cmd+alt+r',
			when: 'editorTextFocus',
		});
	});

	it('lets only user settings change the API base', () => {
		assert.equal(manifest.contributes.configuration.properties['onlinecompiler.apiBase'].scope, 'application');
	});

	it('has no runtime dependencies', () => {
		assert.equal(manifest.dependencies, undefined);
	});
});

describe('README.md', () => {
	it('has the current languages table (npm run readme updates it)', () => {
		const readme = readFileSync('README.md', 'utf8');
		assert.equal(withTable(readme), readme);
		assert.ok(readme.includes(languagesTable()));
	});
});
