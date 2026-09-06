import React, { useState, useEffect } from "react";
import { View, Linking, TouchableOpacity } from "react-native";

import { Screen, Text, EmptyState, Skeleton } from "../../components/ui";
import { useTailwind } from "../../styles/tailwind";
import { hit, space } from "../../styles/tokens";
import { fetchArticle, fetchRelatedArticles, topicLabel } from "../../api/articles";

/**
 * One article.
 *
 * The body is plain text on purpose. This renders `content` into `Text` nodes
 * split on blank lines, so an article that arrives with markdown in it shows
 * the markdown - see `content/research/standards.md`, which is why the corpus
 * is written without it.
 *
 * `sources` is the part that makes the health content answerable. An article
 * that says 59% of dogs are overweight and cannot say where that came from is
 * indistinguishable from one that made it up.
 *
 * Further reading is fetched separately and is allowed to fail: a related-
 * articles strip that 500s should cost you the strip, not the article.
 */
const ArticleDetailScreen = ({ route, navigation }) => {
  const tailwind = useTailwind();
  const { articleId } = route.params ?? {};

  const [article, setArticle] = useState(null);
  const [related, setRelated] = useState([]);
  // Starts false when there is no id to fetch, so the effect never has to set
  // state synchronously in its body just to stop a spinner that should not
  // have started.
  const [isLoading, setIsLoading] = useState(Boolean(articleId));

  useEffect(() => {
    let cancelled = false;

    if (!articleId) return undefined;

    Promise.all([
      fetchArticle(articleId).catch(() => null),
      fetchRelatedArticles(articleId).catch(() => []),
    ]).then(([body, others]) => {
      if (cancelled) return;
      setArticle(body);
      setRelated(others);
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [articleId]);

  if (isLoading) {
    return (
      <Screen scroll testID="article-loading">
        <Skeleton width="85%" height={28} />
        <View style={{ height: space.md }} />
        <Skeleton width="40%" height={14} />
        <View style={{ height: space.xl }} />
        {[..."123456"].map((key) => (
          <View key={key}>
            <Skeleton width="100%" height={14} />
            <View style={{ height: space.sm }} />
          </View>
        ))}
      </Screen>
    );
  }

  if (!article) {
    return (
      <EmptyState
        icon="document-outline"
        title="Article not found"
        message="It may have been removed, or the link is out of date."
      />
    );
  }

  const published = article.publishedDate ? new Date(article.publishedDate) : null;
  const reviewed = article.lastReviewedDate
    ? new Date(article.lastReviewedDate)
    : null;
  const paragraphs = String(article.content ?? "")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <Screen scroll testID="article-detail">
      <Text variant="display">{article.title}</Text>

      <Text variant="caption" tone="muted" style={tailwind("mt-sm")}>
        {[
          article.byline,
          published && !Number.isNaN(published.valueOf())
            ? published.toLocaleDateString()
            : null,
        ]
          .filter(Boolean)
          .join("  ·  ")}
      </Text>

      {article.summary ? (
        <Text variant="title" tone="muted" style={tailwind("mt-lg")}>
          {article.summary}
        </Text>
      ) : null}

      {paragraphs.map((paragraph, index) => (
        <Text key={index} style={tailwind("mt-lg")}>
          {paragraph}
        </Text>
      ))}

      {article.sources?.length ? (
        <View style={tailwind("mt-xxl pt-lg border-t border-border")}>
          <Text variant="label">Sources</Text>
          {article.sources.map((source, index) => (
            <TouchableOpacity
              key={`${source.url}-${index}`}
              accessibilityRole="link"
              accessibilityLabel={`${source.title}, ${source.publisher}`}
              onPress={() => Linking.openURL(source.url).catch(() => {})}
              // A one-line citation is about 36pt of text. `hit.min` is the
              // 44pt floor, and a link is exactly the kind of small target it
              // exists for.
              style={[tailwind("mt-md justify-center"), { minHeight: hit.min }]}
            >
              <Text variant="caption" tone="primary">
                {source.title}
              </Text>
              <Text variant="caption" tone="faint">
                {source.publisher}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {article.tags?.length ? (
        <View style={tailwind("flex-row flex-wrap mt-xl")}>
          {article.tags.map((topic) => (
            <View
              key={topic}
              style={tailwind(
                "mr-sm mb-sm px-md py-xs bg-surfaceAlt border border-border rounded-pill"
              )}
            >
              <Text variant="caption" tone="muted">
                {topicLabel(topic)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {related.length ? (
        <View style={tailwind("mt-xl pt-lg border-t border-border")}>
          <Text variant="label">Read next</Text>
          {related.map((other) => (
            <TouchableOpacity
              key={String(other._id)}
              accessibilityRole="button"
              accessibilityLabel={other.title}
              // `push` rather than `navigate`: navigating to the route you are
              // already on is a no-op in React Navigation, so tapping further
              // reading from an article would have done nothing at all.
              onPress={() => navigation?.push?.("ArticleDetail", { articleId: other._id })}
              style={[tailwind("mt-md justify-center"), { minHeight: hit.min }]}
            >
              <Text variant="body" tone="primary">
                {other.title}
              </Text>
              {other.summary ? (
                <Text variant="caption" tone="muted" numberOfLines={2}>
                  {other.summary}
                </Text>
              ) : null}
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {reviewed && !Number.isNaN(reviewed.valueOf()) ? (
        <Text variant="caption" tone="faint" style={tailwind("mt-xl")}>
          Last reviewed {reviewed.toLocaleDateString()}. General information
          only — it is not veterinary advice, and it is no substitute for
          talking to your own vet about your own animal.
        </Text>
      ) : null}
    </Screen>
  );
};

export default ArticleDetailScreen;
