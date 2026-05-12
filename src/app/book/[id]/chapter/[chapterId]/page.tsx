import ChapterView from '@/components/ChapterView';

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; chapterId: string }>;
}) {
  const { id, chapterId } = await params;
  return <ChapterView bookId={id} chapterId={decodeURIComponent(chapterId)} />;
}
