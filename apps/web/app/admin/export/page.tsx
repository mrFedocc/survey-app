export const dynamic = 'force-static';
export const revalidate = 60;

export default function AdminExportPage() {
  return (
    <main style={{padding: 24}}>
      <h1>Admin / Export</h1>
      <p>Статическая страница экспорта. Если нужно ходить на API — дергай его из клиентского кода fetch’ем.</p>
    </main>
  );
}
