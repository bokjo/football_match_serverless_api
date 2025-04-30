export interface IBaseResponseArgs {
  statusCode: number;
  headers?: { [key: string]: string };
  body?: any; // TODO: make it success or error response type
}

export class BaseResponse {
  statusCode: number;
  headers: { [key: string]: string };
  body: string;
  constructor(args: IBaseResponseArgs) {
    const { statusCode, headers, body } = args;
    this.statusCode = args.statusCode;
    this.headers = args.headers || { "Content-Type": "application/json" };
    this.body = JSON.stringify(args.body);
  }
}
