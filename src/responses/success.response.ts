import { BaseResponse } from "./base.response";

export class SuccessResponse extends BaseResponse {
  constructor(message: string, payload: any) {
    super({
      statusCode: 200,
      body: { message, data: payload },
    });
  }
}
