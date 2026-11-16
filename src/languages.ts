// The compilers OnlineCompiler.io runs, in the order GET /api/compilers/ lists them, with the file
// extensions and VS Code language ids that pick each one by default. The test packs (ids ending in
// -tests) are left out: they judge test suites and do not run a plain file.
//
// When two languages share an extension (.m for Octave and Objective-C, .pl for Perl and Prolog),
// the editor's language mode decides, and without one the first compiler in this list wins.

export interface Compiler {
	/** The compiler id the API takes. */
	id: string;
	/** The name the API's compiler list gives it. */
	name: string;
	/** Lower-case file extensions, with the dot, that run with this compiler by default. */
	extensions: string[];
	/** VS Code language ids (built in, or from popular language extensions) that pick it. */
	languageIds: string[];
}

export const COMPILERS: Compiler[] = [
	{ id: 'python-3.14', name: 'Python 3.14', extensions: ['.py', '.pyw'], languageIds: ['python'] },
	{ id: 'python-3.14-pandas2', name: 'Python 3.14 (pandas 2)', extensions: [], languageIds: [] },
	{ id: 'duckdb-1.5', name: 'SQL (DuckDB 1.5)', extensions: [], languageIds: [] },
	{ id: 'gcc-15', name: 'C (gcc 15)', extensions: ['.c'], languageIds: ['c'] },
	{ id: 'g++-15', name: 'C++ (g++ 15)', extensions: ['.cpp', '.cc', '.cxx', '.c++'], languageIds: ['cpp'] },
	{ id: 'g++-15-cpp20', name: 'C++20 (g++ 15)', extensions: [], languageIds: [] },
	{ id: 'openjdk-25', name: 'Java 25', extensions: ['.java'], languageIds: ['java'] },
	{ id: 'dotnet-csharp-10', name: 'C# (.NET 10)', extensions: ['.cs'], languageIds: ['csharp'] },
	{ id: 'dotnet-fsharp-10', name: 'F# (.NET 10)', extensions: ['.fs', '.fsx'], languageIds: ['fsharp'] },
	{ id: 'php-8.5', name: 'PHP 8.5', extensions: ['.php'], languageIds: ['php'] },
	{ id: 'ruby-4.0', name: 'Ruby 4.0', extensions: ['.rb'], languageIds: ['ruby'] },
	{ id: 'haskell-9.12', name: 'Haskell 9.12', extensions: ['.hs'], languageIds: ['haskell'] },
	{ id: 'go-1.26', name: 'Go 1.26', extensions: ['.go'], languageIds: ['go'] },
	{ id: 'rust-1.93', name: 'Rust 1.93', extensions: ['.rs'], languageIds: ['rust'] },
	{ id: 'typescript-deno', name: 'TypeScript (Deno)', extensions: ['.ts'], languageIds: ['typescript'] },
	{ id: 'nodejs-24', name: 'JavaScript (Node.js 24)', extensions: ['.js', '.mjs', '.cjs'], languageIds: ['javascript'] },
	{ id: 'sqlite-3', name: 'SQL (SQLite 3)', extensions: ['.sql'], languageIds: ['sql'] },
	{ id: 'bash-5.2', name: 'Bash 5.2', extensions: ['.sh', '.bash'], languageIds: ['shellscript'] },
	{ id: 'gfortran-15', name: 'Fortran (gfortran 15)', extensions: ['.f90', '.f95', '.f03', '.f08'], languageIds: ['fortran', 'FortranFreeForm'] },
	{ id: 'dotnet-vbnet-10', name: 'Visual Basic (.NET 10)', extensions: ['.vb'], languageIds: ['vb'] },
	{ id: 'kotlin-2.4', name: 'Kotlin 2.4', extensions: ['.kt'], languageIds: ['kotlin'] },
	{ id: 'r-4.6', name: 'R 4.6', extensions: ['.r'], languageIds: ['r'] },
	{ id: 'swift-6.4', name: 'Swift 6.4', extensions: ['.swift'], languageIds: ['swift'] },
	{ id: 'gnucobol-3.2', name: 'COBOL (GnuCOBOL 3.2)', extensions: ['.cob', '.cbl', '.cobol'], languageIds: ['cobol', 'COBOL'] },
	{ id: 'perl-5.44', name: 'Perl 5.44', extensions: ['.pl'], languageIds: ['perl'] },
	{ id: 'julia-1.13', name: 'Julia 1.13', extensions: ['.jl'], languageIds: ['julia'] },
	{ id: 'fpc-3.2', name: 'Pascal (Free Pascal 3.2)', extensions: ['.pas', '.pp'], languageIds: ['pascal', 'objectpascal'] },
	{ id: 'octave-11', name: 'Octave 11', extensions: ['.m'], languageIds: ['octave', 'matlab'] },
	{ id: 'nasm-3', name: 'Assembly (NASM 3)', extensions: ['.asm', '.nasm'], languageIds: ['nasm'] },
	{ id: 'lua-5.5', name: 'Lua 5.5', extensions: ['.lua'], languageIds: ['lua'] },
	{ id: 'ocaml-5.4', name: 'OCaml 5.4', extensions: ['.ml'], languageIds: ['ocaml'] },
	{ id: 'sbcl-2.6', name: 'Common Lisp (SBCL 2.6)', extensions: ['.lisp', '.lsp'], languageIds: ['commonlisp', 'lisp'] },
	{ id: 'erlang-29', name: 'Erlang (OTP 29)', extensions: ['.erl'], languageIds: ['erlang'] },
	{ id: 'elixir-1.20', name: 'Elixir 1.20', extensions: ['.exs', '.ex'], languageIds: ['elixir'] },
	{ id: 'swipl-10', name: 'Prolog (SWI-Prolog 10)', extensions: ['.pl'], languageIds: ['prolog'] },
	{ id: 'ldc-1.43', name: 'D (LDC 1.43)', extensions: ['.d'], languageIds: ['d'] },
	{ id: 'fbc-1.10', name: 'FreeBASIC 1.10', extensions: ['.bas'], languageIds: ['freebasic'] },
	{ id: 'dart-3.13', name: 'Dart 3.13', extensions: ['.dart'], languageIds: ['dart'] },
	{ id: 'clojure-1.12', name: 'Clojure 1.12', extensions: ['.clj'], languageIds: ['clojure'] },
	{ id: 'groovy-6.0', name: 'Groovy 6.0', extensions: ['.groovy', '.gvy'], languageIds: ['groovy'] },
	{ id: 'scala-3.10', name: 'Scala 3.10', extensions: ['.scala', '.sc'], languageIds: ['scala'] },
	{ id: 'zig-0.17', name: 'Zig 0.17', extensions: ['.zig'], languageIds: ['zig'] },
	{ id: 'nim-2.2', name: 'Nim 2.2', extensions: ['.nim'], languageIds: ['nim'] },
	{ id: 'crystal-1.22', name: 'Crystal 1.22', extensions: ['.cr'], languageIds: ['crystal'] },
	{ id: 'gnat-15', name: 'Ada (GNAT 15)', extensions: ['.adb', '.ada'], languageIds: ['ada'] },
	{ id: 'powershell-7.6', name: 'PowerShell 7.6', extensions: ['.ps1'], languageIds: ['powershell'] },
	{ id: 'racket-9.3', name: 'Racket 9.3', extensions: ['.rkt'], languageIds: ['racket'] },
	{ id: 'clang-objc-21', name: 'Objective-C (Clang 21)', extensions: ['.m'], languageIds: ['objective-c'] },
];

/** The lower-case extension of a file name or path, with its dot ("" if it has none). */
export function extensionOf(fileName: string): string {
	const base = fileName.split(/[\\/]/).pop() ?? '';
	const dot = base.lastIndexOf('.');
	return dot > 0 ? base.slice(dot).toLowerCase() : '';
}

/**
 * The compiler id a file runs with by default: by its extension, with the language mode settling an
 * extension two languages share, or by the language mode alone (an untitled file, or an extension
 * this list doesn't know). undefined when neither names a language OnlineCompiler.io runs.
 */
export function defaultCompiler(fileName: string, languageId?: string): string | undefined {
	const extension = extensionOf(fileName);
	const byExtension = extension ? COMPILERS.filter((c) => c.extensions.includes(extension)) : [];
	const byLanguage = languageId ? COMPILERS.find((c) => c.languageIds.includes(languageId)) : undefined;
	if (byExtension.length > 0) {
		return byLanguage && byExtension.includes(byLanguage) ? byLanguage.id : byExtension[0].id;
	}
	return byLanguage?.id;
}

/** The built-in compiler with this id, if there is one. */
export function compilerById(id: string): Compiler | undefined {
	return COMPILERS.find((c) => c.id === id);
}

/** Every extension and language id that has a default compiler, for the editor title bar's run button. */
export function runnableExtensions(): string[] {
	return [...new Set(COMPILERS.flatMap((c) => c.extensions))];
}

export function runnableLanguageIds(): string[] {
	return [...new Set(COMPILERS.flatMap((c) => c.languageIds))];
}
