import { App, TFile } from 'obsidian';
import { PeriodicNoteDetector, PeriodicNoteType } from './periodic-note-detector';
import { LinkTarget } from './natural-language-parser';
import { PeriodicLinksSettings } from './settings';

// moment is bundled with Obsidian - import the function
import { moment } from 'obsidian';

// Type for moment instances
type Moment = ReturnType<typeof moment>;

// Plugin API types
interface PeriodicNoteSettings {
	template?: string;
	format?: string;
	folder?: string;
}

interface PeriodicNotesSettings {
	dailyNotes?: PeriodicNoteSettings;
	weeklyNotes?: PeriodicNoteSettings;
	monthlyNotes?: PeriodicNoteSettings;
	quarterlyNotes?: PeriodicNoteSettings;
	yearlyNotes?: PeriodicNoteSettings;
}

interface LegacyPeriodicConfig {
	enabled: boolean;
	format?: string;
	template?: string;
	folder?: string;
}

interface LegacyPeriodicNotesSettings {
	daily?: LegacyPeriodicConfig;
	weekly?: LegacyPeriodicConfig;
	monthly?: LegacyPeriodicConfig;
	quarterly?: LegacyPeriodicConfig;
	yearly?: LegacyPeriodicConfig;
}

interface PeriodicNotesPlugin {
	_loaded: boolean;
	settings: PeriodicNotesSettings | LegacyPeriodicNotesSettings;
}

interface PluginAPI {
	plugins: Record<string, PeriodicLinksPlugin | PeriodicNotesPlugin>;
}

// Plugin API types
interface PeriodicLinksPlugin {
  _loaded: boolean;
  settings: PeriodicLinksSettings;
}




export class LinkCreator {
	private app: App;
	private detector: PeriodicNoteDetector;

	constructor(app: App, detector: PeriodicNoteDetector) {
		this.app = app;
		this.detector = detector;
	}

	async createLink(target: LinkTarget, originalPhrase: string): Promise<string | null> {
		const config = this.detector.getConfig(target.type);
		if (!config) {
			return null;
		}

		// Generate the filename for the target periodic note
		const filename = this.generateFilename(target.date, config.format, target.type);
		const folderPath = config.folder ? `${config.folder}/` : '';
		const fullPath = `${folderPath}${filename}.md`;

		// Check if the file already exists
		const existingFile = this.app.vault.getAbstractFileByPath(fullPath);
		if (existingFile && existingFile instanceof TFile) {
			// File exists, create natural-looking link without folder prefix
			return `[[${filename}|${originalPhrase}]]`;
		}

		// Check creation mode
		const settings = this.getPluginSettings();
		if (settings?.autoCreateNotes === true) {
			// Immediate creation mode - create the file now
			try {
			// Ensure the folder exists
			if (config.folder) {
				const folderExists = this.app.vault.getAbstractFileByPath(config.folder);
				if (!folderExists) {
					await this.app.vault.createFolder(config.folder);
				}
			}

			// Create the file with template content
			let content = '';

			// Try to get template content from core plugins or periodic notes plugin
			try {
				let templatePath: string | undefined;

				// Check core Daily Notes plugin for daily notes
				if (target.type === 'daily') {
					interface DailyNotesOptions {
						template?: string;
						format?: string;
						folder?: string;
					}

					interface DailyNotesInstance {
						options?: DailyNotesOptions;
					}

					interface DailyNotesPlugin {
						enabled: boolean;
						instance?: DailyNotesInstance;
					}

					interface InternalPlugins {
						plugins: Record<string, DailyNotesPlugin>;
					}

					const internalPlugins = (this.app as { internalPlugins?: InternalPlugins }).internalPlugins;
					const dailyNotesPlugin = internalPlugins?.plugins?.['daily-notes'];
					if (dailyNotesPlugin?.instance?.options?.template) {
						templatePath = dailyNotesPlugin.instance.options.template;
					}
				}

				// Check Periodic Notes plugin if no template found from core plugin
				if (!templatePath) {
					const plugins = (this.app as { plugins?: PluginAPI }).plugins;
					const periodicNotesPlugin = plugins?.plugins?.['periodic-notes'] as PeriodicNotesPlugin | undefined;
					if (periodicNotesPlugin && periodicNotesPlugin._loaded) {
						templatePath = this.getTemplatePath(target.type, periodicNotesPlugin.settings);
					}
				}

				// Read and process the template if found
				if (templatePath) {
					try {
						const normalizedTemplatePath = templatePath;
						const templateFile = this.app.metadataCache.getFirstLinkpathDest(normalizedTemplatePath, "");
						if (templateFile) {
							content = await this.app.vault.cachedRead(templateFile);
							content = this.processTemplate(content, target.date, target.type);
						}
					} catch (error) {
						console.warn('Failed to read template:', templatePath, error);
					}
				}
			} catch {
				// Template processing failed, use default content
			}

			// If no template content, use default title
			if (!content.trim()) {
				content = `# ${this.generateTitle(target.date, target.type)}\n\n`;
			}

			// Create the file
			await this.app.vault.create(fullPath, content);

			// Return natural-looking link without folder prefix
			return `[[${filename}|${originalPhrase}]]`;
			} catch (error: unknown) {
				console.error('Failed to create periodic note:', error);
				// Fall back to creating a link that will prompt user to create the file
				return `[[${filename}|${originalPhrase}]]`;
			}
		} else {
			// On-demand creation mode - just return the link
			return `[[${filename}|${originalPhrase}]]`;
		}
	}

	private generateFilename(date: Moment, format: string, type: PeriodicNoteType): string {
		// Use moment.js formatting - date is already a moment object
		return date.format(format);
	}


	private generateTitle(date: Moment, type: PeriodicNoteType): string {
		switch (type) {
			case 'daily':
				return date.format('dddd, MMMM Do, YYYY');
			case 'weekly': {
				const start = date.clone().day(1); // Monday
				const end = date.clone().day(7); // Sunday
				return `Week of ${start.format('MMMM Do')} - ${end.format('MMMM Do, YYYY')}`;
			}
			case 'monthly':
				return date.format('MMMM YYYY');
			case 'quarterly': {
				const quarter = Math.ceil((date.month() + 1) / 3);
				return `Q${quarter} ${date.format('YYYY')}`;
			}
			case 'yearly':
				return date.format('YYYY');
			default:
				return date.format('YYYY-MM-DD');
		}
	}

	private getTemplatePath(type: PeriodicNoteType, settings: PeriodicNotesSettings | LegacyPeriodicNotesSettings): string | undefined {
		// Handle both legacy format (settings.weekly) and new format (settings.weeklyNotes)
		switch (type) {
			case 'daily':
				return (settings as PeriodicNotesSettings).dailyNotes?.template ||
				       (settings as LegacyPeriodicNotesSettings).daily?.template;
			case 'weekly':
				return (settings as PeriodicNotesSettings).weeklyNotes?.template ||
				       (settings as LegacyPeriodicNotesSettings).weekly?.template;
			case 'monthly':
				return (settings as PeriodicNotesSettings).monthlyNotes?.template ||
				       (settings as LegacyPeriodicNotesSettings).monthly?.template;
			case 'quarterly':
				return (settings as PeriodicNotesSettings).quarterlyNotes?.template ||
				       (settings as LegacyPeriodicNotesSettings).quarterly?.template;
			case 'yearly':
				return (settings as PeriodicNotesSettings).yearlyNotes?.template ||
				       (settings as LegacyPeriodicNotesSettings).yearly?.template;
			default:
				return undefined;
		}
	}

	private processTemplate(template: string, date: Moment, type: PeriodicNoteType): string {
		// Process common template variables
		let processed = template;

		// Date/time variables
		processed = processed.replace(/\{\{date\}\}/g, date.format('YYYY-MM-DD'));
		processed = processed.replace(/\{\{time\}\}/g, date.format('HH:mm'));
		processed = processed.replace(/\{\{title\}\}/g, this.generateTitle(date, type));

		// Type-specific variables
		switch (type) {
			case 'daily':
				processed = processed.replace(/\{\{yesterday\}\}/g, date.clone().subtract(1, 'day').format('YYYY-MM-DD'));
				processed = processed.replace(/\{\{tomorrow\}\}/g, date.clone().add(1, 'day').format('YYYY-MM-DD'));
				break;

			case 'weekly': {
				processed = processed.replace(/\{\{sunday\}\}/g, date.clone().day(0).format('YYYY-MM-DD'));
				processed = processed.replace(/\{\{monday\}\}/g, date.clone().day(1).format('YYYY-MM-DD'));
				processed = processed.replace(/\{\{tuesday\}\}/g, date.clone().day(2).format('YYYY-MM-DD'));
				processed = processed.replace(/\{\{wednesday\}\}/g, date.clone().day(3).format('YYYY-MM-DD'));
				processed = processed.replace(/\{\{thursday\}\}/g, date.clone().day(4).format('YYYY-MM-DD'));
				processed = processed.replace(/\{\{friday\}\}/g, date.clone().day(5).format('YYYY-MM-DD'));
				processed = processed.replace(/\{\{saturday\}\}/g, date.clone().day(6).format('YYYY-MM-DD'));
				break;
			}

			case 'monthly': {
				processed = processed.replace(/\{\{date:MMMM YYYY\}\}/g, date.format('MMMM YYYY'));
				break;
			}

			case 'quarterly': {
				const quarter = Math.ceil((date.month() + 1) / 3);
				processed = processed.replace(/\{\{date:YYYY \[Q\]Q\}\}/g, `Q${quarter}`);
				break;
			}

			case 'yearly': {
				processed = processed.replace(/\{\{date:YYYY\}\}/g, date.format('YYYY'));
				break;
			}
		}

		return processed;
	}

	private getPluginSettings(): PeriodicLinksSettings | undefined {
		// Get settings from our plugin
		const plugins = (this.app as { plugins?: PluginAPI }).plugins;
		const plugin = plugins?.plugins?.['periodic-links'] as PeriodicLinksPlugin | undefined;
		return plugin?.settings;
	}
}