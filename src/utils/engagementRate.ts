export const calculateEngagementRate = (statistics: {
  likeCount?: string;
  commentCount?: string;
  viewCount?: string;
}): number => {
  const { likeCount, commentCount, viewCount } = statistics;
  if (!viewCount || viewCount === '0') return 0;

  const likes = parseInt(likeCount || '0', 10);
  const comments = parseInt(commentCount || '0', 10);
  const views = parseInt(viewCount, 10);

  return ((likes + comments) / views) * 100;
};
