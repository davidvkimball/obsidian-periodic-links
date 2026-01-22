import { Plugin, Notice, MarkdownView, Editor, EditorPosition } from 'obsidian';
import { PeriodicLinksSettings, DEFAULT_SETTINGS, PeriodicLinksSettingTab } from './settings';
import { PeriodicNoteDetector } from './periodic-note-detector';
import { NaturalLanguageParser } from './natural-language-parser';
import { LinkCreator } from './link-creator';

export default class PeriodicLinksPlugin extends Plugin {
	settings: PeriodicLinksSettings;
	detector: PeriodicNoteDetector;
	parser: NaturalLanguageParser;
	linkCreator: LinkCreator;

	async onload() {
		await this.loadSettings();

		// Initialize core components
		this.detector = new PeriodicNoteDetector(this.app);
		this.parser = new NaturalLanguageParser();
		this.linkCreator = new LinkCreator(this.app, this.detector);

		// Register editor change event to handle natural language linking
		this.registerEvent(
			this.app.workspace.on('editor-change', (editor: Editor, info: MarkdownView) => {
				void this.handleEditorChange(editor, info);
			})
		);

		// Add settings tab
		this.addSettingTab(new PeriodicLinksSettingTab(this.app, this));

		// Add cleanup command
		this.addCommand({
			id: 'cleanup-broken-links',
			name: 'Clean up broken periodic note links',
			callback: () => this.cleanupBrokenLinks()
		});
	}

	onunload() {
		// Cleanup will be handled by Obsidian's plugin system
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<PeriodicLinksSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private async handleEditorChange(editor: Editor, view: MarkdownView) {
		if (!view.file) return;

		// Only process if this is a periodic note
		const periodicType = this.detector.detectPeriodicType(view.file);
		if (!periodicType) return;

		const cursor = editor.getCursor();
		const currentLine = editor.getLine(cursor.line) || '';

		// Check if user just typed a space after a natural language phrase
		const match = this.findNaturalLanguagePhrase(currentLine, cursor);
		if (!match) return;

		const { phrase, trailing, start, end } = match;

		// Parse the natural language phrase (use the matched phrase as-is for parsing)
		const parsedPhrase = phrase.toLowerCase(); // Still need lowercase for parsing logic
		const linkTarget = this.parser.parsePhrase(parsedPhrase, periodicType, view.file);
		if (!linkTarget) return;

		// Create the link using the original capitalization
		const linkText = await this.linkCreator.createLink(linkTarget, phrase);
		if (!linkText) return;

		// Replace the phrase with the link
		const lineStart = { line: cursor.line, ch: start };
		const lineEnd = { line: cursor.line, ch: end };

		// Add appropriate spacing based on what was originally after the phrase
		let replacement = linkText;
		if (trailing.includes(' ')) {
			// Original had a space, so add a space after the link
			replacement += ' ';
		} else if (trailing.match(/[.,;:!?]/)) {
			// Original had punctuation that typically gets a space after, so add a space
			replacement += ' ';
		}
		// If trailing contains quotes or other punctuation that doesn't need space, don't add one

		editor.replaceRange(replacement, lineStart, lineEnd);
	}

	private findNaturalLanguagePhrase(line: string, cursor: EditorPosition): { phrase: string, trailing: string, start: number, end: number } | null {
		// Look for natural language phrases ending with punctuation or space
		const phrases = [
			'yesterday', 'tomorrow', 'last week', 'next week', 'this week',
			'last month', 'next month', 'this month',
			'last quarter', 'next quarter', 'this quarter',
			'last year', 'next year', 'this year'
		];

		// Also support "X days/weeks/months ago" and "in X days/weeks/months"
		const dynamicPatterns = [
			/(\d+)\s+(days?|weeks?|months?|quarters?|years?)\s+ago\b/i,
			/in\s+(\d+)\s+(days?|weeks?|months?|quarters?|years?)\b/i,
			/(\d+)\s+(days?|weeks?|months?|quarters?|years?)\s+from\s+now\b/i
		];

		// Check for cursor position being after punctuation/space that follows a phrase
		const beforeCursor = line.substring(0, cursor.ch);

		// Check static phrases - match phrase followed by punctuation, space, or end of line
		for (const phrase of phrases) {
			const pattern = new RegExp(`\\b${phrase}([\\s.,;:!?"']*)$`, 'i');
			const match = beforeCursor.match(pattern);
			if (match && match.index !== undefined) {
				const start = match.index;
				const end = start + match[0].length;
				const fullMatch = match[0];
				const trailing = match[1] || ''; // The captured trailing characters
				// Return the actual matched text with original capitalization, trimmed of trailing chars
				const matchedText = fullMatch.replace(/[\s.,;:!?"']+$/, '');
				return { phrase: matchedText, trailing, start, end };
			}
		}

		// Check dynamic patterns - match phrase followed by punctuation, space, or end of line
		for (const pattern of dynamicPatterns) {
			const punctuatedPattern = new RegExp(pattern.source.replace(/\\b$/, '([\\s.,;:!?"\']*)$'), 'i');
			const match = beforeCursor.match(punctuatedPattern);
			if (match && match.index !== undefined) {
				const fullMatch = match[0];
				const trailing = match[match.length - 1] || ''; // Last capture group
				const start = match.index;
				const end = start + match[0].length;
				const matchedText = fullMatch.replace(/[\s.,;:!?"']+$/, '');
				return { phrase: matchedText, trailing, start, end };
			}
		}

		return null;
	}

	private async cleanupBrokenLinks() {
		const files = this.app.vault.getMarkdownFiles();
		let cleanedCount = 0;

		for (const file of files) {
			const content = await this.app.vault.read(file);
			const lines = content.split('\n');
			let modified = false;

			for (let i = 0; i < lines.length; i++) {
				const line = lines[i] || '';
				// Look for broken periodic links - links that point to non-existent periodic notes
				const linkRegex = /\[\[([^\]]+)\]\]/g;
				let match;

				while ((match = linkRegex.exec(line)) !== null) {
					const linkText = match[1];
					if (!linkText || typeof linkText !== 'string') continue;

					const filePath = this.app.metadataCache.getFirstLinkpathDest(linkText, file.path);

					if (!filePath) {
						// Check if this looks like a periodic note link that should exist
						const periodicType = this.detector.detectPeriodicType(file);
						if (periodicType && this.looksLikePeriodicLink(linkText, periodicType) && match.index !== undefined && match[0]) {
							// Remove the broken link
							const beforeLink = line.substring(0, match.index);
							const afterLink = line.substring(match.index + match[0].length);
							lines[i] = beforeLink + linkText + afterLink;
							modified = true;
						}
					}
				}
			}

			if (modified) {
				await this.app.vault.modify(file, lines.join('\n'));
				cleanedCount++;
			}
		}

		new Notice(`Cleaned up broken links in ${cleanedCount} files`);
	}

	private looksLikePeriodicLink(linkText: string, currentType: string): boolean {
		// Simple heuristic: check if the link text contains date-like patterns
		const datePatterns = [
			/\d{4}-\d{2}-\d{2}/,  // YYYY-MM-DD
			/\d{4}-W\d{2}/,       // YYYY-WWW
			/\d{4}-\d{2}/,        // YYYY-MM
			/\d{4}-Q\d/,          // YYYY-QX
			/\d{4}/               // YYYY
		];

		return datePatterns.some(pattern => pattern.test(linkText));
	}
}
