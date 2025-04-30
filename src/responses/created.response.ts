import { BaseResponse } from "./base.response";

export class CreatedResponse extends BaseResponse {
  constructor(message: string, payload: any) {
    super({
      statusCode: 201,
      body: { message, data: payload },
    });
  }
}
