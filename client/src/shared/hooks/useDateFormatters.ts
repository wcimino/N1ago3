import { useCallback } from "react";
import { useTimezone } from "../../contexts/TimezoneContext";
import {
  formatDateTime as formatDateTimeBase,
  formatDateTimeShort as formatDateTimeShortBase,
  formatDateTimeWithPrefix as formatDateTimeWithPrefixBase,
  formatDate as formatDateBase,
  formatShortDateTime as formatShortDateTimeBase,
  formatRelativeTime,
  formatTime as formatTimeBase,
} from "../../lib/dateUtils";

export function useDateFormatters() {
  const { timezone } = useTimezone();

  const formatDateTime = useCallback(
    (date: string | Date) => formatDateTimeBase(date, timezone),
    [timezone]
  );

  const formatDateTimeShort = useCallback(
    (date: string | Date) => formatDateTimeShortBase(date, timezone),
    [timezone]
  );

  const formatDateTimeWithPrefix = useCallback(
    (date: string | Date) => formatDateTimeWithPrefixBase(date, timezone),
    [timezone]
  );

  const formatDate = useCallback(
    (date: string | Date) => formatDateBase(date, timezone),
    [timezone]
  );

  const formatShortDateTime = useCallback(
    (date: string | Date) => formatShortDateTimeBase(date, timezone),
    [timezone]
  );

  const formatTime = useCallback(
    (date: string | Date) => formatTimeBase(date, timezone),
    [timezone]
  );

  return {
    timezone,
    formatDateTime,
    formatDateTimeShort,
    formatDateTimeWithPrefix,
    formatDate,
    formatShortDateTime,
    formatRelativeTime,
    formatTime,
  };
}
