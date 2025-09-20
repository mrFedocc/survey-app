export const dynamic = 'force-static';

export default function ExportPage() {
  return (
    <main style={{ padding: 24, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <h1 style={{ margin: 0 }}>Export</h1>
      <p>В статической сборке (GitHub Pages) серверные эндпоинты недоступны.</p>
      <p>Сделай экспорт на клиенте или через отдельный API на сервере.</p>
    </main>
  );
}
