"use client";
import DatePicker from "react-datepicker";
import { de } from "date-fns/locale";
import { Timestamp } from "firebase/firestore";
import "react-datepicker/dist/react-datepicker.css";
import './date-input.css';

type Props = {
  value: Timestamp | null | any; // Allow any to handle bad data from form state
  onChange: (val: Timestamp | null) => void;
  placeholder?: string;
  minYear?: number;
  maxYear?: number;
  disabled?: boolean;
  className?: string;
  showMonthYearPicker?: boolean;
  dateFormat?: string;
};

const toDate = (ts: Timestamp | null | any): Date | null => {
  if (!ts) return null;
  let date: Date;

  if (ts instanceof Timestamp) {
    date = ts.toDate();
  } else if (typeof ts === 'object' && 'seconds' in ts && ts.seconds !== null && 'nanoseconds' in ts) {
    // Handle plain objects from Firestore serialization
    date = new Timestamp(ts.seconds, ts.nanoseconds).toDate();
  } else {
    // It might be a string, number, or something else, try to parse
    date = new Date(ts);
  }

  // Final check if the created date is valid
  if (isNaN(date.getTime())) {
    return null;
  }
  
  return date;
};


const toTs = (d: Date | null) => (d ? Timestamp.fromDate(d) : null);

export default function DateInput({
  value,
  onChange,
  placeholder = "TT.MM.JJJJ",
  minYear = 1950,
  maxYear = 2100,
  disabled,
  className = "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
  showMonthYearPicker = false,
  dateFormat = "dd.MM.yyyy",
}: Props) {
  return (
    <DatePicker
      selected={toDate(value)}
      onChange={(d) => onChange(toTs(d))}
      locale={de}
      dateFormat={dateFormat}
      placeholderText={placeholder}
      showMonthDropdown
      showYearDropdown
      dropdownMode="select"
      yearDropdownItemNumber={20}
      scrollableYearDropdown
      isClearable
      withPortal
      disabled={disabled}
      className={className}
      showMonthYearPicker={showMonthYearPicker}
    />
  );
}
