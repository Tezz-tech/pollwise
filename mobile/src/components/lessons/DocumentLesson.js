import { useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import Screen from '../Screen.js';
import LipButton from '../LipButton.js';
import Card from '../Card.js';
import Tally from '../Tally.js';
import { theme } from '../../theme/theme.js';

const { colors, fonts, type, space, radius } = theme;
/** The server's minimum before a document can be completed (SPEC §8.1, SECURITY §3). */
export const DOCUMENT_MINIMUM_SECONDS = 10;

/** "320 KB" or "2.4 MB", for the title card. */
export function formatBytes(bytes) {
  if (!bytes) return null;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * A document lesson (DESIGN §6.7): a title card with its page count and size, Open document (it opens in the device's
 * own viewer), then "I've read this" once the minimum time has passed. Completing it is the caller's job.
 * @param {{ lesson: { id: string, title: string, document: { url: string, fileName: string, bytes: number, pages: number | null } }, onComplete: () => Promise<void>, topBar: (progress: number) => import('react').ReactNode }} props
 */
export default function DocumentLesson({ lesson, onComplete, topBar }) {
  const [openedAt, setOpenedAt] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [openError, setOpenError] = useState(null);
  const doc = lesson.document;
  const secondsLeft = openedAt
    ? Math.max(0, DOCUMENT_MINIMUM_SECONDS - Math.floor((now - openedAt) / 1000))
    : null;

  useEffect(() => {
    if (!openedAt || secondsLeft === 0) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [openedAt, secondsLeft]);

  const open = async () => {
    setOpenError(null);
    try {
      await Linking.openURL(doc.url);
      setOpenedAt(Date.now());
      setNow(Date.now());
    } catch {
      setOpenError('That document could not be opened. Check your connection and try again.');
    }
  };

  const finish = async () => {
    setBusy(true);
    try {
      await onComplete();
    } finally {
      setBusy(false);
    }
  };

  const canFinish = openedAt !== null && secondsLeft === 0;
  const sizeText = formatBytes(doc.bytes);
  const facts = [doc.pages ? `${doc.pages} ${doc.pages === 1 ? 'page' : 'pages'}` : null, sizeText]
    .filter(Boolean)
    .join(' · ');

  return (
    <Screen
      padded
      footer={
        <View style={styles.footer}>
          {!openedAt ? (
            <LipButton label="Open document" onPress={open} testID="document-open" />
          ) : (
            <LipButton label="Open again" tone="secondary" onPress={open} />
          )}
          <LipButton
            label={
              busy
                ? 'Saving…'
                : canFinish
                  ? "I've read this"
                  : `Keep reading · ${secondsLeft ?? DOCUMENT_MINIMUM_SECONDS}s`
            }
            onPress={finish}
            disabled={!canFinish || busy}
            testID="document-done"
          />
        </View>
      }
    >
      {topBar(openedAt ? 0.5 : 0)}
      <Card style={styles.card}>
        <Tally mood="happy" size={96} accessibilityLabel="Tally, the PollWise mascot" />
        <Text accessibilityRole="header" style={styles.title}>
          {doc.fileName || lesson.title}
        </Text>
        {facts ? <Text style={styles.facts}>{facts}</Text> : null}
        <Text style={styles.body}>
          The document opens in your phone's viewer. Read it, then come back and tap "I've read
          this".
        </Text>
        {openError ? <Text style={styles.error}>{openError}</Text> : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', gap: space.md, marginTop: space.lg, padding: space['2xl'] },
  title: {
    fontFamily: fonts.black,
    fontSize: type.h2.size,
    lineHeight: type.h2.line,
    color: colors.ink900,
    textAlign: 'center',
  },
  facts: {
    fontFamily: fonts.heavy,
    fontSize: type.small.size,
    color: colors.jade700,
    backgroundColor: colors.jade100,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
  },
  body: {
    fontFamily: fonts.bold,
    fontSize: type.body.size,
    lineHeight: type.body.line,
    color: colors.ink600,
    textAlign: 'center',
  },
  error: {
    fontFamily: fonts.bold,
    fontSize: type.small.size,
    color: colors.coral700,
    textAlign: 'center',
  },
  footer: { gap: space.sm },
});
