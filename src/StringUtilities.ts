const StringUtilities = {
  pluralizeWord: (
    count: number | null | undefined,
    singular: string,
    plural = `${singular}s`,
  ): string => {
    return count === 1 ? singular : plural;
  },
  pluralizeTemplate: (count: number | null, singular: string, plural = `${singular}s`): string => {
    const word = StringUtilities.pluralizeWord(count, singular, plural);
    return `${count ?? 0} ${word}`;
  },
  /**
   * @see https://stackoverflow.com/a/7225474
   */
  fromCamelToTitleCase: (str: string): string => {
    const words = str.split(/(?<=[a-z])(?=[A-Z])/g).map((word) => {
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    });
    return words.join(" ");
  },
  areEqual: (
    a: string,
    b: string,
    options?: { locales?: Array<string> } & Intl.CollatorOptions,
  ) => {
    return a.localeCompare(b, options?.locales, options) === 0;
  },
};

export default StringUtilities;
