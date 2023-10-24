export interface ICodedMessageModel {
  code: string;
  message: string;
  data: Record<string, string>;
  statusCode: number;
}
