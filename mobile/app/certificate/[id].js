import { useState } from 'react';
import { Linking, Share, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Screen from '../../src/components/Screen.js';
import LipButton from '../../src/components/LipButton.js';
import Skeleton from '../../src/components/Skeleton.js';
import Card from '../../src/components/Card.js';
import { api } from '../../src/api/client.js';
import { API_BASE_URL, VERIFY_BASE_URL } from '../../src/lib/config.js';
import { toast } from '../../src/lib/toast.js';
import { certificateShareText, certificateDate } from '../../src/lib/certificates.js';
import { theme } from '../../src/theme/theme.js';

const { colors, fonts, type, space, radius } = theme;

/**
 * One certificate (DESIGN §6.9): the card, Download PDF, and Share. The PDF comes through a two-minute link from the
 * server, opened in the browser; sharing sends the public check link, not the PDF.
 */
export default function CertificateScreen() {
  const { id } = useLocalSearchParams();
  const [downloading, setDownloading] = useState(false);
  const list = useQuery({
    queryKey: ['me', 'certificates'],
    queryFn: () => api.request('/me/certificates'),
  });
  const cert = (list.data?.items ?? []).find((c) => c.id === id);

  const download = async () => {
    setDownloading(true);
    try {
      const link = await api.request(`/certificates/${id}/pdf-link`);
      await Linking.openURL(`${API_BASE_URL}${link.path}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDownloading(false);
    }
  };

  const share = async () => {
    try {
      await Share.share({ message: certificateShareText(cert, VERIFY_BASE_URL) });
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (list.isPending) {
    return (
      <Screen padded>
        <Skeleton height={320} />
      </Screen>
    );
  }
  if (!cert) {
    return (
      <Screen
        padded
        footer={
          <LipButton label="Back to progress" tone="secondary" onPress={() => router.back()} />
        }
      >
        <Text style={styles.body}>This certificate could not be found.</Text>
      </Screen>
    );
  }

  return (
    <Screen
      padded
      footer={
        <View style={styles.actions}>
          <LipButton
            label={downloading ? 'Opening…' : 'Download PDF'}
            onPress={download}
            disabled={downloading}
            testID="certificate-download"
          />
          <LipButton label="Share" tone="secondary" onPress={share} testID="certificate-share" />
        </View>
      }
    >
      <Card style={styles.card}>
        <Text style={styles.wordmark}>
          Poll<Text style={styles.wordmarkAccent}>Wise</Text>
        </Text>
        <Text style={styles.kicker}>Certificate of completion</Text>
        <Text accessibilityRole="header" style={styles.course}>
          {cert.courseTitle}
        </Text>
        <Text style={styles.name}>{cert.learnerName}</Text>
        <Text style={styles.body}>
          Issued {certificateDate(cert.issuedAt)} · Score {Math.round(cert.score)}%
        </Text>
        <Text style={styles.code} selectable>
          Code {cert.code}
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    gap: space.md,
    padding: space['2xl'],
    marginTop: space.lg,
    borderRadius: radius.xl,
  },
  wordmark: { fontFamily: fonts.black, fontSize: type.h2.size, color: colors.ink900 },
  wordmarkAccent: { color: colors.jade600 },
  kicker: {
    fontFamily: fonts.heavy,
    fontSize: type.label.size,
    letterSpacing: type.label.tracking,
    textTransform: 'uppercase',
    color: colors.amber700,
  },
  course: {
    fontFamily: fonts.black,
    fontSize: type.h1.size,
    lineHeight: type.h1.line,
    color: colors.ink900,
    textAlign: 'center',
  },
  name: {
    fontFamily: fonts.heavy,
    fontSize: type.h2.size,
    color: colors.jade700,
    textAlign: 'center',
  },
  body: {
    fontFamily: fonts.bold,
    fontSize: type.body.size,
    lineHeight: type.body.line,
    color: colors.ink600,
    textAlign: 'center',
  },
  code: {
    fontFamily: fonts.heavy,
    fontSize: type.small.size,
    color: colors.ink600,
    letterSpacing: 1,
  },
  actions: { gap: space.sm },
});
