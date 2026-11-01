import { useTransform, type MotionValue } from 'motion/react';

/** Piecewise-linear map of `value` from `input` stops to `output` stops, held at the ends. */
export function interpolate(value: number, input: number[], output: number[]): number {
  if (value <= input[0]) return output[0];
  for (let index = 1; index < input.length; index += 1) {
    if (value <= input[index]) {
      const span = input[index] - input[index - 1];
      const share = span ? (value - input[index - 1]) / span : 1;
      return output[index - 1] + (output[index] - output[index - 1]) * share;
    }
  }
  return output[output.length - 1];
}

/**
 * Like useTransform with ranges, but always computed here. motion hands an opacity driven straight by page scroll to the browser's
 * scroll timeline, and on that path it ignored our input range (the "Scroll to begin" hint was still half visible at mid-page).
 */
export function useRange(value: MotionValue<number>, input: number[], output: number[]) {
  return useTransform(value, current => interpolate(current, input, output));
}
