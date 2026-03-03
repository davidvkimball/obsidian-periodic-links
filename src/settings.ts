import { App, PluginSettingTab, Setting, SettingGroup } from "obsidian";
import PeriodicLinksPlugin from "./main";

export interface PeriodicLinksSettings {
	autoCreateNotes: boolean;
	enableNaturalLanguage: boolean;
	enableWrittenNumbers: boolean;
	enableExtendedPhrases: boolean;
	workScope: 'current-type' | 'all-periodic' | 'everywhere';
	strictFolderCheck: boolean;
}

export const DEFAULT_SETTINGS: PeriodicLinksSettings = {
	autoCreateNotes: true,
	enableNaturalLanguage: true,
	enableWrittenNumbers: true,
	enableExtendedPhrases: true,
	workScope: 'current-type',
	strictFolderCheck: false
}

export class PeriodicLinksSettingTab extends PluginSettingTab {
	plugin: PeriodicLinksPlugin;
	public icon = 'lucide-calendar-days';

	constructor(app: App, plugin: PeriodicLinksPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		const generalGroup = new SettingGroup(containerEl);

		generalGroup.addSetting((setting: any) => {
			setting
				.setName('Strict folder check')
				.setDesc('Require notes to match both format and folder location (more precise but restrictive)')
				.addToggle((toggle: any) => toggle
					.setValue(this.plugin.settings.strictFolderCheck)
					.onChange(async (value: any) => {
						this.plugin.settings.strictFolderCheck = value;
						await this.plugin.saveSettings();
					}));
		});

		generalGroup.addSetting((setting: any) => {
			setting
				.setName('Note creation mode')
				.setDesc('Choose how to handle links to notes that don\'t exist yet (recommended: immediate for templates)')
				.addDropdown((dropdown: any) => dropdown
					.addOption('immediate', 'Create notes immediately')
					.addOption('on-demand', 'Create links to non-existing notes')
					.setValue(this.plugin.settings.autoCreateNotes ? 'immediate' : 'on-demand')
					.onChange(async (value: any) => {
						this.plugin.settings.autoCreateNotes = value === 'immediate';
						await this.plugin.saveSettings();
					}));
		});

		generalGroup.addSetting((setting: any) => {
			setting
				.setName('Work scope')
				.setDesc('Choose where natural language parsing should work')
				.addDropdown((dropdown: any) => dropdown
					.addOption('current-type', 'Only in current periodic note type')
					.addOption('all-periodic', 'Across all periodic note types')
					.addOption('everywhere', 'In any file')
					.setValue(this.plugin.settings.workScope)
					.onChange(async (value: PeriodicLinksSettings['workScope']) => {
						this.plugin.settings.workScope = value;
						await this.plugin.saveSettings();
					}));
		});

		const nlpGroup = new SettingGroup(containerEl).setHeading("Natural language settings");

		nlpGroup.addSetting((setting: any) => {
			setting
				.setName('Enable natural language')
				.setDesc('Enable basic natural language phrases (yesterday, tomorrow, last week, etc.)')
				.addToggle((toggle: any) => toggle
					.setValue(this.plugin.settings.enableNaturalLanguage)
					.onChange(async (value: any) => {
						this.plugin.settings.enableNaturalLanguage = value;
						await this.plugin.saveSettings();
					}));
		});

		nlpGroup.addSetting((setting: any) => {
			setting
				.setName('Enable written numbers')
				.setDesc('Enable written number support (two, three, five instead of 2, 3, 5)')
				.addToggle((toggle: any) => toggle
					.setValue(this.plugin.settings.enableWrittenNumbers)
					.onChange(async (value: any) => {
						this.plugin.settings.enableWrittenNumbers = value;
						await this.plugin.saveSettings();
					}));
		});

		nlpGroup.addSetting((setting: any) => {
			setting
				.setName('Enable extended phrases')
				.setDesc('Enable extended phrases (previous quarter, in 2 weeks, 3 years ago, etc.)')
				.addToggle((toggle: any) => toggle
					.setValue(this.plugin.settings.enableExtendedPhrases)
					.onChange(async (value: any) => {
						this.plugin.settings.enableExtendedPhrases = value;
						await this.plugin.saveSettings();
					}));
		});
	}
}
