import { useEffect, useRef } from 'react';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { theme } from '../theme/theme.js';

const { colors, radius, space } = theme;

/**
 * A bottom sheet (DESIGN §3: sheets rise with springGentle). Controlled by `visible`. Needs the
 * BottomSheetModalProvider in the root layout.
 * @param {{ visible: boolean, onClose: () => void, snapPoints?: (string | number)[], children: import('react').ReactNode }} props
 */
export default function AppSheet({ visible, onClose, snapPoints = ['50%'], children }) {
  const ref = useRef(null);

  useEffect(() => {
    if (visible) ref.current?.present();
    else ref.current?.dismiss();
  }, [visible]);

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={snapPoints}
      onDismiss={onClose}
      enablePanDownToClose
      backgroundStyle={{ backgroundColor: colors.surface, borderRadius: radius.xl }}
      handleIndicatorStyle={{ backgroundColor: colors.line, width: 44 }}
    >
      <BottomSheetView
        style={{ paddingHorizontal: space['2xl'], paddingBottom: space['3xl'], gap: space.lg }}
      >
        {children}
      </BottomSheetView>
    </BottomSheetModal>
  );
}
