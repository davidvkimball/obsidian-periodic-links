---
name: project
description: Project-specific architecture, maintenance tasks, and unique conventions for Periodic Links.
---

# Periodic Links Project Skill

Automatically link between periodic notes with natural language. This plugin automates the navigation between Daily, Weekly, Monthly, Quarterly, and Yearly notes by detecting date patterns and creating bi-directional links.

## Core Architecture

- **Natural Language Parsing**: Includes logic to parse date strings and relative time references.
- **Periodic Note Integration**: Heavily dependent on the "Periodic Notes" core or community plugin structure.
- **Link Orchestration**: Automates the creation and maintenance of date-based internal links.

## Project-Specific Conventions

- **Date-Centric Logic**: All operations revolve around moment-based date calculations.
- **Workflow Automation**: Designed to be a "set and forget" plugin that maintains vault cross-linking.
- **Mobile Compatible**: Focused on plain-text/metadata operations without complex UI requirements.

## Key Files

- `src/main.ts`: Main link detection and creation logic.
- `manifest.json`: Plugin registration and id (`periodic-links`).
- `esbuild.config.mjs`: Build script for the logic-heavy plugin.

## Maintenance Tasks

- **Link Persistence**: Verify that links remain valid when periodic note naming schemes change.
- **Moment Audit**: Track Moment.js usage for compatibility with latest Obsidian internal libraries.
- **Overlap Detection**: Ensure logic handles transitions between different periods (e.g., Daily to Weekly) correctly.
