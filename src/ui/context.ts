import type { Actions } from '../actions';
import type { Store } from '../store';

export type Ctx = {
  store: Store;
  actions: Actions;
  /** Kører fn og viser fejl pænt. Returnerer undefined hvis fn fejlede. */
  guard: <T>(fn: () => Promise<T>) => Promise<T | undefined>;
  today: () => string;
  signOut: () => void;
};
