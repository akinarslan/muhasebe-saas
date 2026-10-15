import type { CostSnapshot, RateSnapshot } from "./pricing-types";
export type Activity = "Reklam" | "Yazılım";
export type CustomerSegment = "Resmî kurum" | "Reklamcı" | "Mağaza-İşyeri";
export interface Tenant {
  id: string;
  name: string;
}
export interface LegalEntity {
  id: string;
  tenantId: string;
  name: string;
}
export interface User {
  id: string;
  tenantId: string;
  name: string;
  role: string;
}
export interface Customer {
  id: string;
  tenantId: string;
  legalEntityId: string;
  name: string;
  segment: CustomerSegment;
  city: string;
  district: string;
  phone: string;
  email: string;
  taxOffice?: string;
  taxId?: string;
  contact?: string;
  address?: string;
  notes?: string;
  term?: number;
}
export interface Product {
  id: string;
  name: string;
  activity: Activity;
  price: number;
  cost: number;
  unit: string;
  print: boolean;
}
export interface SaleLine {
  costSnapshot?: CostSnapshot;
  legacyCostTry?: number;
  priceOrigin?: "manual" | "calculator" | "legacy";
  id: string;
  productId: string;
  description: string;
  quantity: number;
  width: number;
  height: number;
  price: number;
  discount: number;
  vat: number;
}
export type PaymentMethod =
  "Nakit" | "Havale/EFT" | "Kredi kartı" | "Mail order" | "Çek" | "Senet";
export interface PaymentPlan {
  id: string;
  method: PaymentMethod;
  amount: number;
  dueDate: string;
}
export interface Payment {
  id: string;
  saleId: string;
  method: PaymentMethod;
  amount: number;
  date: string;
}
export interface Sale {
  rateSnapshot?: RateSnapshot;
  legacyDemo?: boolean;
  id: string;
  tenantId: string;
  legalEntityId: string;
  customerId: string;
  activity: Activity;
  date: string;
  dueDate: string;
  currency: "TRY" | "USD";
  lines: SaleLine[];
  plans: PaymentPlan[];
  payments: Payment[];
  notes: string;
}
export interface Receivable {
  saleId: string;
  customerId: string;
  amount: number;
  dueDate: string;
}
export interface Supplier {
  id: string;
  tenantId: string;
  name: string;
}
export interface Payable {
  id: string;
  supplierId: string;
  activity: Activity;
  date: string;
  dueDate: string;
  amount: number;
  paid: number;
}
export interface Draft {
  rateSnapshot?: RateSnapshot;
  activity: Activity;
  segment: CustomerSegment;
  customerId: string;
  currency: "TRY" | "USD";
  date: string;
  dueDate: string;
  lines: SaleLine[];
  plans: PaymentPlan[];
  paid: number;
  method: PaymentMethod;
  notes: string;
}
export interface DemoData {
  version: 1;
  customers: Customer[];
  sales: Sale[];
  payables: Payable[];
}
