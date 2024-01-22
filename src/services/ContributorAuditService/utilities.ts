const ParamUtilities = {
  getAsString(params: Record<string, string | number>, key: string): string {
    const value = params[key];
    if (typeof value !== "string") {
      throw new Error(`Expected string for parameter '${key}', got ${typeof value}`);
    }
    return value;
  },
  getAsNumber(params: Record<string, string | number>, key: string): number {
    const value = params[key];
    if (typeof value !== "number") {
      throw new Error(`Expected number for parameter '${key}', got ${typeof value}`);
    }
    return value;
  },
};

export { ParamUtilities };
