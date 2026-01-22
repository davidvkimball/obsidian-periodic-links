import { App, PluginSettingTab, Setting } from "obsidian";
import PeriodicLinksPlugin from "./main";

export interface PeriodicLinksSettings {
	detectionMethod: 'auto' | 'folder' | 'property' | 'format';
	enableCleanup: boolean;
}

export const DEFAULT_SETTINGS: PeriodicLinksSettings = {
	detectionMethod: 'auto',
	enableCleanup: true
}

export class PeriodicLinksSettingTab extends PluginSettingTab {
	plugin: PeriodicLinksPlugin;

	constructor(app: App, plugin: PeriodicLinksPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setHeading()
			.setName('Periodic links settings');

		new Setting(containerEl)
			.setName('Detection method')
			.setDesc('How to detect periodic notes (auto tries all methods)')
			.addDropdown(dropdown => dropdown
				.addOption('auto', 'Auto-detect')
				.addOption('folder', 'Folder-based')
				.addOption('property', 'Property-based')
				.addOption('format', 'Format-based')
				.setValue(this.plugin.settings.detectionMethod)
				.onChange(async (value: PeriodicLinksSettings['detectionMethod']) => {
					this.plugin.settings.detectionMethod = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Enable cleanup')
			.setDesc('Enable cleanup of broken periodic note links')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableCleanup)
				.onChange(async (value) => {
					this.plugin.settings.enableCleanup = value;
					await this.plugin.saveSettings();
				}));
	}
}
