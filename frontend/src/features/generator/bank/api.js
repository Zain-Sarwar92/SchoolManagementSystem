import api from "../../../services/api.js";
import { dbSubTypesForField } from "./questionTypes.js";

/** GET /generator/catalog */
export async function fetchCatalog() {
  const { data } = await api.get("/generator/catalog");
  return data;
}

/** GET /generator/subjects/:id/syllabus */
export async function fetchSubjectSyllabus(subjectId) {
  const { data } = await api.get(`/generator/subjects/${subjectId}/syllabus`);
  return data;
}

/**
 * Shared body for pool search / pick.
 * Resolves catalog field → DB subTypes (PAIR/WORD aliases etc.).
 */
export function buildPoolBody({
  subjectId,
  topicIds,
  chapterIds,
  type,
  subType,
  field,
  source = "ALL",
  excludeIds,
  limit,
  count,
  mode,
  chapterQuotas,
  topicUsage,
} = {}) {
  const fieldKey = field || subType || null;
  const subTypes = fieldKey ? dbSubTypesForField(fieldKey) : undefined;
  const body = {
    subjectId,
    type,
    source: source || "ALL",
  };
  if (Array.isArray(topicIds) && topicIds.length) body.topicIds = topicIds;
  if (Array.isArray(chapterIds) && chapterIds.length) {
    body.chapterIds = chapterIds;
  }
  if (subTypes?.length) {
    body.subTypes = subTypes;
    body.subType = subTypes[0];
  }
  if (Array.isArray(excludeIds) && excludeIds.length) {
    body.excludeIds = excludeIds;
  }
  if (limit != null) body.limit = limit;
  if (count != null) body.count = count;
  if (mode) body.mode = mode;
  if (Array.isArray(chapterQuotas) && chapterQuotas.length) {
    body.chapterQuotas = chapterQuotas;
  }
  if (topicUsage && typeof topicUsage === "object" && !Array.isArray(topicUsage)) {
    body.topicUsage = topicUsage;
  }
  return body;
}

/** POST /generator/pool/search */
export async function searchPool(params) {
  const body =
    params && params.subjectId && params.type && !params.subTypes
      ? buildPoolBody(params)
      : params;
  const { data } = await api.post("/generator/pool/search", body);
  return data;
}

/** POST /generator/pool/pick — mode BALANCED | RANDOM */
export async function pickPool(params) {
  const body =
    params && params.subjectId && params.type && !params.subTypes
      ? buildPoolBody(params)
      : params;
  const { data } = await api.post("/generator/pool/pick", body);
  return data;
}
