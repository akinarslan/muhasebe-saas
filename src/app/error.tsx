"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="loading">
      <h1>Çalışma alanı açılamadı</h1>
      <p>Bir hata oluştu. Yeniden deneyebilirsiniz.</p>
      <button className="btn btn-primary" onClick={reset}>
        Yeniden dene
      </button>
    </main>
  );
}
