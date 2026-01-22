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
	calendarSetManager?: CalendarSetManager;
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

interface PluginAPI {
	plugins: Record<string, PeriodicNotesPlugin>;
}

interface InternalPlugins {
	plugins: Record<string, DailyNotesPlugin>;
}

interface CalendarSetManager {
	getActiveConfig(granularity: string): { enabled: boolean; folder: string; format: string } | null;
	getFormat(granularity: string): string;
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
				// Check if using new CalendarSet system or legacy settings
				if (periodicNotesPlugin.calendarSetManager) {
					// New CalendarSet system
					const calendarSetManager = periodicNotesPlugin.calendarSetManager;

					// Check each granularity
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
								folder: config.folder || ''
							});
							}
						} catch {
							// Granularity not configured, skip
						}
					}
				} else {
					// Legacy settings format
					const settings = periodicNotesPlugin.settings as LegacyPeriodicNotesSettings;

					// Check legacy daily notes
					if (settings?.daily?.enabled) {
						this.periodicNotesConfig.set('daily', {
							type: 'daily',
							format: settings.daily.format || 'YYYY-MM-DD',
							folder: settings.daily.folder || ''
						});
					}

					// Check legacy weekly notes
					if (settings?.weekly?.enabled) {
						this.periodicNotesConfig.set('weekly', {
							type: 'weekly',
							format: settings.weekly.format || 'gggg-[W]ww',
							folder: settings.weekly.folder || ''
						});
					}

					// Check legacy monthly notes
					if (settings?.monthly?.enabled) {
						this.periodicNotesConfig.set('monthly', {
							type: 'monthly',
							format: settings.monthly.format || 'YYYY-MM',
							folder: settings.monthly.folder || ''
						});
					}

					// Check legacy quarterly notes
					if (settings?.quarterly?.enabled) {
						this.periodicNotesConfig.set('quarterly', {
							type: 'quarterly',
							format: settings.quarterly.format || 'YYYY-[Q]Q',
							folder: settings.quarterly.folder || ''
						});
					}

					// Check legacy yearly notes
					if (settings?.yearly?.enabled) {
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

		// Check format match using moment.js parsing (like Periodic Notes plugin)
		try {
			// For simple formats, just use the filename
			// Remove .md extension if present
			const dateInputStr = fileName.replace(/\.md$/, '');
			const date = moment(dateInputStr, config.format, true);
			return date.isValid();
		} catch {
			return false;
		}
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