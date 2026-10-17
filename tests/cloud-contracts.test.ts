import { describe, expect, it } from "vitest";
import { amount, customerCreate, materialCreate, saleCreate, costingSchema } from "../src/lib/cloud/contracts";
const id="00000000-0000-4000-8000-000000000001";
describe("cloud command trust boundary",()=>{
  it("rejects forged tenant authority and client financial totals",()=>{
    expect(customerCreate.safeParse({legalEntityId:id,idempotencyKey:id,name:"Customer",tenantId:id}).success).toBe(false);
    expect(saleCreate.safeParse({legalEntityId:id,idempotencyKey:id,customerId:id,totalTry:"1"}).success).toBe(false);
  });
  it("requires explicit bounded USD strings rather than formatted or negative prices",()=>{
    for(const v of ["1,25","-1","Infinity","1e8","1000000000","0.0000001",1.25])expect(amount.safeParse(v).success).toBe(false);
    for(const v of ["0","1.25","999999999.999999"])expect(amount.safeParse(v).success).toBe(true);
  });
  it("accepts a manually priced material without deriving a legacy sales price",()=>{
    const row=materialCreate.parse({legalEntityId:id,idempotencyKey:id,name:"Roll",unit:"square_meter",roll:true,margins:{left:2,right:2,top:2,bottom:2},variants:[{name:"152",widthCm:152,inStock:true,usdCost:null}]});
    expect(row.variants[0].usdCost).toBe(null);
  });
  it("rejects client overrides of expense unit rates",()=>{
    expect(costingSchema.safeParse({materials:[],expenses:[{typeId:id,quantity:1,usdAmount:0.01}],method:"margin",targetPercent:30,manualNetUsd:null,vat:20}).success).toBe(false);
  });
  it("preserves empty versus invalid customer contact values",()=>{
    const base={legalEntityId:id,idempotencyKey:id,name:"Customer"};
    expect(customerCreate.parse(base).email).toBe("");
    expect(customerCreate.safeParse({...base,email:"broken",taxId:"123"}).success).toBe(false);
  });
});
