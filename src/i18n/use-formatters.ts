import { useFormatter, useLocale, useTranslations } from "next-intl";

export interface FormatCurrencyOptions {
  currency?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

export interface FormatDateOptions {
  dateStyle?: "full" | "long" | "medium" | "short";
  timeStyle?: "full" | "long" | "medium" | "short";
  year?: "numeric" | "2-digit";
  month?: "numeric" | "2-digit" | "narrow" | "short" | "long";
  day?: "numeric" | "2-digit";
}

export function useFormatters() {
  const formatter = useFormatter();
  const locale = useLocale();
  const t = useTranslations();

  /**
   * Formats a monetary amount using the active locale from next-intl.
   */
  function formatAmount(amount: number, options: FormatCurrencyOptions = {}): string {
    const {
      currency = "USD",
      minimumFractionDigits,
      maximumFractionDigits,
    } = options;

    return formatter.number(amount, {
      style: "currency",
      currency,
      ...(minimumFractionDigits !== undefined ? { minimumFractionDigits } : {}),
      ...(maximumFractionDigits !== undefined ? { maximumFractionDigits } : {}),
    });
  }

  /**
   * Formats a date or timestamp using the active locale from next-intl.
   */
  function formatDate(
    value: Date | number | string,
    options: FormatDateOptions = { dateStyle: "medium" },
  ): string {
    const date = value instanceof Date ? value : new Date(value);
    return formatter.dateTime(date, options);
  }

  /**
   * Formats a pluralized count using next-intl message/number formatting.
   */
  function formatCount(
    count: number,
    options?: { key?: string; values?: Record<string, string | number> },
  ): string {
    if (options?.key) {
      return t(options.key, { count, ...options.values });
    }
    return formatter.number(count);
  }

  return {
    locale,
    formatAmount,
    formatDate,
    formatCount,
    raw: formatter,
  };
}