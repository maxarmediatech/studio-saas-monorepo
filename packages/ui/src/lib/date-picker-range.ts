const DEFAULT_FUTURE_YEAR_COUNT = 10;

export function getDefaultDatePickerEndMonth(today = new Date()) {
	return new Date(today.getFullYear() + DEFAULT_FUTURE_YEAR_COUNT, 11, 31);
}
