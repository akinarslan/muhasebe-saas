"use client";
import { useState, useEffect, useCallback } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { motion } from "motion/react";
import {
  Compass,
  Users,
  ShieldCheck,
  Search,
  UserPlus,
  X,
  KeyRound,
  Clock,
  ArrowRight,
  Building2,
  CheckCircle2,
  Eye,
  LayoutDashboard,
} from "lucide-react";
import { Button } from "./ui/button";
import { SignOut } from "./auth-form";
import {
  permissions,
  roleTemplates,
  moduleLabels,
  type Grant,
  type Scope,
} from "@/lib/auth/catalog";
import { decide } from "@/lib/auth/policy";
type Member = {
  id: string;
  userId: string;
  status: string;
  version: number;
  isMaster: boolean;
  user?: {
    name: string;
    email: string;
    twoFactorEnabled: boolean;
    lastLoginAt: string | null;
  };
  roles: { roleId: string; scope: Scope }[];
  overrides: { permissionId: string; effect: "ALLOW" | "DENY"; scope: Scope }[];
};
type Data = { membershipId: string; canManage: boolean; members: Member[] };
type Metadata = {
  tenantId: string;
  companies: { id: string; name: string }[];
  activities: { id: string; name: string; legalEntityId: string }[];
};
type Details = {
  sessions: {
    id: string;
    createdAt: string;
    expiresAt: string;
    mfaVerifiedAt: string | null;
  }[];
  audit: { id: string; action: string; createdAt: string; summary: unknown }[];
};
const statuses: Record<string, string> = {
  ACTIVE: "Aktif",
  INVITED: "Davet edildi",
  INACTIVE: "Pasif",
  SUSPENDED: "Askıya alındı",
};
const tabs = [
  "Genel bilgiler",
  "Roller",
  "Özel yetkiler",
  "Erişim kapsamı",
  "Oturumlar",
  "Değişiklik geçmişi",
];
async function api(path: string, method = "GET", body?: unknown) {
  const response = await fetch(`/api/cloud/${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "SERVICE_UNAVAILABLE");
  return data;
}
const errorText = (error: unknown) =>
  error instanceof Error && error.message === "STEP_UP_REQUIRED"
    ? "Önce Hesap güvenliği sayfasında parola ve TOTP ile yeniden doğrulayın."
    : error instanceof Error && error.message === "VERSION_CONFLICT"
      ? "Kayıt başka bir işlemde değişti. Listeyi yenileyin."
      : "İşlem tamamlanamadı. Yetkinizi ve bağlantınızı kontrol edin; kaydedilmemiş alanlar korunuyor.";
export function UserAdministration() {
  const [data, setData] = useState<Data | null>(null),
    [metadata, setMetadata] = useState<Metadata | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Member | null>(null),
    [tab, setTab] = useState(tabs[0]),
    [details, setDetails] = useState<Details | null>(null),
    [role, setRole] = useState("SALES"),
    [status, setStatus] = useState("ACTIVE");
  const [kind, setKind] = useState<Scope["kind"]>("TENANT"),
    [company, setCompany] = useState(""),
    [activity, setActivity] = useState(""),
    [overrides, setOverrides] = useState<Record<string, "ALLOW" | "DENY">>({});
  const [preview, setPreview] = useState(false),
    [busy, setBusy] = useState(false),
    [invite, setInvite] = useState(false);
  const load = useCallback(async () => {
    try {
      const [users, context] = await Promise.all([
        api("users"),
        api("context"),
      ]);
      setData(users);
      setMetadata(context);
      setError("");
    } catch (e) {
      setError(errorText(e));
    }
  }, []);
  useEffect(() => {
    let active = true;
    Promise.all([api("users"), api("context")])
      .then(([users, context]) => {
        if (active) {
          setData(users);
          setMetadata(context);
        }
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      });
    return () => {
      active = false;
    };
  }, []);
  async function open(member: Member) {
    setSelected(member);
    setTab(tabs[0]);
    setRole(member.roles[0]?.roleId ?? "SALES");
    setStatus(member.status);
    setKind(member.roles[0]?.scope.kind ?? "TENANT");
    setCompany(member.roles[0]?.scope.legalEntityId ?? "");
    setActivity(member.roles[0]?.scope.activityId ?? "");
    setOverrides(
      Object.fromEntries(
        member.overrides.map((o) => [o.permissionId, o.effect]),
      ),
    );
    setPreview(false);
    setDetails(null);
    try {
      setDetails(await api(`users/${member.id}`));
    } catch (e) {
      setError(errorText(e));
    }
  }
  const editable = !!data?.canManage && selected?.id !== data.membershipId;
  const scope: Scope = {
    tenantId: metadata?.tenantId ?? "",
    kind,
    legalEntityId: kind === "TENANT" ? null : company || null,
    activityId: kind === "ACTIVITY" ? activity || null : null,
  };
  const grants: Grant[] = [
    ...(roleTemplates.find((r) => r.id === role)?.permissions ?? []).map(
      (permissionId) => ({
        permissionId,
        effect: "ALLOW" as const,
        source: "ROLE" as const,
        scope,
      }),
    ),
    ...Object.entries(overrides).map(([permissionId, effect]) => ({
      permissionId,
      effect,
      source: "OVERRIDE" as const,
      scope,
    })),
  ];
  const effective = permissions.filter((p) =>
    decide(
      selected?.userId ?? "",
      p.id,
      {
        tenantId: scope.tenantId,
        legalEntityId: scope.legalEntityId,
        activityId: scope.activityId,
        createdById: selected?.userId,
      },
      grants,
    ),
  );
  async function save() {
    if (!selected) return;
    setBusy(true);
    try {
      await api(`users/${selected.id}`, "PATCH", {
        version: selected.version,
        status,
        roleId: role,
        scope: {
          kind,
          legalEntityId: scope.legalEntityId,
          activityId: scope.activityId,
        },
        overrides: Object.entries(overrides).map(([permissionId, effect]) => ({
          permissionId,
          effect,
        })),
      });
      await load();
      setSelected(null);
      setNotice("Kullanıcı erişimi ve denetim kaydı kaydedildi.");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="cloud-shell">
      <aside className="cloud-sidebar">
        <Link className="cloud-brand" href="/app">
          <Compass size={30} />
          <strong>
            pusula<small>BULUT YÖNETİMİ</small>
          </strong>
        </Link>
        <span className="cloud-nav-label">ÇALIŞMA ALANI</span>
        <Link href="/app">
          <LayoutDashboard size={19} /> Genel bakış
        </Link>
        <Link href="/admin/users" aria-current="page">
          <Users size={19} /> Kullanıcılar ve yetkiler
        </Link>
        <Link href="/account/security">
          <ShieldCheck size={19} /> Hesap güvenliği
        </Link>
        <span className="cloud-nav-label">AYRI DENEYİM</span>
        <Link href="/">
          <Eye size={19} /> Yerel demo
        </Link>
        <div className="cloud-sidebar-foot">
          <ShieldCheck size={20} />
          <p>
            Neon development
            <br />
            <small>Gerçek oturum · Ayrı demo verisi</small>
          </p>
        </div>
      </aside>
      <main className="cloud-main">
        <header className="cloud-top">
          <span>
            <Building2 size={17} /> İşletme yönetimi / Erişim kontrolü
          </span>
          <SignOut />
        </header>
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.16 }}
        >
          <div className="cloud-heading">
            <div>
              <span className="eyebrow">GÜVENLİ İŞ BİRLİĞİ</span>
              <h1>Kullanıcılar ve yetkiler</h1>
              <p>
                Ekibinizin erişimini, sorumluluklarını ve veri kapsamını
                yönetin.
              </p>
            </div>
            <Button disabled={!data?.canManage} onClick={() => setInvite(true)}>
              <UserPlus size={17} /> Kullanıcı davet et
            </Button>
          </div>
          <div className="cloud-kpis">
            <article>
              <span className="icon-tile">
                <Users />
              </span>
              <div>
                <small>Toplam üye</small>
                <strong>{data?.members.length ?? "—"}</strong>
              </div>
            </article>
            <article>
              <span className="icon-tile">
                <CheckCircle2 />
              </span>
              <div>
                <small>Aktif erişim</small>
                <strong>
                  {data?.members.filter((m) => m.status === "ACTIVE").length ??
                    "—"}
                </strong>
              </div>
            </article>
            <article>
              <span className="icon-tile">
                <KeyRound />
              </span>
              <div>
                <small>Master Admin</small>
                <strong>
                  {data?.members.filter(
                    (m) => m.isMaster && m.status === "ACTIVE",
                  ).length ?? "—"}
                </strong>
              </div>
            </article>
          </div>
          {error && (
            <div className="info-box" role="alert">
              {error}{" "}
              <Link href="/account/security">
                Hesap güvenliği <ArrowRight size={14} />
              </Link>
            </div>
          )}
          <section className="cloud-panel">
            <div className="cloud-toolbar">
              <h2>Ekip üyeleri</h2>
              <label className="cloud-search">
                <Search size={17} />
                <input
                  aria-label="Kullanıcı ara"
                  placeholder="Ad veya e-posta ara…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <Button variant="outline" onClick={() => void load()}>
                Yenile
              </Button>
            </div>
            <div className="table-scroll">
              <table className="cloud-table">
                <thead>
                  <tr>
                    {[
                      "Kullanıcı",
                      "E-posta",
                      "Rol",
                      "Durum",
                      "Faaliyet kapsamı",
                      "Son giriş",
                      "İşlemler",
                    ].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data?.members
                    .filter((m) =>
                      `${m.user?.name} ${m.user?.email}`
                        .toLocaleLowerCase("tr")
                        .includes(search.toLocaleLowerCase("tr")),
                    )
                    .map((m) => (
                      <tr key={m.id}>
                        <td>
                          <span className="cloud-avatar">
                            {m.user?.name.slice(0, 2).toLocaleUpperCase("tr")}
                          </span>
                          <strong>{m.user?.name ?? "Kimlik kaydı yok"}</strong>
                        </td>
                        <td>{m.user?.email}</td>
                        <td>
                          {m.roles
                            .map(
                              (r) =>
                                roleTemplates.find((t) => t.id === r.roleId)
                                  ?.name ?? r.roleId,
                            )
                            .join(", ") || "Rol atanmadı"}
                        </td>
                        <td>
                          <span
                            className={`badge ${m.status === "ACTIVE" ? "success" : "neutral"}`}
                          >
                            {statuses[m.status]}
                          </span>
                        </td>
                        <td>
                          {m.roles[0]?.scope.kind === "TENANT"
                            ? "Tenant geneli"
                            : (metadata?.activities.find(
                                (a) => a.id === m.roles[0]?.scope.activityId,
                              )?.name ??
                              metadata?.companies.find(
                                (c) => c.id === m.roles[0]?.scope.legalEntityId,
                              )?.name ??
                              "Atanmamış")}
                        </td>
                        <td>
                          {m.user?.lastLoginAt
                            ? new Date(m.user.lastLoginAt).toLocaleString(
                                "tr-TR",
                              )
                            : "Henüz giriş yok"}
                        </td>
                        <td>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void open(m)}
                            aria-label={`${m.user?.name} kullanıcısını yönet`}
                          >
                            Yönet <ArrowRight size={14} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {!data && !error && (
              <p className="cloud-empty">Üyelikler doğrulanıyor…</p>
            )}
          </section>
        </motion.section>
      </main>
      <Dialog.Root
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="drawer-overlay" />
          <Dialog.Content className="drawer cloud-user-drawer">
            <header className="drawer-head">
              <span className="icon-tile">
                <ShieldCheck />
              </span>
              <div>
                <Dialog.Title>{selected?.user?.name}</Dialog.Title>
                <Dialog.Description>
                  {selected?.user?.email} · Erişim yönetimi
                </Dialog.Description>
              </div>
              <Dialog.Close
                className="icon-button"
                aria-label="Kullanıcı panelini kapat"
              >
                <X />
              </Dialog.Close>
            </header>
            <nav className="cloud-tabs" aria-label="Kullanıcı ayrıntıları">
              {tabs.map((t) => (
                <button
                  key={t}
                  aria-pressed={tab === t}
                  onClick={() => {
                    setTab(t);
                    setPreview(false);
                  }}
                >
                  {t}
                </button>
              ))}
            </nav>
            <div className="drawer-body cloud-user-body">
              {error && (
                <div className="info-box" role="alert">
                  {error}
                </div>
              )}
              {!editable && (
                <div className="info-box">
                  Kendi erişiminizi bu panelden değiştiremezsiniz. Hassas
                  işlemler yeniden doğrulama gerektirir.
                </div>
              )}
              {tab === "Genel bilgiler" && (
                <>
                  <h3>Üyelik bilgileri</h3>
                  <p>
                    {selected?.user?.name}
                    <br />
                    {selected?.user?.email}
                  </p>
                  <label>
                    Hesap durumu
                    <select
                      aria-label="Hesap durumu"
                      value={status}
                      disabled={!editable}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      {Object.entries(statuses).map(([key, value]) => (
                        <option key={key} value={key}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p>
                    MFA:{" "}
                    {selected?.user?.twoFactorEnabled ? "Etkin" : "Kurulmadı"}
                  </p>
                </>
              )}
              {tab === "Roller" && (
                <>
                  <h3>Rol şablonu</h3>
                  <p>
                    Şablon temel izinleri belirler. Özel DENY kararları
                    önceliklidir.
                  </p>
                  <label>
                    Hazır rol
                    <select
                      aria-label="Hazır rol"
                      value={role}
                      disabled={!editable}
                      onChange={(e) => setRole(e.target.value)}
                    >
                      {roleTemplates.map((r) => (
                        <option value={r.id} key={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
              {tab === "Özel yetkiler" && (
                <>
                  <h3>Kullanıcıya özel izin matrisi</h3>
                  <p>
                    Sonuç seçilen kapsam içindir. Sunucu, kayıt kapsamını ve
                    güncel izinleri her istekte yeniden doğrular.
                  </p>
                  <div className="cloud-permission-list">
                    {permissions.map((p) => (
                      <label className="cloud-permission" key={p.id}>
                        <span>
                          <small>{moduleLabels[p.module]}</small>
                          {p.label}
                          <em>
                            {effective.some((e) => e.id === p.id)
                              ? "İzinli"
                              : "Reddedildi"}
                          </em>
                        </span>
                        <select
                          data-testid={`permission-${p.id}`}
                          aria-label={`${moduleLabels[p.module]}: ${p.label} özel izni`}
                          disabled={!editable}
                          value={overrides[p.id] ?? "INHERIT"}
                          onChange={(e) =>
                            setOverrides((current) => {
                              const next = { ...current };
                              if (e.target.value === "INHERIT")
                                delete next[p.id];
                              else
                                next[p.id] = e.target.value as "ALLOW" | "DENY";
                              return next;
                            })
                          }
                        >
                          <option value="INHERIT">Rol üzerinden</option>
                          <option value="ALLOW">İzin ver</option>
                          <option value="DENY">Reddet</option>
                        </select>
                      </label>
                    ))}
                  </div>
                </>
              )}
              {tab === "Erişim kapsamı" && (
                <>
                  <h3>Veri erişim sınırı</h3>
                  <label>
                    Kapsam türü
                    <select
                      aria-label="Kapsam türü"
                      value={kind}
                      disabled={!editable}
                      onChange={(e) => setKind(e.target.value as Scope["kind"])}
                    >
                      <option value="TENANT">Tenant geneli</option>
                      <option value="LEGAL_ENTITY">Belirli şirket</option>
                      <option value="ACTIVITY">Belirli faaliyet</option>
                      <option value="OWN">Kendi oluşturduğu kayıtlar</option>
                    </select>
                  </label>
                  {kind !== "TENANT" && (
                    <label>
                      Şirket
                      <select
                        aria-label="Şirket kapsamı"
                        value={company}
                        disabled={!editable}
                        onChange={(e) => {
                          setCompany(e.target.value);
                          setActivity("");
                        }}
                      >
                        <option value="">Şirket seçin</option>
                        {metadata?.companies.map((c) => (
                          <option value={c.id} key={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {kind === "ACTIVITY" && (
                    <label>
                      Faaliyet
                      <select
                        aria-label="Faaliyet kapsamı"
                        value={activity}
                        disabled={!editable}
                        onChange={(e) => setActivity(e.target.value)}
                      >
                        <option value="">Faaliyet seçin</option>
                        {metadata?.activities
                          .filter((a) => a.legalEntityId === company)
                          .map((a) => (
                            <option value={a.id} key={a.id}>
                              {a.name}
                            </option>
                          ))}
                      </select>
                    </label>
                  )}
                  <div className="info-box">
                    Departman, tutar limiti ve onay alanları modelde
                    ayrılmıştır; bu sürümün arayüzünde etkin değildir.
                  </div>
                </>
              )}
              {tab === "Oturumlar" && (
                <>
                  <h3>Aktif oturumlar</h3>
                  {details?.sessions.map((s) => (
                    <article className="cloud-session" key={s.id}>
                      <Clock size={17} />
                      <div>
                        <strong>
                          {new Date(s.createdAt).toLocaleString("tr-TR")}
                        </strong>
                        <p>
                          Bitiş: {new Date(s.expiresAt).toLocaleString("tr-TR")}{" "}
                          · MFA {s.mfaVerifiedAt ? "doğrulandı" : "yok"}
                        </p>
                      </div>
                    </article>
                  ))}
                  {details?.sessions.length === 0 && <p>Aktif oturum yok.</p>}
                  <Button
                    variant="outline"
                    disabled={busy || !editable}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await api(
                          `users/${selected!.id}/sessions`,
                          "DELETE",
                          {},
                        );
                        setNotice("Kullanıcının oturumları sonlandırıldı.");
                        setDetails(await api(`users/${selected!.id}`));
                      } catch (e) {
                        setError(errorText(e));
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Tüm oturumları sonlandır
                  </Button>
                </>
              )}
              {tab === "Değişiklik geçmişi" && (
                <>
                  <h3>Denetim kaydı</h3>
                  {details?.audit.map((a) => (
                    <article className="cloud-session" key={a.id}>
                      <ShieldCheck size={17} />
                      <div>
                        <strong>{a.action}</strong>
                        <p>{new Date(a.createdAt).toLocaleString("tr-TR")}</p>
                        <details>
                          <summary>Güvenli değişiklik özeti</summary>
                          <pre>{JSON.stringify(a.summary, null, 2)}</pre>
                        </details>
                      </div>
                    </article>
                  ))}
                </>
              )}
              {preview && (
                <section
                  className="cloud-preview"
                  aria-label="Değişiklik önizlemesi"
                >
                  <h3>Kaydetmeden önce kontrol edin</h3>
                  <p>
                    Rol:{" "}
                    {selected?.roles
                      .map(
                        (r) =>
                          roleTemplates.find((t) => t.id === r.roleId)?.name ??
                          r.roleId,
                      )
                      .join(", ") || "Yok"}{" "}
                    → {roleTemplates.find((t) => t.id === role)?.name}
                    <br />
                    Durum: {statuses[selected?.status ?? ""]} →{" "}
                    {statuses[status]}
                    <br />
                    Kapsam:{" "}
                    {
                      {
                        TENANT: "Tenant geneli",
                        LEGAL_ENTITY: "Belirli şirket",
                        ACTIVITY: "Belirli faaliyet",
                        OWN: "Kendi kayıtları",
                      }[kind]
                    }{" "}
                    {metadata?.companies.find((c) => c.id === company)?.name}{" "}
                    {metadata?.activities.find((a) => a.id === activity)?.name}
                  </p>
                  <ul>
                    {Object.entries(overrides).map(([id, effect]) => (
                      <li key={id}>
                        {permissions.find((p) => p.id === id)?.label}:{" "}
                        {effect === "ALLOW" ? "İzin ver" : "Reddet"}
                      </li>
                    ))}
                    {selected?.overrides
                      .filter((o) => !overrides[o.permissionId])
                      .map((o) => (
                        <li key={`removed-${o.permissionId}`}>
                          {
                            permissions.find((p) => p.id === o.permissionId)
                              ?.label
                          }
                          : Özel karar kaldırılır; rol üzerinden hesaplanır.
                        </li>
                      ))}
                  </ul>
                  <details>
                    <summary>Etkili izinleri görüntüle</summary>
                    <ul>
                      {effective.map((p) => (
                        <li key={p.id}>
                          {moduleLabels[p.module]} · {p.label}
                        </li>
                      ))}
                    </ul>
                  </details>
                  <p>
                    Nihai izin: {effective.length} / {permissions.length}.
                    Önceki kapsamlar bu seçimle değiştirilir.
                  </p>
                  <Button onClick={() => void save()} disabled={busy}>
                    Değişiklikleri onayla ve kaydet
                  </Button>
                </section>
              )}
            </div>
            <footer className="drawer-footer">
              <Link className="btn btn-outline" href="/account/security">
                Yeniden doğrula
              </Link>
              <Button
                disabled={!editable || busy}
                onClick={() => setPreview(true)}
              >
                Değişiklikleri incele
              </Button>
            </footer>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <Dialog.Root open={invite} onOpenChange={setInvite}>
        <Dialog.Portal>
          <Dialog.Overlay className="drawer-overlay" />
          <Dialog.Content className="drawer">
            <header className="drawer-head">
              <UserPlus />
              <div>
                <Dialog.Title>Yeni kullanıcı daveti</Dialog.Title>
                <Dialog.Description>
                  Başlangıçta erişim rolü verilmez.
                </Dialog.Description>
              </div>
              <Dialog.Close aria-label="Davet panelini kapat">
                <X />
              </Dialog.Close>
            </header>
            <form
              className="drawer-body"
              onSubmit={async (e) => {
                e.preventDefault();
                const fields = new FormData(e.currentTarget);
                setBusy(true);
                try {
                  const r = await api(
                    "users/invite",
                    "POST",
                    Object.fromEntries(fields),
                  );
                  setInvite(false);
                  setNotice(
                    r.status === "created"
                      ? "Davet şifreli yerel test taşıyıcısına kaydedildi. Gerçek e-posta gönderilmedi."
                      : "Davet oluşturulmadı; mevcut kimliği operatörle kontrol edin.",
                  );
                  await load();
                } catch (e) {
                  setError(errorText(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Ad soyad
                <input name="name" required maxLength={200} />
              </label>
              <label>
                E-posta
                <input name="email" type="email" required />
              </label>
              <div className="info-box">
                SMTP bağlı değil. Davet yalnız şifreli development test iletisi
                olarak oluşturulur.
              </div>
              <Button disabled={busy}>Davet oluştur</Button>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {notice && (
        <div className="toast" role="status">
          <CheckCircle2 />
          {notice}
          <button aria-label="Bildirimi kapat" onClick={() => setNotice("")}>
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
