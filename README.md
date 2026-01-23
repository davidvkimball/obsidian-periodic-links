# Periodic Links

Automatically link between periodic notes with natural language.

## Features

- **Natural Language Linking**: Type phrases like "tomorrow", "next week", "last month", etc. and automatically create links to the corresponding periodic notes
- **Smart Detection**: Only works in periodic notes themselves, intelligently detecting note types based on filename format
- **Immediate Note Creation**: Creates notes with proper templates and folder structure applied
- **Written Number Support**: Supports phrases like "in two weeks", "three months ago"
- **Weekday-Specific Phrases**: "next Thursday", "2 Sundays from now", "last Tuesday"
- **Compatible with Core Plugins**: Works with Obsidian's core Daily Notes plugin and the Periodic Notes community plugin
- **Format Agnostic**: Adapts to your configured date formats for daily, weekly, monthly, quarterly, and yearly notes

## How It Works

When you're editing a periodic note, typing natural language phrases will automatically create links:

- **Daily notes**: `yesterday`, `tomorrow`, `2 days ago`, `in 3 days`
- **Weekly notes**: `last week`, `next week`, `this week`, `2 weeks ago`
- **Monthly notes**: `last month`, `next month`, `in 2 months`
- **Quarterly notes**: `last quarter`, `next quarter`, `Q1 2025`
- **Yearly notes**: `last year`, `next year`, `2025`

## Installation

### From Obsidian Community Plugins

1. Open Settings → Community plugins
2. Browse and search for "Periodic Links"
3. Install and enable the plugin

### Manual Installation

1. Download the latest release
2. Extract files to `VaultFolder/.obsidian/plugins/periodic-links/`
3. Reload Obsidian and enable the plugin

## Requirements

- **Obsidian** v1.11.0 or higher
- **Daily Notes** core plugin or **Periodic Notes** community plugin must be configured

## Settings

### Note Creation Mode
Choose how links to non-existing notes are handled:
- **Create notes immediately** (recommended): Creates notes with templates applied
- **Create links to non-existing notes**: Creates wiki links (templates won't apply)

### Natural Language Settings
- **Enable natural language**: Master toggle for all phrase recognition
- **Enable written numbers**: Support phrases like "in two weeks"
- **Enable extended phrases**: Support relative phrases like "3 days ago"

### Work Scope
Control where natural language parsing works:
- **Only in current periodic note type**: Conservative mode
- **Across all periodic note types** (recommended): Allows cross-type linking
- **In any file**: Works everywhere (uses current date as reference)

### Strict Folder Check
When enabled, requires notes to match both format AND folder location for stricter validation.

## Usage Examples

### Basic Phrases
- `yesterday`, `tomorrow` → Daily notes
- `last week`, `next week`, `this week` → Weekly notes
- `last month`, `next month`, `this month` → Monthly notes
- `last quarter`, `next quarter`, `this quarter` → Quarterly notes
- `last year`, `next year`, `this year` → Yearly notes

### Extended Phrases
- `2 days ago`, `in 3 days` → Relative daily notes
- `5 weeks ago`, `in 2 weeks` → Relative weekly notes
- `3 months ago`, `in 6 months` → Relative monthly notes
- `2 quarters ago`, `in 1 quarter` → Relative quarterly notes
- `5 years ago`, `in 10 years` → Relative yearly notes

### Written Numbers
- `in two days`, `three weeks ago`, `five months from now`
- `in eighteen years`, `twenty quarters ago`

### Weekday-Specific
- `next Thursday`, `last Tuesday` → Next/previous occurrence of weekday
- `2 Sundays from now`, `three Mondays ago` → Nth occurrence of weekday
- `in 2 Fridays`, `in three Mondays` → Nth occurrence of weekday (future only)
- All weekday patterns support both singular (`Friday`) and plural (`Fridays`) forms

### Context-Aware
The plugin detects your current note type and creates appropriate links:
- In a daily note: `next week` creates weekly note links
- In a weekly note: `next month` creates monthly note links
- In a monthly note: `next year` creates yearly note links

## Compatibility

- ✅ **Daily Notes** (core plugin)
- ✅ **Periodic Notes** (community plugin)
- ✅ **Calendar** plugin weekly notes
- ✅ Custom date formats
- ✅ Folder-based organization

## Troubleshooting

### Phrases not working?
- Ensure you're editing a periodic note (daily, weekly, monthly, quarterly, or yearly)
- Check that the corresponding periodic note type is enabled in your settings
- Type a space or punctuation after the phrase to trigger linking
- Verify "Enable natural language" is turned on in plugin settings

### Wrong dates being linked?
- Check your periodic notes format settings match your actual note filenames
- The plugin detects note types by filename format (e.g., `2026-01-22.md` for daily notes)
- Use "Strict folder check" if you organize notes in specific folders

### Templates not applying?
- Use "Create notes immediately" mode for proper template application
- "Create links to non-existing notes" mode won't apply templates

### Performance issues?
- The plugin uses debounced processing (150ms delay) to avoid lag during typing
- If you experience issues, try disabling other plugins temporarily

## Contributing

This plugin is developed with AI assistance using the OpenSkills system. See `AGENTS.md` for development guidance.

## Credits

Inspired by and compatible with:
- [Periodic Notes](https://github.com/liamcain/obsidian-periodic-notes) - Core periodic note functionality
- [Auto Periodic Notes](https://github.com/jamiefdhurst/obsidian-auto-periodic-notes) - Automatic note creation
- [Memos Sync](https://github.com/RyoJerryYu/obsidian-memos-sync) - Integration patterns
- [Repeat Plugin](https://github.com/prncc/obsidian-repeat-plugin) - Spaced repetition concepts

## Support

- **Issues**: [GitHub Issues](https://github.com/davidvkimball/obsidian-periodic-links/issues)
- **Funding**: [Patreon](https://patreon.com/davidvkimball)

## License

MIT License - see LICENSE file for details.