import { View } from 'react-native';
import OptionTile from '../OptionTile.js';

/**
 * One answer out of several (DESIGN §6.8): stacked option tiles. Tapping a tile selects it. `reveal` (a result from the
 * server) marks the chosen tile right or wrong, but only once the learner has checked.
 * @param {{ options: { id: string, text: string }[], value: string | null, onChange: (id: string) => void, disabled?: boolean, shakeKey?: number, reveal?: { correct: boolean } | null }} props
 */
export default function SingleChoice({ options, value, onChange, disabled, shakeKey, reveal }) {
  return (
    <View>
      {options.map((option) => {
        const chosen = value === option.id;
        const state = chosen && reveal ? (reveal.correct ? 'correct' : 'wrong') : undefined;
        return (
          <OptionTile
            key={option.id}
            label={option.text}
            selected={chosen}
            state={state}
            disabled={disabled}
            shakeKey={state === 'wrong' ? shakeKey : 0}
            onPress={() => onChange(option.id)}
            testID={`option-${option.id}`}
          />
        );
      })}
    </View>
  );
}
