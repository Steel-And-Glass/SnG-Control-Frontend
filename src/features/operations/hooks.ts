"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api/apiError";
export const cancelled = (e: unknown) => e instanceof Error && e.name === "AbortError";
export function useRead<T>(read: (signal: AbortSignal) => Promise<T>) {
 const [data,setData]=useState<{owner:typeof read;value:T}>(); const [error,setError]=useState<{owner:typeof read;value:unknown}>(); const [loading,setLoading]=useState(true); const current=useRef<AbortController|null>(null);
 const fetchData=useCallback(async(parent?:AbortSignal)=>{
  current.current?.abort(); const c=new AbortController();current.current=c;const signal=parent?AbortSignal.any([c.signal,parent]):c.signal;
  try {const value=await read(signal);signal.throwIfAborted();if(current.current===c){setData({owner:read,value});setError(undefined);}return value;}
  catch(e){if(!signal.aborted&&!cancelled(e)&&current.current===c)setError({owner:read,value:e});throw e;}
  finally{if(!signal.aborted&&current.current===c)setLoading(false);}
 },[read]);
 useEffect(()=>{void fetchData().catch(()=>{});return()=>current.current?.abort();},[fetchData]);
 const reload=useCallback((parent?:AbortSignal)=>{setLoading(true);setError(undefined);return fetchData(parent);},[fetchData]);
 return {data:data?.owner===read?data.value:undefined,error:error?.owner===read?error.value:undefined,loading:loading||(data?.owner!==read&&error?.owner!==read),reload,retry:()=>void reload().catch(()=>{})};
}
// The exact closure (including request key and expected revision) survives an uncertain write.
export function useOperation(refresh: (signal: AbortSignal) => Promise<unknown>) {
 const [error,setError]=useState<unknown>();const [busy,setBusy]=useState(false);const [pending,setPending]=useState<((signal:AbortSignal)=>Promise<unknown>)>();const [notice,setNotice]=useState("");
 const lock=useRef(false);const current=useRef<AbortController|null>(null);
 useEffect(()=>()=>current.current?.abort(),[]);
 async function run(work:(signal:AbortSignal)=>Promise<unknown>){
  if(lock.current)return;lock.current=true;setBusy(true);setError(undefined);setNotice("");const c=new AbortController();current.current=c;let written=false;
  try{await work(c.signal);c.signal.throwIfAborted();written=true;setPending(undefined);await refresh(c.signal);c.signal.throwIfAborted();setNotice("Operación registrada. Estado consultado nuevamente en el servidor.");}
  catch(e){if(!c.signal.aborted&&!cancelled(e)){setError(e);if(!written&&(!(e instanceof ApiError)||e.status===0||e.status>=500))setPending(()=>work);else setPending(undefined);if(e instanceof ApiError&&e.status===409)await refresh(c.signal).catch(()=>{});if(written)setNotice("La operación fue registrada; vuelve a consultar el estado. No repitas el envío.");}}
  finally{lock.current=false;if(!c.signal.aborted)setBusy(false);}
 }
 return {error,busy,notice,pending,disabled:busy||!!pending,run,retry:()=>pending&&void run(pending)};
}
