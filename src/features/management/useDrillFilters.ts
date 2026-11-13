import { useSyncExternalStore } from "react";
const subscribe=(notify:()=>void)=>{window.addEventListener("popstate",notify);return()=>window.removeEventListener("popstate",notify);};
// Server snapshot is empty; React synchronizes query filters after hydration.
export function useDrillFilters(){return new URLSearchParams(useSyncExternalStore(subscribe,()=>window.location.search,()=>""));}
export function clearDrillFilters(){window.history.replaceState(window.history.state,"",window.location.pathname);window.dispatchEvent(new PopStateEvent("popstate"));}
