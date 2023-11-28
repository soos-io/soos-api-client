import StringUtilities from "./StringUtilities";

describe("PluralizeWord", () => {
  test("pluralizeWord should return the singular word for a count of 1", () => {
    expect(StringUtilities.pluralizeWord(1, "word")).toBe("word");
  });

  test("pluralizeWord should return the plural word for a count of 0", () => {
    expect(StringUtilities.pluralizeWord(0, "word")).toBe("words");
  });

  test("pluralizeWord should return the plural word for a count of null", () => {
    expect(StringUtilities.pluralizeWord(null, "word")).toBe("words");
  });

  test("pluralizeWord should return the plural word for a count of undefined", () => {
    expect(StringUtilities.pluralizeWord(undefined, "word")).toBe("words");
  });
});

describe("pluralizeTemplate", () => {
  test("pluralizeTemplate should return the singular word for a count of 1", () => {
    expect(StringUtilities.pluralizeTemplate(1, "word")).toBe("1 word");
  });

  test("pluralizeTemplate should return the plural word for a count of 0", () => {
    expect(StringUtilities.pluralizeTemplate(0, "word")).toBe("0 words");
  });

  test("pluralizeTemplate should return the singular word for a count of null", () => {
    expect(StringUtilities.pluralizeTemplate(null, "word")).toBe("0 words");
  });
});

describe("fromCamelToTitleCase", () => {
  test("fromCamelToTitleCase should return a title case string", () => {
    expect(StringUtilities.fromCamelToTitleCase("camelCase")).toBe("Camel Case");
  });

  test("fromCamelToTitleCase should return a title case string with multiple words", () => {
    expect(StringUtilities.fromCamelToTitleCase("camelCaseString")).toBe("Camel Case String");
  });
});

describe("areEqual", () => {
  test("areEqual should return true for equal strings", () => {
    expect(StringUtilities.areEqual("string", "string")).toBe(true);
  });

  test("areEqual should return false for unequal strings", () => {
    expect(StringUtilities.areEqual("string", "other")).toBe(false);
  });

  test("areEqual should return false for unequal strings with different cases", () => {
    expect(StringUtilities.areEqual("string", "STRING")).toBe(false);
  });

  test("areEqual should return true for equal strings with different cases when case is ignored", () => {
    expect(StringUtilities.areEqual("string", "STRING", { sensitivity: "base" })).toBe(true);
  });
});
