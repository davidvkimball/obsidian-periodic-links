import { App, PluginSettingTab, SettingGroup, Notice } from "obsidian";
import PeriodicLinksPlugin from "./main";
import { ConfirmationModal } from "./modal";

export interface PeriodicLinksSettings {
	autoCreateNotes: boolean;
	enableNaturalLanguage: boolean;
	enablePrintedDates: boolean;
	enableWrittenNumbers: boolean;
	enableExtendedPhrases: boolean;
	workScope: 'current-type' | 'all-periodic' | 'everywhere';
	strictFolderCheck: boolean;
	excludedFolders: string[];
}

export const DEFAULT_SETTINGS: PeriodicLinksSettings = {
	autoCreateNotes: true,
	enablePrintedDates: true,
	enableNaturalLanguage: true,
	enableWrittenNumbers: true,
	enableExtendedPhrases: true,
	workScope: 'current-type',
	strictFolderCheck: false,
	excludedFolders: []
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

		generalGroup.addSetting(setting => {
			setting
				.setName('Strict folder check')
				.setDesc('Require notes to match both format and folder location (more precise but restrictive)')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.strictFolderCheck)
					.onChange(async value => {
						this.plugin.settings.strictFolderCheck = value;
						await this.plugin.saveSettings();
					}));
		});

		generalGroup.addSetting(setting => {
			setting
				.setName('Note creation mode')
				.setDesc('Choose how to handle links to notes that don\'t exist yet (recommended: immediate for templates)')
				.addDropdown(dropdown => dropdown
					.addOption('immediate', 'Create notes immediately')
					.addOption('on-demand', 'Create links to non-existing notes')
					.setValue(this.plugin.settings.autoCreateNotes ? 'immediate' : 'on-demand')
					.onChange(async value => {
						this.plugin.settings.autoCreateNotes = value === 'immediate';
						await this.plugin.saveSettings();
					}));
		});

		generalGroup.addSetting(setting => {
			setting
				.setName('Work scope')
				.setDesc('Choose where natural language parsing should work')
				.addDropdown(dropdown => dropdown
					.addOption('current-type', 'Only in current periodic note type')
					.addOption('all-periodic', 'Across all periodic note types')
					.addOption('everywhere', 'In any file')
					.setValue(this.plugin.settings.workScope)
					.onChange(async (value: PeriodicLinksSettings['workScope']) => {
						this.plugin.settings.workScope = value;
						await this.plugin.saveSettings();
					}));
		});

		const printedGroup = new SettingGroup(containerEl).setHeading("Printed date settings");

		printedGroup.addSetting(setting => {
			setting
				.setName('Enable printed dates')
				.setDesc('Enable explicit date formats (august 21, 2024, 8/21/2024, 2024-08-21, etc.)')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.enablePrintedDates)
					.onChange(async value => {
						this.plugin.settings.enablePrintedDates = value;
						await this.plugin.saveSettings();
					}));
		});

		const nlpGroup = new SettingGroup(containerEl).setHeading("Natural language settings");

		nlpGroup.addSetting(setting => {
			setting
				.setName('Enable natural language')
				.setDesc('Enable basic natural language phrases (yesterday, tomorrow, last week, etc.)')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.enableNaturalLanguage)
					.onChange(async value => {
						this.plugin.settings.enableNaturalLanguage = value;
						await this.plugin.saveSettings();
					}));
		});

		nlpGroup.addSetting(setting => {
			setting
				.setName('Enable written numbers')
				.setDesc('Enable written number support (two, three, five instead of 2, 3, 5)')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.enableWrittenNumbers)
					.onChange(async value => {
						this.plugin.settings.enableWrittenNumbers = value;
						await this.plugin.saveSettings();
					}));
		});

		nlpGroup.addSetting(setting => {
			setting
				.setName('Enable extended phrases')
				.setDesc('Enable extended phrases (previous quarter, in 2 weeks, 3 years ago, etc.)')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.enableExtendedPhrases)
					.onChange(async value => {
						this.plugin.settings.enableExtendedPhrases = value;
						await this.plugin.saveSettings();
					}));
		});

		const bulkGroup = new SettingGroup(containerEl).setHeading("Bulk conversion");

		bulkGroup.addSetting(setting => {
			setting
				.setName('Convert all phrases in vault')
				.setDesc('Scan all notes in your vault and convert recognized phrases into periodic links. This cannot be easily undone.')
				.addButton(button => button
					.setButtonText('Convert vault')
					.setWarning()
					.onClick(() => {
						const modal = new ConfirmationModal(
							this.app,
							"Convert all phrases in vault?",
							"This will scan every Markdown file in your vault and convert any recognized date phrases into periodic links. This process may take a moment and cannot be easily undone. Are you sure?",
							() => {
								void (async () => {
									const result = await this.plugin.convertVault();
									new Notice(`Bulk conversion complete: Linked ${result.totalChanges} phrases across ${result.filesProcessed} files.`);
								})();
							}
						);
						modal.open();
					}));
		});

		bulkGroup.addSetting(setting => {
			setting
				.setName('Excluded folders')
				.setDesc('Folders to skip during vault-wide conversion (one per line)')
				.addTextArea(text => text
					.setPlaceholder('Templates\narchive')
					.setValue(this.plugin.settings.excludedFolders.join('\n'))
					.onChange(async (value) => {
						this.plugin.settings.excludedFolders = value.split('\n').map(s => s.trim()).filter(s => s !== '');
						await this.plugin.saveSettings();
					}));
		});
	}
}
