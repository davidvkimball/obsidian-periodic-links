import { App, Modal, Setting } from "obsidian";

export class ConfirmationModal extends Modal {
	private title: string;
	private message: string;
	private onConfirm: () => void;

	constructor(app: App, title: string, message: string, onConfirm: () => void) {
		super(app);
		this.title = title;
		this.message = message;
		this.onConfirm = onConfirm;
	}

	onOpen() {
		const { contentEl } = this;

		this.titleEl.setText(this.title);
		contentEl.createEl("p", { text: this.message });

		new Setting(contentEl)
			.addButton((btn) =>
				btn
					.setButtonText("Confirm")
					.setCta()
					.onClick(() => {
						this.close();
						this.onConfirm();
					})
			)
			.addButton((btn) =>
				btn
					.setButtonText("Cancel")
					.onClick(() => {
						this.close();
					})
			);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
