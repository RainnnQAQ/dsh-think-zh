# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-11-09

### Added

- System-prompt section `think-zh:thinking-language` at `order: 10250` that mandates Simplified Chinese reasoning, forbids English reasoning openers, and keeps code, commands, paths and error messages verbatim.
- Per-turn runtime reminder `think-zh:reminder` at `order: 900` that survives long contexts, compaction and preset switches.
- `system-prompt/assemble` guard that restores both segments when another plugin rewrites the assembly and removes only its own segments when disabled.
- Settings panel under Built-in plugins (`settings.plugins.tab`, id `think-zh`, order 50) with live preview of the injected prompt.
- Host HTTP API `/api/think-zh/status`, `/api/think-zh/set`, `/api/think-zh/reset`.
- Runtime configuration file `$DSH_HOME/think-zh.json` overriding bundle defaults.
- `install.mjs` with profile auto-detection, `--list`, `--all`, `--profile`, `--mode bundle|patch`, `--remove`, and `.bak` backups.
- Mobile support for Android DSHA: 40px touch targets, 16px inputs, safe-area padding, no `color-mix`, fully fluid width.
- Self-test (39 checks), host probe (19 checks) and real-cordis end-to-end test (12 checks).
- Documentation: `README.md`.

### Notes

- The plugin has no chat command; all controls live in the settings panel, the HTTP API and `$DSH_HOME/think-zh.json`.
