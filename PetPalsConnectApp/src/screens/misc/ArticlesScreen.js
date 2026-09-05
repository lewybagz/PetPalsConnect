import React, { useState, useEffect, useCallback } from "react";
import { View, FlatList, TextInput } from "react-native";
import { MaterialIcons as Icon } from "@expo/vector-icons";

import ArticleCard from "../../components/ArticleCardComponent";
import { Screen, Text, EmptyState, ListSkeleton } from "../../components/ui";
import { useTailwind } from "../../styles/tailwind";
import { useTokens } from "../../context/AppThemeContext";
import api from "../../api/axios";

/**
 * The article list.
 *
 * Three things here were broken in ways only a device would show:
 *
 * - `keyExtractor` read `item.id.toString()`. A Mongo document has `_id` and
 *   no `id`, so the first article rendered threw on `undefined.toString()` -
 *   the screen could never display a single result.
 * - The navigation param was `item.id` too, so `ArticleDetail` fetched
 *   `/api/articles/undefined`.
 * - Every request built its own `Authorization` header from `getStoredToken`.
 *   `src/api/axios` already attaches the Firebase ID token and retries once on
 *   a 401; a hand-rolled header skips that and goes stale. (`PUBLIC_READS` in
 *   the backend's auth audit means an article is the same for every caller,
 *   not that the route is unauthenticated - every route is behind
 *   `authenticate`.)
 */
const ArticlesScreen = ({ navigation }) => {
  const tailwind = useTailwind();
  const tokens = useTokens();

  const [articles, setArticles] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const fetchArticles = useCallback(async (query) => {
    const path = query
      ? `/api/articles/search?q=${encodeURIComponent(query)}`
      : "/api/articles/latest";
    const response = await api.get(path);
    return Array.isArray(response.data) ? response.data : [];
  }, []);

  const apply = useCallback((rows) => {
    setArticles(rows);
    setFailed(rows === null);
    setIsLoading(false);
  }, []);

  /**
   * The first load resolves into the promise callback rather than setting
   * state in the effect body. `isLoading` already starts true, so there is
   * nothing to set synchronously - and `react-hooks/set-state-in-effect` is
   * right that doing so costs a cascading render for no gain.
   */
  useEffect(() => {
    let cancelled = false;

    fetchArticles("")
      .then((rows) => {
        if (!cancelled) apply(rows);
      })
      .catch(() => {
        if (!cancelled) {
          setArticles([]);
          setFailed(true);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fetchArticles, apply]);

  /** Search and retry are event handlers, so they may show the wait at once. */
  const load = useCallback(
    async (query) => {
      setIsLoading(true);
      setFailed(false);
      try {
        apply(await fetchArticles(query));
      } catch {
        setArticles([]);
        setFailed(true);
        setIsLoading(false);
      }
    },
    [fetchArticles, apply]
  );

  return (
    <Screen scroll={false} padded={false}>
      <View style={tailwind("flex-row items-center m-lg px-md bg-surface border border-border rounded-control")}>
        <Icon name="search" size={20} color={tokens.textMuted} />
        <TextInput
          testID="article-search"
          style={[tailwind("flex-1 py-md px-sm text-text"), { fontSize: 16 }]}
          placeholder="Search articles..."
          placeholderTextColor={tokens.textFaint}
          onChangeText={setSearchQuery}
          onSubmitEditing={() => load(searchQuery.trim())}
          returnKeyType="search"
          value={searchQuery}
        />
      </View>

      {isLoading ? (
        <View style={tailwind("px-lg")}>
          <ListSkeleton count={5} />
        </View>
      ) : articles.length === 0 ? (
        <EmptyState
          icon={failed ? "cloud-offline-outline" : "newspaper-outline"}
          title={failed ? "Could not load articles" : "Nothing found"}
          message={
            failed
              ? "Check your connection and try again."
              : searchQuery
                ? `No articles match "${searchQuery.trim()}".`
                : "New guides are on the way."
          }
          actionLabel="Try again"
          onAction={() => load(searchQuery.trim())}
        />
      ) : (
        <FlatList
          data={articles}
          renderItem={({ item }) => (
            <ArticleCard
              article={item}
              onPress={() =>
                navigation.navigate("ArticleDetail", { articleId: item._id })
              }
            />
          )}
          keyExtractor={(item) => String(item._id)}
          ListHeaderComponent={
            searchQuery.trim() ? (
              <Text variant="caption" tone="muted" style={tailwind("px-lg pb-sm")}>
                {articles.length} result{articles.length === 1 ? "" : "s"}
              </Text>
            ) : null
          }
        />
      )}
    </Screen>
  );
};

export default ArticlesScreen;
