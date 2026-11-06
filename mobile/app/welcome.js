import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Screen from '../src/components/Screen.js';
import LipButton from '../src/components/LipButton.js';
import Tally from '../src/components/Tally.js';
import PrivacyNotice from '../src/components/PrivacyNotice.js';
import { markPrivacyNoticeSeen, privacyNoticeSeen } from '../src/lib/privacyNotice.js';
import { usePublicSettings } from '../src/api/queries.js';
import { theme } from '../src/theme/theme.js';

const { colors, fonts, type, space, radius } = theme;

/** Three slides (DESIGN §6.2). Swipe or Next; the last slide offers sign-up or log-in. */
const SLIDES = Object.freeze([
  {
    mood: 'wave',
    title: 'Learn what to do at the polling unit.',
    body: 'Practical training for the people who run polling units and collation centres.',
  },
  {
    mood: 'thinking',
    title: 'Short lessons. Quick checks. Real situations.',
    body: 'Each lesson takes about five minutes. Each check asks one question at a time.',
  },
  {
    mood: 'cheer',
    title: 'Finish a course, earn your certificate.',
    body: 'Pass the checks to open the next module. Finish the course and your certificate is yours.',
  },
]);

export default function Welcome() {
  const { width } = useWindowDimensions();
  const pager = useRef(null);
  const [index, setIndex] = useState(0);
  const [notice, setNotice] = useState(false);
  const settings = usePublicSettings();
  // Shown once, before anything else is asked of the learner (SECURITY §11).
  useEffect(() => {
    privacyNoticeSeen().then((seen) => {
      if (!seen) setNotice(true);
    });
  }, []);
  const acceptNotice = () => {
    setNotice(false);
    markPrivacyNoticeSeen().catch(() => {});
  };
  const last = index === SLIDES.length - 1;

  const goTo = (next) => {
    pager.current?.scrollTo({ x: next * width, animated: true });
    setIndex(next);
  };

  return (
    <Screen
      padded={false}
      footer={
        <View style={styles.footer}>
          {last ? (
            <>
              <LipButton
                label="Get started"
                onPress={() => router.push('/signup')}
                testID="welcome-get-started"
              />
              <LipButton
                label="I already have an account"
                tone="secondary"
                onPress={() => router.push('/login')}
                testID="welcome-login"
              />
            </>
          ) : (
            <LipButton label="Next" onPress={() => goTo(index + 1)} testID="welcome-next" />
          )}
          <Dots count={SLIDES.length} active={index} />
        </View>
      }
    >
      <ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        style={styles.pager}
      >
        {SLIDES.map((slide) => (
          <View key={slide.title} style={[styles.slide, { width }]}>
            <Tally mood={slide.mood} size={200} accessibilityLabel="Tally, the PollWise mascot" />
            <Text accessibilityRole="header" style={styles.title}>
              {slide.title}
            </Text>
            <Text style={styles.body}>{slide.body}</Text>
          </View>
        ))}
      </ScrollView>
      <PrivacyNotice
        visible={notice}
        policyUrl={settings.data?.privacyPolicyUrl ?? null}
        onContinue={acceptNotice}
      />
    </Screen>
  );
}

function Dots({ count, active }) {
  return (
    <View style={styles.dots} accessibilityLabel={`Slide ${active + 1} of ${count}`}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[styles.dot, i === active && styles.dotActive]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pager: { flex: 1 },
  slide: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space['3xl'],
    gap: space['2xl'],
  },
  title: {
    fontFamily: fonts.black,
    fontSize: type.h1.size,
    lineHeight: type.h1.line,
    color: colors.ink900,
    textAlign: 'center',
  },
  body: {
    fontFamily: fonts.bold,
    fontSize: type.body.size,
    lineHeight: type.body.line,
    color: colors.ink600,
    textAlign: 'center',
  },
  footer: { gap: space.md, paddingHorizontal: space['2xl'] },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
  },
  dot: { width: 8, height: 8, borderRadius: radius.pill, backgroundColor: colors.line },
  dotActive: { width: 24, backgroundColor: colors.jade600 },
});
