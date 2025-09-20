export const metadata = {
  title: "Survey",
  description: "survey.petly.moscow"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
