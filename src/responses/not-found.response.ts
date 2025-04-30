import { BaseResponse } from "./base.response";

export class NotFoundResponse extends BaseResponse {
  constructor(message: string) {
    super({
      statusCode: 404,
      body: { error: message },
    });
  }
}
