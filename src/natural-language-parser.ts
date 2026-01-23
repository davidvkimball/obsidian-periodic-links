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
	private writtenNumbers: Record<string, number> = {
		'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
		'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
		'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
		'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20,
		'thirty': 30, 'forty': 40, 'fifty': 50, 'sixty': 60, 'seventy': 70,
		'eighty': 80, 'ninety': 90
	};

	private weekdays: Record<string, number> = {
		'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
		'thursday': 4, 'friday': 5, 'saturday': 6
	};

	private parseNumber(word: string): number | null {
		const lower = word.toLowerCase();
		if (this.writtenNumbers[lower]) {
			return this.writtenNumbers[lower];
		}
		const num = parseInt(lower);
		return isNaN(num) ? null : num;
	}

	private isValidPluralization(count: number, unit: string): boolean {
		// For count = 1, accept both "day" and "days"
		// For count > 1, require plural form ("days", not "day")
		if (count === 1) {
			return unit === 'day' || unit === 'days' || unit === 'week' || unit === 'weeks' ||
				   unit === 'month' || unit === 'months' || unit === 'quarter' || unit === 'quarters' ||
				   unit === 'year' || unit === 'years';
		} else {
			const isPlural = unit.endsWith('s');
			return isPlural;
		}
	}

	parsePhrase(phrase: string, currentType: PeriodicNoteType | null, currentFile: TFile, enableWrittenNumbers: boolean = true, workAcrossAllPeriodicNotes: boolean = false, workEverywhere: boolean = false): LinkTarget | null {
		const now = moment();

		// Handle current file's date as reference point
		let referenceDate: moment.Moment;
		if (currentType) {
			const config = this.extractDateFromFilename(currentFile.basename, currentType);
			if (config) {
				referenceDate = config.date;
			} else {
				referenceDate = now;
			}
		} else {
			referenceDate = now;
		}

		const lowerPhrase = phrase.toLowerCase().trim();

		// Static phrases
		switch (lowerPhrase) {
			case 'yesterday':
				if (workAcrossAllPeriodicNotes || currentType === 'daily') {
					return { type: 'daily', date: referenceDate.clone().subtract(1, 'day') };
				}
				break;

			case 'tomorrow':
				if (workAcrossAllPeriodicNotes || currentType === 'daily') {
					return { type: 'daily', date: referenceDate.clone().add(1, 'day') };
				}
				break;

			case 'last week':
				if (workAcrossAllPeriodicNotes || currentType === 'weekly' || currentType === 'daily') {
					return { type: 'weekly', date: referenceDate.clone().subtract(1, 'week') };
				}
				break;

			case 'next week':
				if (workAcrossAllPeriodicNotes || currentType === 'weekly' || currentType === 'daily') {
					return { type: 'weekly', date: referenceDate.clone().add(1, 'week') };
				}
				break;

			case 'this week':
				if (workAcrossAllPeriodicNotes || currentType === 'daily') {
					return { type: 'weekly', date: referenceDate.clone() };
				}
				break;

			case 'last month':
				if (workAcrossAllPeriodicNotes || currentType === 'monthly' || currentType === 'weekly' || currentType === 'daily') {
					return { type: 'monthly', date: referenceDate.clone().subtract(1, 'month') };
				}
				break;

			case 'next month':
				if (workAcrossAllPeriodicNotes || currentType === 'monthly' || currentType === 'weekly' || currentType === 'daily') {
					return { type: 'monthly', date: referenceDate.clone().add(1, 'month') };
				}
				break;

			case 'this month':
				if (workAcrossAllPeriodicNotes || currentType === 'weekly' || currentType === 'daily') {
					return { type: 'monthly', date: referenceDate.clone() };
				}
				break;

			case 'last quarter':
			case 'previous quarter':
				if (workAcrossAllPeriodicNotes || currentType === 'quarterly' || currentType === 'monthly' || currentType === 'weekly' || currentType === 'daily') {
					return { type: 'quarterly', date: referenceDate.clone().subtract(3, 'months') };
				}
				break;

			case 'next quarter':
				if (workAcrossAllPeriodicNotes || currentType === 'quarterly' || currentType === 'monthly' || currentType === 'weekly' || currentType === 'daily') {
					return { type: 'quarterly', date: referenceDate.clone().add(3, 'months') };
				}
				break;

			case 'this quarter':
				if (workAcrossAllPeriodicNotes || currentType === 'monthly' || currentType === 'weekly' || currentType === 'daily') {
					return { type: 'quarterly', date: referenceDate.clone() };
				}
				break;

			case 'last year':
			case 'previous year':
				if (workAcrossAllPeriodicNotes || currentType === 'yearly' || currentType === 'quarterly' || currentType === 'monthly' || currentType === 'weekly' || currentType === 'daily') {
					return { type: 'yearly', date: referenceDate.clone().subtract(1, 'year') };
				}
				break;

			case 'next year':
				if (workAcrossAllPeriodicNotes || currentType === 'yearly' || currentType === 'quarterly' || currentType === 'monthly' || currentType === 'weekly' || currentType === 'daily') {
					return { type: 'yearly', date: referenceDate.clone().add(1, 'year') };
				}
				break;

			case 'this year':
				if (workAcrossAllPeriodicNotes || currentType === 'quarterly' || currentType === 'monthly' || currentType === 'weekly' || currentType === 'daily') {
					return { type: 'yearly', date: referenceDate.clone() };
				}
				break;
		}

		// Dynamic patterns
		// Dynamic patterns with written number support and proper pluralization
		const numberPattern = enableWrittenNumbers
			? '(\\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)'
			: '(\\d+)';
		// Use stricter pluralization: require 's' for plural forms when number > 1
		const unitPattern = '(days?|weeks?|months?|quarters?|years?)';

		// Helper function to validate pluralization
		const isValidPluralization = (count: number, unit: string): boolean => {
			const isPlural = unit.endsWith('s');
			const shouldBePlural = count !== 1;
			return isPlural === shouldBePlural;
		};

		// X units ago
		const agoPattern = new RegExp(`${numberPattern}\\s+${unitPattern}\\s+ago`, 'i');
		const agoMatch = phrase.match(agoPattern);
		if (agoMatch && agoMatch[1] && agoMatch[2]) {
			const count = this.parseNumber(agoMatch[1]);
			const unit = this.normalizeUnit(agoMatch[2]);
			if (count && unit && isValidPluralization(count, agoMatch[2])) {
				const type = this.unitToType(unit, currentType, workAcrossAllPeriodicNotes);
				if (type) {
					return { type, date: referenceDate.clone().subtract(count, unit) };
				}
			}
		}

		// in X units
		const inPattern = new RegExp(`in\\s+${numberPattern}\\s+${unitPattern}`, 'i');
		const inMatch = phrase.match(inPattern);
		if (inMatch && inMatch[1] && inMatch[2]) {
			const count = this.parseNumber(inMatch[1]);
			const unit = this.normalizeUnit(inMatch[2]);
			if (count && unit && isValidPluralization(count, inMatch[2])) {
				const type = this.unitToType(unit, currentType, workAcrossAllPeriodicNotes);
				if (type) {
					return { type, date: referenceDate.clone().add(count, unit) };
				}
			}
		}

		// X units from now
		const fromNowPattern = new RegExp(`${numberPattern}\\s+${unitPattern}\\s+from\\s+now`, 'i');
		const fromNowMatch = phrase.match(fromNowPattern);
		if (fromNowMatch && fromNowMatch[1] && fromNowMatch[2]) {
			const count = this.parseNumber(fromNowMatch[1]);
			const unit = this.normalizeUnit(fromNowMatch[2]);
			if (count && unit && isValidPluralization(count, fromNowMatch[2])) {
				const type = this.unitToType(unit, currentType, workAcrossAllPeriodicNotes);
				if (type) {
					return { type, date: now.clone().add(count, unit) };
				}
			}
		}

		// Weekday-specific patterns
		const weekdayPattern = '(sunday|monday|tuesday|wednesday|thursday|friday|saturday)';

		// next/last [weekday]
		const nextLastWeekdayPattern = new RegExp(`(next|last)\\s+${weekdayPattern}`, 'i');
		const nextLastMatch = phrase.match(nextLastWeekdayPattern);
		if (nextLastMatch && nextLastMatch[1] && nextLastMatch[2]) {
			const direction = nextLastMatch[1].toLowerCase();
			const weekdayName = nextLastMatch[2].toLowerCase();
			const weekday = this.weekdays[weekdayName];

			if (weekday !== undefined) {
				const isFuture = direction === 'next';
				const date = this.calculateWeekdayDate(weekday, 1, isFuture, referenceDate);
				const type = this.unitToType('days', currentType, workAcrossAllPeriodicNotes);
				if (type) {
					return { type, date };
				}
			}
		}

		// [number] [weekday] from now / ago
		const numberWeekdayPattern = new RegExp(`${numberPattern}\\s+${weekdayPattern}\\s+(from\\s+now|ago)`, 'i');
		const numberWeekdayMatch = phrase.match(numberWeekdayPattern);
		if (numberWeekdayMatch && numberWeekdayMatch[1] && numberWeekdayMatch[2] && numberWeekdayMatch[3]) {
			const count = this.parseNumber(numberWeekdayMatch[1]);
			const weekdayName = numberWeekdayMatch[2].toLowerCase();
			const direction = numberWeekdayMatch[3].toLowerCase();
			const weekday = this.weekdays[weekdayName];

			if (count && weekday !== undefined) {
				const isFuture = direction === 'from now';
				const date = this.calculateWeekdayDate(weekday, count, isFuture, referenceDate);
				const type = this.unitToType('days', currentType, workAcrossAllPeriodicNotes);
				if (type) {
					return { type, date };
				}
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

	private unitToType(unit: moment.unitOfTime.DurationConstructor, currentType: PeriodicNoteType | null, workAcrossAllPeriodicNotes: boolean): PeriodicNoteType | null {
		switch (unit) {
			case 'days':
				return workAcrossAllPeriodicNotes || currentType === 'daily' ? 'daily' : null;
			case 'weeks':
				return workAcrossAllPeriodicNotes || currentType === 'weekly' || currentType === 'daily' ? 'weekly' : null;
			case 'months':
				return workAcrossAllPeriodicNotes || currentType === 'monthly' || currentType === 'weekly' || currentType === 'daily' ? 'monthly' : null;
			case 'quarters':
				return workAcrossAllPeriodicNotes || currentType === 'quarterly' || currentType === 'monthly' || currentType === 'weekly' || currentType === 'daily' ? 'quarterly' : null;
			case 'years':
				return 'yearly'; // Always allow yearly since it's the top level
			default:
				return null;
		}
	}

	private calculateWeekdayDate(weekday: number, count: number = 1, isFuture: boolean = true, referenceDate: Moment = moment()): Moment {
		const currentDay = referenceDate.day();
		let daysToAdd: number;

		if (isFuture) {
			// For future dates - always find the NEXT occurrence, never today
			if (weekday > currentDay) {
				daysToAdd = weekday - currentDay;
			} else if (weekday === currentDay) {
				daysToAdd = 7; // Next week if it's today
			} else {
				daysToAdd = 7 - (currentDay - weekday);
			}
			// Add additional weeks for count > 1
			daysToAdd += (count - 1) * 7;
		} else {
			// For past dates - always find the PREVIOUS occurrence, never today
			if (weekday < currentDay) {
				daysToAdd = -(currentDay - weekday);
			} else if (weekday === currentDay) {
				daysToAdd = -7; // Previous week if it's today
			} else {
				daysToAdd = -(7 - (weekday - currentDay));
			}
			// Subtract additional weeks for count > 1
			daysToAdd -= (count - 1) * 7;
		}

		return referenceDate.clone().add(daysToAdd, 'days');
	}
}