const isNil = (value: unknown): value is null | undefined => value === null || value === undefined;

const ensureValue = <T>(value: T | null | undefined, propertyName: string): T => {
  if (isNil(value)) throw new Error(`'${propertyName}' is required.`);
  return value;
};

export { isNil, ensureValue };
