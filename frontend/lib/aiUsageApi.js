import { request } from "./api";

// The account's AI use today against its daily limits (backend routes/aiUsage.js). All its profiles count together.
// -> { timeZone, resetsAt, symptomChecks, assistantMessages, historyQuestions, prescriptionReads, reportAnalyses },
//    each { feature, used, limit, remaining, resetsAt }.
export const getAiUsage = async (signal) => request("/ai-usage", { signal });

// The daily-limit details of an error from an AI feature, or null when it is another error.
export const dailyLimitOf = (error) => (error?.code === "daily_ai_limit" && error.dailyLimit ? error.dailyLimit : null);
