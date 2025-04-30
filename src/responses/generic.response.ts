import { BaseResponse, IBaseResponseArgs } from "./base.response";

export class GenericResponse extends BaseResponse {
  constructor(args: IBaseResponseArgs) {
    super(args);
  }
}
