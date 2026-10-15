"use client";
import { createId } from "@/lib/runtime";

import * as Dialog from "@radix-ui/react-dialog";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X, UserRoundPlus, ChevronDown } from "lucide-react";
import cities from "@/data/cities.json";
import { segments, tenant, entity } from "@/lib/mock";
import { normalize } from "@/lib/finance";
import type { Customer } from "@/lib/types";
import { Button } from "./ui/button";
const schema = z
  .object({
    name: z.string().trim().min(2, "En az 2 karakter girin."),
    segment: z.enum(segments),
    city: z.string(),
    district: z.string(),
    phone: z
      .string()
      .refine(
        (v) => !v || /^[+\d\s()-]{10,20}$/.test(v),
        "Geçerli bir telefon girin.",
      ),
    email: z
      .string()
      .refine(
        (v) => !v || z.email().safeParse(v).success,
        "Geçerli bir e-posta girin.",
      ),
    taxOffice: z.string(),
    taxId: z
      .string()
      .refine(
        (v) => !v || /^\d{10,11}$/.test(v),
        "VKN 10, TCKN 11 rakam olmalıdır.",
      ),
    contact: z.string(),
    address: z.string(),
    notes: z.string(),
    term: z.number().min(0).max(365),
  })
  .refine(
    (v) =>
      !v.district ||
      cities.find((c) => c.name === v.city)?.districts.includes(v.district),
    { path: ["district"], message: "İle bağlı bir ilçe seçin." },
  );
type Values = z.infer<typeof schema>;
export function CustomerDrawer({
  open,
  onOpenChange,
  customers,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  customers: Customer[];
  onSave: (c: Customer) => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    reset,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      segment: "Mağaza-İşyeri",
      city: "",
      district: "",
      phone: "",
      email: "",
      taxOffice: "",
      taxId: "",
      contact: "",
      address: "",
      notes: "",
      term: 30,
    },
  });
  const city = useWatch({ control, name: "city" });
  function submit(v: Values) {
    if (
      customers.some(
        (c) =>
          normalize(c.name) === normalize(v.name) ||
          (v.taxId && c.taxId === v.taxId),
      )
    ) {
      setError("root", {
        message:
          "Bu isim veya VKN/TCKN ile bir müşteri zaten var. Mevcut kaydı kontrol edin.",
      });
      return;
    }
    try {
      onSave({
        ...v,
        id: createId(),
        tenantId: tenant.id,
        legalEntityId: entity.id,
      });
    } catch {
      setError("root", {
        message:
          "Müşteri kaydedilemedi. Bilgileriniz korunuyor; yeniden deneyin.",
      });
      return;
    }
    reset();
  }
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="drawer-overlay" />
        <Dialog.Content className="drawer">
          <header className="drawer-head">
            <span className="icon-tile">
              <UserRoundPlus size={21} />
            </span>
            <div>
              <Dialog.Title>Yeni müşteri</Dialog.Title>
              <Dialog.Description>
                Müşterinizi ekleyin, kaldığınız yerden devam edin.
              </Dialog.Description>
            </div>
            <Dialog.Close className="icon-button" aria-label="Paneli kapat">
              <X size={20} />
            </Dialog.Close>
          </header>
          <form onSubmit={handleSubmit(submit)} className="drawer-form">
            <div className="drawer-body">
              <div className="info-box">
                Bu kayıt yalnızca bu tarayıcıdaki demo verilerine eklenir.
              </div>
              <h3>Müşteri bilgileri</h3>
              <label>
                Segment <span>*</span>
                <select {...register("segment")}>
                  {segments.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                Şirket / kurum adı <span>*</span>
                <input
                  placeholder="Örn. Armoni Tasarım"
                  {...register("name")}
                  aria-invalid={!!errors.name}
                />
                {errors.name && (
                  <small className="error">{errors.name.message}</small>
                )}
              </label>
              <div className="field-grid">
                <label>
                  İl
                  <select
                    {...register("city", {
                      onChange: () => setValue("district", ""),
                    })}
                  >
                    <option value="">İl seçin</option>
                    {cities.map((c) => (
                      <option key={c.name}>{c.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  İlçe
                  <select disabled={!city} {...register("district")}>
                    <option value="">İlçe seçin</option>
                    {cities
                      .find((c) => c.name === city)
                      ?.districts.map((d) => (
                        <option key={d}>{d}</option>
                      ))}
                  </select>
                  {errors.district && (
                    <small className="error">{errors.district.message}</small>
                  )}
                </label>
              </div>
              <label>
                Telefon
                <input
                  type="tel"
                  placeholder="0532 000 00 00"
                  {...register("phone")}
                />
                {errors.phone && (
                  <small className="error">{errors.phone.message}</small>
                )}
              </label>
              <label>
                E-posta
                <input
                  type="email"
                  placeholder="iletisim@firma.com"
                  {...register("email")}
                />
                {errors.email && (
                  <small className="error">{errors.email.message}</small>
                )}
              </label>
              <details>
                <summary>
                  Vergi ve diğer bilgiler <ChevronDown size={16} />
                </summary>
                <div className="details-fields">
                  <div className="field-grid">
                    <label>
                      Vergi dairesi
                      <input {...register("taxOffice")} />
                    </label>
                    <label>
                      VKN / TCKN
                      <input inputMode="numeric" {...register("taxId")} />
                      {errors.taxId && (
                        <small className="error">{errors.taxId.message}</small>
                      )}
                    </label>
                  </div>
                  <label>
                    Yetkili adı
                    <input {...register("contact")} />
                  </label>
                  <label>
                    Adres
                    <textarea {...register("address")} />
                  </label>
                  <label>
                    Varsayılan ödeme vadesi (gün)
                    <input
                      type="number"
                      min="0"
                      max="365"
                      {...register("term", { valueAsNumber: true })}
                    />
                    {errors.term && (
                      <small className="error">{errors.term.message}</small>
                    )}
                  </label>
                  <label>
                    Notlar
                    <textarea {...register("notes")} />
                  </label>
                </div>
              </details>
              {errors.root && (
                <p className="error" role="alert">
                  {errors.root.message}
                </p>
              )}
            </div>
            <footer className="drawer-footer">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Vazgeç
              </Button>
              <Button type="submit">Müşteriyi kaydet</Button>
            </footer>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
