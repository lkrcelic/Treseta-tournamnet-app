"use client";

import {getBurzaAPI} from "@/app/_fetchers/burza";
import {BurzaPost} from "@/app/_interfaces/burza";
import useAuthStore from "@/app/_store/authStore";
import {useCallback, useEffect, useState} from "react";

// The open ads, shared by Početna and Burza: shown from the session cache at once and refreshed on every mount,
// so a new ad appears without a reload. The cache is per player (an ad's "mine" and "busy" depend on who looks).
let cache: {userId: number | null; posts: BurzaPost[]} | null = null;
let inflight: Promise<BurzaPost[]> | null = null;

function loadBurza(userId: number | null): Promise<BurzaPost[]> {
  inflight ??= getBurzaAPI()
    .then((posts) => {
      cache = {userId, posts};
      return posts;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

// Forgets the list after an ad was published or closed
export function invalidateBurza() {
  cache = null;
}

export default function useBurza(): {posts: BurzaPost[] | null; error: string | null; reload: () => void} {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const [posts, setPosts] = useState<BurzaPost[] | null>(cache?.userId === userId ? cache.posts : null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setError(null);
    loadBurza(userId)
      .then(setPosts)
      .catch((e) => setError(e instanceof Error ? e.message : "Oglasi se nisu učitali."));
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return {posts, error, reload};
}
