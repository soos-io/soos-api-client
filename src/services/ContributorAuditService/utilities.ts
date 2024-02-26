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

const DataMappingUtilities = {
  mergeContributors(contributorsArray: any[][]): any[] {
    const flattenedContributors = contributorsArray.flat();

    const mergedContributors = new Map<string, any>();

    flattenedContributors.forEach((contributor) => {
      const existingContributor = mergedContributors.get(contributor.username);

      if (existingContributor) {
        contributor.repositories.forEach((repo: any) => {
          if (!existingContributor.repositories.find((r: any) => r.id === repo.id)) {
            existingContributor.repositories.push(repo);
          }
        });
      } else {
        mergedContributors.set(contributor.username, contributor);
      }
    });

    return Array.from(mergedContributors.values());
  },
};

export { ParamUtilities, DataMappingUtilities };
