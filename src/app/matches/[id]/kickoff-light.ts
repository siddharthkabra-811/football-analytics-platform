// Pitch centers from https://www.fchd.info/maps/GAZ.htm.
const venues = new Map([
  ["etihad stadium", { city: "Manchester", latitude: 53.483126, longitude: -2.200352 }],
  ["villa park", { city: "Birmingham", latitude: 52.50907, longitude: -1.88503 }],
  ["st james park", { city: "Newcastle upon Tyne", latitude: 54.975578, longitude: -1.621585 }],
]);

export function venueLocation(stadium: string | null | undefined) {
  return stadium ? venues.get(stadium.toLowerCase().replace(/[.'’]/g, "")) : undefined;
}

export function kickoffLight(kickoff: Date | null, venue: ReturnType<typeof venueLocation>) {
  if (!kickoff || !venue) return "neutral";

  // NOAA solar position approximation, evaluated at kickoff in UTC.
  // https://gml.noaa.gov/grad/solcalc/solareqns.PDF
  const year = kickoff.getUTCFullYear();
  const hour = kickoff.getUTCHours() + kickoff.getUTCMinutes() / 60 + kickoff.getUTCSeconds() / 3600;
  const day = (Date.UTC(year, kickoff.getUTCMonth(), kickoff.getUTCDate()) - Date.UTC(year, 0, 1)) / 86400000;
  const daysInYear = (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86400000;
  const angle = 2 * Math.PI / daysInYear * (day + (hour - 12) / 24);
  const equationOfTime = 229.18 * (.000075 + .001868 * Math.cos(angle) - .032077 * Math.sin(angle)
    - .014615 * Math.cos(2 * angle) - .040849 * Math.sin(2 * angle));
  const declination = .006918 - .399912 * Math.cos(angle) + .070257 * Math.sin(angle)
    - .006758 * Math.cos(2 * angle) + .000907 * Math.sin(2 * angle)
    - .002697 * Math.cos(3 * angle) + .00148 * Math.sin(3 * angle);
  const radians = Math.PI / 180;
  const latitude = venue.latitude * radians;
  const hourAngle = ((hour * 60 + equationOfTime + 4 * venue.longitude) / 4 - 180) * radians;
  const sineAltitude = Math.sin(latitude) * Math.sin(declination)
    + Math.cos(latitude) * Math.cos(declination) * Math.cos(hourAngle);

  if (sineAltitude >= Math.sin(-.833 * radians)) return "daylight";
  return sineAltitude >= Math.sin(-6 * radians) ? "twilight" : "night";
}
