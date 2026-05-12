import Reader from '@/components/Reader';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Reader bookId={id} />;
}
