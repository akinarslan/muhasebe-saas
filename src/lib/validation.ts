import { z } from "zod";
import { methods, segments } from "./mock";
const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Geçerli tarih girin.");
export const draftSchema = z
  .object({
    activity: z.enum(["Reklam", "Yazılım"]),
    segment: z.enum(segments),
    customerId: z.string().min(1, "Bir müşteri seçin."),
    currency: z.enum(["TRY", "USD"]),
    date: iso,
    dueDate: iso,
    lines: z
      .array(
        z.object({
          id: z.string(),
          productId: z.string().min(1),
          description: z.string().trim().min(1, "Açıklama boş olamaz."),
          quantity: z
            .number()
            .positive("Miktar sıfırdan büyük olmalı.")
            .max(100000),
          width: z.number().positive().max(100000),
          height: z.number().positive().max(100000),
          price: z.number().nonnegative().max(1e9),
          discount: z.number().min(0).max(100),
          vat: z.number().min(0).max(100),
        }),
      )
      .min(1, "En az bir ürün veya hizmet ekleyin."),
    paid: z.number().nonnegative(),
    method: z.enum(methods),
    plans: z.array(
      z.object({
        id: z.string(),
        method: z.enum(methods),
        amount: z.number().positive("Plan tutarı sıfırdan büyük olmalı."),
        dueDate: iso,
      }),
    ),
    notes: z.string(),
  })
  .refine((v) => v.dueDate >= v.date, {
    message: "Vade satış tarihinden önce olamaz.",
    path: ["dueDate"],
  })
  .refine((v) => v.plans.every((p) => p.dueDate >= v.date), {
    message: "Plan vadesi satış tarihinden önce olamaz.",
    path: ["plans"],
  });
