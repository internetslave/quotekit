import BookHome from '@/components/BookHome';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BookHome bookId={id} />;
}
