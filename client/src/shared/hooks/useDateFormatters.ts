import { useCallback } from "react";
import { useTimezone } from "../../contexts/TimezoneContext";
import {
  formatDateTime as formatDateTimeBase,
  formatDateTimeWithPrefix as formatDateTimeWithPrefixBase,
  formatDate as formatDateBase,
  formatRelativeTime,
  formatTime as formatTimeBase,
} from "../../lib/dateUtils";

export function useDateFormatters() {
  const { timezone } = useTimezone();

  const formatDateTime = useCallback(
    (date: string | Date) => formatDateTimeBase(date, timezone),
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

  const formatTime = useCallback(
    (date: string | Date) => formatTimeBase(date, timezone),
    [timezone]
  );

  return {
    timezone,
    formatDateTime,
    /** @deprecated Use formatDateTime instead */
    formatDateTimeShort: formatDateTime,
    formatDateTimeWithPrefix,
    formatDate,
    /** @deprecated Use formatDateTime instead */
    formatShortDateTime: formatDateTime,
    formatRelativeTime,
    formatTime,
  };
}
