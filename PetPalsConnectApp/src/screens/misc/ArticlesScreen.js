import React, { useState, useEffect, useCallback } from "react";
import { View, FlatList, TextInput, TouchableOpacity, ActivityIndicator } from "react-native";
import { MaterialIcons as Icon } from "@expo/vector-icons";

import ArticleCard from "../../components/ArticleCardComponent";
import { Screen, Text, EmptyState, ListSkeleton } from "../../components/ui";
import { useTailwind } from "../../styles/tailwind";
import { useTokens } from "../../context/AppThemeContext";
import { hit } from "../../styles/tokens";
import {
  PAGE_SIZE,
  fetchArticles,
  fetchTopics,
  searchArticles,
  orderTopics,
  topicLabel,
} from "../../api/articles";

/**
 * The article list, and the index over it.
 *
 * This screen was written for a corpus of nothing and then given sixty
 * articles, which broke it in three ways at once: `/latest` was capped at
 * twenty with no paging, so most of the corpus was unreachable; there was no
 * way to browse by subject, so finding the rabbit article meant guessing a
 * word in its title; and `keyExtractor` read `item.id.toString()`, which a
 * Mongo document does not have, so the first article rendered threw.
 *
 * A flat reverse-chronological list is fine for five articles and useless for
 * sixty. The topic row is the index, and it is built from the tags the corpus
 * actually carries rather than from a hardcoded list that could describe
 * topics nothing has been written about.
 */
const ArticlesScreen = ({ navigation }) => {
  const tailwind = useTailwind();
  const tokens = useTokens();

  /**
   * What the list is currently showing, as one piece of state.
   *
   * A tag and a search term are mutually exclusive views of the corpus, and
   * holding them separately meant two setters had to be kept in step by hand.
   * As one object it also becomes the effect's dependency, so switching topic
   * cancels the in-flight request for the previous one - a slow first page can
   * no longer land after a faster one and overwrite it.
   */
  const [view, setView] = useState({ tag: null, term: "" });
  const [query, setQuery] = useState("");

  const [articles, setArticles] = useState([]);
  const [topics, setTopics] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const [failed, setFailed] = useState(false);

  const searching = Boolean(view.term);

  /** The topic row, fetched once. Its failure costs the row, not the list. */
  useEffect(() => {
    let cancelled = false;
    fetchTopics()
      .then((all) => {
        if (!cancelled) setTopics(orderTopics(all));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  /** Page one of whatever `view` currently describes. */
  useEffect(() => {
    let cancelled = false;

    const request = view.term
      ? searchArticles(view.term)
      : fetchArticles({ tag: view.tag });

    request
      .then((rows) => {
        if (cancelled) return;
        setArticles(rows);
        setFailed(false);
        // Search is not paged, so its first response is always complete.
        setExhausted(Boolean(view.term) || rows.length < PAGE_SIZE);
        setIsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setArticles([]);
        setFailed(true);
        setExhausted(true);
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [view]);

  const show = useCallback((next) => {
    setIsLoading(true);
    setView(next);
  }, []);

  const chooseTopic = useCallback(
    (nextTag) => {
      setQuery("");
      show({ tag: nextTag, term: "" });
    },
    [show]
  );

  const runSearch = useCallback(() => {
    show({ tag: null, term: query.trim() });
  }, [query, show]);

  const loadMore = useCallback(async () => {
    if (loadingMore || isLoading || exhausted || searching) return;
    setLoadingMore(true);
    try {
      const rows = await fetchArticles({ tag: view.tag, skip: articles.length });
      setArticles((current) => {
        // The list is keyed by `_id`, and two rows with the same key is a
        // React warning and a visibly duplicated card. A page that overlaps -
        // because an article was published between requests - is filtered out
        // rather than rendered twice.
        const seen = new Set(current.map((a) => String(a._id)));
        return [...current, ...rows.filter((a) => !seen.has(String(a._id)))];
      });
      if (rows.length < PAGE_SIZE) setExhausted(true);
    } catch {
      setExhausted(true);
    } finally {
      setLoadingMore(false);
    }
  }, [articles.length, exhausted, isLoading, loadingMore, searching, view.tag]);

  const chip = (label, active, onPress, count) => (
    <TouchableOpacity
      key={label}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={count ? `${label}, ${count} articles` : label}
      onPress={onPress}
      style={[
        tailwind(
          `mr-sm px-md items-center justify-center rounded-pill border ${
            active ? "bg-primary border-primary" : "bg-surface border-border"
          }`
        ),
        { minHeight: hit.min },
      ]}
    >
      <Text variant="label" tone={active ? "onPrimary" : "text"}>
        {label}
        {count ? `  ${count}` : ""}
      </Text>
    </TouchableOpacity>
  );

  return (
    <Screen scroll={false} padded={false}>
      <View
        style={tailwind(
          "flex-row items-center mx-lg mt-lg px-md bg-surface border border-border rounded-control"
        )}
      >
        <Icon name="search" size={20} color={tokens.textMuted} />
        <TextInput
          testID="article-search"
          style={[tailwind("flex-1 py-md px-sm text-text"), { fontSize: 16 }]}
          placeholder="Search articles..."
          placeholderTextColor={tokens.textFaint}
          onChangeText={setQuery}
          onSubmitEditing={runSearch}
          returnKeyType="search"
          value={query}
        />
        {query ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            onPress={() => chooseTopic(null)}
            style={tailwind("pl-sm")}
          >
            <Icon name="close" size={20} color={tokens.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {topics.length > 0 && !searching ? (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          testID="article-topics"
          data={topics}
          // A horizontal list inside a column takes the remaining height
          // unless told not to, and its items stretch to fill it - which
          // rendered the topic chips as full-height capsules. `flexGrow: 0`
          // sizes the row to its content; `alignItems: center` stops the
          // chips stretching inside it.
          style={[tailwind("mt-md"), { flexGrow: 0, flexShrink: 0 }]}
          contentContainerStyle={[tailwind("px-lg"), { alignItems: "center" }]}
          keyExtractor={(item) => item.tag}
          ListHeaderComponent={chip("All", view.tag === null, () => chooseTopic(null))}
          renderItem={({ item }) =>
            chip(topicLabel(item.tag), view.tag === item.tag, () => chooseTopic(item.tag), item.count)
          }
        />
      ) : null}

      {isLoading ? (
        <View style={tailwind("px-lg mt-lg")}>
          <ListSkeleton count={5} />
        </View>
      ) : articles.length === 0 ? (
        <EmptyState
          icon={failed ? "cloud-offline-outline" : "newspaper-outline"}
          title={failed ? "Could not load articles" : "Nothing here yet"}
          message={
            failed
              ? "Check your connection and try again."
              : searching
                ? `No articles match "${query.trim()}".`
                : view.tag
                  ? `Nothing filed under ${topicLabel(view.tag)} yet.`
                  : "New guides are on the way."
          }
          actionLabel={failed ? "Try again" : "Show all articles"}
          onAction={() => (failed ? show({ ...view }) : chooseTopic(null))}
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
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          ListHeaderComponent={
            searching || view.tag ? (
              <Text variant="caption" tone="muted" style={tailwind("px-lg pt-md")}>
                {articles.length} article{articles.length === 1 ? "" : "s"}
                {view.tag ? ` in ${topicLabel(view.tag)}` : ""}
              </Text>
            ) : null
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator color={tokens.primary} style={tailwind("py-lg")} />
            ) : exhausted && articles.length > PAGE_SIZE ? (
              <Text
                variant="caption"
                tone="faint"
                align="center"
                style={tailwind("py-lg")}
              >
                That is everything.
              </Text>
            ) : null
          }
        />
      )}
    </Screen>
  );
};

export default ArticlesScreen;
