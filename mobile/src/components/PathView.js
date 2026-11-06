import { useEffect, useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Tally from './Tally.js';
import PathNode from './PathNode.js';
import ModuleBanner from './ModuleBanner.js';
import { buildPath, ROW_HEIGHT } from '../lib/path.js';
import { theme } from '../theme/theme.js';

const { space, size } = theme;
/** Horizontal wiggle of the S-curve, in pixels from the centre line. */
const WIGGLE = [0, -72, 0, 72];

/**
 * The winding path (DESIGN §6.5): module banners, then lesson nodes in an S-curve, Tally beside the current node. On
 * open it scrolls the current node into view; when a module unlocks, it scrolls there and pops its first node.
 * @param {{
 *   outline: object,
 *   onNodePress: (row: object) => void,
 *   onLockedPress: (row: object) => void,
 *   unlockedModuleId?: string | null,
 *   continuing?: boolean,
 * }} props
 */
export default function PathView({
  outline,
  onNodePress,
  onLockedPress,
  unlockedModuleId,
  continuing,
}) {
  const { width } = useWindowDimensions();
  const scroll = useRef(null);
  const { rows, currentId, moduleStartIndex } = useMemo(() => buildPath(outline), [outline]);

  // Y offset of every row, so the scroll target is known without measuring.
  const offsets = useMemo(() => {
    let y = 0;
    return rows.map((row) => {
      const at = y;
      y += row.height + space.md;
      return at;
    });
  }, [rows]);

  const scrollTo = (rowIndex, animated = true) => {
    if (rowIndex < 0) return;
    scroll.current?.scrollTo({ y: Math.max(0, offsets[rowIndex] - 140), animated });
  };

  // Open on the current node.
  useEffect(() => {
    const index = rows.findIndex((r) => r.kind === 'node' && r.id === currentId);
    scrollTo(index, false);
  }, [currentId]);

  // An unlocked module: scroll to its first node. The pop itself is handled by PathNode via `pop`.
  useEffect(() => {
    if (!unlockedModuleId) return;
    const start = moduleStartIndex[unlockedModuleId];
    if (start !== undefined) scrollTo(start + 1);
  }, [unlockedModuleId]);

  let lessonPosition = 0;
  let nodeNumber = 0;

  return (
    <ScrollView
      ref={scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      accessibilityLabel="Your learning path"
    >
      {rows.map((row, i) => {
        if (row.kind === 'banner') {
          lessonPosition = 0;
          return (
            <View key={row.key} style={styles.bannerWrap}>
              <ModuleBanner
                index={row.index}
                total={row.total}
                title={row.title}
                done={row.done}
                steps={outline.modules.find((m) => m.id === row.moduleId)?.lessons?.length ?? 0}
                locked={row.locked}
              />
            </View>
          );
        }
        const position = row.check ? lessonPosition : (lessonPosition += 1);
        nodeNumber += 1;
        const offsetX = WIGGLE[nodeNumber % WIGGLE.length];
        const isCurrent = row.id === currentId;
        return (
          <View
            key={row.key}
            style={[styles.nodeRow, { height: ROW_HEIGHT, width: width - space['2xl'] * 2 }]}
          >
            <PathNode
              row={row}
              position={position}
              offsetX={offsetX}
              tooltip={isCurrent ? (continuing ? 'CONTINUE' : 'START') : undefined}
              pop={
                row.moduleId === unlockedModuleId && i === moduleFirstIndex(rows, row.moduleId)
                  ? 1
                  : 0
              }
              onPress={() => onNodePress(row)}
              onLocked={() => onLockedPress(row)}
            />
            {isCurrent ? (
              <View
                pointerEvents="none"
                style={[
                  styles.tally,
                  {
                    left: offsetX > 0 ? space.sm : undefined,
                    right: offsetX > 0 ? undefined : space.sm,
                    top: ROW_HEIGHT - size.touch - space.xs,
                  },
                ]}
              >
                <Tally mood="happy" size={64} accessibilityLabel="Tally, the PollWise mascot" />
              </View>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

/** The index of a module's first node row, so the unlock pop lands on the right node. */
function moduleFirstIndex(rows, moduleId) {
  return rows.findIndex((r) => r.kind === 'node' && r.moduleId === moduleId);
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space['2xl'],
    paddingTop: space.lg,
    paddingBottom: space['5xl'],
    gap: space.md,
  },
  bannerWrap: { marginTop: space.sm },
  nodeRow: { alignItems: 'center', justifyContent: 'center' },
  tally: { position: 'absolute', bottom: space.sm },
});
