// @vitest-environment node
import { afterEach,beforeEach,describe,it,expect,vi } from "vitest";
const {store,write}=vi.hoisted(()=>({store:{tcmb:null as unknown},write:vi.fn()}));
vi.mock("../src/lib/rate-store",()=>({readRateStore:async()=>store,writeRateStore:write}));
import {GET,POST} from "../src/app/api/exchange-rate/route";
beforeEach(()=>{write.mockReset();store.tcmb=null;});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
describe("TCMB demo endpoint and retired shared-key mutations",()=>{
 it("rejects unauthenticated manual mutation",async()=>{expect((await POST()).status).toBe(403);expect(write).not.toHaveBeenCalled();});
 it("old administrator token cannot bypass real authorization",async()=>{vi.stubEnv("PUSULA_RATE_ADMIN_TOKEN","test-only-admin-token-123456789");expect((await POST()).status).toBe(403);expect(write).not.toHaveBeenCalled();});
 it("does not persist a manual value in the global demo rate store",async()=>{expect((await POST()).status).toBe(403);expect(write).not.toHaveBeenCalled();});
 it("does not enable demo manual control from an environment token",async()=>{vi.stubEnv("PUSULA_RATE_ADMIN_TOKEN","test-only-admin-token-123456789");vi.stubGlobal("fetch",vi.fn().mockRejectedValue(new Error("offline")));expect((await (await GET()).json()).manualEnabled).toBe(false);});
 it("returns 503 without cached TCMB and never an example rate",async()=>{vi.stubGlobal("fetch",vi.fn().mockRejectedValue(new Error("offline")));const r=await GET();expect(r.status).toBe(503);expect((await r.json()).rate).toBeNull();});
 it("preserves last successful rate when TCMB is unavailable",async()=>{store.tcmb={value:49,source:"tcmb",publishedAt:"2026-10-14",fetchedAt:"2026-10-14T13:00:00Z"};vi.stubGlobal("fetch",vi.fn().mockRejectedValue(new Error("offline")));const r=await GET();expect(r.status).toBe(200);const body=await r.json();expect(body.rate).toEqual(store.tcmb);expect(body.stale).toBe(true);expect(write).not.toHaveBeenCalled();});
 it("never reports legacy manual success even if storage could write",async()=>{write.mockResolvedValueOnce(undefined);const r=await POST();expect(r.status).toBe(403);expect((await r.json()).rate).toBeUndefined();expect(write).not.toHaveBeenCalled();});
});
