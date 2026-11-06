import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Screen from '../Screen.js';
import LipButton from '../LipButton.js';
import Card from '../Card.js';
import { toCards } from '../../lib/richText.js';
import { textMinimumSeconds } from '../../lib/lessonRules.js';
import { theme } from '../../theme/theme.js';

const { colors, fonts, type, space, radius } = theme;

/**
 * A reading lesson (DESIGN §6.7): cards you swipe through, each about 60 words, with a callout style for "Did you know?"
 * boxes. The last button stays disabled until the minimum reading time has passed on this device (the server checks it
 * again, SECURITY §3).
 * @param {{ lesson: { id: string, text: { doc: object, readMinutes: number } }, onComplete: () => Promise<void>, topBar: (progress: number) => import('react').ReactNode }} props
 */
export default function TextLesson({ lesson, onComplete, topBar }) {
  const { width } = useWindowDimensions();
  const cards = useMemo(() => toCards(lesson.text?.doc), [lesson.text?.doc]);
  const minimum = textMinimumSeconds(lesson.text?.readMinutes);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  // The clock starts once, when the lesson opens: a refetch must not restart the reading time.
  const [openedAt] = useState(() => Date.now());
  const [secondsLeft, setSecondsLeft] = useState(minimum);
  const list = useRef(null);
  const last = index === cards.length - 1;
  const pageWidth = width - space['2xl'] * 2;

  useEffect(() => {
    const tick = () =>
      setSecondsLeft(Math.max(0, minimum - Math.floor((Date.now() - openedAt) / 1000)));
    tick();
    if (minimum - Math.floor((Date.now() - openedAt) / 1000) <= 0) return undefined;
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [minimum, openedAt]);

  const goTo = (next) => {
    list.current?.scrollToIndex({ index: next, animated: true });
    setIndex(next);
  };

  const finish = async () => {
    setBusy(true);
    try {
      await onComplete();
    } finally {
      setBusy(false);
    }
  };

  const footer = last ? (
    <LipButton
      label={
        secondsLeft > 0 ? `Keep reading · ${secondsLeft}s` : busy ? 'Saving…' : 'Complete lesson'
      }
      onPress={finish}
      disabled={secondsLeft > 0 || busy}
      testID="lesson-complete"
    />
  ) : (
    <LipButton label="Continue" onPress={() => goTo(index + 1)} testID="lesson-continue" />
  );

  return (
    <Screen padded footer={footer}>
      {topBar((index + 1) / Math.max(cards.length, 1))}
      <Text style={styles.lessonTitle}>{lesson.title}</Text>
      <FlatList
        ref={list}
        data={cards}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        keyExtractor={(_, i) => String(i)}
        getItemLayout={(_, i) => ({ length: pageWidth, offset: pageWidth * i, index: i })}
        renderItem={({ item }) => (
          <View style={[styles.page, { width: pageWidth }]}>
            <Card style={styles.body}>
              {item.map((block, i) => (
                <BlockView key={i} block={block} />
              ))}
            </Card>
          </View>
        )}
        showsHorizontalScrollIndicator={false}
        style={styles.pager}
      />
      <Text style={styles.pageCount}>
        {index + 1} of {cards.length}
      </Text>
    </Screen>
  );
}

function BlockView({ block }) {
  if (block.kind === 'heading') {
    return (
      <Text accessibilityRole="header" style={block.level === 2 ? styles.h2 : styles.h3}>
        {block.runs.map(RunText)}
      </Text>
    );
  }
  if (block.kind === 'callout') {
    return (
      <View style={styles.callout}>
        <Text style={styles.calloutText}>{block.runs.map(RunText)}</Text>
      </View>
    );
  }
  if (block.kind === 'list') {
    return (
      <View style={styles.list}>
        {block.items.map((runs, i) => (
          <Text key={i} style={styles.paragraph}>
            {block.ordered ? `${i + 1}. ` : '•  '}
            {runs.map(RunText)}
          </Text>
        ))}
      </View>
    );
  }
  return <Text style={styles.paragraph}>{block.runs.map(RunText)}</Text>;
}

/** A styled run. The text is always rendered as text, never as markup. */
function RunText(run, i) {
  return (
    <Text key={i} style={[run.bold && styles.bold, run.italic && styles.italic]}>
      {run.text}
    </Text>
  );
}

const styles = StyleSheet.create({
  lessonTitle: {
    fontFamily: fonts.bold,
    fontSize: type.small.size,
    color: colors.ink600,
    marginTop: space.lg,
    marginBottom: space.md,
  },
  pager: { flexGrow: 0 },
  page: { paddingRight: space.md },
  body: { minHeight: 300, gap: space.md },
  h2: {
    fontFamily: fonts.black,
    fontSize: type.h2.size,
    lineHeight: type.h2.line,
    color: colors.ink900,
  },
  h3: {
    fontFamily: fonts.heavy,
    fontSize: type.h3.size,
    lineHeight: type.h3.line,
    color: colors.ink900,
  },
  paragraph: {
    fontFamily: fonts.regular,
    fontSize: type.body.size,
    lineHeight: type.body.line,
    color: colors.ink900,
  },
  bold: { fontFamily: fonts.heavy },
  italic: { fontStyle: 'italic' },
  list: { gap: space.xs },
  callout: {
    backgroundColor: colors.sky100,
    borderRadius: radius.md,
    padding: space.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.sky600,
  },
  calloutText: {
    fontFamily: fonts.bold,
    fontSize: type.body.size,
    lineHeight: type.body.line,
    color: colors.ink900,
  },
  pageCount: {
    fontFamily: fonts.bold,
    fontSize: type.small.size,
    color: colors.ink600,
    textAlign: 'center',
    marginTop: space.md,
  },
});
