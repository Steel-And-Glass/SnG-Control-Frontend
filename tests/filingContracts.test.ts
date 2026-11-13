import {expect,it} from "vitest";
import {parseFilings} from "@/features/engineering/filingContracts";
import browserResponse from "./fixtures/openingFilings.browser.json";
import dtoResponse from "./fixtures/openingFilings.dto.json";
// Browser 200 response supplied during smoke, anonymized without dropping keys/nulls.
it("accepts the browser 200 legacy response with source.modification.evidence",()=>{
 const parsed=parseFilings(browserResponse);expect(parsed.filings[0].structures).toHaveLength(6);expect(parsed.filings[0].blockedReason).toBe("LEGACY_INCOMPLETE_EVIDENCE");
});
it("isolates the offending modification from the rest of the browser response",()=>{
 const control=structuredClone(browserResponse);control.filings[0].structures[0].source.modification=null;
 expect(()=>parseFilings(control)).not.toThrow();
});
it("accepts the actual backend DTO serialization including nullable historical comparisons",()=>{
 expect(parseFilings(dtoResponse).filings).toHaveLength(2);
});

it.each(["extra","objectEvidence","missingEvidence","numericEvidence"])("rejects invalid modification %s without opening arbitrary fields",kind=>{
 const value=structuredClone(browserResponse);const m=value.filings[0].structures[0].source.modification as unknown as Record<string,unknown>;
 if(kind==="extra")m.unknown="private";if(kind==="objectEvidence")m.evidence={arbitrary:true};if(kind==="missingEvidence")delete m.evidence;if(kind==="numericEvidence")m.evidence=1;
 expect(()=>parseFilings(value)).toThrow();
});
it("keeps evidence opaque, never executing or interpreting its serialized content",()=>{
 const value=structuredClone(browserResponse);value.filings[0].structures[0].source.modification!.evidence="opaque non-JSON evidence";
 expect(parseFilings(value).filings[0].structures[0].source.modification?.evidence).toBe("opaque non-JSON evidence");
});
it("rejects unknown source fields, malformed comparison values and writable blocked filings",()=>{
 const unknown=structuredClone(browserResponse);Object.assign(unknown.filings[0].structures[0].source,{unknown:"value"});expect(()=>parseFilings(unknown)).toThrow();
 const comparison=structuredClone(browserResponse);Object.assign(comparison.filings[0].structures[0].source.comparison!,{width:"5"});expect(()=>parseFilings(comparison)).toThrow();
 const blocked=structuredClone(browserResponse);blocked.filings[0].canModify=true;expect(()=>parseFilings(blocked)).toThrow();
});
