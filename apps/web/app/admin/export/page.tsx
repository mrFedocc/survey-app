// apps/web/app/admin/export/page.tsx
export const dynamic = 'force-static';
export const revalidate = 60; // можно 60/300/0; главное, чтобы не было динамики

export default function AdminExportPage() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Admin &rarr; Export</h1>
      <p>Здесь будет экспорт данных.</p>
    </main>
  );
}
