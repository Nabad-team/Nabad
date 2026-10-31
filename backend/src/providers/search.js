const { EMERGENCY_NEEDS } = require("../triage/emergencyNeeds");
const Provider = require("../models/Provider");
const { openingStatus } = require("./hours");

// Both $text and $geoNear must be the first indexed stage. For combined searches,
// resolve text matches to IDs, then let the geospatial index order/filter those IDs.
async function searchProviders(query, favorites, now = new Date()) {
  const match = {};
  for (const key of ["specialty", "service"]) if (query[key]) match[key === "specialty" ? "specialties" : "services"] = query[key];
  for (const key of ["city", "district", "governorate"]) if (query[key]) match[key] = new RegExp(`^${query[key].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
  if (query.insurance) match.insurances = query.insurance;
  if (query.emergency24h) match.emergency24h = true;
  if (query.emergencyNeeds?.length) {
    match.type = "hospital";
    match.emergency24h = true;
    for (const field of ["specialties", "services"]) {
      const required = [...new Set(query.emergencyNeeds.flatMap(id => EMERGENCY_NEEDS[id][field]))];
      if (required.length) match[field] = { $all: [...new Set([...required, ...(match[field] ? [match[field]] : [])])] };
    }
  }
  if (query.favorites) match.slug = { $in: favorites || [] };
  // Words/phrases only: do not interpret quotes or leading '-' as search operators.
  const words = (query.q || "").match(/[\p{L}\p{N}]+/gu) || [];
  const text = words.map(word => `"${word}"`).join(" ");
  if (query.q && !words.length) match._id = { $in: [] };
  const geo = query.lat !== undefined;
  if (text) {
    if (geo) match._id = { $in: await Provider.find({ ...match, $text: { $search: text } }).distinct("_id") };
    else match.$text = { $search: text };
  }
  const pipeline = geo ? [{ $geoNear: {
    near: { type: "Point", coordinates: [query.lng, query.lat] }, key: "location", spherical: true,
    distanceField: "distanceKm", distanceMultiplier: 0.001, query: match,
    ...(query.radiusKm === undefined ? {} : { maxDistance: query.radiusKm * 1000 }),
  } }] : [{ $match: match }];
  if (query.openNow) pipeline.push({ $match: openNowMatch(now) });
  pipeline.push({ $sort: geo ? { distanceKm: 1, name: 1, slug: 1 } : { name: 1, slug: 1 } },
    { $facet: { providers: [{ $skip: (query.page - 1) * query.limit }, { $limit: query.limit }], count: [{ $count: "total" }] } });
  const [result, specialties, cities, services, governorates, districts, insurances] = await Promise.all([
    Provider.aggregate(pipeline), Provider.distinct("specialties"), Provider.distinct("city"), Provider.distinct("services"), Provider.distinct("governorate"),
    Provider.distinct("district"), Provider.distinct("insurances"),
  ]);
  return { providers: result[0].providers.map(p => ({ ...p, openingStatus: openingStatus(p, now) })), total: result[0].count[0]?.total || 0,
    page: query.page, limit: query.limit, specialties: choices(specialties), cities: choices(cities), services: choices(services), governorates: choices(governorates), districts: choices(districts), insurances: choices(insurances) };
}
const choices = values => values.filter(value => typeof value === "string" && value.length > 0).sort();

// Evaluate schedules in MongoDB before count/pagination, using the same Beirut clock.
function openNowMatch(now) {
  const { beirutClock } = require("./hours");
  const { day, minute } = beirutClock(now);
  return { $or: [{ emergency24h: true }, { hoursKnown: true, $expr: { $anyElementTrue: { $map: {
    input: { $ifNull: ["$hours", []] }, as: "slot", in: { $cond: [
      { $gt: ["$$slot.end", "$$slot.start"] },
      { $and: [{ $eq: ["$$slot.day", day] }, { $lte: ["$$slot.start", minute] }, { $gt: ["$$slot.end", minute] }] },
      { $or: [{ $and: [{ $eq: ["$$slot.day", day] }, { $lte: ["$$slot.start", minute] }] },
        { $and: [{ $eq: [{ $mod: [{ $add: ["$$slot.day", 1] }, 7] }, day] }, { $gt: ["$$slot.end", minute] }] }] },
    ] },
  } } } }] };
}
module.exports = { searchProviders, openNowMatch };
