export function isAllowedProfileTimezone(
  candidate: string,
): boolean {
  if (
    /^(utc|gmt)?[+-]/i.test(candidate) ||
    /^etc\//i.test(candidate)
  ) {
    return false;
  }

  try {
    new Intl.DateTimeFormat("en-US", {
      timeZone: candidate,
    });

    return true;
  } catch {
    return false;
  }
}
