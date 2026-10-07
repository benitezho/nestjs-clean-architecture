/** Two-way conversion between a domain object and its persistence representation. */
export interface DataMapper<TDomain, TPersistence> {
  toDomain(persistence: TPersistence): TDomain;
  toPersistence(domain: TDomain): TPersistence;
}
