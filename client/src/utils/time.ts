const SANTIAGO_TZ = "America/Santiago";

const dateTimeFormatter = new Intl.DateTimeFormat("es-CL", {
  timeZone: SANTIAGO_TZ,
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});

export function formatKickoff(isoUtc: string): string {
  return dateTimeFormatter.format(new Date(isoUtc));
}
