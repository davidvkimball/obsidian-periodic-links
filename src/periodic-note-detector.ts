import { App, TFile } from 'obsidian';

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

interface PeriodicNotesPlugin {
	_loaded: boolean;
	settings: PeriodicNotesSettings;
}

interface PluginAPI {
	plugins: Record<string, PeriodicNotesPlugin>;
}

interface InternalPlugins {
	plugins: Record<string, DailyNotesPlugin>;
}

export class PeriodicNoteDetector {
	private app: App;
	private coreDailyNotesConfig: PeriodicNoteConfig | null = null;
	private periodicNotesConfig: Map<PeriodicNoteType, PeriodicNoteConfig> = new Map();

	constructor(app: App) {
		this.app = app;
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
			const plugins = (this.app as { plugins?: PluginAPI }).plugins;
			const periodicNotesPlugin = plugins?.plugins?.['periodic-notes'];
			if (periodicNotesPlugin && periodicNotesPlugin._loaded) {
				const settings = periodicNotesPlugin.settings;

				// Daily notes
				if (settings.dailyNotes) {
					this.periodicNotesConfig.set('daily', {
						type: 'daily',
						format: settings.dailyNotes.format || 'YYYY-MM-DD',
						folder: settings.dailyNotes.folder || ''
					});
				}

				// Weekly notes
				if (settings.weeklyNotes) {
					this.periodicNotesConfig.set('weekly', {
						type: 'weekly',
						format: settings.weeklyNotes.format || 'gggg-[W]ww',
						folder: settings.weeklyNotes.folder || ''
					});
				}

				// Monthly notes
				if (settings.monthlyNotes) {
					this.periodicNotesConfig.set('monthly', {
						type: 'monthly',
						format: settings.monthlyNotes.format || 'YYYY-MM',
						folder: settings.monthlyNotes.folder || ''
					});
				}

				// Quarterly notes
				if (settings.quarterlyNotes) {
					this.periodicNotesConfig.set('quarterly', {
						type: 'quarterly',
						format: settings.quarterlyNotes.format || 'YYYY-[Q]Q',
						folder: settings.quarterlyNotes.folder || ''
					});
				}

				// Yearly notes
				if (settings.yearlyNotes) {
					this.periodicNotesConfig.set('yearly', {
						type: 'yearly',
						format: settings.yearlyNotes.format || 'YYYY',
						folder: settings.yearlyNotes.folder || ''
					});
				}
			}
		} catch {
			// Periodic Notes plugin not available or not configured
		}
	}

	detectPeriodicType(file: TFile): PeriodicNoteType | null {
		const fileName = file.basename;
		const filePath = file.path;

		// Check against all configured periodic note types
		const allConfigs = [
			...(this.coreDailyNotesConfig ? [this.coreDailyNotesConfig] : []),
			...Array.from(this.periodicNotesConfig.values())
		];

		for (const config of allConfigs) {
			if (this.matchesConfig(fileName, filePath, config)) {
				return config.type;
			}
		}

		return null;
	}

	private matchesConfig(fileName: string, filePath: string, config: PeriodicNoteConfig): boolean {
		// Check folder match
		if (config.folder) {
			const normalizedFolder = config.folder.replace(/\\/g, '/');
			const fileDir = filePath.substring(0, filePath.lastIndexOf('/'));
			if (!fileDir.startsWith(normalizedFolder)) {
				return false;
			}
		}

		// Check format match using regex patterns
		const pattern = this.formatToRegex(config.format);
		return pattern.test(fileName);
	}

	private formatToRegex(format: string): RegExp {
		// Convert moment.js format to regex based on Periodic Notes plugin patterns
		let regex = format
			.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape regex chars
			.replace(/YYYY/g, '\\d{4}')           // Year
			.replace(/MM/g, '\\d{2}')             // Month
			.replace(/DD/g, '\\d{2}')             // Day
			.replace(/gggg/g, '\\d{4}')           // Week year
			.replace(/gg/g, '\\d{4}')             // Week year (2 digits)
			.replace(/ww/g, '\\d{2}')             // Week
			.replace(/w/g, '\\d{1,2}')            // Week (1-2 digits)
			.replace(/W/g, 'W')                   // Week literal
			.replace(/\[([^\]]+)\]/g, '$1')       // Remove moment brackets
			.replace(/Q/g, '[1-4]')               // Quarter
			.replace(/dddd/g, '[A-Za-z]+')        // Full day name
			.replace(/ddd/g, '[A-Za-z]+')         // Short day name
			.replace(/dd/g, '[A-Za-z]+')          // Min day name
			.replace(/MMMM/g, '[A-Za-z]+')        // Full month name
			.replace(/MMM/g, '[A-Za-z]+')         // Short month name
			.replace(/HH/g, '\\d{2}')             // Hour
			.replace(/mm/g, '\\d{2}')             // Minute
			.replace(/ss/g, '\\d{2}');            // Second

		return new RegExp(`^${regex}$`);
	}

	getConfig(type: PeriodicNoteType): PeriodicNoteConfig | null {
		// Check periodic notes plugin first, then core daily notes
		return this.periodicNotesConfig.get(type) ?? (type === 'daily' ? this.coreDailyNotesConfig : null);
	}

	getAllEnabledTypes(): PeriodicNoteType[] {
		const types: PeriodicNoteType[] = [];

		if (this.coreDailyNotesConfig) {
			types.push('daily');
		}

		this.periodicNotesConfig.forEach((_, type) => {
			types.push(type);
		});

		return types;
	}
}