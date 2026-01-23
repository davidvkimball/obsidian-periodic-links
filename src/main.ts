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

export default class PeriodicLinksPlugin extends Plugin {
	settings: PeriodicLinksSettings;
	detector: PeriodicNoteDetector;
	parser: NaturalLanguageParser;
	linkCreator: LinkCreator;

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

		// Check if we're in a periodic note
		const currentType = this.detector.detectPeriodicType(view.file);
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
		if (trailing.includes(' ')) {
			replacement += ' ';
		} else if (trailing.match(/[.,;:!?]/)) {
			replacement += ' ';
		}

		editor.replaceRange(replacement, lineStart, lineEnd);
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