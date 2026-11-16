# Changelog

## 0.1.0

First release.

- **OnlineCompiler: Run File** (`Ctrl+Alt+R`, `Cmd+Alt+R` on macOS, or the run button in the editor title bar) sends the current file, or the selection, to the OnlineCompiler.io API and shows its output, stderr, exit code, time and memory in the OnlineCompiler.io output panel, with a clear line when output was cut short.
- Standard input comes from `<file>.in` or `input.txt` beside the file, or, with `onlinecompiler.askForInput`, from an input box.
- **OnlineCompiler: Set API Key** keeps the key in VS Code's secret storage. The first run without a key offers to get a free one or enter one.
- **OnlineCompiler: Choose Language** picks another compiler for the current file until VS Code restarts.
- 46 languages, each picked by file extension or the editor's language mode.
- A status bar item while a file runs, **OnlineCompiler: Stop Run**, and a 60 second timeout.
- Settings: `onlinecompiler.apiBase`, `onlinecompiler.askForInput` and `onlinecompiler.clearOutput`.
- No telemetry.
