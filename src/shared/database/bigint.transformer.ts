import type { ValueTransformer } from 'typeorm';

/** pg returns bigint as string; amounts are guaranteed safe integers by Money. */
export const bigintTransformer: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) => (value === null || value === undefined ? value : Number(value)),
};
