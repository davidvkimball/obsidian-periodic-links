import { TFile } from 'obsidian';
import { PeriodicNoteType } from './periodic-note-detector';

// moment is bundled with Obsidian - import the function
import { moment } from 'obsidian';

// Type for moment instances - use the actual moment.Moment type
type Moment = ReturnType<typeof moment>;

export interface LinkTarget {
	type: PeriodicNoteType;
	date: Moment;
}

interface DateMatch {
	date: Moment;
}

export class NaturalLanguageParser {
	parsePhrase(phrase: string, currentType: PeriodicNoteType, currentFile: TFile): LinkTarget | null {
		const now = moment();

		// Handle current file's date as reference point
		let referenceDate: moment.Moment;
		const config = this.extractDateFromFilename(currentFile.basename, currentType);
		if (config) {
			referenceDate = config.date;
		} else {
			referenceDate = now;
		}

		const lowerPhrase = phrase.toLowerCase().trim();

		// Static phrases
		switch (lowerPhrase) {
			case 'yesterday':
				if (currentType === 'daily') {
					return { type: 'daily', date: referenceDate.clone().subtract(1, 'day') };
				}
				break;

			case 'tomorrow':
				if (currentType === 'daily') {
					return { type: 'daily', date: referenceDate.clone().add(1, 'day') };
				}
				break;

			case 'last week':
				if (currentType === 'weekly' || currentType === 'daily') {
					const type = currentType === 'weekly' ? 'weekly' : 'weekly';
					return { type, date: referenceDate.clone().subtract(1, 'week') };
				}
				break;

			case 'next week':
				if (currentType === 'weekly' || currentType === 'daily') {
					const type = currentType === 'weekly' ? 'weekly' : 'weekly';
					return { type, date: referenceDate.clone().add(1, 'week') };
				}
				break;

			case 'this week':
				if (currentType === 'daily') {
					return { type: 'weekly', date: referenceDate.clone() };
				}
				break;

			case 'last month':
				if (currentType === 'monthly' || currentType === 'weekly' || currentType === 'daily') {
					const type = currentType === 'monthly' ? 'monthly' : 'monthly';
					return { type, date: referenceDate.clone().subtract(1, 'month') };
				}
				break;

			case 'next month':
				if (currentType === 'monthly' || currentType === 'weekly' || currentType === 'daily') {
					const type = currentType === 'monthly' ? 'monthly' : 'monthly';
					return { type, date: referenceDate.clone().add(1, 'month') };
				}
				break;

			case 'this month':
				if (currentType === 'weekly' || currentType === 'daily') {
					return { type: 'monthly', date: referenceDate.clone() };
				}
				break;

			case 'last quarter':
				if (currentType === 'quarterly' || currentType === 'monthly' || currentType === 'weekly' || currentType === 'daily') {
					const type = currentType === 'quarterly' ? 'quarterly' : 'quarterly';
					return { type, date: referenceDate.clone().subtract(3, 'months') };
				}
				break;

			case 'next quarter':
				if (currentType === 'quarterly' || currentType === 'monthly' || currentType === 'weekly' || currentType === 'daily') {
					const type = currentType === 'quarterly' ? 'quarterly' : 'quarterly';
					return { type, date: referenceDate.clone().add(3, 'months') };
				}
				break;

			case 'this quarter':
				if (currentType === 'monthly' || currentType === 'weekly' || currentType === 'daily') {
					return { type: 'quarterly', date: referenceDate.clone() };
				}
				break;

			case 'last year':
				if (currentType === 'yearly' || currentType === 'quarterly' || currentType === 'monthly' || currentType === 'weekly' || currentType === 'daily') {
					const type = currentType === 'yearly' ? 'yearly' : 'yearly';
					return { type, date: referenceDate.clone().subtract(1, 'year') };
				}
				break;

			case 'next year':
				if (currentType === 'yearly' || currentType === 'quarterly' || currentType === 'monthly' || currentType === 'weekly' || currentType === 'daily') {
					const type = currentType === 'yearly' ? 'yearly' : 'yearly';
					return { type, date: referenceDate.clone().add(1, 'year') };
				}
				break;

			case 'this year':
				if (currentType === 'quarterly' || currentType === 'monthly' || currentType === 'weekly' || currentType === 'daily') {
					return { type: 'yearly', date: referenceDate.clone() };
				}
				break;
		}

		// Dynamic patterns
		const agoMatch = phrase.match(/(\d+)\s+(days?|weeks?|months?|quarters?|years?)\s+ago/i);
		if (agoMatch && agoMatch[1] && agoMatch[2]) {
			const count = parseInt(agoMatch[1]);
			const unit = this.normalizeUnit(agoMatch[2]);
			const type = this.unitToType(unit, currentType);
			if (type) {
				return { type, date: referenceDate.clone().subtract(count, unit) };
			}
		}

		const inMatch = phrase.match(/in\s+(\d+)\s+(days?|weeks?|months?|quarters?|years?)/i);
		if (inMatch && inMatch[1] && inMatch[2]) {
			const count = parseInt(inMatch[1]);
			const unit = this.normalizeUnit(inMatch[2]);
			const type = this.unitToType(unit, currentType);
			if (type) {
				return { type, date: referenceDate.clone().add(count, unit) };
			}
		}

		const fromNowMatch = phrase.match(/(\d+)\s+(days?|weeks?|months?|quarters?|years?)\s+from\s+now/i);
		if (fromNowMatch && fromNowMatch[1] && fromNowMatch[2]) {
			const count = parseInt(fromNowMatch[1]);
			const unit = this.normalizeUnit(fromNowMatch[2]);
			const type = this.unitToType(unit, currentType);
			if (type) {
				return { type, date: now.clone().add(count, unit) };
			}
		}

		return null;
	}

	private extractDateFromFilename(filename: string, type: PeriodicNoteType): DateMatch | null {
		// Simple date extraction - in a real implementation this would be more sophisticated
		// and use the actual format strings from the plugin configurations

		switch (type) {
			case 'daily': {
				const dailyMatch = filename.match(/(\d{4})-(\d{2})-(\d{2})/);
				if (dailyMatch) {
					return { date: moment(`${dailyMatch[1]}-${dailyMatch[2]}-${dailyMatch[3]}`, 'YYYY-MM-DD') };
				}
				break;
			}

			case 'weekly': {
				const weeklyMatch = filename.match(/(\d{4})-W(\d{2})/);
				if (weeklyMatch && weeklyMatch[1] && weeklyMatch[2]) {
					return { date: moment().year(parseInt(weeklyMatch[1])).week(parseInt(weeklyMatch[2])) };
				}
				break;
			}

			case 'monthly': {
				const monthlyMatch = filename.match(/(\d{4})-(\d{2})/);
				if (monthlyMatch && monthlyMatch[1] && monthlyMatch[2]) {
					return { date: moment(`${monthlyMatch[1]}-${monthlyMatch[2]}-01`, 'YYYY-MM-DD') };
				}
				break;
			}

			case 'quarterly': {
				const quarterlyMatch = filename.match(/(\d{4})-Q([1-4])/);
				if (quarterlyMatch && quarterlyMatch[1] && quarterlyMatch[2]) {
					const year = parseInt(quarterlyMatch[1]);
					const quarter = parseInt(quarterlyMatch[2]);
					return { date: moment().year(year).quarter(quarter) };
				}
				break;
			}

			case 'yearly': {
				const yearlyMatch = filename.match(/(\d{4})/);
				if (yearlyMatch) {
					return { date: moment(`${yearlyMatch[1]}-01-01`, 'YYYY-MM-DD') };
				}
				break;
			}
		}

		return null;
	}

	private normalizeUnit(unit: string): moment.unitOfTime.DurationConstructor {
		switch (unit.toLowerCase()) {
			case 'day':
			case 'days':
				return 'days';
			case 'week':
			case 'weeks':
				return 'weeks';
			case 'month':
			case 'months':
				return 'months';
			case 'quarter':
			case 'quarters':
				return 'quarters';
			case 'year':
			case 'years':
				return 'years';
			default:
				return 'days';
		}
	}

	private unitToType(unit: moment.unitOfTime.DurationConstructor, currentType: PeriodicNoteType): PeriodicNoteType | null {
		switch (unit) {
			case 'days':
				return currentType === 'daily' ? 'daily' : null;
			case 'weeks':
				return 'weekly';
			case 'months':
				return 'monthly';
			case 'quarters':
				return 'quarterly';
			case 'years':
				return 'yearly';
			default:
				return null;
		}
	}
}