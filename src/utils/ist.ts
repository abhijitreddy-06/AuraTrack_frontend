export const IST_TIME_ZONE = "Asia/Kolkata";

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: IST_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export const getISTDate = (instant = new Date()) => {
  const values = Object.fromEntries(
    dateFormatter
      .formatToParts(instant)
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
};

// Noon UTC keeps a DATEONLY database value on the same calendar day in IST.
export const dateOnlyToDate = (date: string) => new Date(`${date}T12:00:00.000Z`);

export const formatISTDate = (
  date: string | Date,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" },
) =>
  (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? dateOnlyToDate(date)
    : new Date(date)
  ).toLocaleDateString("en-IN", { ...options, timeZone: IST_TIME_ZONE });
