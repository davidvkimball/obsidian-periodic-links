import { App, TFile } from 'obsidian';
import { moment } from 'obsidian';

export type PeriodicNoteType = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface PeriodicNoteConfig {
	type: PeriodicNoteType;
	format: string;
	folder: string;
}

interface DailyNotesPlugin {
	enabled: boolean;
	instance?: {
		options?: {
			format?: string;
			folder?: string;
		};
	};
}







interface InternalPlugins {
	plugins: Record<string, DailyNotesPlugin>;
}

interface PluginInstance {
	_loaded: boolean;
	calendarSetManager?: {
		getActiveConfig: (type: string) => { enabled: boolean; folder: string } | null;
		getFormat: (type: string) => string;
	};
	settings?: {
		daily?: { enabled: boolean; format?: string; folder?: string };
		weekly?: { enabled: boolean; format?: string; folder?: string };
		monthly?: { enabled: boolean; format?: string; folder?: string };
		quarterly?: { enabled: boolean; format?: string; folder?: string };
		yearly?: { enabled: boolean; format?: string; folder?: string };
	};
}

interface ObsidianApp {
	plugins?: {
		plugins: Record<string, PluginInstance>;
	};
}



export class PeriodicNoteDetector {
	private app: App;
	private strictFolderCheck: boolean = false;
	private coreDailyNotesConfig: PeriodicNoteConfig | null = null;
	private periodicNotesConfig: Map<PeriodicNoteType, PeriodicNoteConfig> = new Map();

	constructor(app: App, strictFolderCheck: boolean = false) {
		this.app = app;
		this.strictFolderCheck = strictFolderCheck;
		this.loadConfigurations();
	}

	private loadConfigurations() {
		// Load core Daily Notes configuration
		try {
			const internalPlugins = (this.app as { internalPlugins?: InternalPlugins }).internalPlugins;
			const dailyNotesPlugin = internalPlugins?.plugins?.['daily-notes'];
			if (dailyNotesPlugin && dailyNotesPlugin.enabled) {
				const settings = dailyNotesPlugin.instance?.options;
				if (settings) {
					this.coreDailyNotesConfig = {
						type: 'daily',
						format: settings.format || 'YYYY-MM-DD',
						folder: settings.folder || ''
					};
				}
			}
		} catch {
			// Core Daily Notes plugin not available or not configured
		}

		// Load Periodic Notes plugin configuration
		try {
			const obsidianApp = this.app as ObsidianApp;
			const periodicNotesPlugin = obsidianApp.plugins?.plugins?.['periodic-notes'];

			if (periodicNotesPlugin && periodicNotesPlugin._loaded) {
				// Check if using new CalendarSet system or legacy settings
				if (periodicNotesPlugin.calendarSetManager) {
					// New CalendarSet system
					const calendarSetManager = periodicNotesPlugin.calendarSetManager;
					const granularities: Array<'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'> = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'];

					for (const granularity of granularities) {
						try {
							const config = calendarSetManager.getActiveConfig(granularity === 'daily' ? 'day' :
								granularity === 'weekly' ? 'week' :
								granularity === 'monthly' ? 'month' :
								granularity === 'quarterly' ? 'quarter' : 'year');

							if (config && config.enabled) {
								const format = calendarSetManager.getFormat(granularity === 'daily' ? 'day' :
									granularity === 'weekly' ? 'week' :
									granularity === 'monthly' ? 'month' :
									granularity === 'quarterly' ? 'quarter' : 'year');

								this.periodicNotesConfig.set(granularity, {
									type: granularity,
									format: format,
									folder: config.folder
								});
							}
						} catch {
							// Granularity not configured, skip
						}
					}
				} else if (periodicNotesPlugin.settings) {
					// Legacy settings format
					const settings = periodicNotesPlugin.settings;

					// Check legacy daily notes
					if (settings.daily?.enabled) {
						this.periodicNotesConfig.set('daily', {
							type: 'daily',
							format: settings.daily.format || 'YYYY-MM-DD',
							folder: settings.daily.folder || ''
						});
					}

					// Check legacy weekly notes
					if (settings.weekly?.enabled) {
						this.periodicNotesConfig.set('weekly', {
							type: 'weekly',
							format: settings.weekly.format || 'gggg-[W]ww',
							folder: settings.weekly.folder || ''
						});
					}

					// Check legacy monthly notes
					if (settings.monthly?.enabled) {
						this.periodicNotesConfig.set('monthly', {
							type: 'monthly',
							format: settings.monthly.format || 'YYYY-MM',
							folder: settings.monthly.folder || ''
						});
					}

					// Check legacy quarterly notes
					if (settings.quarterly?.enabled) {
						this.periodicNotesConfig.set('quarterly', {
							type: 'quarterly',
							format: settings.quarterly.format || 'YYYY-[Q]Q',
							folder: settings.quarterly.folder || ''
						});
					}

					// Check legacy yearly notes
					if (settings.yearly?.enabled) {
						this.periodicNotesConfig.set('yearly', {
							type: 'yearly',
							format: settings.yearly.format || 'YYYY',
							folder: settings.yearly.folder || ''
						});
					}
				}
			}
		} catch {
			// Periodic Notes plugin not available or not configured
		}
	}

	private getDefaultFormat(type: PeriodicNoteType): string {
		switch (type) {
			case 'daily':
				return 'YYYY-MM-DD';
			case 'weekly':
				return 'gggg-[W]ww';
			case 'monthly':
				return 'YYYY-MM';
			case 'quarterly':
				return 'YYYY-[Q]Q';
			case 'yearly':
				return 'YYYY';
			default:
				return 'YYYY-MM-DD';
		}
	}

	detectPeriodicType(file: TFile): PeriodicNoteType | null {
		const fileName = file.basename;
		const filePath = file.path;

		// Check against all configured periodic note types using format-based detection
		const allConfigs = [
			...(this.coreDailyNotesConfig ? [this.coreDailyNotesConfig] : []),
			...Array.from(this.periodicNotesConfig.values())
		];

		for (const config of allConfigs) {
			if (this.matchesConfig(fileName, filePath, config)) {
				return config.type;
			}
		}

		// Fallback: try to detect common periodic note patterns even if plugins not configured
		return this.detectCommonPatterns(fileName);
	}

	private detectCommonPatterns(fileName: string): PeriodicNoteType | null {
		// Try common periodic note patterns as fallback
		const patterns = [
			{ regex: /^\d{4}-\d{2}-\d{2}$/, type: 'daily' as PeriodicNoteType },     // YYYY-MM-DD
			{ regex: /^\d{4}-W\d{2}$/, type: 'weekly' as PeriodicNoteType },       // YYYY-WWW
			{ regex: /^\d{4}-\d{2}$/, type: 'monthly' as PeriodicNoteType },       // YYYY-MM
			{ regex: /^\d{4}-Q\d$/, type: 'quarterly' as PeriodicNoteType },       // YYYY-QX
			{ regex: /^\d{4}$/, type: 'yearly' as PeriodicNoteType }               // YYYY
		];

		for (const { regex, type } of patterns) {
			if (regex.test(fileName)) {
				return type;
			}
		}

		return null;
	}

	private matchesConfig(fileName: string, filePath: string, config: PeriodicNoteConfig): boolean {
		// Handle formats with slashes - only for periodic notes plugin (not core daily notes)
		// Core daily notes plugin treats slashes as filename patterns, not folder structures
		const isCoreDailyNotes = config === this.coreDailyNotesConfig;
		if (config.format.includes('/') && !isCoreDailyNotes) {
			return this.matchesFolderStructure(filePath, config);
		}

		// Regular format matching for filename-only formats (or core daily notes with slashes)
		try {
			const dateInputStr = fileName.replace(/\.md$/, '');
			const date = moment(dateInputStr, config.format, true);
			if (!date.isValid()) {
				return false;
			}
		} catch {
			return false;
		}

		// Optional strict folder check
		if (this.strictFolderCheck && config.folder) {
			const normalizedFolder = config.folder.replace(/\\/g, '/');
			const fileDir = filePath.substring(0, filePath.lastIndexOf('/'));
			// For core daily notes, folder might be empty string, so allow files in root
			if (normalizedFolder && !fileDir.startsWith(normalizedFolder)) {
				return false;
			}
		}

		return true;
	}

	private matchesFolderStructure(filePath: string, config: PeriodicNoteConfig): boolean {
		// Remove .md extension and extract the path components
		const pathWithoutExt = filePath.replace(/\.md$/, '');
		const pathParts = pathWithoutExt.split('/');

		// Split the format by slashes to get the structure
		const formatParts = config.format.split('/');

		// We need at least as many path parts as format parts
		if (pathParts.length < formatParts.length) {
			return false;
		}

		// Take the last N parts of the path where N is the number of format parts
		const relevantPathParts = pathParts.slice(-formatParts.length);

		// Try to parse the date using the folder structure
		try {
			const dateString = relevantPathParts.join('/');
			const date = moment(dateString, config.format, true);
			if (!date.isValid()) {
				return false;
			}
		} catch {
			return false;
		}

		// Optional strict folder check - check if the base folder matches
		if (this.strictFolderCheck && config.folder) {
			const normalizedFolder = config.folder.replace(/\\/g, '/');
			// Remove the date-specific folders from the path to get the base folder
			const basePath = pathParts.slice(0, -formatParts.length).join('/');
			// Allow empty base path to match empty config folder
			if (normalizedFolder && basePath !== normalizedFolder) {
				return false;
			}
		}

		return true;
	}



	getConfig(type: PeriodicNoteType): PeriodicNoteConfig | null {
		// Check periodic notes plugin first, then core daily notes
		return this.periodicNotesConfig.get(type) ?? (type === 'daily' ? this.coreDailyNotesConfig : null);
	}

	getAllEnabledTypes(): PeriodicNoteType[] {
		const types: PeriodicNoteType[] = [];

		// Check if core Daily Notes plugin is actually enabled
		try {
			const internalPlugins = (this.app as { internalPlugins?: InternalPlugins }).internalPlugins;
			const dailyNotesPlugin = internalPlugins?.plugins?.['daily-notes'];
			if (dailyNotesPlugin && dailyNotesPlugin.enabled && this.coreDailyNotesConfig) {
				types.push('daily');
			}
		} catch {
			// Ignore errors when checking core plugin status
		}

		// Add types from Periodic Notes plugin (excluding daily if core plugin handles it)
		this.periodicNotesConfig.forEach((config, type) => {
			if (type !== 'daily' || !this.coreDailyNotesConfig) {
				types.push(type);
			}
		});

		return types;
	}
}