# Periodic Links

Automatically link between periodic notes with natural language.

## Features

- **Natural Language Linking**: Type phrases like "tomorrow", "next week", "last month", etc. and automatically create links to the corresponding periodic notes
- **Smart Detection**: Only works in periodic notes themselves, intelligently detecting note types based on format, folder, or properties
- **Compatible with Core Plugins**: Works with Obsidian's core Daily Notes plugin and the Periodic Notes community plugin
- **Smart Linking**: Creates links to periodic notes (existing or not)
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

The plugin automatically detects your periodic note configurations. You can customize:

- **Detection Methods**: Choose how to identify periodic notes (format, folder, properties)
- **Cleanup Commands**: Remove broken links when formats change

## Usage Examples

In a daily note:
- Type `tomorrow` → Links to tomorrow's daily note
- Type `next week` → Links to next week's weekly note (if weekly notes enabled)

In a weekly note:
- Type `last week` → Links to previous week's note
- Type `next month` → Links to next month's monthly note

## Compatibility

- ✅ **Daily Notes** (core plugin)
- ✅ **Periodic Notes** (community plugin)
- ✅ **Calendar** plugin weekly notes
- ✅ Custom date formats
- ✅ Folder-based organization

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