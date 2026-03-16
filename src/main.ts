import { Plugin, MarkdownView, Editor, EditorPosition, TFile, Notice } from 'obsidian';
import { PeriodicLinksSettings, DEFAULT_SETTINGS, PeriodicLinksSettingTab } from './settings';
import { PeriodicNoteDetector } from './periodic-note-detector';
import { NaturalLanguageParser } from './natural-language-parser';
import { LinkCreator } from './link-creator';
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
	private lastReplacement: { line: number, start: number, end: number, time: number } | null = null;



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
			name: 'Convert phrase to link',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				await this.handleManualConversion(editor, view);
			},
		});

		// Add bulk conversion command
		this.addCommand({
			id: 'convert-all-phrases-in-note',
			name: 'Convert all phrases in current note',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				if (!view.file) return;
				const count = await this.convertAllPhrasesInFile(view.file);
				new Notice(`Converted ${count} phrases in "${view.file.basename}"`);
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

		// Check if we just replaced this exact area (Undo protection)
		const nowTime = Date.now();
		if (this.lastReplacement && 
			this.lastReplacement.line === cursor.line && 
			this.lastReplacement.start === start && 
			Math.abs(this.lastReplacement.time - nowTime) < 2000) {
			return;
		}

		// Parse the natural language phrase
		const parsedPhrase = phrase.toLowerCase();
		const workEverywhere = this.settings.workScope === 'everywhere';
		const workAcrossAllPeriodicNotes = this.settings.workScope === 'all-periodic';
		const linkTarget = this.parser.parsePhrase(parsedPhrase, currentType, view.file, this.settings.enableWrittenNumbers, workAcrossAllPeriodicNotes, workEverywhere, this.settings.enablePrintedDates);
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
		} else if (trailing.match(/[.,;:!?\])"']/)) {
			replacement += ' ';
		}

		editor.replaceRange(replacement, lineStart, lineEnd);

		// Store replacement info for Undo protection
		this.lastReplacement = {
			line: cursor.line,
			start: start,
			end: start + replacement.length,
			time: Date.now()
		};
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
		const linkTarget = this.parser.parsePhrase(phrase, currentType, view.file, this.settings.enableWrittenNumbers, workAcrossAllPeriodicNotes, workEverywhere, this.settings.enablePrintedDates);

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

				return { phrase: word.replace(/[.,;:!?\])"']+$/, ''), start: currentCh, end: currentCh + word.length };
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
				const pattern = new RegExp(`\\b${phrase}([\\s.,;:!?"']+)$`, 'i'); // Changed * to +
				const match = beforeCursor.match(pattern);
				if (match && match.index !== undefined) {
					// Check if we're inside a link, code, or HTML tag
					if (this.isInLink(beforeCursor) || this.isInCode(beforeCursor) || this.isInHtml(beforeCursor)) continue;

					const start = match.index;
					
					// Ensure not preceded by [[ or | (with optional space)
					const prefix = beforeCursor.substring(0, start).trim();
					if (prefix.endsWith('[[') || prefix.endsWith('|')) continue;

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
					new RegExp(`(next|last)\\s+${weekdayPattern}([\\s.,;:!?"']+)$`, 'i'), // Changed * to +
					new RegExp(`${numberPattern}\\s+${weekdayPattern}\\s+(from\\s+now|ago)([\\s.,;:!?"']+)$`, 'i'), // Changed * to +
					new RegExp(`in\\s+${numberPattern}\\s+${weekdayPattern}([\\s.,;:!?"']+)$`, 'i'), // Changed * to +
					// General time patterns
					new RegExp(`${numberPattern}\\s+${unitPattern}\\s+ago([\\s.,;:!?"']+)$`, 'i'), // Changed * to +
					new RegExp(`in\\s+${numberPattern}\\s+${unitPattern}([\\s.,;:!?"']+)$`, 'i'), // Changed * to +
					new RegExp(`${numberPattern}\\s+${unitPattern}\\s+from\\s+now([\\s.,;:!?"']+)$`, 'i') // Changed * to +
				];

				// Check dynamic patterns
				for (const pattern of dynamicPatterns) {
					const match = beforeCursor.match(pattern);
					if (match && match.index !== undefined) {
						// Check if we're inside a link, code, or HTML tag
						if (this.isInLink(beforeCursor) || this.isInCode(beforeCursor) || this.isInHtml(beforeCursor)) continue;

						const fullMatch = match[0];
						const trailing = match[match.length - 1] || '';
						const start = match.index;

						// Ensure not preceded by [[ or | (with optional space)
						const prefix = beforeCursor.substring(0, start).trim();
						if (prefix.endsWith('[[') || prefix.endsWith('|')) continue;

						const end = start + match[0].length;
						const matchedText = fullMatch.replace(/[\s.,;:!?"']+$/, '');
						return { phrase: matchedText, trailing, start, end };
					}
				}
			}

			// Explicit date patterns
			if (this.settings.enablePrintedDates) {
				const explicitDatePatterns = [
					// MMMM D, YYYY or MMMM Do, YYYY
					/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(st|nd|rd|th)?,\s+\d{4}([\s.,;:!?"']+)$/i, // Changed * to +
					// MMM D, YYYY
					/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}([\s.,;:!?"']+)$/i, // Changed * to +
					// YYYY-MM-DD
					/\b\d{4}-\d{2}-\d{2}([\s.,;:!?"']+)$/i, // Changed * to +
					// M/D/YYYY or M/D/YY (various separators)
					/\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}([\s.,;:!?"']+)$/i // Changed * to +
				];

				for (const pattern of explicitDatePatterns) {
					const match = beforeCursor.match(pattern);
					if (match && match.index !== undefined) {
						// Check if we're inside a link, code, or HTML tag
						if (this.isInLink(beforeCursor) || this.isInCode(beforeCursor) || this.isInHtml(beforeCursor)) continue;

						const fullMatch = match[0];
						const trailing = match[match.length - 1] || '';
						const start = match.index;

						// Ensure not preceded by [[ or | (with optional space)
						const prefix = beforeCursor.substring(0, start).trim();
						if (prefix.endsWith('[[') || prefix.endsWith('|')) continue;

						const end = start + match[0].length;
						const matchedText = fullMatch.replace(/[\s.,;:!?"']+$/, '');
						return { phrase: matchedText, trailing, start, end };
					}
				}
			}
		}

		return null;
	}

	private isInHtml(text: string): boolean {
		const lastOpen = text.lastIndexOf('<');
		if (lastOpen === -1) return false;
		const lastClose = text.lastIndexOf('>');
		return lastOpen > lastClose;
	}

	private isInLink(text: string): boolean {
		const lastOpen = text.lastIndexOf('[[');
		if (lastOpen === -1) return false;
		const lastClose = text.lastIndexOf(']]');
		return lastOpen > lastClose;
	}

	private isInCode(text: string): boolean {
		const lastFence = text.lastIndexOf('```');
		const lastTick = text.lastIndexOf('`');
		if (lastFence !== -1 && lastFence >= lastTick) {
			const fences = (text.match(/```/g) || []).length;
			return fences % 2 !== 0;
		}
		const ticks = (text.match(/`/g) || []).length;
		return ticks % 2 !== 0;
	}

	public async convertAllPhrasesInFile(file: TFile): Promise<number> {
		let changesCount = 0;
		const workEverywhere = this.settings.workScope === 'everywhere';
		const workAcrossAllPeriodicNotes = this.settings.workScope === 'all-periodic';
		
		// Detect type for reference date
		const currentType = this.detector.detectPeriodicType(file);

		// Read content, find matches, create links (async), then write back.
		let data = await this.app.vault.read(file);
		
		const placeholders: string[] = [];
		const protectedPatterns = [
			/```[\s\S]*?```/g,
			/`[^`\n]+`/g,
			/\[\[.*?\]\]/g,
			/\[.*?\]\(.*?\)/g,
			/<[^>]+>/g
		];

		let processedData = data;
		
		// Protect properties
		const frontmatterMatch = processedData.match(/^---\n[\s\S]*?\n---(?:\n|$)/);
		if (frontmatterMatch) {
			const properties = frontmatterMatch[0];
			const placeholder = `__PERIODIC_LINK_PLACEHOLDER_${placeholders.length}__`;
			placeholders.push(properties);
			processedData = processedData.replace(properties, placeholder);
		}

		for (const pattern of protectedPatterns) {
			processedData = processedData.replace(pattern, (match) => {
				const placeholder = `__PERIODIC_LINK_PLACEHOLDER_${placeholders.length}__`;
				placeholders.push(match);
				return placeholder;
			});
		}

		const staticPhrases = [
			'yesterday', 'tomorrow', 'last week', 'next week', 'this week',
			'last month', 'next month', 'this month',
			'last quarter', 'previous quarter', 'next quarter', 'this quarter',
			'last year', 'previous year', 'next year', 'this year',
			'this sunday', 'this monday', 'this tuesday', 'this wednesday',
			'this thursday', 'this friday', 'this saturday'
		];

		const numberPattern = this.settings.enableWrittenNumbers
			? '(\\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)'
			: '(\\d+)';
		const unitPattern = '(days?|weeks?|months?|quarters?|years?)';
		const weekdayPattern = '(sundays|mondays|tuesdays|wednesdays|thursdays|fridays|saturdays|sunday|monday|tuesday|wednesday|thursday|friday|saturday)';

		const dynamicPatterns = [
			`(?:next|last)\\s+${weekdayPattern}`,
			`${numberPattern}\\s+${weekdayPattern}\\s+(?:from\\s+now|ago)`,
			`in\\s+${numberPattern}\\s+${weekdayPattern}`,
			`${numberPattern}\\s+${unitPattern}\\s+ago`,
			`in\\s+${numberPattern}\\s+${unitPattern}`,
			`${numberPattern}\\s+${unitPattern}\\s+from\\s+now`
		];

		const explicitDatePatterns = [
			'(?:January|February|March|April|May|June|July|August|September|October|November|December)\\s+\\d{1,2}(?:st|nd|rd|th)?,\\s+\\d{4}',
			'(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\\s+\\d{1,2},\\s+\\d{4}',
			'\\d{4}-\\d{2}-\\d{2}',
			'\\d{1,2}[/.-]\\d{1,2}[/.-]\\d{2,4}'
		];

		const allPatterns = [...staticPhrases, ...dynamicPatterns, ...explicitDatePatterns];
		const combinedRegex = new RegExp(`\\b(${allPatterns.join('|')})\\b`, 'gi');

		// We use a map to store replacements to avoid multiple async calls for the same phrase
		const replacements = new Map<string, string>();
		const matches = Array.from(processedData.matchAll(combinedRegex));
		
		for (const match of matches) {
			const phrase = match[0];
			if (replacements.has(phrase)) continue;

			const linkTarget = this.parser.parsePhrase(phrase, currentType, file, this.settings.enableWrittenNumbers, workAcrossAllPeriodicNotes, workEverywhere, this.settings.enablePrintedDates);
			if (linkTarget) {
				const linkText = await this.linkCreator.createLink(linkTarget, phrase);
				if (linkText) {
					replacements.set(phrase, linkText);
				}
			}
		}

		// Apply replacements
		let finalContent = processedData;
		finalContent = finalContent.replace(combinedRegex, (match) => {
			if (replacements.has(match)) {
				changesCount++;
				return replacements.get(match)!;
			}
			return match;
		});

		// Restore protected blocks
		for (let i = 0; i < placeholders.length; i++) {
			const placeholder = `__PERIODIC_LINK_PLACEHOLDER_${i}__`;
			const original = placeholders[i];
			if (original !== undefined) {
				finalContent = finalContent.replace(placeholder, original);
			}
		}

		if (changesCount > 0) {
			await this.app.vault.modify(file, finalContent);
		}

		return changesCount;
	}

	public async convertVault(): Promise<{ filesProcessed: number, totalChanges: number }> {
		const files = this.app.vault.getMarkdownFiles();
		let totalChanges = 0;
		let filesProcessed = 0;

		const notice = new Notice("Converting vault phrases... 0%", 0);
		let i = 0;
		for (const file of files) {
			// Check if file is in an excluded folder
			const isExcluded = this.settings.excludedFolders.some(folder => file.path.startsWith(folder + '/'));
			if (isExcluded) {
				i++;
				continue;
			}

			const count = await this.convertAllPhrasesInFile(file);
			if (count > 0) {
				totalChanges += count;
				filesProcessed++;
			}
			i++;
			notice.setMessage(`Converting vault phrases... ${Math.round((i / files.length) * 100)}%`);
		}
		notice.hide();

		return { filesProcessed, totalChanges };
	}
}