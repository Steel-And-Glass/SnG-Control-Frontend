import type { ApiClient, JsonValue } from "@/lib/api/types";
import { ApiError } from "@/lib/api/apiError";
import { array, parsePreparation, parseRelease, parseDetail, parseReview, parseView, parseJob, parseHistory, parseResult, parseAttachment, type Command } from "./contracts";
const root = "operations";
const prep = (id: string) => `${root}/preparations/${id}`;
const query = (skip: number) => new URLSearchParams({skip:String(skip)});
export const operationsService = {
 releases: async (api: ApiClient, skip: number, signal: AbortSignal) => array(await api.get(`${root}/releases`, {query:query(skip),signal}),parseRelease,50),
 preparations: async (api: ApiClient, skip: number, signal: AbortSignal) => array(await api.get(`${root}/preparations`, {query:query(skip),signal}),parsePreparation,50),
 create: async (api: ApiClient, id: string, signal: AbortSignal) => parseDetail(await api.post(`${root}/releases/${id}/preparation`,undefined,{signal})),
 detail: async (api: ApiClient, id: string, signal: AbortSignal) => parseDetail(await api.get(prep(id),{signal})),
 extract: async (api: ApiClient, id: string, signal: AbortSignal) => parseJob(await api.post(`${prep(id)}/extraction`,undefined,{signal})),
 job: async (api: ApiClient, id: string, signal: AbortSignal) => {try{return parseJob(await api.get(`${prep(id)}/extraction`,{signal}));}catch(e){if(e instanceof ApiError&&e.status===404)return null;throw e;}},
 reviews: async (api: ApiClient, id: string, signal: AbortSignal) => array(await api.get(`${prep(id)}/reviews`,{signal}),parseReview,100),
 review: async (api: ApiClient, id: string, review: string, signal: AbortSignal) => parseView(await api.get(`${prep(id)}/reviews/${review}`,{signal})),
 command: async (api: ApiClient, id: string, command: Command, signal: AbortSignal) => parseResult(await api.post(`${prep(id)}/reviews/commands`,command as unknown as JsonValue,{signal})),
 history: async (api: ApiClient, id: string, skip: number, signal: AbortSignal) => array(await api.get(`${prep(id)}/reviews/history`,{query:query(skip),signal}),parseHistory,100),
 upload: async (api: ApiClient, id: string, requestKey: string, file: File, signal: AbortSignal) => {const form=new FormData();form.set("requestKey",requestKey);form.set("file",file);return parseAttachment(await api.upload(`${prep(id)}/reviews/evidence`,form,{signal}));},
 download: (api: ApiClient,id: string,document: string,attachment: boolean,signal: AbortSignal) => api.downloadStream(`${prep(id)}/reviews/${attachment?"evidence":"sources"}/${document}`,{signal}),
};
