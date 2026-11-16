# OnlineCompiler.io for VS Code

Run code in 46 languages without installing compilers. Press `Ctrl+Alt+R` (`Cmd+Alt+R` on macOS) and the current file runs on [OnlineCompiler.io](https://onlinecompiler.io). Its output, errors, exit code, time and memory appear in the **OnlineCompiler.io** output panel.

Extensions that run code on your machine need each compiler or interpreter installed and set up first. This one sends the file to the OnlineCompiler.io API instead, so Python, Java, C++, Rust, Go, COBOL, Haskell and the rest run the same way on any computer, with nothing else to install.

## Features

- Run the current file, or only the selected lines.
- 46 languages, picked from the file extension. Choose another compiler for a file with **OnlineCompiler: Choose Language**.
- Standard input from `main.py.in` or `input.txt` beside the file, or typed in when you run.
- Output, stderr, exit code, run time and memory, with a clear line when output was cut short.
- A run button in the editor title bar, a status bar item while the file runs, and a way to stop waiting.
- Your API key is kept in VS Code's secret storage.
- No telemetry.

## Get started

1. Get a free API key: sign in with Google or GitHub at [api.onlinecompiler.io/compilers/api-keys](https://api.onlinecompiler.io/compilers/api-keys/). Your first key is made for you; copy it.
2. In VS Code, run **OnlineCompiler: Set API Key** from the Command Palette (`Ctrl+Shift+P`) and paste the key. Or run a file straight away: the first run asks for a key, with **Get a free key** and **Enter key** buttons.
3. Open a file, such as `main.py`, and press `Ctrl+Alt+R` (`Cmd+Alt+R` on macOS) or click the run button in the editor title bar.

The Free plan needs no card. See [pricing](https://onlinecompiler.io/pricing) for plans and [limits](https://onlinecompiler.io/docs/limits) for how long a run may take and how much memory it gets.

## Running a file

The extension sends the editor's text, unsaved changes included, or only the selection when there is one. Nothing is saved for you. The result appears in the **OnlineCompiler.io** output panel:

```
[Running] main.py with python-3.14, stdin from main.py.in
Hello, World!

[Done] exit code 0, time 0.025 s, memory 8.0 MB
```

- Compile errors and anything the program writes to stderr appear under `[stderr]`.
- The summary line explains the sandbox's own exit codes: 124 (time limit reached), 137 (memory limit), 153 (too much output) and 71 (too many processes).
- When the output or stderr is longer than the API returns, a `[Truncated]` line says so.
- While a file runs, the status bar shows it. Click that item, or the stop button in the title bar, to stop waiting. The extension also stops waiting after 60 seconds.
- Programs run on Linux, so Windows line endings in the code and input are sent as plain `\n`.
- Every run counts as one run on your plan, as it would through the API.

## Input (stdin)

The extension looks for input in this order:

1. A file named after the source file plus `.in`, in the same folder: `main.py.in` for `main.py`, `Main.java.in` for `Main.java`.
2. `input.txt` in the same folder.
3. Neither: the program gets no input. Turn on `onlinecompiler.askForInput` to type a line of input before each run instead. For input of several lines, use an input file.

If the input file is open with unsaved changes, the editor's text is sent.

## Choosing the language

Each file runs with the compiler its extension maps to (table below). Untitled files, and files with an extension the table doesn't list, use the editor's language mode. Two extensions are shared: `.m` runs as Objective-C when the language mode is Objective-C (the VS Code default) and as Octave when a MATLAB or Octave extension sets the mode; `.pl` runs as Perl unless the mode is Prolog.

Run **OnlineCompiler: Choose Language** to pick another compiler for the current file, such as C++20 (`g++-15-cpp20`), Python with pandas 2 (`python-3.14-pandas2`) or DuckDB SQL (`duckdb-1.5`). The choice lasts until VS Code restarts. A file with no default asks for a language on its first run.

## Commands

| Command | Keybinding | What it does |
| --- | --- | --- |
| OnlineCompiler: Run File | `Ctrl+Alt+R` (`Cmd+Alt+R` on macOS) | Runs the current file, or the selection |
| OnlineCompiler: Choose Language | | Picks the compiler for the current file |
| OnlineCompiler: Set API Key | | Saves your API key; leave the box empty to remove a saved key |
| OnlineCompiler: Stop Run | | Stops waiting for the run in progress |

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `onlinecompiler.apiBase` | `https://api.onlinecompiler.io` | Base URL of the API. Only your user settings can change it, so a workspace cannot send your code or key elsewhere. |
| `onlinecompiler.askForInput` | `false` | Ask for a line of input before each run when there is no input file. |
| `onlinecompiler.clearOutput` | `true` | Clear the output panel before each run. |

## Supported languages

<!-- languages:start -->
| Language | Compiler id | Runs by default for |
| --- | --- | --- |
| Python 3.14 | `python-3.14` | `.py` `.pyw` |
| Python 3.14 (pandas 2) | `python-3.14-pandas2` | Choose Language |
| SQL (DuckDB 1.5) | `duckdb-1.5` | Choose Language |
| C (gcc 15) | `gcc-15` | `.c` |
| C++ (g++ 15) | `g++-15` | `.cpp` `.cc` `.cxx` `.c++` |
| C++20 (g++ 15) | `g++-15-cpp20` | Choose Language |
| Java 25 | `openjdk-25` | `.java` |
| C# (.NET 10) | `dotnet-csharp-10` | `.cs` |
| F# (.NET 10) | `dotnet-fsharp-10` | `.fs` `.fsx` |
| PHP 8.5 | `php-8.5` | `.php` |
| Ruby 4.0 | `ruby-4.0` | `.rb` |
| Haskell 9.12 | `haskell-9.12` | `.hs` |
| Go 1.26 | `go-1.26` | `.go` |
| Rust 1.93 | `rust-1.93` | `.rs` |
| TypeScript (Deno) | `typescript-deno` | `.ts` |
| JavaScript (Node.js 24) | `nodejs-24` | `.js` `.mjs` `.cjs` |
| SQL (SQLite 3) | `sqlite-3` | `.sql` |
| Bash 5.2 | `bash-5.2` | `.sh` `.bash` |
| Fortran (gfortran 15) | `gfortran-15` | `.f90` `.f95` `.f03` `.f08` |
| Visual Basic (.NET 10) | `dotnet-vbnet-10` | `.vb` |
| Kotlin 2.4 | `kotlin-2.4` | `.kt` |
| R 4.6 | `r-4.6` | `.r` |
| Swift 6.4 | `swift-6.4` | `.swift` |
| COBOL (GnuCOBOL 3.2) | `gnucobol-3.2` | `.cob` `.cbl` `.cobol` |
| Perl 5.44 | `perl-5.44` | `.pl` |
| Julia 1.13 | `julia-1.13` | `.jl` |
| Pascal (Free Pascal 3.2) | `fpc-3.2` | `.pas` `.pp` |
| Octave 11 | `octave-11` | `.m` |
| Assembly (NASM 3) | `nasm-3` | `.asm` `.nasm` |
| Lua 5.5 | `lua-5.5` | `.lua` |
| OCaml 5.4 | `ocaml-5.4` | `.ml` |
| Common Lisp (SBCL 2.6) | `sbcl-2.6` | `.lisp` `.lsp` |
| Erlang (OTP 29) | `erlang-29` | `.erl` |
| Elixir 1.20 | `elixir-1.20` | `.exs` `.ex` |
| Prolog (SWI-Prolog 10) | `swipl-10` | `.pl` |
| D (LDC 1.43) | `ldc-1.43` | `.d` |
| FreeBASIC 1.10 | `fbc-1.10` | `.bas` |
| Dart 3.13 | `dart-3.13` | `.dart` |
| Clojure 1.12 | `clojure-1.12` | `.clj` |
| Groovy 6.0 | `groovy-6.0` | `.groovy` `.gvy` |
| Scala 3.10 | `scala-3.10` | `.scala` `.sc` |
| Zig 0.17 | `zig-0.17` | `.zig` |
| Nim 2.2 | `nim-2.2` | `.nim` |
| Crystal 1.22 | `crystal-1.22` | `.cr` |
| Ada (GNAT 15) | `gnat-15` | `.adb` `.ada` |
| PowerShell 7.6 | `powershell-7.6` | `.ps1` |
| Racket 9.3 | `racket-9.3` | `.rkt` |
| Objective-C (Clang 21) | `clang-objc-21` | `.m` |
<!-- languages:end -->

The [compilers page](https://onlinecompiler.io/docs/compilers) has each one's compile command, packages and typical run time.

## Privacy

- When you run a file, its code (or the selection) and its input are sent over HTTPS to the OnlineCompiler.io API. Nothing is sent at any other time, except that **Choose Language** fetches the list of compilers, which carries no code and no key.
- The code runs in an isolated sandbox with no network access.
- Each run is kept as execution history in your OnlineCompiler.io dashboard for a limited time, as the [privacy policy](https://onlinecompiler.io/privacy) describes.
- The extension collects no telemetry. Its requests name the extension and VS Code versions in the `User-Agent` header.
- Your API key is stored with VS Code's secret storage (your system's keychain) and is sent only to the API, in the `Authorization` header.

## Links

- [OnlineCompiler.io](https://onlinecompiler.io)
- [API documentation](https://onlinecompiler.io/docs)
- [API keys](https://api.onlinecompiler.io/compilers/api-keys/)
- [Pricing](https://onlinecompiler.io/pricing)
- [Report a problem](https://github.com/onlinecompiler-io/onlinecompiler-vscode/issues)

## Development

```sh
npm install
npm run check      # type check
npm test           # unit tests; with ONLINECOMPILER_API_KEY set, also a run on the live API
npm run test:e2e   # runs the extension inside VS Code against a local fake API
npm run package    # builds onlinecompiler-<version>.vsix
```

`npm run readme` rewrites the languages table above from `src/languages.ts`.

## License

MIT. Copyright (c) 2026 RunCode Inc.
