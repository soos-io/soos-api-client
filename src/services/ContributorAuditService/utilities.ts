import {
  IContributorAuditRepositories,
  IContributorAuditRepository,
} from "../../api/SOOSHooksApiClient";

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
  updateContributors(
    acc: IContributorAuditRepositories[],
    repo: IContributorAuditRepository,
    username: string,
    commitDate: string,
  ): IContributorAuditRepositories[] {
    const existingContributor = acc.find((contributor) => contributor.username === username);

    if (!existingContributor) {
      acc.push({ username, repositories: [repo] });
    } else {
      const existingRepository = existingContributor.repositories.find((r) => r.id === repo.id);
      if (!existingRepository) {
        existingContributor.repositories.push(repo);
      } else if (new Date(existingRepository.lastCommit) < new Date(commitDate)) {
        existingRepository.lastCommit = commitDate;
      }
    }

    return acc;
  },
  mergeContributors(contributorsArray: IContributorAuditRepositories[][]): any[] {
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
