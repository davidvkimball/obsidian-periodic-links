import { Plugin, MarkdownView, Editor, EditorPosition } from 'obsidian';
import { PeriodicLinksSettings, DEFAULT_SETTINGS, PeriodicLinksSettingTab } from './settings';
import { PeriodicNoteDetector } from './periodic-note-detector';
import { NaturalLanguageParser } from './natural-language-parser';
import { LinkCreator } from './link-creator';

// Simple debounce utility
function debounce<T extends (...args: unknown[]) => void>(func: T, wait: number): (...args: Parameters<T>) => void {
	let timeout: ReturnType<typeof setTimeout>;
	return (...args: Parameters<T>) => {
		clearTimeout(timeout);
		timeout = setTimeout(() => func(...args), wait);
	};
}

import { PeriodicNoteType } from './periodic-note-detector';

export default class PeriodicLinksPlugin extends Plugin {
	settings: PeriodicLinksSettings;
	detector: PeriodicNoteDetector;
	parser: NaturalLanguageParser;
	linkCreator: LinkCreator;

	// Cache for periodic note type
	private cachedType: { path: string; type: PeriodicNoteType | null } | null = null;



	async onload() {
		try {
			const savedData = await this.loadData() as Partial<PeriodicLinksSettings>;
			this.settings = Object.assign({}, DEFAULT_SETTINGS, savedData);

			// Initialize core components
			this.detector = new PeriodicNoteDetector(this.app, this.settings.strictFolderCheck);
			this.parser = new NaturalLanguageParser();
			this.linkCreator = new LinkCreator(this.app, this.detector);
		} catch (error) {
			console.error('Periodic Links plugin failed to load:', error);
		}

		// Register editor change event to handle natural language linking (debounced for performance)
		const debouncedHandleEditorChange = debounce(
			(editor: Editor, info: unknown) => void this.handleEditorChange(editor, info as MarkdownView),
			50 // 50ms debounce for responsiveness
		);

		this.registerEvent(
			this.app.workspace.on('editor-change', (editor, info) => {
				debouncedHandleEditorChange(editor, info);
			})
		);

		// Add manual conversion command
		this.addCommand({
			id: 'convert-phrase-to-periodic-link',
			name: 'Convert phrase to periodic link',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				await this.handleManualConversion(editor, view);
			},
		});

		// Add settings tab
		this.addSettingTab(new PeriodicLinksSettingTab(this.app, this));

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

		// Check if we're in a periodic note (with caching)
		let currentType: PeriodicNoteType | null;
		if (this.cachedType && this.cachedType.path === view.file.path) {
			currentType = this.cachedType.type;
		} else {
			currentType = this.detector.detectPeriodicType(view.file);
			this.cachedType = { path: view.file.path, type: currentType };
		}

		if (!currentType && this.settings.workScope !== 'everywhere') return;


		// Check if natural language parsing is enabled
		if (!this.settings.enableNaturalLanguage) return;

		const cursor = editor.getCursor();
		const currentLine = editor.getLine(cursor.line) || '';

		// Check if user just typed a space/punctuation after a natural language phrase
		const match = this.findNaturalLanguagePhrase(currentLine, cursor);
		if (!match) return;

		const { phrase, trailing, start, end } = match;

		// Parse the natural language phrase
		const parsedPhrase = phrase.toLowerCase();
		const workEverywhere = this.settings.workScope === 'everywhere';
		const workAcrossAllPeriodicNotes = this.settings.workScope === 'all-periodic';
		const linkTarget = this.parser.parsePhrase(parsedPhrase, currentType, view.file, this.settings.enableWrittenNumbers, workAcrossAllPeriodicNotes, workEverywhere);
		if (!linkTarget) return;

		// Create the link
		const linkText = await this.linkCreator.createLink(linkTarget, phrase);
		if (!linkText) return;

		// Replace the phrase with the link
		const lineStart = { line: cursor.line, ch: start };
		const lineEnd = { line: cursor.line, ch: end };

		// Add appropriate spacing
		let replacement = linkText;
		if (trailing.includes(' ') || trailing.includes('\n')) {
			replacement += trailing.includes(' ') ? ' ' : '\n';
		} else if (trailing.match(/[.,;:!?\]\)"']/)) {
			replacement += ' ';
		}

		editor.replaceRange(replacement, lineStart, lineEnd);
	}

	private async handleManualConversion(editor: Editor, view: MarkdownView) {
		if (!view.file) return;

		const cursor = editor.getCursor();
		let phrase: string;
		let start: number;
		let end: number;

		const selection = editor.getSelection();
		if (selection) {
			phrase = selection;
			const from = editor.getCursor('from');
			const to = editor.getCursor('to');
			start = from.ch;
			end = to.ch;
		} else {
			// Find phrase at cursor if no selection
			const line = editor.getLine(cursor.line);
			const match = this.findPhraseAtCursor(line, cursor);
			if (!match) return;
			phrase = match.phrase;
			start = match.start;
			end = match.end;
		}

		// Use caching for periodic note type
		let currentType: PeriodicNoteType | null;
		if (this.cachedType && this.cachedType.path === view.file.path) {
			currentType = this.cachedType.type;
		} else {
			currentType = this.detector.detectPeriodicType(view.file);
			this.cachedType = { path: view.file.path, type: currentType };
		}

		const workEverywhere = this.settings.workScope === 'everywhere';
		const workAcrossAllPeriodicNotes = this.settings.workScope === 'all-periodic';
		const linkTarget = this.parser.parsePhrase(phrase, currentType, view.file, this.settings.enableWrittenNumbers, workAcrossAllPeriodicNotes, workEverywhere);

		if (linkTarget) {
			const linkText = await this.linkCreator.createLink(linkTarget, phrase);
			if (linkText) {
				editor.replaceRange(linkText, { line: cursor.line, ch: start }, { line: cursor.line, ch: end });
			}
		}
	}

	private findPhraseAtCursor(line: string, cursor: EditorPosition): { phrase: string, start: number, end: number } | null {
		// This is a simplified version of findNaturalLanguagePhrase for manual conversion
		// It tries to find the word/phrase under the cursor
		const words = line.split(/(\s+)/);
		let currentCh = 0;
		for (let i = 0; i < words.length; i++) {
			const word = words[i];
			if (word && cursor.ch >= currentCh && cursor.ch <= currentCh + word.length && !word.match(/^\s+$/)) {
				// Check if it's a multi-word phrase (e.g., "last week")
				// For simplicity, we'll try to match against known patterns

				// Try static phrases first
				const staticPhrases = [
					'yesterday', 'tomorrow', 'last week', 'next week', 'this week',
					'last month', 'next month', 'this month',
					'last quarter', 'previous quarter', 'next quarter', 'this quarter',
					'last year', 'previous year', 'next year', 'this year'
				];

				for (const p of staticPhrases) {
					const regex = new RegExp(`\\b${p}\\b`, 'i');
					const match = line.match(regex);
					if (match && match.index !== undefined) {
						if (cursor.ch >= match.index && cursor.ch <= match.index + match[0].length) {
							return { phrase: match[0], start: match.index, end: match.index + match[0].length };
						}
					}
				}

				return { phrase: word.replace(/[.,;:!?\]\)"']+$/, ''), start: currentCh, end: currentCh + word.length };
			}
			if (word) {
				currentCh += word.length;
			}
		}
		return null;
	}


	private findNaturalLanguagePhrase(line: string, cursor: EditorPosition): { phrase: string, trailing: string, start: number, end: number } | null {
		// Check for cursor position being after punctuation/space that follows a phrase
		const beforeCursor = line.substring(0, cursor.ch);

		// Static phrases
		const staticPhrases = [
			'yesterday', 'tomorrow', 'last week', 'next week', 'this week',
			'last month', 'next month', 'this month',
			'last quarter', 'previous quarter', 'next quarter', 'this quarter',
			'last year', 'previous year', 'next year', 'this year',
			'this sunday', 'this monday', 'this tuesday', 'this wednesday',
			'this thursday', 'this friday', 'this saturday'
		];

		if (this.settings.enableNaturalLanguage) {
			// Check static phrases
			for (const phrase of staticPhrases) {
				const pattern = new RegExp(`\\b${phrase}([\\s.,;:!?"']*)$`, 'i');
				const match = beforeCursor.match(pattern);
				if (match && match.index !== undefined) {
					const start = match.index;
					const end = start + match[0].length;
					const fullMatch = match[0];
					const trailing = match[1] || '';
					const matchedText = fullMatch.replace(/[\s.,;:!?"']+$/, '');
					return { phrase: matchedText, trailing, start, end };
				}
			}

			// Dynamic patterns
			if (this.settings.enableExtendedPhrases) {
				const numberPattern = this.settings.enableWrittenNumbers
					? '(\\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)'
					: '(\\d+)';
				const unitPattern = '(days?|weeks?|months?|quarters?|years?)';
				const weekdayPattern = '(sundays|mondays|tuesdays|wednesdays|thursdays|fridays|saturdays|sunday|monday|tuesday|wednesday|thursday|friday|saturday)';

				const dynamicPatterns = [
					// Weekday patterns (check these first)
					new RegExp(`(next|last)\\s+${weekdayPattern}([\\s.,;:!?"']*)$`, 'i'),
					new RegExp(`${numberPattern}\\s+${weekdayPattern}\\s+(from\\s+now|ago)([\\s.,;:!?"']*)$`, 'i'),
					new RegExp(`in\\s+${numberPattern}\\s+${weekdayPattern}([\\s.,;:!?"']*)$`, 'i'),
					// General time patterns
					new RegExp(`${numberPattern}\\s+${unitPattern}\\s+ago([\\s.,;:!?"']*)$`, 'i'),
					new RegExp(`in\\s+${numberPattern}\\s+${unitPattern}([\\s.,;:!?"']*)$`, 'i'),
					new RegExp(`${numberPattern}\\s+${unitPattern}\\s+from\\s+now([\\s.,;:!?"']*)$`, 'i')
				];

				// Check dynamic patterns
				for (const pattern of dynamicPatterns) {
					const match = beforeCursor.match(pattern);
					if (match && match.index !== undefined) {
						const fullMatch = match[0];
						const trailing = match[match.length - 1] || '';
						const start = match.index;
						const end = start + match[0].length;
						const matchedText = fullMatch.replace(/[\s.,;:!?"']+$/, '');
						return { phrase: matchedText, trailing, start, end };
					}
				}
			}
		}

		return null;
	}


}