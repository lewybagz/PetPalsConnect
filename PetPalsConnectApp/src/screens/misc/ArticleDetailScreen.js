import React, { useState, useEffect } from "react";
import { View, Linking, TouchableOpacity } from "react-native";

import { Screen, Text, EmptyState, Skeleton } from "../../components/ui";
import { useTailwind } from "../../styles/tailwind";
import { hit, space } from "../../styles/tokens";
import api from "../../api/axios";

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
 */
const ArticleDetailScreen = ({ route }) => {
  const tailwind = useTailwind();
  const { articleId } = route.params ?? {};

  const [article, setArticle] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchArticle = async () => {
      if (!articleId) {
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        const response = await api.get(`/api/articles/${articleId}`);
        if (!cancelled) setArticle(response.data);
      } catch {
        if (!cancelled) setArticle(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchArticle();
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
