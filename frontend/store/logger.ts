import type { StateCreator, StoreMutatorIdentifier } from "zustand";

export function logger<
  T,
  Mis extends [StoreMutatorIdentifier, unknown][] = [],
  Mos extends [StoreMutatorIdentifier, unknown][] = []
>(
  config: StateCreator<T, Mis, Mos>,
  name: string
): StateCreator<T, Mis, Mos> {
  return config;
}
