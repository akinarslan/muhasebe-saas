import type { Customer, Draft } from "./types";
import { emptyDraft } from "./mock";
import { localISO } from "./finance";

export type CustomerTarget = { customerId: string; segment: Draft["segment"]; term: number };

export function customerTarget(customer: Customer | undefined, segment: Draft["segment"]): CustomerTarget {
  return { customerId: customer?.id ?? "", segment: customer?.segment ?? segment, term: customer?.term ?? 30 };
}

// Dates/payment method can also contain customer-specific terms without any lines.
export function hasCustomerDraftData(draft: Draft, currentTerm = 30): boolean {
  const expectedDue = new Date(`${draft.date}T12:00:00`);
  expectedDue.setDate(expectedDue.getDate() + currentTerm);
  return Boolean(draft.lines.length || draft.plans.length || draft.paid !== 0 ||
    draft.notes || draft.rateSnapshot || draft.method !== emptyDraft().method ||
    draft.dueDate !== localISO(expectedDue));
}

export function switchDraftCustomer(draft: Draft, target: CustomerTarget): Draft {
  const due = new Date(`${draft.date}T12:00:00`);
  due.setDate(due.getDate() + target.term);
  return { ...emptyDraft(), activity: draft.activity, currency: draft.currency,
    date: draft.date, dueDate: localISO(due), customerId: target.customerId, segment: target.segment };
}
