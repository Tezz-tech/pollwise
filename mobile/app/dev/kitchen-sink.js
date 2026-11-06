/* global __DEV__ */
import { useState } from 'react';
import { Redirect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import Screen from '../../src/components/Screen.js';
import LipButton from '../../src/components/LipButton.js';
import OptionTile from '../../src/components/OptionTile.js';
import ProgressBar from '../../src/components/ProgressBar.js';
import Chip from '../../src/components/Chip.js';
import Card from '../../src/components/Card.js';
import Skeleton from '../../src/components/Skeleton.js';
import Confetti from '../../src/components/Confetti.js';
import CountUp from '../../src/components/CountUp.js';
import ProgressRing from '../../src/components/ProgressRing.js';
import Tally from '../../src/components/Tally.js';
import AppSheet from '../../src/components/AppSheet.js';
import Field from '../../src/components/Field.js';
import StrengthBar from '../../src/components/StrengthBar.js';
import { useToasts } from '../../src/stores/toastStore.js';
import { useCelebrations } from '../../src/stores/celebrationStore.js';
import { FlameIcon, LockIcon, ShieldIcon } from '../../src/components/icons.js';
import { theme } from '../../src/theme/theme.js';

const { colors, fonts, type, space } = theme;

/**
 * Every component in every state (DESIGN, Phase 7). Hidden in release builds: the route redirects there.
 */
export default function KitchenSink() {
  if (!__DEV__) return <Redirect href="/" />;
  return <Sink />;
}

function Sink() {
  const [picked, setPicked] = useState('a');
  const [multi, setMulti] = useState(['b']);
  const [progress, setProgress] = useState(0.4);
  const [shineKey, setShineKey] = useState(0);
  const [confettiKey, setConfettiKey] = useState(0);
  const [xp, setXp] = useState(20);
  const [sheet, setSheet] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [text, setText] = useState('');
  const [password, setPassword] = useState('');
  const showToast = useToasts((s) => s.show);
  const pushPopups = useCelebrations((s) => s.push);
  const tallyMoods = ['happy', 'cheer', 'thinking', 'wave'];

  return (
    <Screen scroll contentStyle={styles.page}>
      <Heading>Buttons</Heading>
      <Row>
        <LipButton label="Primary" onPress={() => {}} />
        <LipButton label="Secondary" tone="secondary" onPress={() => {}} />
      </Row>
      <Row>
        <LipButton label="Coral" tone="coral" onPress={() => {}} />
        <LipButton label="Amber" tone="amber" onPress={() => {}} />
      </Row>
      <Row>
        <LipButton label="Ghost" tone="ghost" onPress={() => {}} />
        <LipButton label="Disabled" disabled onPress={() => {}} />
      </Row>

      <Heading>Option tiles</Heading>
      <OptionTile label="Idle" onPress={() => setPicked('a')} />
      <OptionTile
        label="Selected (tap me)"
        selected={picked === 'a'}
        onPress={() => setPicked('a')}
      />
      <OptionTile label="Right answer" state="correct" selected />
      <OptionTile
        label="Wrong answer (shakes)"
        state="wrong"
        selected
        shakeKey={shakeKey}
        onPress={() => setShakeKey((k) => k + 1)}
      />
      <OptionTile label="Disabled" disabled />
      <OptionTile
        label="Multi choice (tap to toggle)"
        multi
        selected={multi.includes('x')}
        onPress={() =>
          setMulti((m) => (m.includes('x') ? m.filter((v) => v !== 'x') : [...m, 'x']))
        }
      />

      <Heading>Progress</Heading>
      <ProgressBar progress={progress} shineKey={shineKey} accessibilityLabel="Demo progress" />
      <Row>
        <LipButton
          label="Advance"
          tone="secondary"
          onPress={() => {
            setProgress((p) => Math.min(1, p + 0.2));
            setShineKey((k) => k + 1);
          }}
        />
        <LipButton label="Reset" tone="ghost" onPress={() => setProgress(0)} />
      </Row>
      <Row>
        <ProgressRing progress={progress} size={64}>
          <Text style={styles.small}>{Math.round(progress * 100)}%</Text>
        </ProgressRing>
        <ProgressRing progress={1} size={64} color={colors.amber500}>
          <FlameIcon size={24} />
        </ProgressRing>
        <CountUp value={xp} suffix=" XP" color={colors.amber700} />
      </Row>
      <Row>
        <LipButton label="+10 XP" tone="amber" onPress={() => setXp((v) => v + 10)} />
        <LipButton label="Confetti" tone="secondary" onPress={() => setConfettiKey((k) => k + 1)} />
      </Row>

      <Heading>Chips</Heading>
      <Row>
        <Chip label="12 days" tone="amber" icon={<FlameIcon size={14} />} />
        <Chip label="240 XP" tone="amber" />
        <Chip label="Tip" tone="sky" />
        <Chip label="For you" tone="jade" selected />
        <Chip label="All" tone="neutral" onPress={() => {}} />
        <Chip label="Locked" tone="neutral" icon={<LockIcon size={12} />} />
      </Row>

      <Heading>Cards and feedback</Heading>
      <Card>
        <Text style={styles.body}>A card with a border.</Text>
      </Card>
      <Card raised tint={colors.jade100}>
        <Text style={styles.body}>A raised card with a lip.</Text>
      </Card>
      <Skeleton height={20} />
      <Skeleton height={20} width="60%" />
      <Row>
        <LipButton
          label="Toast"
          tone="secondary"
          onPress={() => showToast('Saved to your account.', 'success')}
        />
        <LipButton
          label="Pop-up (streak)"
          tone="secondary"
          onPress={() => pushPopups([{ type: 'streak_extended', current: 4 }])}
        />
      </Row>
      <Row>
        <LipButton
          label="Milestone"
          tone="secondary"
          onPress={() => pushPopups([{ type: 'streak_milestone', current: 7 }])}
        />
        <LipButton
          label="Freeze"
          tone="secondary"
          onPress={() => pushPopups([{ type: 'streak_freeze_earned', freezes: 1 }])}
        />
      </Row>
      <Row>
        <LipButton
          label="Goal met"
          tone="secondary"
          onPress={() => pushPopups([{ type: 'daily_goal_met', xpToday: 10, goal: 10 }])}
        />
        <LipButton
          label="Course done"
          tone="secondary"
          onPress={() => pushPopups([{ type: 'course_completed' }])}
        />
      </Row>
      <LipButton label="Open a sheet" tone="secondary" onPress={() => setSheet(true)} />

      <Heading>Tally</Heading>
      <Row>
        {tallyMoods.map((mood) => (
          <View key={mood} style={styles.tallyCell}>
            <Tally mood={mood} size={96} accessibilityLabel={`Tally, ${mood}`} />
            <Text style={styles.small}>{mood}</Text>
          </View>
        ))}
      </Row>

      <Heading>Form fields</Heading>
      <Field
        label="Full name"
        value={text}
        onChangeText={setText}
        error={text.length > 0 && text.length < 3 ? 'At least three letters.' : null}
      />
      <Field
        label="Phone number"
        prefix="+234"
        value=""
        onChangeText={() => {}}
        hint="Nigerian mobile, like 0803 000 0000."
      />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />
      <StrengthBar
        score={password.length >= 14 ? 4 : password.length >= 10 ? 2 : 0}
        label={password.length >= 10 ? 'Fair' : 'Too short'}
      />

      <Heading>Icons</Heading>
      <Row>
        <ShieldIcon size={32} color={colors.freeze} />
        <FlameIcon size={32} />
        <LockIcon size={32} />
      </Row>

      <Confetti runKey={confettiKey} />
      <AppSheet visible={sheet} onClose={() => setSheet(false)} snapPoints={['40%']}>
        <BottomSheetView>
          <Text style={styles.body}>A bottom sheet, the way popovers and details open.</Text>
        </BottomSheetView>
      </AppSheet>
    </Screen>
  );
}

function Heading({ children }) {
  return (
    <Text accessibilityRole="header" style={styles.heading}>
      {children}
    </Text>
  );
}

function Row({ children }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  page: { gap: space.md, paddingBottom: space['5xl'] },
  heading: {
    fontFamily: fonts.black,
    fontSize: type.h2.size,
    color: colors.ink900,
    marginTop: space.lg,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, alignItems: 'center' },
  body: {
    fontFamily: fonts.bold,
    fontSize: type.body.size,
    lineHeight: type.body.line,
    color: colors.ink900,
  },
  small: { fontFamily: fonts.bold, fontSize: type.small.size, color: colors.ink600 },
  tallyCell: { alignItems: 'center', gap: space.xs },
});
