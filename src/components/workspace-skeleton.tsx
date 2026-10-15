export function WorkspaceSkeleton() {
  return (
    <main
      className="workspace-skeleton"
      role="status"
      aria-label="Çalışma alanı yükleniyor"
    >
      <div className="skeleton skeleton-header" />
      <div className="skeleton-cards">
        {Array.from({ length: 8 }, (_, i) => (
          <div className="skeleton" key={i} />
        ))}
      </div>
      <div className="skeleton skeleton-chart" />
      <span className="sr-only">Çalışma alanınız hazırlanıyor…</span>
    </main>
  );
}
