/** One-way conversion, e.g. domain to HTTP response or event to outbox row. */
export interface Mapper<TSource, TTarget> {
  map(source: TSource): TTarget;
}
