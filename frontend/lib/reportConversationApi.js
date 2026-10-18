import { request } from "./api";

const path = (profileId) => `/reports/conversations?profileId=${encodeURIComponent(profileId || "self")}`;

export const getReportConversations = (profileId) => request(path(profileId));

export const deleteReportConversation = (profileId, conversationId) =>
  request(`/reports/conversations/${encodeURIComponent(conversationId)}?profileId=${encodeURIComponent(profileId || "self")}`, { method: "DELETE" });
