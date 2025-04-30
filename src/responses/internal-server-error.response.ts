import { BaseResponse } from "./base.response";

export class InternalServerErrorResponse extends BaseResponse {
  constructor(message: string) {
    super({
      statusCode: 500,
      body: { error: message },
    });
  }
}
