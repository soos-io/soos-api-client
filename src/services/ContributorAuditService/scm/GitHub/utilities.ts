import { IContributorAuditRepositories } from "../../../../api/SOOSHooksApiClient";

const mergeContributors = (
  contributorsArray: IContributorAuditRepositories[][],
): IContributorAuditRepositories[] => {
  const flattenedContributors = contributorsArray.flat();

  const mergedContributors = new Map<string, IContributorAuditRepositories>();

  flattenedContributors.forEach((contributor) => {
    const existingContributor = mergedContributors.get(contributor.username);

    if (existingContributor) {
      contributor.repositories.forEach((repo) => {
        if (!existingContributor.repositories.find((r) => r.id === repo.id)) {
          existingContributor.repositories.push(repo);
        }
      });
    } else {
      mergedContributors.set(contributor.username, contributor);
    }
  });

  return Array.from(mergedContributors.values());
};

export { mergeContributors };
