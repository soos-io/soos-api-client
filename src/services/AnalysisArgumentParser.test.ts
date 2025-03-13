import { IntegrationName, IntegrationType, ScanType } from "../enums";
import AnalysisArgumentParser, { ICommonArguments } from "./AnalysisArgumentParser";

const getSut = () => {
  return AnalysisArgumentParser.create(
    IntegrationName.SoosCsa,
    IntegrationType.IDE,
    ScanType.CSA,
    "1.0.0-pre.1",
  );
};

describe("AnalysisArgumentParser", () => {
  test("Can create", () => {
    const argumentParser = getSut();
    expect(argumentParser).not.toBeNull();
  });

  test("Can parse args", () => {
    const argumentParser = getSut();

    argumentParser.addBaseScanArguments();

    const options = argumentParser.parseArguments<ICommonArguments>([
      "node",
      "soos-csa",
      "--clientId=123",
      "--apiKey",
      "xxxxxx",
    ]);

    expect(options).not.toBeNull();
    console.log(options);
    expect(options.clientId).not.toBeUndefined();
    expect(options.apiKey).not.toBeUndefined();
  });
});
