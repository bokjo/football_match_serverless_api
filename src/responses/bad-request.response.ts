import { BaseResponse } from "./base.response";

export class BadRequestResponse extends BaseResponse {
  constructor(message: string) {
    super({
      statusCode: 400,
      body: { error: message },
    });
  }
}
