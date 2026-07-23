"use client";

import { apiGet, createApiClient } from "@/lib/api-client";
import { useAuth } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Category, ThreadSummary } from "@/types/thread";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { MessageSquarePlus, Plus, Search, MessageSquare, Users, Hash, Sparkles, ArrowRight } from "lucide-react";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { cn } from "@/lib/utils";


function ThreadHomePage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const apiClient = useMemo(() => createApiClient(getToken), [getToken]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [activeCategory, setActiveCategory] = useState(searchParams.get("category") ?? "all");
  const [threads, setThreads] = useState<ThreadSummary[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        setIsLoading(true);
        const [extractCategories, extractThreads] = await Promise.all([
          apiGet<Category[]>(apiClient, "/api/threads/categories"),
          apiGet<ThreadSummary[]>(apiClient, "/api/threads/threads", {
            params: {
              category:
                activeCategory && activeCategory !== "all"
                  ? activeCategory
                  : undefined,
              q: search || undefined,
            },
          }),
        ]);
        if (!isMounted) {
          return;
        }

        // console.log( extractCategories);
        // console.log( extractThreads);
        setCategories(extractCategories);
        setThreads(extractThreads);
      } catch (error) {
        console.error("Error fetching categories:", error);
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, [apiClient]);


  async function applyFilters(currentCategoryVal: string, currentSearchVal: string) {
    const params = new URLSearchParams();

    if (currentCategoryVal && currentCategoryVal !== "all") {
      params.set("category", currentCategoryVal);
    }
    if (currentSearchVal) {
      params.set("q", currentSearchVal.trim());
    }
    router.push(`?${params.toString()}`);

    setIsLoading(true);

    try {
      const threadsListAfterSearchAndFilter = await apiGet<ThreadSummary[]>(apiClient, '/api/threads/threads?', {
        params: {
          category: currentCategoryVal && currentCategoryVal !== "all" ? currentCategoryVal : undefined,
          q: currentSearchVal || undefined
        }
      });

      setThreads(threadsListAfterSearchAndFilter);
    }
    catch (error) {
      console.error("Error applying filters:", error);
    }
    finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-8">
      {/* Hero Welcome & Features Dashboard Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-linear-to-br from-card via-card to-primary/5 p-6 md:p-8 shadow-xs">
        {/* Glow decoration */}
        <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -left-16 -bottom-16 h-40 w-40 rounded-full bg-chart-2/10 blur-3xl" />

        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3 w-3" />
              Welcome to ThreadStream
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl bg-linear-to-r from-foreground via-foreground to-muted-foreground bg-clip-text text-transparent">
              Your Real-Time Hub for Discussions
            </h1>
            <p className="text-muted-foreground text-sm md:text-base leading-relaxed">
              Explore dynamic topics, join live chat rooms, swap direct messages, and customize your experience with built-in Markdown and theme features.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/threads/new">
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20">
                <Plus className="mr-1.5 h-4 w-4" />
                Start Thread
              </Button>
            </Link>
            <Link href="/chat?tab=rooms">
              <Button variant="outline" className="border-border bg-card/50 text-foreground hover:bg-muted">
                <Hash className="mr-1.5 h-4 w-4 text-primary" />
                Browse Rooms
              </Button>
            </Link>
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-border/50 bg-card/65 backdrop-blur-xs transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-xs">
            <CardContent className="p-4 space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <MessageSquare className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-foreground text-sm">Rich Discussions</h3>
              <p className="text-xs text-muted-foreground">
                Read and write threads using full Markdown formatting. Bold, italic, code-blocks and more.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/65 backdrop-blur-xs transition-all hover:-translate-y-0.5 hover:border-chart-2/30 hover:shadow-xs">
            <CardContent className="p-4 space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-2/10 text-chart-2">
                <Hash className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-foreground text-sm">Live Group Rooms</h3>
              <p className="text-xs text-muted-foreground">
                Join topic channels, see live typing signals, and participate in real-time group chat rooms.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/65 backdrop-blur-xs transition-all hover:-translate-y-0.5 hover:border-purple-500/30 hover:shadow-xs">
            <CardContent className="p-4 space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500">
                <Users className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-foreground text-sm">Direct Messages</h3>
              <p className="text-xs text-muted-foreground">
                Connect and chat one-on-one instantly with direct messaging. Fast, authenticated and secure.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/65 backdrop-blur-xs transition-all hover:-translate-y-0.5 hover:border-orange-500/30 hover:shadow-xs">
            <CardContent className="p-4 space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500">
                <Sparkles className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-foreground text-sm">Custom Styling</h3>
              <p className="text-xs text-muted-foreground">
                Switch instantly between light and dark themes. Fully customizable user profiles and avatars.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex w-full flex-col gap-6 lg:flex-row">
        <aside className="w-full shrink-0 lg:w-72">
          <Card className="sticky top-24 border-sidebar-border bg-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Categories</CardTitle>
              <Link href="/threads/new">
                <Button
                  size="icon"
                  className="h-8 w-8 rounded-full bg-primary text-primary-foreground shadow-sm shadow-primary/40"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            <button
              onClick={() => {
                setActiveCategory("all");
                applyFilters("all", search);
              }}
              className={cn(
                "cursor-pointer flex w-full items-center rounded-lg px-3 py-3 text-sm font-medium transition-all duration-200",
                activeCategory === "all"
                  ? "bg-primary/15 text-primary border-l-2 border-primary"
                  : "text-muted-foreground hover:bg-card/80 hover:text-foreground"
              )}
            >
              All categories
            </button>
            {isLoading && categories.length === 0 && (
              <div className="space-y-2 py-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="skeleton h-10 w-full" />
                ))}
              </div>
            )}
            {categories.map((cat) => (
              <button
                key={cat.slug}
                onClick={() => {
                  setActiveCategory(cat.slug);
                  applyFilters(cat.slug, search);
                }}
                className={cn(
                  "cursor-pointer flex w-full items-center rounded-lg px-3 py-3 text-sm font-medium transition-all duration-200",
                  activeCategory === cat.slug
                    ? "bg-primary/15 text-primary border-l-2 border-primary"
                    : "text-muted-foreground hover:bg-card/80 hover:text-foreground"
                )}
              >
                {cat.name}
              </button>
            ))}
          </CardContent>
        </Card>
      </aside>

      <div className="flex-1 space-y-6">
        <Card className="border-border/70 bg-card/95">
          <CardHeader className="pb-5">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              Latest Threads
            </h1>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="flex flex-1 items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-10 bg-secondary/80 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
                    placeholder="Search Threads..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        applyFilters(activeCategory, search);
                      }
                    }}
                  />
                </div>
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                  Search
                </Button>
              </div>
            </div>

            <Link href="/threads/new">
              <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 md:w-auto">
                <Plus className="w-4 h-4" />
                New Thread
              </Button>
            </Link>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {/* Skeleton loaders */}
          {isLoading && (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="border-border/70 bg-card">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="skeleton h-5 w-20" />
                          <div className="skeleton h-4 w-24" />
                          <div className="skeleton h-4 w-16" />
                        </div>
                        <div className="skeleton h-6 w-3/4" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-4">
                    <div className="space-y-2">
                      <div className="skeleton h-4 w-full" />
                      <div className="skeleton h-4 w-2/3" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && threads.length === 0 && (
            <Card className="border-dashed border-border bg-card">
              <CardContent className="py-16 text-center">
                <MessageSquarePlus className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
                <p className="text-lg font-medium text-foreground/80">
                  No threads found
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Be the first to start a conversation
                </p>
                <Link href="/threads/new">
                  <Button className="mt-5 bg-primary text-primary-foreground hover:bg-primary/90">
                    <Plus className="mr-1 h-4 w-4" />
                    Create your first thread
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Thread cards with hover lift */}
          {!isLoading &&
            threads.map((thread) => (
              <Card
                key={thread.id}
                className="card-hover-lift group cursor-pointer border-border/70 bg-card hover:border-primary/50"
              >
                <Link href={`threads/${thread.id}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <Badge
                            variant="outline"
                            className="border-border/70 bg-secondary/70 text-[12px]"
                          >
                            {thread.category.name}
                          </Badge>
                          {thread?.author?.handle && (
                            <span className="text-muted-foreground/90">
                              by @{thread?.author?.handle}
                            </span>
                          )}
                          <span className="text-muted-foreground/85">
                            {new Date(thread.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        <CardTitle className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors duration-200">
                          {thread.title}
                        </CardTitle>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pb-4">
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {thread.excerpt}
                    </p>
                  </CardContent>
                </Link>
              </Card>
            ))}
        </div>
      </div>
    </div>
  </div>
  );
}

export default ThreadHomePage;
