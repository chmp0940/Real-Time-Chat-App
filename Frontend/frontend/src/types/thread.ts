export type Category = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
};

export type ThreadDetails = {
  id: number;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  category: {
    slug: string;
    name: string;
  };
  author: {
    displayName: string | null;
    handle: string | null;
  };
  likeCount: number;
  replyCount: number;
  viewerHasLiked: boolean;
};

export type ThreadSummary = {
  id: number;
  title: string;
  excerpt: string;
  createdAt: string;
  category: {
    slug: string;
    name: string;
  };
  author: {
    displayName: string | null;
    handle: string | null;
  };
};

export type Comment = {
  id: number;
  body: string;
  createdAt: string;
  author: {
    displayName: string | null;
    handle: string | null;
  };
};

export type MeResponse = {
  id: number;
  handle: string | null;
};
